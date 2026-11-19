/**
 * 视频播放页「按视口铺满」布局（第 113 轮 layout-fit）对外入口。
 *
 * 对外只暴露三个函数：
 * - setupVideoFit()    挂载：算一次 → 写变量/类 → 监听视口变化（ResizeObserver + 100ms 节流）
 * - teardownVideoFit() 卸载：移除类 / 变量 / 样式表
 * - syncVideoFit()     手动重算（供既有 500ms 状态同步或调试用）
 *
 * 开关契约（可回退）
 * ------------------
 * 新布局的全部效果都挂在 html.bewly-video-fit 上：
 * 1. 去掉这个类（或调用 teardownVideoFit）→ 新布局 CSS 整块失效，回到旧布局；
 * 2. 想长期关掉：给 <html> 加 data-bewly-fit-off 属性，或
 *    localStorage.setItem('bewly-video-fit-off', '1')；
 * 3. 旧布局（fixedLayout.ts 的 html.bewly-video-fixed）一行没改，
 *    因此第 1 条就是完整的回退路径。
 *
 * 说明：本模块**不**读 settings / ui 状态，是否启用由接线方（videoPage/index.ts）决定；
 * 这样布局本身可以在单测与真机探针里独立驱动。
 */
import { applyFitLayout, clearFitLayout, ensureShadowStyle } from './apply'
import { computeLayout } from './compute'
import { measureFitLayout } from './measure'
import { startFitWatch } from './watch'

export { applyFitLayout, clearFitLayout, FIT_CLASS, FIT_METRICS_ATTR, STACKED_CLASS } from './apply'
export type { FitLayoutBox, FitLayoutInput, FitLayoutMode, FitLayoutResult } from './compute'
export { computeLayout } from './compute'
export { startFitWatch } from './watch'

/** 长期关闭开关：<html data-bewly-fit-off> */
export const FIT_KILL_ATTR = 'data-bewly-fit-off'
/** 长期关闭开关：localStorage 键（值为 '1' 时关闭） */
export const FIT_KILL_STORAGE_KEY = 'bewly-video-fit-off'

let stopWatch: (() => void) | null = null
let retryTimer = 0
let applied = false

function isKilled(): boolean {
  if (document.documentElement.hasAttribute(FIT_KILL_ATTR))
    return true
  try {
    return window.localStorage.getItem(FIT_KILL_STORAGE_KEY) === '1'
  }
  catch {
    return false
  }
}

/** 迷你播放器是「播放器浮起来」的独立形态，交给旧逻辑，不动 */
function isMini(): boolean {
  return document.documentElement.classList.contains('bewly-video-mini')
}

function clearApplied(): void {
  if (!applied)
    return
  clearFitLayout()
  applied = false
}

/**
 * 重算并应用一次。
 *
 * 调用频率由 watch.ts 的节流保证（rAF + 100ms），本身是幂等的。
 */
export function syncVideoFit(): void {
  if (isKilled() || isMini()) {
    clearApplied()
    return
  }

  const measurements = measureFitLayout()
  const result = computeLayout({
    vw: window.innerWidth,
    vh: window.innerHeight,
    topBarH: measurements.topBarH,
    railH: measurements.railH,
    reserveH: measurements.reserveH,
    controlH: measurements.controlH,
  })

  if (!result.ok) {
    clearApplied()
    return
  }

  applyFitLayout(result)
  applied = true
}

/**
 * 挂载新布局。
 *
 * 返回卸载函数（与 setupXxx 的既有约定一致）。
 */
export function setupVideoFit(): () => void {
  teardownVideoFit()
  syncVideoFit()

  // 增强层宿主是异步挂载的：轨道样式需要它出现后再补一次
  retryTimer = window.setInterval(() => {
    if (applied)
      ensureShadowStyle()
  }, 1000)

  stopWatch = startFitWatch(syncVideoFit, {
    throttleMs: 100,
    getTargets: () => [
      document.querySelector('#mirror-vdcon'),
      document.querySelector('#playerWrap'),
      document.querySelector('#mirror-vdcon .left-container'),
      document.querySelector('#mirror-vdcon .right-container'),
    ],
  })

  return teardownVideoFit
}

/** 卸载新布局（回到旧布局：类 / 变量 / 注入样式全部移除） */
export function teardownVideoFit(): void {
  stopWatch?.()
  stopWatch = null
  if (retryTimer) {
    window.clearInterval(retryTimer)
    retryTimer = 0
  }
  clearApplied()
  // 兜底：即使 applied 状态丢了也要清干净
  clearFitLayout()
}
