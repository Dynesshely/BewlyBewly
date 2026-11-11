/**
 * 直播页（live.bilibili.com）的 DOM 适配层。
 *
 * 注意：Bewly 此前**完全没有**支持直播页，仓库 scss 里没有直播页的类名可以确认，
 * 因此这里的选择器都是「按结构推断 + 多候选 + 允许失败」：
 * 每条查询都返回 null 时，对应功能在面板里隐藏 / 禁用，不会硬改坏页面。
 * 结构一旦变化，只需要改这一个文件。
 *
 * 已知的直播页结构线索（推断）：
 *   - 播放器：`#live-player`（外层舞台）+ `#live-player-ctnr`（内层）；
 *   - 布局：`.player-and-aside-area`（播放器与右侧栏的横向容器）；
 *   - 右侧栏：`.aside-area`；
 *   - 弹幕开关：播放器控制条里的 danmaku 按钮；
 *   - 全屏：播放器控制条里的 fullscreen 按钮。
 */

const LIVE_HOST_RE = /(?:^|\.)live\.bilibili\.com$/i

const PLAYER_SELECTORS = [
  // 实测 2026-11 直播页：舞台是 .live-non-revenue-player 内的 #player-ctnr，
  // 旧版才是 #live-player / #live-player-ctnr，两套都保留。
  '#live-player',
  '.live-player',
  '#live-player-ctnr',
  '.live-non-revenue-player',
  '#player-ctnr',
  '.player-ctnr',
  '[class*="live-non-revenue-player"]',
  '.player-and-aside-area > .player-area',
  '[class*="live-player"]',
]

const ASIDE_SELECTORS = [
  '.aside-area',
  '#aside-area',
  '.player-and-aside-area > aside',
  '[class*="aside-area"]',
  '[class*="right-aside"]',
]

/** 播放器控制条里的弹幕开关（可能是 button，也可能是 checkbox） */
const DANMAKU_SELECTORS = [
  '#live-player .web-player-icon-danmaku',
  '[class*="player"] [class*="danmaku-switch"]',
  '[class*="player"] [class*="dm-switch"]',
  '[class*="player"] button[aria-label*="弹幕"]',
  '#live-player [class*="danmaku-switch"]',
  '#live-player [class*="dm-switch"]',
  '#live-player [class*="danmaku"] button',
  '#live-player button[aria-label*="弹幕"]',
  '[class*="danmaku-switch"]',
  'button[aria-label*="弹幕"]',
]

/** 播放器控制条里的全屏按钮 */
const FULLSCREEN_SELECTORS = [
  '#live-player .web-player-icon-fullscreen',
  '[class*="player"] [class*="fullscreen"]',
  '[class*="player"] button[aria-label*="全屏"]',
  '#live-player [class*="fullscreen"]',
  '#live-player button[aria-label*="全屏"]',
  '[class*="web-player-icon-fullscreen"]',
  'button[aria-label*="全屏"]',
]

export const PLAYER_ATTR = 'data-bewly-live-player'
export const LAYOUT_ATTR = 'data-bewly-live-layout'
export const ASIDE_ATTR = 'data-bewly-live-aside'
export const ANCESTOR_ATTR = 'data-bewly-live-ancestor'
/** 播放器顶部操作条（真机 `.live-player-handle-bar.expandable`，影院模式要隐藏） */
export const HANDLE_BAR_ATTR = 'data-bewly-live-handle-bar'
/** 播放器画面容器（真机 `.live-player-bg`，影院模式要铺满舞台） */
export const VIDEO_BG_ATTR = 'data-bewly-live-video-bg'
/**
 * 舞台下方的区块（第 23 轮：真机没有右侧聊天列，页面下方 y≈2818 有「推荐 / 榜单」类容器）。
 *
 * 影院模式与「隐藏下方推荐 / 榜单」都作用在属性上：
 * 只隐藏**结构的兄弟节点**，不隐藏舞台本身。
 */
