import { onMounted, onUnmounted } from 'vue'

const CARD_SELECTOR = '[data-video-card]'
const ACTIVE_ATTR = 'data-keyboard-active'
const WHEEL_THRESHOLD = 55

/**
 * 首页视频卡片的键盘 / 滚轮导航。
 *
 * - 方向键 / 滚轮：切换 active 卡片
 * - Enter：在新标签页打开
 * - Space：在当前标签页打开
 *
 * 行为约定：
 * - 滚轮完全接管（capture + preventDefault + stopPropagation），页面本身不滚动；
 * - 每一次滚轮输入只切换一张卡片（累积 delta 达到阈值触发一次）；
 * - 切换后手动滚动滚动容器，保证 active 卡片始终进入视口。
 */
interface ScrollInstance {
  elements: () => { viewport: HTMLElement, scrollOffsetElement: HTMLElement }
  update?: () => boolean
}

export function useKeyboardCardNavigation(getOsInstance?: () => ScrollInstance | null | undefined) {
  let activeIndex = 0
  let wheelAccum = 0
  let observer: MutationObserver | undefined
  let shadowRootEl: ShadowRoot | null = null

  function getCards(): HTMLElement[] {
    return Array.from(shadowRootEl?.querySelectorAll<HTMLElement>(CARD_SELECTOR) ?? [])
  }

  function findActiveIndex(cards: HTMLElement[]): number {
    return cards.findIndex(card => card.hasAttribute(ACTIVE_ATTR))
  }

  function getInstance(): ScrollInstance | null {
    try {
      return getOsInstance?.() ?? null
    }
    catch {
      return null
    }
  }

  /** 弹出对话框（设置、确认框等）打开时不接管 */
  function hasOpenModal(): boolean {
    return !!shadowRootEl?.querySelector('.dialog')
  }

  function isEditableTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null
    if (!el)
      return false
    if (el.isContentEditable)
      return true
    const tag = el.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
      return true
    return !!el.closest?.('input, textarea, select, [contenteditable="true"]')
  }

  /** 焦点在按钮/链接等可交互元素上时，Enter / Space 交给原生行为 */
  function isFocusOnInteractiveElement(): boolean {
    const active = document.activeElement
    if (!active || active === document.body || active === document.documentElement)
      return false
    const tag = active.tagName
    return tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'TEXTAREA'
      || tag === 'SELECT' || (active as HTMLElement).isContentEditable
  }

  function applyActive(cards: HTMLElement[], index: number) {
    cards.forEach((card, i) => {
      if (i === index)
        card.setAttribute(ACTIVE_ATTR, '')
      else
        card.removeAttribute(ACTIVE_ATTR)
    })
  }

  /**
   * 滚动滚动容器，让 active 卡片完全可见（即时滚动，避免与页面滚动叠加）。
   */
  function scrollCardIntoView(card: HTMLElement) {
    const instance = getInstance()
    if (!instance)
      return

    const elements = instance.elements()
    const viewport = elements.viewport
    const scrollEl = elements.scrollOffsetElement ?? viewport
    const viewportRect = viewport.getBoundingClientRect()
    const cardRect = card.getBoundingClientRect()
    // 顶部留出 sticky tab 栏与间距，底部留一点呼吸空间
    const topPadding = 96
    const bottomPadding = 32
    const currentTop = viewport.scrollTop

    let targetTop = currentTop
    if (cardRect.top < viewportRect.top + topPadding)
      targetTop = currentTop - (viewportRect.top + topPadding - cardRect.top)
    else if (cardRect.bottom > viewportRect.bottom - bottomPadding)
      targetTop = currentTop + (cardRect.bottom - (viewportRect.bottom - bottomPadding))

    if (targetTop === currentTop)
      return

    const clamped = Math.max(0, targetTop)
    // 写入权威 viewport，然后让 OverlayScrollbars 同步内部状态
    viewport.scrollTop = clamped
    try {
      instance.update?.()
    }
    catch {
      // ignore
    }
    scrollEl.scrollTop = clamped

    // 下一帧断言目标卡片已进入视口；若被外部逻辑重置（重渲染/布局变化），再校正一次
    requestAnimationFrame(() => {
      try {
        const currentViewport = instance.elements().viewport
        const vpRect = currentViewport.getBoundingClientRect()
        const rect = card.getBoundingClientRect()
        const visible = rect.bottom > vpRect.top && rect.top < vpRect.bottom
        if (!visible && Math.abs(currentViewport.scrollTop - clamped) > 1)
          currentViewport.scrollTop = clamped
      }
      catch {
        // ignore
      }
    })
  }

  function setActive(index: number) {
    const cards = getCards()
    if (!cards.length)
      return

    const next = Math.min(cards.length - 1, Math.max(0, index))
    activeIndex = next
    applyActive(cards, next)
    scrollCardIntoView(cards[next])
  }

  /** 卡片列表变化（无限加载、组件重建）后补回高亮 */
  function ensureActive() {
    const cards = getCards()
    if (!cards.length)
      return
    if (activeIndex >= cards.length)
      activeIndex = cards.length - 1
    if (findActiveIndex(cards) < 0)
      applyActive(cards, activeIndex)
  }

  /** 第一行卡片数量，用于上下方向键跨行移动 */
  function getColumns(cards: HTMLElement[]): number {
    if (cards.length < 2)
      return 1
    const firstTop = Math.round(cards[0].getBoundingClientRect().top)
    let count = 0
    for (const card of cards) {
      if (Math.round(card.getBoundingClientRect().top) !== firstTop)
        break
      count++
    }
    return Math.max(1, count)
  }

  function openActive(target: '_blank' | '_self') {
    const cards = getCards()
    const current = findActiveIndex(cards)
    const index = current >= 0
      ? current
      : activeIndex
    const url = cards[index]?.dataset.videoUrl
    if (!url)
      return
    window.open(url, target)
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing)
      return
    if (event.ctrlKey || event.metaKey || event.altKey)
      return
    if (hasOpenModal() || isEditableTarget(event.target))
      return

    const cards = getCards()
    if (!cards.length)
      return

    if ((event.key === 'Enter' || event.key === ' ') && isFocusOnInteractiveElement())
      return

    const current = findActiveIndex(cards)
    const base = current >= 0
      ? current
      : activeIndex
    const columns = getColumns(cards)

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        setActive(base + 1)
        break
      case 'ArrowLeft':
        event.preventDefault()
        setActive(base - 1)
        break
      case 'ArrowDown':
        event.preventDefault()
        setActive(base + columns)
        break
      case 'ArrowUp':
        event.preventDefault()
        setActive(base - columns)
        break
      case 'Home':
        event.preventDefault()
        setActive(0)
        break
      case 'End':
        event.preventDefault()
        setActive(cards.length - 1)
        break
      case 'Enter':
        event.preventDefault()
        openActive('_blank')
        break
      case ' ':
        event.preventDefault()
        openActive('_self')
        break
      default:
        break
    }
  }

  function normalizeWheelDelta(event: WheelEvent): number {
    if (event.deltaMode === 1)
      return event.deltaY * 40
    if (event.deltaMode === 2)
      return event.deltaY * 800
    return event.deltaY
  }

  function handleWheel(event: WheelEvent) {
    if (hasOpenModal() || isEditableTarget(event.target))
      return

    const cards = getCards()
    if (!cards.length)
      return

    // 完全接管滚轮：页面不滚动，只做卡片切换
    event.preventDefault()
    event.stopPropagation()

    wheelAccum += normalizeWheelDelta(event)
    if (Math.abs(wheelAccum) < WHEEL_THRESHOLD)
      return

    const direction = wheelAccum > 0
      ? 1
      : -1
    // 每一下输入只切换一次，丢弃余量避免一次滚动跳过多张
    wheelAccum = 0

    const current = findActiveIndex(cards)
    const base = current >= 0
      ? current
      : activeIndex
    setActive(base + direction)
  }

  onMounted(() => {
    shadowRootEl = document.querySelector('#bewly')?.shadowRoot ?? null
    window.addEventListener('keydown', handleKeydown)
    // capture 阶段接管，先于 OverlayScrollbars 内部的 wheel 处理
    document.addEventListener('wheel', handleWheel, { capture: true, passive: false })

    if (shadowRootEl) {
      observer = new MutationObserver(() => ensureActive())
      observer.observe(shadowRootEl, { childList: true, subtree: true })
      ensureActive()
    }
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
    document.removeEventListener('wheel', handleWheel, { capture: true })
    observer?.disconnect()
    shadowRootEl?.querySelectorAll(ACTIVE_ATTR).forEach(el => el.removeAttribute(ACTIVE_ATTR))
  })
}
