import type { ComponentPublicInstance } from 'vue'

/**
 * 动态页的轻量虚拟列表（**不卸载节点**）。
 *
 * 长列表（1000+ 条）里逐条渲染动态卡片很贵，但直接卸载离屏节点又会丢图片状态 / 展开状态
 * / 点赞等局部状态。因此这里不接管渲染，只做两件事：
 *
 * 1. 用两个 IntersectionObserver 算出「活跃带」（视口上下各 1.5 屏）与「缓冲区」
 *    （视口上下各 3 屏），**不手写偏移量、不测量整体高度**，天然适配不定高卡片；
 * 2. 给每个卡片根节点直接写内联样式：
 *    - 活跃带 / 当前 j-k 高亮卡：`content-visibility: visible`（正常渲染）；
 *    - 缓冲区：`content-visibility: auto`（浏览器跳过离屏渲染，仍参与布局）；
 *    - 更远：`content-visibility: hidden`（跳过渲染与布局，但 DOM 与内部状态完整保留）；
 *    三者都带 `contain-intrinsic-size: auto <高度>`，让被跳过的卡片用记住的真实高度占位，
 *    滚动条不会因为「未渲染」而跳动。
 *
 * 高度来源：活跃带内的卡片用 ResizeObserver 量一次真实高度（按 index 缓存），
 * 从未进过活跃带的卡片用估算高度兜底（进带后立刻被真实高度替换）。
 *
 * 关闭优化（`enabled() === false`）时移除全部内联样式，完全退回改动前的渲染方式。
 */

export type VirtualItemVisibility = 'visible' | 'auto' | 'hidden'

export interface UseVirtualListOptions {
  /** 是否启用离屏优化（localStorage 开关 && 列表非空） */
  enabled: () => boolean
  /** 当前列表长度（用于判断是否需要重建观察器） */
  count: () => number
  /** 当前键盘高亮的卡片下标：始终强制渲染 */
  activeIndex?: () => number
  /** 滚动容器（App 的 .bewly-scroll-container）；拿不到时退化为视口 */
  getScrollRoot: () => HTMLElement | null
  /** 活跃带：视口上下各保留多少屏（默认 1.5） */
  overscanScreens?: number
  /** 缓冲区：超过多少屏直接 hidden（默认 3） */
  hiddenScreens?: number
  /** 从未渲染过的卡片的占位高度（px，默认 320） */
  estimatedHeight?: number
}

const STYLE_CONTENT_VISIBILITY = 'content-visibility'
const STYLE_CONTAIN_INTRINSIC_SIZE = 'contain-intrinsic-size'

