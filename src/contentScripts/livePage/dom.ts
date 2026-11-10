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

/** 右侧栏（礼物 / 榜单 / 推荐列） */
export function findAside(): HTMLElement | null {
  return firstMatch<HTMLElement>(ASIDE_SELECTORS)
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
export function markLiveStage(): { player: HTMLElement | null, aside: HTMLElement | null } {
  clearLiveStage()

  const player = findPlayer()
  if (!player)
    return { player: null, aside: null }

  player.setAttribute(PLAYER_ATTR, '')

  // 播放器与侧栏的共同祖先：隐藏侧栏后让整个布局撑满
  const aside = findAside()
  if (aside) {
    aside.setAttribute(ASIDE_ATTR, '')
    let common: HTMLElement | null = player.parentElement
    while (common && common !== document.body && !common.contains(aside))
      common = common.parentElement
    if (common && common !== document.body)
      common.setAttribute(LAYOUT_ATTR, '')
  }

  let parent = player.parentElement
  while (parent && parent !== document.body && parent !== document.documentElement) {
    parent.setAttribute(ANCESTOR_ATTR, '')
    parent = parent.parentElement
  }

  return { player, aside }
}

export function clearLiveStage(): void {
  const attrs = [
    PLAYER_ATTR,
    LAYOUT_ATTR,
    ASIDE_ATTR,
    ANCESTOR_ATTR,
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
