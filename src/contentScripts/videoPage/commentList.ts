/**
 * 视频页「自绘评论区」阶段 3（第 80 轮，只读渲染）。
 *
 * 数据：B 站评论 API（`/x/v2/reply` pn 分页；子回复 `/x/v2/reply/reply`）。
 * 真机实测（未登录）：`?type=1&oid=<aid>&pn=1&ps=5&sort=2` → code 0；子回复接口同样 code 0。
 * **不用 wbi 签名**（`/wbi/main` 会 -403）。
 *
 * 渲染：`#bewly-comment-list` 插进评论列（`#commentapp` 之前），原生 `#commentapp` 隐藏但保留（兜底）。
 * 容器 `flex: 1 1 auto; min-height: 0; overflow-y: auto` —— 评论列高度仍 = dock 高，fixedLayout 预算不变。
 *
 * 兜底：拿不到 aid / API 失败 / 非 0 → **恢复原生评论区**，绝不白屏。
 * 本轮只读：点赞 / 回复 / 发表留 `data-rpid` / `data-action` 属性给下一轮。
 */
const LIST_ID = 'bewly-comment-list'
const COLUMN_SELECTOR = '[data-bewly-comment-column], #bewly-comment-column'
const NATIVE_APP_SELECTOR = '#commentapp'
const PAGE_SIZE = 20

interface CommentItem {
  rpid: number | string
  mid: string
  uname: string
  face: string
  level: number
  message: string
  emote: Record<string, string>
  ctime: number
  like: number
  rcount: number
  location: string
  isUp: boolean
  isTop: boolean
  pictures: string[]
}

interface CommentState {
  aid: number | null
  bvid: string
  ownerMid: string
  sort: 2 | 0
  onlyUp: boolean
  page: number
  items: CommentItem[]
  hasMore: boolean
  loading: boolean
  failed: boolean
  subpage: { root: CommentItem, items: CommentItem[] } | null
}

const state: CommentState = {
  aid: null,
  bvid: '',
  ownerMid: '',
  sort: 2,
  onlyUp: false,
  page: 0,
  items: [],
  hasMore: false,
  loading: false,
  failed: false,
  subpage: null,
}

let bridgeListening = false
let listMounted = false
/** aid 查询的兜底缓存（bvid → aid） */
const aidCache = new Map<string, number>()

function currentBvid(): string {
  return location.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/)?.[1] ?? ''
}

function onBridgeData(event: Event): void {
  const detail = (event as CustomEvent).detail as { bvid?: string, aid?: number, owner?: { mid?: string | number } } | null
  if (!detail)
    return
  let changed = false
  if (typeof detail.aid === 'number' && detail.aid > 0 && detail.aid !== state.aid) {
    state.aid = detail.aid
    changed = true
  }
  if (detail.owner && detail.owner.mid !== undefined) {
    const mid = String(detail.owner.mid)
    if (mid && mid !== state.ownerMid) {
      state.ownerMid = mid
      changed = true
    }
  }
  if (detail.bvid && detail.bvid !== state.bvid) {
    changed = true
  }
  if (changed)
    reloadComments()
}

function startBridge(): void {
  if (bridgeListening)
    return
  window.addEventListener('bewly-video-data', onBridgeData)
  bridgeListening = true
  window.dispatchEvent(new CustomEvent('bewly-video-data-request'))
}

function stopBridge(): void {
  if (!bridgeListening)
    return
  window.removeEventListener('bewly-video-data', onBridgeData)
  bridgeListening = false
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { credentials: 'include' })
    if (!response.ok)
      return null
    return await response.json() as T
  }
  catch {
    return null
  }
}

/** 兜底拿 aid：桥没给时用 view 接口按 bvid 查一次并缓存 */
async function resolveAid(): Promise<number | null> {
  if (state.aid)
    return state.aid
  const bvid = currentBvid()
  if (!bvid)
    return null
  if (aidCache.has(bvid)) {
    state.aid = aidCache.get(bvid) ?? null
    return state.aid
  }
  const data = await fetchJson<{ code: number, data?: { aid?: number } }>(
    `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`,
  )
  if (data?.code === 0 && typeof data.data?.aid === 'number') {
    aidCache.set(bvid, data.data.aid)
    state.aid = data.data.aid
    return state.aid
  }
  return null
}