export function useVirtualList(options: UseVirtualListOptions) {
  const overscanScreens = options.overscanScreens ?? 1.5
  const hiddenScreens = options.hiddenScreens ?? 3
  const estimatedHeight = options.estimatedHeight ?? 320

  /** 已注册的卡片根节点：index → element */
  const elements = new Map<number, HTMLElement>()
  /** 反查：element → index（IntersectionObserver / ResizeObserver 回调里用） */
  const indexOfElement = new WeakMap<Element, number>()
  /** 活跃带内的下标 */
  const nearIndexes = new Set<number>()
  /** 缓冲区内的下标（含活跃带） */
  const wideIndexes = new Set<number>()
  /** 量过的卡片真实高度 */
  const heights = new Map<number, number>()
  /** 观察器至少回调过一次的卡片：避免观察器首帧未回报时把整列表都判成 hidden */
  const settled = new Set<number>()

  let activeObserver: IntersectionObserver | null = null
  let wideObserver: IntersectionObserver | null = null
  let heightObserver: ResizeObserver | null = null
  let observedRoot: HTMLElement | null = null
  let appliedActiveIndex = -1

  function readActiveIndex(): number {
    const value = options.activeIndex?.() ?? -1
    return Number.isFinite(value)
      ? value
      : -1
  }

  function isEnabled(): boolean {
    return options.enabled() && options.count() > 0
  }

  function intrinsicSize(index: number): string {
    const height = heights.get(index) ?? estimatedHeight
    return `auto ${Math.round(height)}px`
  }

  function resolveVisibility(index: number): VirtualItemVisibility {
    if (index >= 0 && index === readActiveIndex())
      return 'visible'
    // 观察器还没回报过这张卡（首帧 / 刚挂载）：先用 auto 兜底，
    // 浏览器自己会跳过离屏渲染；等观察回调到了再细分 visible / auto / hidden
    if (!settled.has(index))
      return 'auto'
    if (nearIndexes.has(index))
      return 'visible'
    if (wideIndexes.has(index))
      return 'auto'
    return 'hidden'
  }

  function clearElementStyle(el: HTMLElement): void {
    el.style.removeProperty(STYLE_CONTENT_VISIBILITY)
    el.style.removeProperty(STYLE_CONTAIN_INTRINSIC_SIZE)
  }

  /** 把计算出的离屏状态写到卡片根节点（只碰这两个样式，不动其它内联样式） */
  function applyStyle(index: number): void {
    const el = elements.get(index)
    if (!el)
      return
    // 浏览器不支持 IntersectionObserver 时什么都不写，完全退回原渲染
    if (!isEnabled() || !activeObserver) {
      clearElementStyle(el)
      return
    }
    el.style.setProperty(STYLE_CONTENT_VISIBILITY, resolveVisibility(index))
    el.style.setProperty(STYLE_CONTAIN_INTRINSIC_SIZE, intrinsicSize(index))
  }

  function applyAll(): void {
    elements.forEach((_, index) => applyStyle(index))
  }

  function observeHeight(index: number): void {
    const el = elements.get(index)
    if (!el || !heightObserver)
      return
    heightObserver.observe(el)
    const measured = el.getBoundingClientRect().height
    if (measured > 0)
      heights.set(index, measured)
  }

  function unobserveHeight(index: number): void {
    const el = elements.get(index)
    if (el && heightObserver)
      heightObserver.unobserve(el)
  }

  function ensureHeightObserver(): void {
    if (heightObserver || typeof ResizeObserver === 'undefined')
      return
    heightObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const index = indexOfElement.get(entry.target)
        if (index === undefined)
          continue
        const el = entry.target as HTMLElement
        const height = el.getBoundingClientRect().height
        if (height <= 0)
          continue
        heights.set(index, height)
        // 只有「当前不可见」时才需要立刻刷新占位高度；可见卡片本来就是真实高度
        if (resolveVisibility(index) !== 'visible')
          applyStyle(index)
      }
    })
  }

  function handleIntersection(entries: IntersectionObserverEntry[], set: Set<number>): void {
    for (const entry of entries) {
      const index = indexOfElement.get(entry.target)
      if (index === undefined)
        continue
      if (entry.isIntersecting)
        set.add(index)
      else
        set.delete(index)
      settled.add(index)

      if (set === nearIndexes) {
        if (entry.isIntersecting)
          observeHeight(index)
        else
          unobserveHeight(index)
      }

      applyStyle(index)
    }
  }

  function createObservers(root: HTMLElement | null): void {
    if (typeof IntersectionObserver === 'undefined')
      return
    activeObserver = new IntersectionObserver(
      entries => handleIntersection(entries, nearIndexes),
      { root, rootMargin: `${(overscanScreens * 100).toFixed(1)}% 0px` },
    )
    wideObserver = new IntersectionObserver(
      entries => handleIntersection(entries, wideIndexes),
      { root, rootMargin: `${(hiddenScreens * 100).toFixed(1)}% 0px` },
    )
  }

  function disconnectObservers(): void {
    activeObserver?.disconnect()
    wideObserver?.disconnect()
    activeObserver = null
    wideObserver = null
  }

  /** 让观察器与当前滚动容器 / 开关状态保持一致（容器可能在挂载后才出现） */
  function refresh(): void {
    const enabled = isEnabled()
    const root = enabled
      ? options.getScrollRoot()
      : null

    if (!enabled) {
      disconnectObservers()
      observedRoot = null
      nearIndexes.clear()
      wideIndexes.clear()
      heightObserver?.disconnect()
      appliedActiveIndex = -1
      applyAll()
      return
    }

    if (observedRoot !== root || !activeObserver)
      recreate(root)

    ensureHeightObserver()
    elements.forEach((el, index) => {
      activeObserver?.observe(el)
      wideObserver?.observe(el)
      applyStyle(index)
    })
  }

  function recreate(root: HTMLElement | null): void {
    disconnectObservers()
    observedRoot = root
    createObservers(root)
  }

  /** v-for 里的函数 ref：注册 / 反注册卡片根节点，并立刻写入当前状态 */
  function setItemRef(el: Element | ComponentPublicInstance | null, index: number): void {
    const element = el instanceof HTMLElement
      ? el
      : ((el as ComponentPublicInstance | null)?.$el instanceof HTMLElement
          ? (el as ComponentPublicInstance).$el as HTMLElement
          : null)

    const previous = elements.get(index)
    if (previous && previous !== element) {
      activeObserver?.unobserve(previous)
      wideObserver?.unobserve(previous)
      heightObserver?.unobserve(previous)
      indexOfElement.delete(previous)
      settled.delete(index)
      if (!isEnabled())
        clearElementStyle(previous)
      elements.delete(index)
    }

    if (!element) {
      elements.delete(index)
      return
    }

    // 同一个元素换了 index（筛选 / 重新排序）时先摘掉旧记录
    const knownIndex = indexOfElement.get(element)
    if (knownIndex !== undefined && knownIndex !== index) {
      nearIndexes.delete(knownIndex)
      wideIndexes.delete(knownIndex)
      settled.delete(knownIndex)
      elements.delete(knownIndex)
    }

    elements.set(index, element)
    indexOfElement.set(element, index)

    if (!isEnabled()) {
      clearElementStyle(element)
      return
    }

    if (!activeObserver)
      refresh()
    ensureHeightObserver()
    activeObserver?.observe(element)
    wideObserver?.observe(element)
    applyStyle(index)
  }

  /** 密度切换后卡片高度整体变化：清掉旧高度，等下一次进入活跃带重新量 */
  function resetMeasurements(): void {
    heights.clear()
    heightObserver?.disconnect()
    // 活跃带内的卡片立刻按新布局重量一次（高度变了，占位与滚动条也要跟着变）
    nearIndexes.forEach(index => observeHeight(index))
    applyAll()
  }

  /** 高亮卡片变化时，把旧卡与新卡重新算一遍（新卡强制可见） */
  function syncActiveCard(next: number): void {
    if (appliedActiveIndex === next)
      return
    const previous = appliedActiveIndex
    appliedActiveIndex = next
    if (previous >= 0)
      applyStyle(previous)
    if (next >= 0)
      applyStyle(next)
  }

  /** 卸载时清干净（连同写在卡片上的内联样式） */
  function destroy(): void {
    disconnectObservers()
    heightObserver?.disconnect()
    heightObserver = null
    elements.forEach(el => clearElementStyle(el))
    elements.clear()
    nearIndexes.clear()
    wideIndexes.clear()
    heights.clear()
    settled.clear()
    observedRoot = null
    appliedActiveIndex = -1
  }

  onMounted(() => {
    refresh()
    syncActiveCard(readActiveIndex())
  })

  watch(
    () => [
      options.enabled(),
      options.count(),
      options.getScrollRoot(),
    ] as const,
    () => refresh(),
  )

  watch(
    () => options.activeIndex?.() ?? -1,
    (next) => {
      if (isEnabled())
        syncActiveCard(next)
    },
  )

  onBeforeUnmount(destroy)

  return {
    setItemRef,
    refresh,
    resetMeasurements,
    destroy,
  }
}
