/**
 * 视频页「自绘工具栏」阶段 3（第 80 轮）。
 *
 * 视觉自绘 6 个按钮（点赞 / 投币 / 收藏 / 分享 / 举报 / 笔记），
 * **点击转发原生按钮**（同 UP 卡关注的做法，避开 CSRF 与风控）。
 * 数字用 page-world 桥的 `stat` 精确值格式化；状态（已赞/已投币/已收藏）从原生按钮 class 读。
 *
 * 位置：`#bewly-toolbar` 插进 `#arc_toolbar_report` 内部（容器高度仍由
 * `--bvp-toolbar-h` 固定 52，fixedLayout 的 `measureDockBlocks()` 量到的仍是同一个左列子元素）。
 * 原生 `.video-toolbar-left` / `.video-toolbar-right` 隐藏但保留（可程序化 click）。
 */

import { showToast } from './actions'

const TOOLBAR_ID = 'bewly-toolbar'
const TOOLBAR_HOST_SELECTOR = '#arc_toolbar_report'

interface StatData {
  view?: number
  danmaku?: number
  like?: number
  coin?: number
  favorite?: number
  share?: number
  reply?: number
}

let bridgedStat: StatData | null = null
let bridgedBvid = ''
let bridgedAid: number | null = null
let bridgeListening = false
let lastSignature = ''

/** 已登录用户的互动状态（点赞 / 投币 / 收藏），来自接口而不是原生 class */
interface RelationState {
  liked: boolean
  coined: boolean
  favorited: boolean
}

const relationCache = new Map<string, RelationState>()
let relationLoading = false

function bvidFromUrl(): string {
  return location.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/)?.[1] ?? ''
}

function hasLoginCookie(): boolean {
  return /(?:^|;\s*)DedeUserID=/.test(document.cookie)
}

/**
 * 主动查初始互动状态（第 85 轮）。
 *
 * 真机问题：刷新后连 B 站原生按钮都没有 `on` 类，所以「从原生 class 读」拿不到状态。
 * 实测可用的最省接口是 `/x/web-interface/archive/relation?aid=` → `{ like, favorite, coin, ... }` 一次拿全；
 * 失败时用 `has/like` 与 `coins` 分别兜底；三者都失败 → 回退读原生 class。
 */