export const BELOW_ATTR = 'data-bewly-live-below'

const EDITABLE_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
].join(', ')

export function isLivePage(url: string = location.href): boolean {
  try {
    return LIVE_HOST_RE.test(new URL(url).hostname)
  }
  catch {
    return false
  }
}

function firstMatch<T extends Element>(selectors: string[]): T | null {
  for (const selector of selectors) {
    const el = document.querySelector<T>(selector)
    if (el)
      return el
  }
  return null
}

/** 播放器舞台（影院模式 / 全屏的锚点） */
export function findPlayer(): HTMLElement | null {
  return firstMatch<HTMLElement>(PLAYER_SELECTORS)
}

/** 侧栏候选的 class 特征：聊天 / 礼物 / 榜单之类 */
const ASIDE_CLASS_HINT_RE = /chat|danmu|danmaku|gift|guard|rank|aside/i
/** 侧栏候选的文案特征（聊天 / 礼物 / 榜单） */
const ASIDE_TEXT_HINT_RE = /弹幕|聊天|礼物|舰长|榜单|光荣榜|贡献/
/** 聊天 / 礼物侧栏的宽度区间（真机约 320–420px），用来排除控制条与整页容器 */
const ASIDE_MIN_WIDTH = 160
const ASIDE_MAX_WIDTH = 420
const ASIDE_MIN_HEIGHT = 220

/**
 * 右侧栏（礼物 / 榜单 / 聊天列）。
 *
 * 真机实测（live.bilibili.com/6，2026-11）页面上**没有** `.aside-area` / `#aside-area` /
 * `.player-and-aside-area`，所以先试旧选择器，再退化为结构化启发式：
 * 在播放器舞台的祖先（最多 3 层）的同级节点里，找「宽度 < 420px、高度 >= 220px、
 * class 或文案带聊天/礼物/榜单特征」的容器。找不到就返回 null —— 面板里的开关保持禁用，
 * 不会给一个按了没用的假开关。
 */
/** 启发式结果缓存：避免每 300ms 的 sync 反复读取布局；也防止「我们自己把侧栏 display:none 后」再探测不到 */
let heuristicAside: HTMLElement | null = null

export function findAside(player: HTMLElement | null = findPlayer()): HTMLElement | null {
  const matched = firstMatch<HTMLElement>(ASIDE_SELECTORS)
  if (matched)
    return matched

  if (heuristicAside?.isConnected)
    return heuristicAside

  heuristicAside = player
    ? findAsideByHeuristic(player)
    : null
  return heuristicAside
}

/** 卸载 / 离开页面时清掉启发式缓存 */
export function resetAsideCache(): void {
  heuristicAside = null
}

function isVisibleCandidate(el: HTMLElement): boolean {
  const style = getComputedStyle(el)
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
}

function findAsideByHeuristic(player: HTMLElement): HTMLElement | null {
  const candidates = new Set<HTMLElement>()
  let node: HTMLElement | null = player.parentElement
  for (let depth = 0; node && depth < 3; depth++, node = node.parentElement) {
    for (const child of Array.from(node.children)) {
      if (!(child instanceof HTMLElement))
        continue
      if (child === player || child.contains(player))
        continue
      candidates.add(child)
    }
  }

  let best: HTMLElement | null = null
  let bestHeight = 0
  for (const el of candidates) {
    if (!isVisibleCandidate(el))
      continue

    const rect = el.getBoundingClientRect()
    if (rect.width < ASIDE_MIN_WIDTH || rect.width > ASIDE_MAX_WIDTH || rect.height < ASIDE_MIN_HEIGHT)
      continue

    const className = el.getAttribute('class') ?? ''
    const text = (el.textContent ?? '').slice(0, 800)
    if (!ASIDE_CLASS_HINT_RE.test(className) && !ASIDE_TEXT_HINT_RE.test(text))
      continue

    // 高度越大越可能是聊天 / 礼物侧栏（播放器控制条一般很矮）
    if (rect.height > bestHeight) {
      best = el
      bestHeight = rect.height
    }
  }
  return best
}

