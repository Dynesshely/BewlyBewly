/**
 * 播放器显示模式检测（第 37 轮）。
 *
 * 用户报的两个 bug：
 * 1. 网页全屏时推荐轨道仍然显示并盖在播放器上（rail top=941 压在播放器区域）；
 * 2. 宽屏（wide）时评论区应当隐藏，之前没隐藏。
 *
 * 真机状态来源（Lead 实测 1600×1000）：
 * ```
 * 普通态:   .bpx-player-container[data-screen="normal"]
 * 网页全屏: .bpx-player-container[data-screen="web"]  且 body.class 含 "webscreen-fix"
 * 宽屏:     .bpx-player-container[data-screen="wide"]
 * （还有 full = 真·全屏，和 web 同属「网页全屏」语义）
 * ```
 *
 * 本模块只负责「读模式 + 挂状态类」，具体布局由 `fixedLayout.ts` 与页面级 CSS 消费：
 * - `html.bewly-player-webfull`：网页全屏 → 隐藏轨道（状态层）与评论列，播放器吃满高度；
 * - `html.bewly-player-wide`：宽屏 → 隐藏评论列，播放器占满可用宽度，轨道保留。
 *
 * 为什么要独立的模式类：B 站自己会在切模式时重建播放器 DOM，
 * 我们每 500ms 拍重读一次属性，模式变化时重新挂类并让布局重算，天然幂等。
 */

export type PlayerScreenMode = 'normal' | 'wide' | 'webfull'

export const WEBFULL_CLASS = 'bewly-player-webfull'
export const WIDE_CLASS = 'bewly-player-wide'

const PLAYER_CONTAINER_SELECTOR = '.bpx-player-container'

/** 网页全屏时 body 上会出现的类（B 站的标记） */
const WEBSCREEN_BODY_CLASS = 'webscreen-fix'

let currentMode: PlayerScreenMode = 'normal'

/** 只读检测：不写 DOM */
export function detectPlayerScreenMode(): PlayerScreenMode {
  const container = document.querySelector<HTMLElement>(PLAYER_CONTAINER_SELECTOR)
  const screen = container?.getAttribute('data-screen') ?? ''
  const body = document.body?.classList

  if (screen === 'web' || screen === 'full' || body?.contains(WEBSCREEN_BODY_CLASS))
    return 'webfull'
  if (screen === 'wide')
    return 'wide'
  return 'normal'
}

/** 当前模式（上一次 `syncPlayerScreenMode()` 的结果） */
export function getPlayerScreenMode(): PlayerScreenMode {
  return currentMode
}

/**
 * 每拍调用：检测模式并在变化时切换 html 状态类。
 *
 * @returns 模式是否发生变化（调用方据此立刻重跑一次布局，避免「等下一拍才对齐」）
 */
export function syncPlayerScreenMode(): boolean {
  const next = detectPlayerScreenMode()
  const root = document.documentElement
  root.classList.toggle(WEBFULL_CLASS, next === 'webfull')
  root.classList.toggle(WIDE_CLASS, next === 'wide')

  if (next === currentMode)
    return false
  currentMode = next
  return true
}

/** 卸载：清掉状态类并复位 */
export function teardownPlayerScreenMode(): void {
  document.documentElement.classList.remove(WEBFULL_CLASS, WIDE_CLASS)
  currentMode = 'normal'
}