async function loadArchiveRelation(): Promise<RelationState | null> {
  if (!hasLoginCookie())
    return null
  const bvid = bvidFromUrl() || bridgedBvid
  if (!bvid)
    return null
  const cached = relationCache.get(bvid)
  if (cached)
    return cached
  if (relationLoading)
    return null
  relationLoading = true
  try {
    let aid = bridgedAid
    if (!aid) {
      const view = await fetchJson<{ code: number, data?: { aid?: number } }>(
        `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`,
      )
      if (view?.code === 0 && view.data?.aid)
        aid = view.data.aid
    }
    if (!aid)
      return null
    const relation = await fetchJson<{
      code: number
      data?: { like?: boolean, favorite?: boolean, coin?: number }
    }>(`https://api.bilibili.com/x/web-interface/archive/relation?aid=${aid}`)
    if (relation?.code === 0 && relation.data) {
      const state: RelationState = {
        liked: Boolean(relation.data.like),
        coined: Number(relation.data.coin ?? 0) > 0,
        favorited: Boolean(relation.data.favorite),
      }
      relationCache.set(bvid, state)
      return state
    }
    // 兜底：分别查
    const [hasLike, coins] = await Promise.all([
      fetchJson<{ code: number, data?: number }>(`https://api.bilibili.com/x/web-interface/archive/has/like?aid=${aid}`),
      fetchJson<{ code: number, data?: { multiply?: number } }>(`https://api.bilibili.com/x/web-interface/archive/coins?aid=${aid}`),
    ])
    if (hasLike?.code === 0 || coins?.code === 0) {
      const state: RelationState = {
        liked: hasLike?.code === 0 && Number(hasLike.data) === 1,
        coined: coins?.code === 0 && Number(coins.data?.multiply ?? 0) > 0,
        favorited: false,
      }
      relationCache.set(bvid, state)
      return state
    }
    return null
  }
  finally {
    relationLoading = false
  }
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

function currentRelation(): RelationState | null {
  const bvid = bvidFromUrl() || bridgedBvid
  return bvid
    ? relationCache.get(bvid) ?? null
    : null
}

/**
 * 乐观状态（第 86 轮）。
 *
 * 问题：点击后重查 relation 时接口可能仍返回旧值 → 把刚点出来的 is-active 覆盖回未激活；
 * 且 `relation ? relation.x : isActive(native)` 让原生 class 的即时状态完全失效。
 * 现在：点击立即写乐观状态并重绘（2s 内优先），2s 后以接口为准；不一致时直接调写接口兜底。
 */
interface OptimisticState {
  liked: boolean
  likeCount: number
  coined: boolean
  coinCount: number
  favorited: boolean
  at: number
}

const optimisticCache = new Map<string, OptimisticState>()
const OPTIMISTIC_TTL = 2000

function bvidKey(): string {
  return bvidFromUrl() || bridgedBvid
}

async function ensureAid(): Promise<number | null> {
  if (bridgedAid)
    return bridgedAid
  const bvid = bvidKey()
  if (!bvid)
    return null
  const view = await fetchJson<{ code: number, data?: { aid?: number } }>(
    `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`,
  )
  if (view?.code === 0 && view.data?.aid)
    bridgedAid = view.data.aid
  return bridgedAid
}

async function postForm(url: string, body: Record<string, string>): Promise<{ code: number } | null> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
    })
    if (!response.ok)
      return null
    return await response.json() as { code: number }
  }
  catch {
    return null
  }
}

function csrfToken(): string {
  return document.cookie.match(/(?:^|;\s*)bili_jct=([^;]+)/)?.[1] ?? ''
}

/** 当前生效状态：乐观（2s 内） > relation 接口 > 原生 class */
function effectiveState(host: HTMLElement): OptimisticState {
  const key = bvidKey()
  const opt = key
    ? optimisticCache.get(key)
    : undefined
  if (opt && Date.now() - opt.at < OPTIMISTIC_TTL)
    return opt
  const relation = currentRelation()
  const stat = bridgedStat ?? {}
  return {
    liked: relation
      ? relation.liked
      : isActive(findNative(host, ['.video-like'])),
    likeCount: Number(stat.like ?? 0),
    coined: relation
      ? relation.coined
      : isActive(findNative(host, ['.video-coin'])),
    coinCount: Number(stat.coin ?? 0),
    favorited: relation
      ? relation.favorited
      : isActive(findNative(host, ['.video-fav'])),
    at: 0,
  }
}

/** 点击按钮时立即翻转乐观状态并重绘 */
function flipOptimistic(host: HTMLElement, kind: string): void {
  const key = bvidKey()
  if (!key)
    return
  const current = effectiveState(host)
  const next: OptimisticState = {
    ...current,
    at: Date.now(),
  }
  if (kind === 'like') {
    next.liked = !current.liked
    next.likeCount = Math.max(0, current.likeCount + (next.liked
      ? 1
      : -1))
  }
  else if (kind === 'coin') {
    next.coined = !current.coined
    next.coinCount = Math.max(0, current.coinCount + (next.coined
      ? 1
      : -1))
  }
  else if (kind === 'fav') {
    next.favorited = !current.favorited
  }
  optimisticCache.set(key, next)
  lastSignature = ''
  syncToolbar()
}

/**
 * 点击后核实：1.5s 后查服务端；不一致就直接调写接口兜底（不依赖原生按钮是否还在）。
 * 2s 后再重查 relation，一致或乐观已过期就以接口为准。
 */