/**
 * 舞台下方的「推荐 / 榜单」区块（第 23 轮新增，替代真机上并不存在的右侧栏）。
 *
 * 真机实测（live.bilibili.com/6，2026-11）：播放器舞台在页面顶部，下方 y≈2818
 * 有宽约 610px 的区块（class 含 `layerWrapperRoot` / `_layoutContainerRoot_`，内容是礼物 / 榜单类）。
 * B 站类名是 CSS Module 哈希，不能硬编码，因此用结构判定：
 *
 * 1. 从舞台开始向上遍历祖先（到 body 为止，最多 6 层）；
 * 2. 每一层收集「不包含舞台、不是 fixed/sticky、宽度 >= minWidth、高度 >= 60、
 *    且整体位于舞台底部以下（16px 容差）」的兄弟节点；
 * 3. 命中的节点打 `data-bewly-live-below`，去重后返回。
 *
 * 之所以允许在多个层级同时命中：B 站的「下方区块」外面可能还套着若干层布局容器，
 * 外层命中会把内层一起隐藏，重复命中没有副作用（去重保证只有一个节点）。
 */
let belowCache: HTMLElement[] = []

export function findBelowRegions(player: HTMLElement | null = findPlayer()): HTMLElement[] {
  // 已经隐藏过的区块量不出 rect（display:none），所以命中后按缓存复用，
  // 只要节点还连着、且舞台没换，就不再重新测量 —— 否则开关会自己抖动成「不可用」。
  if (belowCache.length && belowCache.every(node => node.isConnected))
    return belowCache
  if (!player)
    return []

  belowCache = detectBelowRegions(player)
  return belowCache
}

/** 卸载 / 离开页面时清掉缓存 */
export function resetBelowCache(): void {
  belowCache = []
}

function detectBelowRegions(player: HTMLElement): HTMLElement[] {
  const playerRect = player.getBoundingClientRect()
  const playerBottom = playerRect.bottom
  const minWidth = Math.max(240, Math.min(window.innerWidth * 0.18, 520))

  const result: HTMLElement[] = []
  const seen = new Set<HTMLElement>()
  let node: HTMLElement | null = player.parentElement
  for (let depth = 0; node && node !== document.body && node !== document.documentElement && depth < 6; depth++, node = node.parentElement) {
    for (const sibling of Array.from(node.children)) {
      if (!(sibling instanceof HTMLElement) || sibling === player || sibling.contains(player))
        continue
      if (seen.has(sibling))
        continue
      const style = getComputedStyle(sibling)
      if (style.position === 'fixed' || style.position === 'sticky' || style.display === 'none')
        continue
      const rect = sibling.getBoundingClientRect()
      if (rect.width < minWidth || rect.height < 60)
        continue
      // 只收「完全位于舞台下方」的块，避免把顶栏 / 播放器同排的元素也隐藏掉
      if (rect.top < playerBottom - 16)
        continue
      seen.add(sibling)
      result.push(sibling)
    }
  }
  return result
}

/** 播放器控制条里的弹幕开关 */
export function findDanmakuToggle(): HTMLElement | null {
  return firstMatch<HTMLElement>(DANMAKU_SELECTORS)
}

/** 播放器控制条里的全屏按钮（找不到时 actions 会退回 requestFullscreen） */
export function findFullscreenButton(): HTMLElement | null {
  return firstMatch<HTMLElement>(FULLSCREEN_SELECTORS)
}

/** 弹幕当前状态：checkbox 读 checked，其它控件按「没有 off 类名」推断为开启 */
export function isDanmakuEnabled(): boolean {
  const el = findDanmakuToggle()
  if (!el)
    return true
  if (el instanceof HTMLInputElement)
    return el.checked
  const tokens = el.className.split(/\s+/)
  return !tokens.some(token => /off|close|disabled/i.test(token))
}

