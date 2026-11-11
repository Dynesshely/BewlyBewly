/**
 * 首页子标签滚动位置记忆（第 20 轮）。
 *
 * 需求与取舍：
 * - **只在同一次页面会话内有效**：真正的恢复源是模块级 `Map`（内存），刷新页面后 Map 为空，
 *   回到顶部 —— 这样「刷新后停在中途、以为页面卡住」不会发生；
 * - sessionStorage 仍然写入（`bewly-home-scroll-<tab>`），用于排查 / DevTools 观察，
 *   **不参与恢复判断**（否则刷新也会恢复，违背需求）；
 * - 恢复是「等内容够高再落位」的轮询：首页子标签切换后数据接口是异步的，
 *   直接设 scrollTop 会被浏览器截断到当前内容高度，所以每次 rAF 检查
 *   `scrollHeight - clientHeight` 是否够用，够用才写 scrollTop，最多等 3s；
 * - 用户在这期间主动滚动（滚轮 / 触摸）就放弃恢复，避免和用户抢滚动条；
 * - 直接赋值 `scrollTop`（不调用 smooth scroll），`prefers-reduced-motion` 下天然是跳转。
 */

const STORAGE_PREFIX = 'bewly-home-scroll-'

/** tab.page → scrollTop；页面刷新后清空（内存态才是恢复依据） */
const memory = new Map<string, number>()

export function homeScrollStorageKey(tab: string): string {
  return `${STORAGE_PREFIX}${tab}`
}

/** 记录某个子标签离开时的滚动位置 */
export function saveHomeScroll(tab: string, top: number): void {
  if (!tab)
    return
  const value = Math.max(0, Math.round(top))
  memory.set(tab, value)
  try {
    sessionStorage.setItem(homeScrollStorageKey(tab), String(value))
  }
  catch {
    // 隐私模式 / 配额满：只保留内存态
  }
}

/**
 * 取出某个子标签上次离开时的位置，并消费掉（同一次停留只恢复一次）。
 * 只读内存态，不读 sessionStorage —— 刷新后必须回到顶部。
 */
export function takeHomeScroll(tab: string): number | null {
  const value = memory.get(tab)
  if (value === undefined)
    return null
  memory.delete(tab)
  return value
}

export interface RestoreOptions {
  /** 最长等待内容变高的时间（ms），默认 3000 */
  maxWaitMs?: number
  /** 内容高度始终不够时是否仍落到当前最大值，默认 true */
  clampToMax?: boolean
}

/**
 * 把滚动容器恢复到 `targetTop`（不触发 smooth）。
 * 返回清理函数：组件卸载 / 用户接管滚动时调用，停止轮询并移除监听。
 */
export function restoreHomeScroll(
  targetTop: number,
  getScrollRoot: () => HTMLElement | null,
  options: RestoreOptions = {},
): () => void {
  const maxWaitMs = options.maxWaitMs ?? 3000
  const clampToMax = options.clampToMax ?? true

  if (!Number.isFinite(targetTop) || targetTop <= 0)
    return () => {}

  let stopped = false
  const startedAt = performance.now()
  const cleanupFns: Array<() => void> = []

  const stop = () => {
    if (stopped)
      return
    stopped = true
    for (const fn of cleanupFns)
      fn()
  }

  // 用户主动滚动就放弃，交还控制权
  const cancelOnUserInput = () => stop()
  for (const eventName of ['wheel', 'touchstart'] as const) {
    window.addEventListener(eventName, cancelOnUserInput, { passive: true })
    cleanupFns.push(() => window.removeEventListener(eventName, cancelOnUserInput))
  }

  const tick = () => {
    if (stopped)
      return
    const root = getScrollRoot()
    if (!root) {
      requestAnimationFrame(tick)
      return
    }
    const maxTop = Math.max(0, root.scrollHeight - root.clientHeight)
    // 内容已经够高（保留 2px 余量，避免亚像素误差导致的永远「不够」）
    if (maxTop + 2 >= targetTop) {
      if (Math.abs(root.scrollTop - targetTop) > 1)
        root.scrollTop = targetTop
      stop()
      return
    }
    if (performance.now() - startedAt >= maxWaitMs) {
      if (clampToMax && Math.abs(root.scrollTop - maxTop) > 1)
        root.scrollTop = maxTop
      stop()
      return
    }
    requestAnimationFrame(tick)
  }

  requestAnimationFrame(tick)
  return stop
}