async function verifyAction(kind: string): Promise<void> {
  const aid = await ensureAid()
  const key = bvidKey()
  if (!aid || !key)
    return
  await new Promise(resolve => window.setTimeout(resolve, 1500))
  const target = optimisticCache.get(key)
  if (!target)
    return
  if (kind === 'like') {
    const hasLike = await fetchJson<{ code: number, data?: number }>(
      `https://api.bilibili.com/x/web-interface/archive/has/like?aid=${aid}`,
    )
    if (hasLike?.code === 0 && (Number(hasLike.data) === 1) !== target.liked) {
      await postForm('https://api.bilibili.com/x/web-interface/archive/like', {
        aid: String(aid),
        like: target.liked ? '1' : '2',
        csrf: csrfToken(),
      })
    }
  }
  else if (kind === 'coin' && target.coined) {
    const coins = await fetchJson<{ code: number, data?: { multiply?: number } }>(
      `https://api.bilibili.com/x/web-interface/archive/coins?aid=${aid}`,
    )
    if (coins?.code === 0 && Number(coins.data?.multiply ?? 0) === 0) {
      await postForm('https://api.bilibili.com/x/web-interface/coin/add', {
        aid: String(aid),
        multiply: '1',
        csrf: csrfToken(),
      })
    }
  }
  await new Promise(resolve => window.setTimeout(resolve, 700))
  relationCache.delete(key)
  const fresh = await loadArchiveRelation()
  const stillOpt = optimisticCache.get(key)
  const matches = Boolean(fresh && stillOpt
    && fresh.liked === target.liked && fresh.coined === target.coined && fresh.favorited === target.favorited)
  if (matches || !stillOpt || Date.now() - stillOpt.at >= OPTIMISTIC_TTL)
    optimisticCache.delete(key)
  lastSignature = ''
  syncToolbar()
}

const NATIVE_HIDE_SELECTORS = ['.video-toolbar-left', '.video-toolbar-right']
const hiddenNatives = new Map<HTMLElement, string>()

function onBridgeData(event: Event): void {
  const detail = (event as CustomEvent).detail as { bvid?: string, aid?: number, stat?: StatData } | null
  if (!detail || !detail.stat)
    return
  const changed = detail.bvid !== bridgedBvid
  bridgedBvid = detail.bvid ?? ''
  bridgedStat = detail.stat
  if (typeof detail.aid === 'number')
    bridgedAid = detail.aid
  if (changed)
    lastSignature = ''
  // 新视频 → 重新查互动状态
  if (changed)
    void refreshRelation()
  syncToolbar()
}

/** 拉一次关系状态并在成功后重渲染 */
async function refreshRelation(): Promise<void> {
  const bvid = bvidFromUrl() || bridgedBvid
  if (bvid)
    relationCache.delete(bvid)
  const state = await loadArchiveRelation()
  if (state) {
    lastSignature = ''
    syncToolbar()
  }
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

/** 数字格式化（与 B 站一致：1.0万 / 1.2亿） */
export function formatStat(value: number | undefined | null): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0)
    return ''
  if (value >= 1e8)
    return `${(value / 1e8).toFixed(1)}亿`
  if (value >= 1e4)
    return `${(value / 1e4).toFixed(1)}万`
  return String(value)
}

function findNative(host: HTMLElement, selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const node = host.querySelector<HTMLElement>(selector)
    if (node)
      return node
  }
  return null
}

/** 按文案找原生按钮（举报 / 笔记这种没有稳定类名的） */
function findNativeByText(host: HTMLElement, re: RegExp): HTMLElement | null {
  for (const node of Array.from(host.querySelectorAll<HTMLElement>('div, button, a, span'))) {
    const text = (node.textContent ?? '').trim()
    if (!text || text.length > 8 || !re.test(text))
      continue
    // 只取最内层（避免命中包整行的大容器）
    if (Array.from(node.children).some(child => re.test((child.textContent ?? '').trim())))
      continue
    return node
  }
  return null
}

function isActive(node: HTMLElement | null): boolean {
  if (!node)
    return false
  return /(?:^|\s)(?:on|active|is-active|liked|selected)(?:\s|$)/.test(node.className)
}

