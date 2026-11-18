import { clearGridMarks, collectVideoCards, findSpaceHeader, findVideoListContainer, readSpaceProfile } from './dom'
/**
 * 空间页头部信息卡自绘（第 92 轮）。
 *
 * 目标：UP 主个人空间页的「头部信息卡」由我们渲染，原生头部在接管成功后隐藏；
 * 视频网格由页面级 CSS 重排（见 userSpacePage.scss 第 92 轮段）；
 * 加载更多自绘一个按钮，点击滚动到底部触发 B 站原生懒加载（不依赖 wbi 签名 API）。
 *
 * 安全策略（无法真机验证）：
 * - `readSpaceProfile()` 拿不到昵称就**完全不接管**（不插卡、不隐藏原生、不打网格标记）；
 * - 关注按钮直接 `click()` 原生按钮，保留 B 站自己的关注弹层与校验；
 * - SPA 切 tab 时若信息变化自动重绘，失败则回退原生。
 */
import { getMessages } from './i18n'

/** 自绘卡片节点 id（卸载时按 id 清理） */
const PROFILE_ID = 'bewly-space-profile'
/** 加载更多按钮 id */
const LOAD_MORE_ID = 'bewly-space-load-more'
/** <html> 上的接管标记：CSS 只在有它时隐藏原生头部 */
const READY_ATTR = 'data-bewly-space-profile'
/** 加载更多点击后等待原生列表增长的时长（ms） */
const LOAD_MORE_WAIT = 1500
/** SPA 重绘检查间隔（ms） */
const REFRESH_INTERVAL = 1200
/** 等卡片出现的轮询间隔（ms，真机实测首屏 0 张，滚动后才懒加载） */
const CARD_POLL_INTERVAL = 250
/** 等卡片出现的总时长上限（ms） */
const CARD_POLL_TIMEOUT = 15000

let refreshTimer: number | null = null
let loadMoreTimer: number | null = null
let cardPollTimer: number | null = null
let cardPollDeadline = 0

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (text)
    node.textContent = text
  return node
}

/** 头像：加载失败时用昵称首字兜底，避免破图 */
function renderAvatar(name: string, avatar: string): HTMLElement {
  const wrap = el('div', 'bsp-profile__avatar')
  if (avatar) {
    const img = document.createElement('img')
    img.src = avatar
    img.alt = ''
    img.loading = 'lazy'
    img.addEventListener('error', () => {
      img.remove()
      wrap.appendChild(el('span', 'bsp-profile__avatar-fallback', name.slice(0, 1)))
    }, { once: true })
    wrap.appendChild(img)
  }
  else {
    wrap.appendChild(el('span', 'bsp-profile__avatar-fallback', name.slice(0, 1)))
  }
  return wrap
}

/** 统计项（数量 + 名称）；数量为空时不渲染 */
function renderStat(value: string, label: string): HTMLElement | null {
  if (!value)
    return null
  const item = el('span', 'bsp-profile__stat')
  item.appendChild(el('strong', 'bsp-profile__stat-value', value))
  item.appendChild(el('span', 'bsp-profile__stat-label', label))
  return item
}

/** 渲染整张头部信息卡 */
function renderProfileCard(followButton: HTMLElement | null): HTMLElement | null {
  const profile = readSpaceProfile()
  if (!profile)
    return null

  const t = getMessages()
  const card = el('section', 'bsp-profile')
  card.id = PROFILE_ID

  // 左：头像；右：昵称与信息
  const main = el('div', 'bsp-profile__main')
  main.appendChild(renderAvatar(profile.name, profile.avatar))

  const info = el('div', 'bsp-profile__info')
  const nameRow = el('div', 'bsp-profile__name-row')
  nameRow.appendChild(el('h1', 'bsp-profile__name', profile.name))
  if (profile.level)
    nameRow.appendChild(el('span', 'bsp-profile__level', profile.level))
  if (profile.verified)
    nameRow.appendChild(el('span', 'bsp-profile__verified', t.profileVerified))
  info.appendChild(nameRow)

  if (profile.signature) {
    const desc = el('p', 'bsp-profile__signature', profile.signature)
    desc.title = profile.signature
    info.appendChild(desc)
  }

  const stats = el('div', 'bsp-profile__stats')
  const followers = renderStat(profile.followers, t.profileFollowers)
  const following = renderStat(profile.following, t.profileFollowing)
  if (followers)
    stats.appendChild(followers)
  if (following)
    stats.appendChild(following)
  if (stats.childElementCount)
    info.appendChild(stats)
  main.appendChild(info)

  // 右：关注按钮（转发给原生按钮，保留 B 站自己的关注弹层）
  if (followButton) {
    const action = el('button', 'bsp-profile__follow', t.profileFollow)
    action.type = 'button'
    action.addEventListener('click', (event) => {
      event.preventDefault()
      followButton.click()
    })
    main.appendChild(action)
  }

  card.appendChild(main)
  return card
}

