import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue'

import { settings } from '~/logic'

/**
 * 列表页（历史 / 稍后再看 / 收藏）的轻量离屏优化（**不卸载节点**）。
 *
 * 思路与动态页的 `views/Moments/composables/useVirtualList.ts` 一致，区别是这里不依赖
 * 组件 ref：列表卡片由 `ListGroupSection` 统一渲染，只要卡片根节点带
 * `data-bewly-list-card` 标记（`ListVideoCard` 是单根组件，属性会落到它的 <article> 上），
 * 本 hook 就能自己扫出来，因此三种视图模式（舒适网格 / 紧凑网格 / 时间轴列表）共用同一套逻辑。
 *
 * 做两件事：
 *   1. 两个 IntersectionObserver 算出「活跃带」（视口上下各 1.5 屏）与「缓冲区」
 *      （视口上下各 3 屏），不测量总高度，天然适配不定高卡片；
 *   2. 给卡片根节点写两个内联样式：
 *      - 活跃带 / 全局键盘导航的当前卡：`content-visibility: visible`；
 *      - 缓冲区：`content-visibility: auto`；
 *      - 更远：`content-visibility: hidden`（跳过渲染与布局，DOM 与组件状态完整保留）；
 *      三者都带 `contain-intrinsic-size: auto <高度>`，离屏卡片用记住的真实高度占位，
 *      滚动条不会因「未渲染」而跳动。
 *
 * 关闭优化（`enabled() === false` 或浏览器不支持 content-visibility）时移除全部内联样式，
 * 完全退回改动前的渲染方式。不碰 hover 快捷操作、键盘导航、无限滚动、分组与骨架屏：
 * 它只对已渲染的卡片根节点做样式级的「渲不渲染」，DOM 结构与事件一律不动。
 *
 * ⚠️ 所有查询都必须走 `#bewly` 的 shadow root：
 * Bewly 的页面（含列表页）渲染在 `#bewly` 的 shadow root 里，`document.querySelector`
 * 是**看不到** `.bewly-list-page` / `[data-bewly-list-card]` 的（曾经因此整个优化是 no-op）。
 * `getScrollRoot` 同理必须拿 shadow root 内的 `.bewly-scroll-container`，否则
 * IntersectionObserver 的 root 是错的。取法与 `views/Moments`、`useFocusBrowse`、
 * `useKeyboardCardNavigation` 保持一致。只有在 shadow root 还不存在（极早期 / 单测环境）时
 * 才回退到 `document`。
 */

export type ListCardVisibility = 'visible' | 'auto' | 'hidden'

/** 卡片根节点标记（由 ListGroupSection 写在 ListVideoCard 上） */
export const LIST_CARD_ATTR = 'data-bewly-list-card'

/** 全局键盘导航的高亮标记（App 的 useKeyboardCardNavigation 写在卡片根上） */
const ACTIVE_ATTR = 'data-keyboard-active'

const STYLE_CONTENT_VISIBILITY = 'content-visibility'
const STYLE_CONTAIN_INTRINSIC_SIZE = 'contain-intrinsic-size'
const CARD_SELECTOR = `[${LIST_CARD_ATTR}]`

/** Bewly 主应用的 shadow root；页面内容都在这里面渲染 */
function getBewlyShadowRoot(): ShadowRoot | null {
  try {
    return document.querySelector<HTMLElement>('#bewly')?.shadowRoot ?? null
  }
  catch {
    return null
  }
}

/** 列表页根节点：shadow root 内优先，取不到才回退 document（单测 / 极早期） */
function findListRoot(): ParentNode | null {
  const shadowRoot = getBewlyShadowRoot()
  if (shadowRoot)
    return shadowRoot.querySelector<HTMLElement>('.bewly-list-page') ?? null
  return document.querySelector<HTMLElement>('.bewly-list-page')
}

/** 滚动容器：必须是 shadow root 内那个，否则 IntersectionObserver 的 root 是错的 */
function findScrollRoot(): HTMLElement | null {
  const shadowRoot = getBewlyShadowRoot()
  if (shadowRoot)
    return shadowRoot.querySelector<HTMLElement>('.bewly-scroll-container') ?? null
  return document.querySelector<HTMLElement>('.bewly-scroll-container')
}

