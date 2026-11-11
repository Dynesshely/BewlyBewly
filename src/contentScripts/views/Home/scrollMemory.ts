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
  /** 落位后的二次校正延迟（ms），默认 [2 帧, 300ms] —— 抵消图片/卡片加载造成的布局偏移 */
  correctionDelays?: number[]
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
  const correctionDelays = options.correctionDelays ?? [0, 300]

  if (!Number.isFinite(targetTop) || targetTop <= 0)
    return () => {}

  let stopped = false
  /** 用户主动接管 / 组件卸载造成的中止（与「落位完成」区分开，后者仍要跑校正） */
  let cancelled = false
  const startedAt = performance.now()
  const cleanupFns: Array<() => void> = []
  /** 只属于轮询阶段的清理（落位后还要保留校正定时器与用户输入监听） */
  const pollingCleanup: Array<() => void> = []

  const stop = () => {
    stopped = true
    cancelled = true
    for (const fn of cleanupFns)
      fn()
  }

  // 用户主动滚动就放弃，交还控制权
  const cancelOnUserInput = () => {
    cancelled = true
    for (const fn of cleanupFns)
      fn()
  }
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
      // 首屏图片/卡片高度还会再变，落位后按同样的目标位置校正一两次；
      // 期间用户主动滚动（上面的 wheel/touchstart 监听）就放弃，不再抢滚动条。
      for (const delay of correctionDelays) {
        const timer = setTimeout(() => {
          if (cancelled)
            return
          const currentRoot = getScrollRoot()
          if (!currentRoot)
            return
          const currentMax = Math.max(0, currentRoot.scrollHeight - currentRoot.clientHeight)
          if (currentMax + 2 >= targetTop && Math.abs(currentRoot.scrollTop - targetTop) > 1)
            currentRoot.scrollTop = targetTop
        }, delay)
        cleanupFns.push(() => clearTimeout(timer))
      }
      // 校正定时器保留到最后，这里不能立刻清理监听；只停止轮询
      stopped = true
      for (const fn of pollingCleanup)
        fn()
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

/**
 * 压掉浏览器「刷新后恢复内层滚动容器位置」的行为（第 21 轮修复 BUG 1）。
 *
 * 背景：刷新页面时 Chromium 会把 `.bewly-scroll-container` 的 scrollTop 还原到刷新前的位置
 * （实测 496px），而产品要求「刷新回顶部」。第 20 轮的内存态设计只保证不从 sessionStorage 恢复，
 * 挡不住浏览器的还原，所以在首页首次挂载时主动把容器压回顶部。
 *
 * 只在挂载早期做几次（同步 + rAF×2 + 120ms + 400ms）：浏览器还原发生在首帧之后，
 * 单次同步置 0 会被覆盖；用户一旦滚动（wheel / touchstart）立即放弃，不再抢滚动条。
 * 只作用于 Bewly 自己的滚动容器，不改 documentElement，也不碰 B 站原生页面的返回行为。
 */
export function suppressInitialScrollRestore(
  getScrollRoot: () => HTMLElement | null,
  getTargetTop: () => number,
): () => void {
  let cancelled = false
  const timers: Array<ReturnType<typeof setTimeout>> = []

  const cancel = () => {
    cancelled = true
    for (const timer of timers)
      clearTimeout(timer)
    timers.length = 0
  }

  for (const eventName of ['wheel', 'touchstart'] as const)
    window.addEventListener(eventName, cancel, { passive: true })

  const apply = () => {
    if (cancelled)
      return
    const root = getScrollRoot()
    if (!root)
      return
    const target = getTargetTop()
    if (Math.abs(root.scrollTop - target) > 1)
      root.scrollTop = target
  }

  apply()
  requestAnimationFrame(() => requestAnimationFrame(apply))

  // 浏览器可能在挂载后几百毫秒才做 scroll restoration（实测有时 >500ms），
  // 这段时间里用 scroll 监听 + 若干定时点持续压回顶部；用户一滚动就整体放弃。
  const root = getScrollRoot()
  const forceTop = () => {
    if (cancelled)
      return
    const currentRoot = getScrollRoot()
    if (!currentRoot)
      return
    const target = getTargetTop()
    if (Math.abs(currentRoot.scrollTop - target) > 1)
      currentRoot.scrollTop = target
  }
  if (root)
    root.addEventListener('scroll', forceTop, { passive: true })

  for (const delay of [60, 120, 240, 400, 700, 1100]) {
    const timer = setTimeout(forceTop, delay)
    timers.push(timer)
  }
  const releaseTimer = setTimeout(() => {
    root?.removeEventListener('scroll', forceTop)
    cancel()
  }, 1600)
  timers.push(releaseTimer)

  return () => {
    root?.removeEventListener('scroll', forceTop)
    cancel()
  }
}