const ICON_LIKE = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 10.5 11 4c1.4 0 2.4 1.1 2.2 2.5L12.8 9h5.1c1.2 0 2 1.2 1.7 2.3l-1.5 5.5A3 3 0 0 1 15.2 19H7" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><rect x="3.5" y="10" width="3.5" height="9" rx="1" stroke="currentColor" stroke-width="1.6"/></svg>'
const ICON_COIN = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="7.5" stroke="currentColor" stroke-width="1.6"/><path d="M12 8.5v7M9.5 11h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
const ICON_FAV = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 4.5 2.3 4.7 5.2.8-3.8 3.7.9 5.1-4.6-2.4-4.6 2.4.9-5.1L4.5 10l5.2-.8L12 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'
const ICON_SHARE = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 5.5 20 11l-6 5.5v-3.2c-4 0-6.6 1.2-8.5 3.7.4-4.8 3.1-7.6 8.5-7.9V5.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'
const ICON_REPORT = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4.5 21 20H3L12 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 10v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="17" r=".9" fill="currentColor"/></svg>'
const ICON_NOTE = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4.5" y="4.5" width="15" height="15" rx="2.5" stroke="currentColor" stroke-width="1.6"/><path d="M8 9h8M8 12.5h8M8 16h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'

interface ActionSpec {
  key: string
  label: string
  icon: string
  count?: string
  active?: boolean
  /** 原生按钮候选选择器 */
  nativeSelectors: string[]
  /** 原生按钮文案正则（选择器找不到时兜底） */
  nativeTextRe?: RegExp
}

function buildActions(host: HTMLElement): ActionSpec[] {
  const stat = bridgedStat ?? {}
  const effective = effectiveState(host)
  return [
    {
      key: 'like',
      label: '点赞',
      icon: ICON_LIKE,
      count: formatStat(effective.likeCount),
      active: effective.liked,
      nativeSelectors: ['.video-like'],
      nativeTextRe: /点赞/,
    },
    {
      key: 'coin',
      label: '投币',
      icon: ICON_COIN,
      count: formatStat(effective.coinCount),
      active: effective.coined,
      nativeSelectors: ['.video-coin'],
      nativeTextRe: /投币/,
    },
    {
      key: 'fav',
      label: '收藏',
      icon: ICON_FAV,
      count: formatStat(stat.favorite),
      active: effective.favorited,
      nativeSelectors: ['.video-fav'],
      nativeTextRe: /收藏/,
    },
    {
      key: 'share',
      label: '分享',
      icon: ICON_SHARE,
      count: formatStat(stat.share),
      nativeSelectors: ['.video-share', '.video-share-wrap'],
      nativeTextRe: /分享/,
    },
    {
      key: 'report',
      label: '举报',
      icon: ICON_REPORT,
      nativeSelectors: ['.video-report', '.video-toolbar-right .report'],
      nativeTextRe: /举报/,
    },
    {
      key: 'note',
      label: '笔记',
      icon: ICON_NOTE,
      nativeSelectors: ['.video-note', '.video-toolbar-right .note'],
      nativeTextRe: /笔记/,
    },
  ]
}

/** 真机结构（CDP）：举报 / 笔记在「更多」下拉（`.video-tool-more`）里，先点开菜单再按文案点 */
async function openMoreMenuAndFind(re: RegExp): Promise<HTMLElement | null> {
  const more = document.querySelector<HTMLElement>('.video-tool-more.video-toolbar-right-item')
    ?? document.querySelector<HTMLElement>('.video-tool-more')
  if (!more)
    return null
  more.click()
  for (let attempt = 0; attempt < 8; attempt++) {
    await new Promise(resolve => window.setTimeout(resolve, 120))
    // 菜单可能被 teleport 到 body，所以从 document 里找最内层的匹配项
    const found = findNativeByText(document.body, re)
    if (found && !found.closest('#bewly-toolbar'))
      return found
  }
  return null
}