export interface UseListVirtualOptions {
  /** 是否启用：默认读 settings.momentsOptimizeEnabled（第 10 轮复用同一个开关） */
  enabled?: () => boolean
  /** 列表根节点；默认 `.bewly-list-page`，找不到退化为 document */
  getRoot?: () => ParentNode | null
  /** 滚动容器；默认 App 的 `.bewly-scroll-container`，找不到退化为视口 */
  getScrollRoot?: () => HTMLElement | null
  /** 列表长度（用于切页 / 追加时重新扫描） */
  count?: () => number
  /** 布局相关状态（视图模式 / 排序 / 过滤词）；变化后清掉旧高度重新量 */
  layoutKey?: () => unknown
  /** 活跃带：视口上下各保留多少屏（默认 1.5） */
  overscanScreens?: number
  /** 缓冲区：超过多少屏直接 hidden（默认 3） */
  hiddenScreens?: number
  /** 从未进过活跃带的卡片的占位高度（px，默认 320） */
  estimatedHeight?: number
}

function supportsContentVisibility(): boolean {
  try {
    return typeof CSS !== 'undefined' && CSS.supports('content-visibility', 'auto')
  }
  catch {
    return false
  }
}

export function useListVirtual(options: UseListVirtualOptions = {}) {
  const overscanScreens = options.overscanScreens ?? 1.5
  const hiddenScreens = options.hiddenScreens ?? 3
  const estimatedHeight = options.estimatedHeight ?? 320

  const enabled = options.enabled ?? (() => settings.value.momentsOptimizeEnabled !== false)
  const getRoot = options.getRoot ?? (() => findListRoot())
  const getScrollRoot = options.getScrollRoot ?? (() => findScrollRoot())
  const count = options.count ?? (() => 0)
  const layoutKey = options.layoutKey ?? (() => '')

  /** 已登记卡片：key → element（key 用卡片的稳定 key，筛选 / 排序后不会串行） */
  const elements = new Map<string, HTMLElement>()
  const keyOfElement = new WeakMap<Element, string>()
  const nearKeys = new Set<string>()
  const wideKeys = new Set<string>()
  /** 量过的真实高度 */
  const heights = new Map<string, number>()
  /** 观察器至少回调过一次的卡片 */
  const settled = new Set<string>()

  let nearObserver: IntersectionObserver | null = null
  let wideObserver: IntersectionObserver | null = null
  let heightObserver: ResizeObserver | null = null
  let mutationObserver: MutationObserver | null = null
  let observedRoot: ParentNode | null = null
  let observedScrollRoot: HTMLElement | null = null
  let scanTimer: number | null = null
  let activeKey = ''

  function isEnabled(): boolean {
    return enabled() && supportsContentVisibility()
  }

  function keyOf(el: Element): string {
    return el.getAttribute(LIST_CARD_ATTR) ?? ''
  }

  function intrinsicSize(key: string): string {
    const height = heights.get(key) ?? estimatedHeight
    return `auto ${Math.round(height)}px`
  }

  function resolveVisibility(key: string): ListCardVisibility {
    if (key && key === activeKey)
      return 'visible'
    // 观察器还没回报过这张卡（首帧 / 刚挂载）：先交给浏览器自己判断
    if (!settled.has(key))
      return 'auto'
    if (nearKeys.has(key))
      return 'visible'
    if (wideKeys.has(key))
      return 'auto'
    return 'hidden'
  }

  function clearStyle(el: HTMLElement): void {
    el.style.removeProperty(STYLE_CONTENT_VISIBILITY)
    el.style.removeProperty(STYLE_CONTAIN_INTRINSIC_SIZE)
  }

  function applyStyle(key: string): void {
    const el = elements.get(key)
    if (!el)
      return
    if (!isEnabled() || !nearObserver) {
      clearStyle(el)
      return
    }
    el.style.setProperty(STYLE_CONTENT_VISIBILITY, resolveVisibility(key))
    el.style.setProperty(STYLE_CONTAIN_INTRINSIC_SIZE, intrinsicSize(key))
  }

  function applyAll(): void {
    elements.forEach((_, key) => applyStyle(key))
  }

  /** 全局键盘导航的高亮卡：把最近的列表卡片找出来，始终强制渲染 */
  function readActiveKey(): string {
    const root = observedRoot ?? getRoot() ?? getBewlyShadowRoot()
    const active = (root ?? document).querySelector<HTMLElement>(`[${ACTIVE_ATTR}]`)
    if (!active)
      return ''
    const card = active.closest<HTMLElement>(CARD_SELECTOR) ?? active
    return keyOf(card)
  }

  function syncActive(): void {
    const next = readActiveKey()
    if (next === activeKey)
      return
    const previous = activeKey
    activeKey = next
    if (previous)
      applyStyle(previous)
    if (next)
      applyStyle(next)
  }

  function observeHeight(key: string): void {
    const el = elements.get(key)
    if (!el || !heightObserver)
      return
    heightObserver.observe(el)
    const measured = el.getBoundingClientRect().height
    if (measured > 0)
      heights.set(key, measured)
  }

  function unobserveHeight(key: string): void {
    const el = elements.get(key)
    if (el && heightObserver)
      heightObserver.unobserve(el)
  }

  function ensureHeightObserver(): void {
    if (heightObserver || typeof ResizeObserver === 'undefined')
      return
    heightObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement
        const key = keyOfElement.get(el) ?? keyOf(el)
        if (!key)
          continue
        const height = el.getBoundingClientRect().height
        if (height <= 0)
          continue
        heights.set(key, height)
        if (resolveVisibility(key) !== 'visible')
          applyStyle(key)
      }
    })
  }

  function handleIntersection(entries: IntersectionObserverEntry[], set: Set<string>): void {
    for (const entry of entries) {
      const el = entry.target as HTMLElement
      const key = keyOfElement.get(el) ?? keyOf(el)
      if (!key)
        continue
      if (entry.isIntersecting)
        set.add(key)
      else
        set.delete(key)
      settled.add(key)

      if (set === nearKeys) {
        if (entry.isIntersecting)
          observeHeight(key)
        else
          unobserveHeight(key)
      }

      applyStyle(key)
    }
  }

  function createObservers(root: HTMLElement | null): void {
    if (typeof IntersectionObserver === 'undefined')
      return
    nearObserver = new IntersectionObserver(
      entries => handleIntersection(entries, nearKeys),
      { root, rootMargin: `${(overscanScreens * 100).toFixed(1)}% 0px` },
    )
    wideObserver = new IntersectionObserver(
      entries => handleIntersection(entries, wideKeys),
      { root, rootMargin: `${(hiddenScreens * 100).toFixed(1)}% 0px` },
    )
  }

  function disconnectObservers(): void {
    nearObserver?.disconnect()
    wideObserver?.disconnect()
    nearObserver = null
    wideObserver = null
  }

  /** 观察器只在「首次」与「滚动容器变化」时重建；重建后旧判定全部作废，等回调重新分类 */
  function ensureObservers(scrollRoot: HTMLElement | null): void {
    if (nearObserver && scrollRoot === observedScrollRoot)
      return
    disconnectObservers()
    nearKeys.clear()
    wideKeys.clear()
    settled.clear()
    observedScrollRoot = scrollRoot
    createObservers(scrollRoot)
  }

  /** 扫描列表里的卡片：新增的挂观察器，消失的清掉内联样式 */
  function scan(): void {
    const root = getRoot() ?? document
    observedRoot = root
    const found = new Set<HTMLElement>()
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(CARD_SELECTOR))

    // root 本身也可能是卡片（防御：根节点直接带标记时）
    if (root instanceof HTMLElement && root.matches(CARD_SELECTOR))
      nodes.unshift(root)

    for (const el of nodes) {
      const key = keyOf(el)
      if (!key)
        continue
      found.add(el)
      const previousKey = keyOfElement.get(el)
      if (previousKey && previousKey !== key) {
        // 同一个 DOM 节点换了 key（重新排序 / 复用）：先摘掉旧记录
        nearKeys.delete(previousKey)
        wideKeys.delete(previousKey)
        settled.delete(previousKey)
        elements.delete(previousKey)
        nearObserver?.unobserve(el)
        wideObserver?.unobserve(el)
        heightObserver?.unobserve(el)
      }
      keyOfElement.set(el, key)
      elements.set(key, el)
    }

    // 已经不在列表里的卡片：移除内联样式并停止观察
    for (const [key, el] of Array.from(elements.entries())) {
      if (found.has(el))
        continue
      nearObserver?.unobserve(el)
      wideObserver?.unobserve(el)
      heightObserver?.unobserve(el)
      clearStyle(el)
      elements.delete(key)
      keyOfElement.delete(el)
      nearKeys.delete(key)
      wideKeys.delete(key)
      settled.delete(key)
    }

    if (!isEnabled()) {
      elements.forEach(el => clearStyle(el))
      return
    }

    ensureObservers(getScrollRoot())
    ensureHeightObserver()

    elements.forEach((el, key) => {
      nearObserver?.observe(el)
      wideObserver?.observe(el)
      applyStyle(key)
    })
    syncActive()
  }

  function scheduleScan(): void {
    if (scanTimer !== null)
      return
    scanTimer = window.setTimeout(() => {
      scanTimer = null
      scan()
    }, 120)
  }

  /** 密度 / 视图模式变化后卡片高度整体变化：清掉旧高度，等重新进入活跃带再量 */
  function resetMeasurements(): void {
    heights.clear()
    heightObserver?.disconnect()
    heightObserver = null
    ensureHeightObserver()
    nearKeys.forEach(key => observeHeight(key))
    applyAll()
  }

  /** 开关变化 / 手动刷新时重新对齐（刷新会重建观察器） */
  function refresh(): void {
    if (!isEnabled()) {
      disconnectObservers()
      heightObserver?.disconnect()
      heightObserver = null
      nearKeys.clear()
      wideKeys.clear()
      settled.clear()
      activeKey = ''
      elements.forEach(el => clearStyle(el))
      return
    }
    scan()
  }

  function destroy(): void {
    if (scanTimer !== null) {
      window.clearTimeout(scanTimer)
      scanTimer = null
    }
    disconnectObservers()
    heightObserver?.disconnect()
    heightObserver = null
    mutationObserver?.disconnect()
    mutationObserver = null
    elements.forEach(el => clearStyle(el))
    elements.clear()
    nearKeys.clear()
    wideKeys.clear()
    heights.clear()
    settled.clear()
    observedRoot = null
    observedScrollRoot = null
    activeKey = ''
  }

  onMounted(() => {
    scan()
    // 无限滚动 / 排序 / 过滤 / 切视图都会重建列表 DOM：监听根节点变化后重扫
    if (typeof MutationObserver !== 'undefined') {
      // 列表根可能还没渲染：此时观察 shadow root，等列表挂上来后再扫描
      const root: Node | null = getRoot() ?? getBewlyShadowRoot() ?? document.body
      if (root) {
        mutationObserver = new MutationObserver((records) => {
          if (!isEnabled())
            return
          // 只是键盘高亮换了卡：不必重扫整个列表，局部同步即可
          if (records.every(record => record.type === 'attributes')) {
            syncActive()
            return
          }
          scheduleScan()
        })
        mutationObserver.observe(root, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: [ACTIVE_ATTR],
        })
      }
    }
  })

  watch(
    () => [
      enabled(),
      layoutKey(),
    ] as const,
    ([nextEnabled, nextLayout], previous) => {
      if (!nextEnabled) {
        refresh()
        return
      }
      const layoutChanged = previous !== undefined && previous[1] !== nextLayout
      if (layoutChanged)
        nextTick(() => resetMeasurements())
      else
        refresh()
    },
  )

  watch(
    () => count(),
    () => {
      if (!isEnabled())
        return
      scheduleScan()
    },
  )

  onBeforeUnmount(destroy)

  return {
    refresh,
    resetMeasurements,
    destroy,
    /** 供调试 / 测试：当前写过的 content-visibility 状态 */
    isEnabled,
  }
}