function normalizeReply(raw: Record<string, any>): CommentItem {
  const member = raw.member ?? {}
  const content = raw.content ?? {}
  const control = raw.reply_control ?? {}
  const emote: Record<string, string> = {}
  if (content.emote && typeof content.emote === 'object') {
    for (const [key, value] of Object.entries(content.emote)) {
      const url = (value as { url?: string })?.url
      if (url)
        emote[key] = url
    }
  }
  const pictures: string[] = Array.isArray(content.pictures)
    ? content.pictures.map((pic: { img_src?: string }) => pic.img_src).filter((src: unknown): src is string => typeof src === 'string')
    : []
  const mid = String(member.mid ?? raw.mid ?? '')
  return {
    rpid: raw.rpid,
    mid,
    uname: member.uname ?? '',
    face: member.face ?? '',
    level: member.level_info?.current ?? 0,
    message: content.message ?? '',
    emote,
    ctime: raw.ctime ?? 0,
    like: raw.like ?? 0,
    rcount: raw.rcount ?? 0,
    location: control.location ?? '',
    isUp: Boolean(mid && state.ownerMid && mid === state.ownerMid) || Boolean(control.is_up_top),
    isTop: Boolean(control.is_up_top ?? raw.top),
    pictures,
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 正文：转义 → 表情替换 → @ 高亮 */
function renderMessage(item: CommentItem): string {
  let html = escapeHtml(item.message)
  for (const [key, url] of Object.entries(item.emote)) {
    const safeKey = escapeHtml(key)
    const token = `<img class="bvp-cmt__emote" src="${escapeHtml(url)}" alt="${safeKey}" loading="lazy" referrerpolicy="no-referrer">`
    html = html.split(safeKey).join(token)
  }
  html = html.replace(/@([\w\u4E00-\u9FA5.-]{1,20})/g, '<span class="bvp-cmt__at">@$1</span>')
  return html.replace(/\n/g, '<br>')
}

function formatTime(ctime: number): string {
  if (!ctime)
    return ''
  const date = new Date(ctime * 1000)
  const now = Date.now()
  const diff = Math.floor((now - date.getTime()) / 1000)
  if (diff < 60)
    return '刚刚'
  if (diff < 3600)
    return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400)
    return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 86400 * 30)
    return `${Math.floor(diff / 86400)} 天前`
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatCountShort(value: number): string {
  if (!Number.isFinite(value) || value <= 0)
    return ''
  if (value >= 1e4)
    return `${(value / 1e4).toFixed(1)}万`
  return String(value)
}

function itemHtml(item: CommentItem, depth: number): string {
  const avatar = item.face
    ? `<img class="bvp-cmt__avatar-img" src="${escapeHtml(item.face)}" alt="${escapeHtml(item.uname)}" loading="lazy" referrerpolicy="no-referrer">`
    : escapeHtml(item.uname.slice(0, 1))
  const upBadge = item.isUp ? '<span class="bvp-cmt__badge bvp-cmt__badge--up">UP</span>' : ''
  const topBadge = item.isTop ? '<span class="bvp-cmt__badge">置顶</span>' : ''
  const pictures = item.pictures.length
    ? `<div class="bvp-cmt__pictures">${item.pictures.map(src => `<a class="bvp-cmt__picture" href="${escapeHtml(src)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(src)}" loading="lazy" referrerpolicy="no-referrer"></a>`).join('')}</div>`
    : ''
  const subReplies = depth === 0 && item.rcount > 0
    ? `<button type="button" class="bvp-cmt__more" data-action="open-subpage" data-rpid="${item.rpid}">共 ${item.rcount} 条回复</button>`
    : ''
  return `<article class="bvp-cmt${depth > 0
    ? ' bvp-cmt--sub'
    : ''}" data-rpid="${item.rpid}" data-mid="${escapeHtml(item.mid)}">
    <div class="bvp-cmt__avatar">${avatar}</div>
    <div class="bvp-cmt__main">
      <div class="bvp-cmt__head">
        <span class="bvp-cmt__name">${escapeHtml(item.uname)}</span>
        ${item.level
          ? `<span class="bvp-cmt__level">Lv${item.level}</span>`
          : ''}
        ${upBadge}${topBadge}
      </div>
      <div class="bvp-cmt__text">${renderMessage(item)}</div>
      ${pictures}
      <div class="bvp-cmt__meta">
        <span class="bvp-cmt__time">${formatTime(item.ctime)}</span>
        ${item.location
          ? `<span class="bvp-cmt__location">${escapeHtml(item.location)}</span>`
          : ''}
        <span class="bvp-cmt__spacer"></span>
        <button type="button" class="bvp-cmt__action" data-action="like" data-rpid="${item.rpid}">赞 ${formatCountShort(item.like)}</button>
        <button type="button" class="bvp-cmt__action" data-action="reply" data-rpid="${item.rpid}">回复</button>
      </div>
      ${subReplies}
    </div>
  </article>`
}

function panelChrome(): string {
  return `<div class="bvp-cmt__toolbar">
    <div class="bvp-cmt__sort">
      <button type="button" class="bvp-cmt__tab${state.sort === 2
        ? ' is-active'
        : ''}" data-action="sort-hot">最热</button>
      <button type="button" class="bvp-cmt__tab${state.sort === 0
        ? ' is-active'
        : ''}" data-action="sort-new">最新</button>
    </div>
    <button type="button" class="bvp-cmt__tab${state.onlyUp ? ' is-active' : ''}" data-action="toggle-up">只看 UP 主</button>
  </div>
  <div class="bvp-cmt__list" id="bewly-comment-items"></div>
  <div class="bvp-cmt__footer" id="bewly-comment-footer"></div>`
}

function renderList(): void {
  const container = document.getElementById(LIST_ID)
  if (!container)
    return
  const subpage = state.subpage
  if (subpage) {
    const subItems = subpage.items.length
      ? subpage.items.map(item => itemHtml(item, 1)).join('')
      : '<div class="bvp-cmt__empty">暂无回复</div>'
    container.innerHTML = `<div class="bvp-cmt__subpage-head">
        <button type="button" class="bvp-cmt__tab" data-action="close-subpage">← 返回评论列表</button>
      </div>
      <div class="bvp-cmt__list">${itemHtml(subpage.root, 0)}${subItems}</div>`
    return
  }
  const visible = state.onlyUp
    ? state.items.filter(item => item.isUp)
    : state.items
  const itemsHtml = visible.length
    ? visible.map(item => itemHtml(item, 0)).join('')
    : `<div class="bvp-cmt__empty">${state.loading
      ? '加载中…'
      : (state.onlyUp ? '这个视频暂时还没有 UP 主的评论' : '还没有评论')}</div>`
  container.innerHTML = panelChrome()
  document.getElementById('bewly-comment-items')!.innerHTML = itemsHtml
  const footer = document.getElementById('bewly-comment-footer')
  if (footer) {
    if (state.loading)
      footer.innerHTML = '<div class="bvp-cmt__loading">加载中…</div>'
    else if (state.hasMore)
      footer.innerHTML = '<button type="button" class="bvp-cmt__load-more" data-action="load-more">加载更多</button>'
    else if (visible.length)
      footer.innerHTML = '<div class="bvp-cmt__end">没有更多了</div>'
    else
      footer.innerHTML = ''
  }
  bindContainerActions(container)
}

function bindContainerActions(container: HTMLElement): void {
  if (container.dataset.bound === '1')
    return
  container.dataset.bound = '1'
  container.addEventListener('click', async (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')
    if (!target)
      return
    const action = target.dataset.action
    if (action === 'sort-hot' || action === 'sort-new') {
      const next = action === 'sort-hot'
        ? 2
        : 0
      if (state.sort === next)
        return
      state.sort = next
      await reloadComments()
      return
    }
    if (action === 'toggle-up') {
      state.onlyUp = !state.onlyUp
      renderList()
      return
    }
    if (action === 'load-more') {
      await loadPage(state.page + 1)
      return
    }
    const rpid = target.dataset.rpid
    if (action === 'open-subpage' && rpid)
      await openSubpage(rpid)
    else if (action === 'close-subpage')
      closeSubpage()
    // like / reply：下一轮接
  })
}

async function fetchMainPage(page: number): Promise<boolean> {
  const aid = await resolveAid()
  if (!aid)
    return false
  const data = await fetchJson<{ code: number, data?: { replies?: Record<string, any>[], top_replies?: Record<string, any>[], page?: { count?: number } } }>(
    `https://api.bilibili.com/x/v2/reply?type=1&oid=${aid}&pn=${page}&ps=${PAGE_SIZE}&sort=${state.sort}`,
  )
  if (!data || data.code !== 0 || !data.data)
    return false
  const list = [
    ...(data.data.top_replies ?? []),
    ...(data.data.replies ?? []),
  ]
  const seen = new Set<string>()
  const items: CommentItem[] = []
  for (const raw of list) {
    const item = normalizeReply(raw)
    if (seen.has(String(item.rpid)))
      continue
    seen.add(String(item.rpid))
    items.push(item)
  }
  if (page === 1) {
    state.items = items
  }
  else {
    state.items = [
      ...state.items,
      ...items.filter(item => !state.items.some(existing => String(existing.rpid) === String(item.rpid))),
    ]
  }
  state.page = page
  const total = data.data.page?.count ?? 0
  state.hasMore = items.length >= PAGE_SIZE && state.items.length < total
  return true
}

async function loadPage(page: number): Promise<void> {
  if (state.loading)
    return
  state.loading = true
  renderList()
  const ok = await fetchMainPage(page)
  state.loading = false
  if (!ok) {
    state.failed = true
    if (!state.items.length)
      restoreNative()
    else
      renderList()
    return
  }
  state.failed = false
  renderList()
}

async function reloadComments(): Promise<void> {
  state.page = 0
  state.items = []
  state.hasMore = false
  state.subpage = null
  state.failed = false
  await loadPage(1)
}

async function openSubpage(rpid: string): Promise<void> {
  const aid = await resolveAid()
  const root = state.items.find(item => String(item.rpid) === String(rpid))
  if (!aid || !root)
    return
  const data = await fetchJson<{ code: number, data?: { replies?: Record<string, any>[] } }>(
    `https://api.bilibili.com/x/v2/reply/reply?type=1&oid=${aid}&root=${rpid}&pn=1&ps=20`,
  )
  const items = data?.code === 0 && data.data?.replies
    ? data.data.replies.map(normalizeReply)
    : []
  state.subpage = { root, items }
  renderList()
}

function closeSubpage(): void {
  state.subpage = null
  renderList()
}

/** 挂载自绘容器并隐藏原生评论区（失败时 restoreNative） */
function mountList(column: HTMLElement, nativeApp: HTMLElement): void {
  let container = document.getElementById(LIST_ID)
  if (!container) {
    container = document.createElement('div')
    container.id = LIST_ID
    column.insertBefore(container, nativeApp)
  }
  nativeApp.style.setProperty('display', 'none', 'important')
  listMounted = true
}

function restoreNative(): void {
  document.getElementById(LIST_ID)?.remove()
  const nativeApp = document.querySelector<HTMLElement>(NATIVE_APP_SELECTOR)
  nativeApp?.style.removeProperty('display')
  listMounted = false
}

/** 首屏 / 切视频时调用；返回 false 表示本次未启用自绘 */
export function syncCommentList(): boolean {
  const bvid = currentBvid()
  if (!bvid)
    return false
  if (bvid !== state.bvid) {
    state.bvid = bvid
    state.aid = null
    state.items = []
    state.page = 0
    state.subpage = null
    state.failed = false
  }
  const column = document.querySelector<HTMLElement>(COLUMN_SELECTOR)
  const nativeApp = document.querySelector<HTMLElement>(NATIVE_APP_SELECTOR)
  if (!column || !nativeApp)
    return false
  if (!listMounted) {
    mountList(column, nativeApp)
    void loadPage(1)
  }
  return true
}

export function setupCommentList(): () => void {
  startBridge()
  const enabled = syncCommentList()
  if (!enabled)
    restoreNative()
  return teardownCommentList
}

/** 卸载：移除自绘列表、恢复原生评论区 */
export function teardownCommentList(): void {
  stopBridge()
  restoreNative()
  state.aid = null
  state.bvid = ''
  state.ownerMid = ''
  state.items = []
  state.page = 0
  state.subpage = null
  state.failed = false
}