/**
 * 给播放器舞台、布局容器、右侧栏与播放器祖先链打标记。
 *
 * 祖先链上的标记用于影院模式清掉 transform / filter / contain / z-index：
 * 只要祖先建立了层叠上下文，`position: fixed` 的舞台就会被 body::before 遮罩盖住
 * （第 4 轮番剧页踩过这个坑：整页变灰、播放器不见）。
 */
export function markLiveStage(): { player: HTMLElement | null, aside: HTMLElement | null, below: HTMLElement[] } {
  clearLiveStage()

  const player = findPlayer()
  if (!player)
    return { player: null, aside: null, below: [] }

  player.setAttribute(PLAYER_ATTR, '')

  // 真机：舞台内是「顶部操作条 + 画面容器」两个子节点；影院模式要隐藏操作条、让画面铺满
  const handleBar = player.querySelector<HTMLElement>('.live-player-handle-bar, [class*="live-player-handle-bar"], [class*="handle-bar"]')
  if (handleBar)
    handleBar.setAttribute(HANDLE_BAR_ATTR, '')

  const videoBg = player.querySelector<HTMLElement>('[class*="live-player-bg"]')
  if (videoBg)
    videoBg.setAttribute(VIDEO_BG_ATTR, '')

  // 播放器与侧栏的共同祖先：隐藏侧栏后让整个布局撑满
  const aside = findAside(player)
  if (aside) {
    aside.setAttribute(ASIDE_ATTR, '')
    let common: HTMLElement | null = player.parentElement
    while (common && common !== document.body && !common.contains(aside))
      common = common.parentElement
    if (common && common !== document.body)
      common.setAttribute(LAYOUT_ATTR, '')
  }

  // 舞台下方区块（第 23 轮）：真机没有右侧栏，可隐藏的是这些推荐 / 榜单区块
  const below = findBelowRegions(player)
  for (const region of below)
    region.setAttribute(BELOW_ATTR, '')

  let parent = player.parentElement
  while (parent && parent !== document.body && parent !== document.documentElement) {
    parent.setAttribute(ANCESTOR_ATTR, '')
    parent = parent.parentElement
  }

  return { player, aside, below }
}

export function clearLiveStage(): void {
  const attrs = [
    PLAYER_ATTR,
    LAYOUT_ATTR,
    ASIDE_ATTR,
    ANCESTOR_ATTR,
    HANDLE_BAR_ATTR,
    VIDEO_BG_ATTR,
    BELOW_ATTR,
  ]
  for (const attr of attrs) {
    document.querySelectorAll<HTMLElement>(`[${attr}]`).forEach(node => node.removeAttribute(attr))
  }
}

/** 影院 / 隐藏侧栏改变了播放器尺寸，通知播放器重新计算布局 */
export function notifyPlayerResize(): void {
  window.dispatchEvent(new Event('resize'))
  window.setTimeout(() => window.dispatchEvent(new Event('resize')), 120)
  window.setTimeout(() => window.dispatchEvent(new Event('resize')), 320)
}

/** 焦点在输入框 / 弹幕输入框 / 可编辑区域里时不劫持快捷键 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (target instanceof Element)
    return target.closest(EDITABLE_SELECTOR) !== null
  return document.activeElement instanceof Element
    && document.activeElement.closest(EDITABLE_SELECTOR) !== null
}

/** 事件是否来自 Bewly 自己的 UI（`#bewly` 浮层） */
export function isFromBewlyUi(event: Event): boolean {
  const bewly = document.getElementById('bewly')
  return Boolean(bewly && event.composedPath().includes(bewly))
}

/** 事件是否来自本模块自己的浮层（shadow root 里的事件会以 host 出现在 composedPath 中） */
export function isFromOverlay(event: Event, hostId: string): boolean {
  const host = document.getElementById(hostId)
  return Boolean(host && event.composedPath().includes(host))
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