/** 移除自绘卡片与所有标记 */
function removeProfileCard(): void {
  document.getElementById(PROFILE_ID)?.remove()
  document.documentElement.removeAttribute(READY_ATTR)
}

/** 加载更多按钮：点击滚到底触发原生懒加载，1.5s 内高度没变化则提示已全部加载 */
function ensureLoadMore(grid: HTMLElement | null): void {
  document.getElementById(LOAD_MORE_ID)?.remove()
  if (!grid)
    return

  const t = getMessages()
  const button = el('button', 'bsp-load-more', t.loadMore)
  button.id = LOAD_MORE_ID
  button.type = 'button'
  button.addEventListener('click', () => {
    if (loadMoreTimer !== null)
      return
    const before = document.documentElement.scrollHeight
    button.disabled = true
    button.textContent = t.loadMoreBusy
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
    loadMoreTimer = window.setTimeout(() => {
      loadMoreTimer = null
      const grown = document.documentElement.scrollHeight > before
      wrapLoadMore(button, grown)
    }, LOAD_MORE_WAIT)
  })

  grid.parentElement?.insertBefore(button, grid.nextSibling)
}

function wrapLoadMore(button: HTMLButtonElement, grown: boolean): void {
  if (grown) {
    button.disabled = false
    button.textContent = getMessages().loadMore
    return
  }
  // 没有新内容：保留按钮但标记完成态（B 站「没有更多」时再点也不会有反应）
  const done = getMessages().loadMoreDone
  button.textContent = done
  button.disabled = true
}

/** 尝试接管：成功返回 true（已插卡 + 打标记），失败返回 false（完全回退原生） */
function tryTakeover(): boolean {
  const header = findSpaceHeader()
  if (!header)
    return false

  const existing = document.getElementById(PROFILE_ID)
  const card = renderProfileCard(document.querySelector<HTMLElement>('.header .default-btn, .header [class*="follow"] button'))
  if (!card)
    return false

  // 卡片插在原生头部之后（原生头部被 CSS 隐藏，卡片占据它的位置）
  if (existing) {
    existing.replaceWith(card)
  }
  else {
    header.insertAdjacentElement('afterend', card)
  }

  document.documentElement.setAttribute(READY_ATTR, 'ready')

  // 视频网格：给共同父容器打标记，页面级 CSS 做 grid
  clearGridMarks()
  // 第 99 轮：不再网格化列表，只把「加载更多」挂在视频主列表之后
  const listContainer = findVideoListContainer()
  ensureLoadMore(listContainer)
  return true
}

function refresh(): void {
  if (!tryTakeover()) {
    removeProfileCard()
    clearGridMarks()
    document.getElementById(LOAD_MORE_ID)?.remove()
    return
  }
  // 卡片已就绪后只需要维护「加载更多」按钮（第 99 轮起不再网格化列表）
  if (!document.getElementById(LOAD_MORE_ID))
    ensureLoadMore(findVideoListContainer())
}

/**
 * 等视频卡出现（真机实测：空间页首屏卡片数为 0，滚动到约 y=800 后才懒加载）。
 *
 * 250ms 轮询最多 15s：一旦检测到卡片就打网格标记 + 插「加载更多」按钮，然后停表。
 * 之后由 1200ms 心跳继续维护（切 tab / 重新懒加载都能接上）。
 */
function startCardPolling(): void {
  if (cardPollTimer !== null)
    return
  cardPollDeadline = Date.now() + CARD_POLL_TIMEOUT

  const tick = () => {
    cardPollTimer = null
    const cards = collectVideoCards()
    if (cards.length >= 6) {
      const listContainer = findVideoListContainer()
      ensureLoadMore(listContainer)
      return
    }
    if (Date.now() >= cardPollDeadline)
      return
    cardPollTimer = window.setTimeout(tick, CARD_POLL_INTERVAL)
  }

  cardPollTimer = window.setTimeout(tick, CARD_POLL_INTERVAL)
}

/** 停止卡片轮询 */
function stopCardPolling(): void {
  if (cardPollTimer !== null) {
    window.clearTimeout(cardPollTimer)
    cardPollTimer = null
  }
}

function startWatching(): void {
  if (refreshTimer !== null)
    return
  refreshTimer = window.setInterval(refresh, REFRESH_INTERVAL)
}

/** 启动空间页自绘（幂等；失败时页面保持原生外观） */
export function mountProfileCard(): void {
  refresh()
  // 首屏卡片可能是 0：轮询等懒加载（失败也不影响卡片本身的接管）
  startCardPolling()
  startWatching()
}

/** 卸载：移除卡片 / 标记 / 定时器，原生头部恢复 */
export function unmountProfileCard(): void {
  if (refreshTimer !== null) {
    window.clearInterval(refreshTimer)
    refreshTimer = null
  }
  if (loadMoreTimer !== null) {
    window.clearTimeout(loadMoreTimer)
    loadMoreTimer = null
  }
  stopCardPolling()
  removeProfileCard()
  clearGridMarks()
  document.getElementById(LOAD_MORE_ID)?.remove()
}