async function forwardToNative(host: HTMLElement, spec: ActionSpec): Promise<void> {
  const direct = findNative(host, spec.nativeSelectors)
    ?? (spec.nativeTextRe
      ? findNativeByText(host, spec.nativeTextRe)
      : null)
  if (direct) {
    direct.click()
    return
  }
  // 举报 / 笔记：走「更多」下拉
  if (spec.nativeTextRe) {
    const inMenu = await openMoreMenuAndFind(spec.nativeTextRe)
    if (inMenu) {
      inMenu.click()
      return
    }
  }
  showToast(`没找到原生的「${spec.label}」按钮，请在原生工具栏操作`)
}

function renderToolbar(host: HTMLElement): void {
  let bar = host.querySelector<HTMLElement>(`#${TOOLBAR_ID}`)
  if (!bar) {
    bar = document.createElement('div')
    bar.id = TOOLBAR_ID
    host.insertBefore(bar, host.firstChild)
  }
  const actions = buildActions(host)
  const signature = actions.map(action => `${action.key}:${action.count ?? ''}:${action.active ? 1 : 0}`).join('|')
  if (signature !== lastSignature) {
    lastSignature = signature
    bar.textContent = ''
    for (const action of actions) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `bvp-toolbar__btn${action.active ? ' is-active' : ''}`
      button.dataset.action = action.key
      button.title = action.label
      button.innerHTML = `${action.icon}<span class="bvp-toolbar__label">${action.label}</span>${action.count
        ? `<span class="bvp-toolbar__count">${action.count}</span>`
        : ''}`
      button.addEventListener('click', (event) => {
        event.stopPropagation()
        // 第 86 轮：三个可切换动作先做乐观更新，让用户立刻看到状态变化
        if (action.key === 'like' || action.key === 'coin' || action.key === 'fav')
          flipOptimistic(host, action.key)
        void forwardToNative(host, action).then(() => {
          if (action.key === 'like' || action.key === 'coin' || action.key === 'fav') {
            void verifyAction(action.key)
          }
          else {
            window.setTimeout(() => {
              lastSignature = ''
              syncToolbar()
            }, 400)
          }
        })
      })
      bar.appendChild(button)
    }
  }
  // 渲染成功后隐藏原生左右两组（保留节点可 click）
  for (const selector of NATIVE_HIDE_SELECTORS) {
    for (const node of Array.from(host.querySelectorAll<HTMLElement>(selector))) {
      if (!hiddenNatives.has(node))
        hiddenNatives.set(node, node.style.display)
      node.style.setProperty('display', 'none', 'important')
    }
  }
}

function restoreNatives(): void {
  for (const [node, display] of hiddenNatives) {
    if (!node.isConnected) {
      hiddenNatives.delete(node)
      continue
    }
    if (display)
      node.style.display = display
    else
      node.style.removeProperty('display')
  }
  hiddenNatives.clear()
}

/** 首屏 / 切视频时调用；返回 false 表示本次未启用自绘 */
export function syncToolbar(): boolean {
  const host = document.querySelector<HTMLElement>(TOOLBAR_HOST_SELECTOR)
  if (!host) {
    resetToolbar()
    return false
  }
  renderToolbar(host)
  // 已登录但还没拿到关系状态 → 异步查一次（避免每拍重复请求：缓存 + loading 标记）
  const bvid = bvidFromUrl() || bridgedBvid
  if (bvid && hasLoginCookie() && !relationCache.has(bvid) && !relationLoading) {
    void loadArchiveRelation().then((state) => {
      if (state) {
        lastSignature = ''
        syncToolbar()
      }
    })
  }
  return true
}

function resetToolbar(): void {
  document.getElementById(TOOLBAR_ID)?.remove()
  restoreNatives()
  lastSignature = ''
}

export function setupToolbar(): () => void {
  startBridge()
  syncToolbar()
  return teardownToolbar
}

export function teardownToolbar(): void {
  stopBridge()
  resetToolbar()
  bridgedStat = null
  bridgedBvid = ''
  bridgedAid = null
  relationCache.clear()
}
