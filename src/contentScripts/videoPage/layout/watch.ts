/**
 * 视口 / 目标元素变化 → 触发重算（第 113 轮）。
 *
 * - rAF + 时间戳节流（默认 100ms），避免 ResizeObserver 连环触发；
 * - 同时监听 window resize / orientationchange（视口变化最直接的信号）；
 * - `getTargets` 返回需要额外观察的元素（播放器 / 左右列），它们尺寸变化
 *   往往意味着可测量高度（reserveH / controlH）变了，需要重算。
 */

export interface FitWatchOptions {
  /** 节流间隔（ms），默认 100 */
  throttleMs?: number
  /** 需要额外 ResizeObserver 盯住的元素（可返回 null，会被过滤） */
  getTargets?: () => Array<Element | null | undefined>
}

/** 启动监听，返回停止函数 */
export function startFitWatch(onChange: () => void, options: FitWatchOptions = {}): () => void {
  const throttleMs = options.throttleMs ?? 100
  let lastRun = 0
  let rafId = 0
  let timer = 0
  let stopped = false

  const run = (): void => {
    if (stopped)
      return
    rafId = 0
    lastRun = Date.now()
    try {
      onChange()
    }
    catch {
      // 布局计算失败不能影响页面
    }
  }

  const schedule = (): void => {
    if (stopped || rafId || timer)
      return
    const elapsed = Date.now() - lastRun
    if (elapsed >= throttleMs) {
      rafId = window.requestAnimationFrame(run)
      return
    }
    timer = window.setTimeout(() => {
      timer = 0
      schedule()
    }, throttleMs - elapsed)
  }

  const observer = typeof ResizeObserver === 'function'
    ? new ResizeObserver(schedule)
    : null

  if (observer) {
    observer.observe(document.documentElement)
    for (const el of options.getTargets?.() ?? []) {
      if (el instanceof Element)
        observer.observe(el)
    }
  }

  window.addEventListener('resize', schedule, { passive: true })
  window.addEventListener('orientationchange', schedule, { passive: true })

  // 首帧后补一拍：B 站播放器 / 信息栏是异步渲染的，立即算会measure 到 0
  rafId = window.requestAnimationFrame(run)

  return () => {
    stopped = true
    if (rafId)
      window.cancelAnimationFrame(rafId)
    if (timer)
      window.clearTimeout(timer)
    observer?.disconnect()
    window.removeEventListener('resize', schedule)
    window.removeEventListener('orientationchange', schedule)
  }
}
