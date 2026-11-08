import { onMounted, onUnmounted, watch } from 'vue'
import { settings } from '~/logic'
import { isAiFilterReady, recordAiHistory, scoreCards } from '~/utils/ai'
import emitter from '~/utils/mitt'

const CARD_SELECTOR = '[data-video-card]'
// B 站原生页面（搜索页、原生首页模式）的卡片选择器
const NATIVE_CARD_SELECTOR = '.bili-video-card'
const ACTIVE_ATTR = 'data-keyboard-active'
const WHEEL_THRESHOLD = 55
const NAV_STATE_KEY = 'bewly-keyboard-nav-state'

export type CardSortMode = 'default' | 'views' | 'duration' | 'newest'
export type CardFilterMode = 'all' | 'unwatched' | 'long' | 'followed'

export const cardSortMode = ref<CardSortMode>('default')
export const cardFilterMode = ref<CardFilterMode>('all')

const SORT_ORDER: CardSortMode[] = [
  'default',
  'views',
  'duration',
  'newest',
]
const FILTER_ORDER: CardFilterMode[] = ['all', 'unwatched', 'long', 'followed']

function parseViews(raw: string | null): number {
  if (!raw)
    return 0
  const text = raw.trim().replace(/,/g, '')
  const num = Number.parseFloat(text)
  if (Number.isNaN(num))
    return 0
  if (text.includes('亿'))
    return num * 1e8
  if (text.includes('万'))
    return num * 1e4
  return num
}

function parseDuration(raw: string | null): number {
  if (!raw)
    return 0
  return raw.split(':').reduce((acc, part) => acc * 60 + (Number.parseInt(part, 10) || 0), 0)
}

function parsePublished(raw: string | null): number {
  if (!raw)
    return 0
  const m = raw.match(/(\d+)\s*(分钟|小时|[天周年]|个月)/)
  if (m) {
    const value = Number.parseInt(m[1], 10)
    const unit: Record<string, number> = {
      分钟: 60,
      小时: 3600,
      天: 86400,
      周: 604800,
      个月: 2592000,
      年: 31536000,
    }
    return Date.now() - value * (unit[m[2]] ?? 0) * 1000
  }
  const ts = new Date(raw).getTime()
  return Number.isNaN(ts)
    ? 0
    : ts
}

function matchesFilter(card: HTMLElement): boolean {
  const filter = cardFilterMode.value
  if (filter === 'all')
    return true
  if (filter === 'followed')
    return card.getAttribute('data-video-followed') === '1'
  if (filter === 'long')
    return parseDuration(card.getAttribute('data-video-duration')) >= 600
  // unwatched：没有观看进度标记视为未看
  return card.getAttribute('data-video-progress') === null
}

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
    const bewlyCards = Array.from(shadowRootEl?.querySelectorAll<HTMLElement>(CARD_SELECTOR) ?? [])
    if (bewlyCards.length)
      return bewlyCards
    // 搜索页等原生页面：回退到 B 站原生卡片
    return Array.from(document.querySelectorAll<HTMLElement>(NATIVE_CARD_SELECTOR))
  }

  /** 仅返回当前可见（未被筛选隐藏）的卡片 */
  function getVisibleCards(): HTMLElement[] {
    return getCards().filter(card => card.style.display !== 'none')
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
      if (i === index) {
        card.setAttribute(ACTIVE_ATTR, '')
        card.setAttribute('aria-current', 'true')
      }
      else {
        card.removeAttribute(ACTIVE_ATTR)
        card.removeAttribute('aria-current')
      }
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

  function extractCardInfo(card: HTMLElement) {
    const title = (card.getAttribute('data-video-title') || card.querySelector('h3, [class*="title"]')?.textContent?.trim()) ?? ''
    const meta = card.textContent?.replace(/\s+/g, ' ').trim().slice(0, 160) ?? ''
    return {
      title: title || meta.slice(0, 60),
      meta,
      url: card.getAttribute('data-video-url') || '',
      author: card.getAttribute('data-video-author') || '',
      view: card.getAttribute('data-video-view') || '',
      duration: card.getAttribute('data-video-duration') || '',
      reason: card.querySelector('.video-reason')?.textContent?.trim() || '',
      aiScore: card.getAttribute('data-ai-score') || '',
      aiCategory: card.getAttribute('data-ai-category') || '',
    }
  }

  function focusSearchBar() {
    const root = document.querySelector('#bewly')?.shadowRoot
    const input = root?.querySelector<HTMLInputElement>('#search-wrap input, .search-bar input, input[type="text"]')
    input?.focus()
  }

  /** 按当前筛选/排序取卡片，并同步高亮到结果第一张 */
  function applyFilterAndSort(shouldScroll = true) {
    const cards = getCards()
    if (!cards.length)
      return
    const kept = cards.filter((card: HTMLElement) => matchesFilter(card))
    const hidden = cards.filter((card: HTMLElement) => !kept.includes(card))
    hidden.forEach(card => card.style.display = 'none')
    kept.forEach((card: HTMLElement) => {
      if (card.style.display === 'none')
        card.style.removeProperty('display')
    })

    const sorted = [...kept]
    const sort = cardSortMode.value
    if (sort !== 'default') {
      sorted.sort((a: HTMLElement, b: HTMLElement) => {
        if (sort === 'views')
          return parseViews(b.getAttribute('data-video-view')) - parseViews(a.getAttribute('data-video-view'))
        if (sort === 'duration')
          return parseDuration(b.getAttribute('data-video-duration')) - parseDuration(a.getAttribute('data-video-duration'))
        return parsePublished(b.getAttribute('data-video-published')) - parsePublished(a.getAttribute('data-video-published'))
      })
    }

    // 通过 order 属性让 DOM 顺序与排序结果一致（仅影响 flex/grid 顺序）
    cards.forEach((card: HTMLElement, index: number) => card.style.order = String(sorted.includes(card)
      ? sorted.indexOf(card)
      : 10000 + index))

    const first = sorted[0]
    if (first) {
      const index = cards.indexOf(first)
      activeIndex = index
      applyActive(cards, index)
      if (shouldScroll)
        scrollCardIntoView(first)
    }
    emitter.emit('keyboard-filter-change', {
      sort: cardSortMode.value,
      filter: cardFilterMode.value,
      visible: kept.length,
      total: cards.length,
    })
  }

  /** 用 AI 评分对当前页卡片重排并打标（失败静默保持原状） */
  async function runAiFilter() {
    if (!isAiFilterReady())
      return
    const cards = getVisibleCards()
    if (!cards.length)
      return
    emitter.emit('ai-filter-start', { total: cards.length })
    const metas = cards.map(card => ({
      id: card.getAttribute('data-video-url') || '',
      title: card.getAttribute('data-video-title') || '',
      author: card.getAttribute('data-video-author') || '',
      duration: card.getAttribute('data-video-duration') || '',
      view: card.getAttribute('data-video-view') || '',
      reason: card.querySelector('.video-reason')?.textContent?.trim() || '',
    })).filter(meta => meta.id)
    const scores = await scoreCards(metas)
    const scored = Object.values(scores)
    if (!scored.length) {
      emitter.emit('ai-filter-done', { ok: false })
      return
    }
    // 排序 + 角标 + 可选只保留「推荐」
    const onlyRecommended = settings.value.aiFilterOnlyRecommended
    cards.sort((a, b) => (scores[b.getAttribute('data-video-url') || '']?.score ?? -1) - (scores[a.getAttribute('data-video-url') || '']?.score ?? -1))
    let visibleCount = 0
    cards.forEach((card) => {
      const score = scores[card.getAttribute('data-video-url') || '']
      if (score) {
        card.setAttribute('data-ai-score', String(score.score))
        card.setAttribute('data-ai-category', score.category)
      }
      const isRecommended = score?.category === '推荐'
      if (onlyRecommended && score && !isRecommended)
        card.style.display = 'none'
      else
        card.style.removeProperty('display')
      if (card.style.display !== 'none') {
        card.style.order = String(visibleCount)
        visibleCount++
      }
    })
    const first = cards.find(card => card.style.display !== 'none') ?? cards[0]
    const all = getCards()
    const index = all.indexOf(first)
    if (index >= 0) {
      activeIndex = index
      applyActive(all, index)
      scrollCardIntoView(first)
    }
    emitter.emit('ai-filter-done', { ok: true, count: scored.length, visible: visibleCount })
    void recordAiHistory({
      at: Date.now(),
      total: cards.length,
      scored: scored.length,
      kept: visibleCount,
    })
    void recordAiHistory({
      at: Date.now(),
      total: cards.length,
      scored: scored.length,
      kept: visibleCount,
    })
  }

  function setActive(index: number) {
    const cards = getVisibleCards()
    if (!cards.length)
      return

    const next = Math.min(cards.length - 1, Math.max(0, index))
    activeIndex = next
    applyActive(cards, next)
    scrollCardIntoView(cards[next])
    emitter.emit('keyboard-active-card', extractCardInfo(cards[next]))
  }

  /** 卡片列表变化（无限加载、组件重建）后补回高亮 */
  /** 键盘模式切换时清理或恢复高亮 */
  function clearActiveHighlight() {
    shadowRootEl?.querySelectorAll(`[${ACTIVE_ATTR}]`).forEach(el => el.removeAttribute(ACTIVE_ATTR))
  }

  function ensureActive() {
    if (!settings.value.keyboardNavEnabled)
      return
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
    const cards = getVisibleCards()
    const current = findActiveIndex(cards)
    const index = current >= 0
      ? current
      : activeIndex
    const url = cards[index]?.dataset.videoUrl
      || cards[index]?.querySelector<HTMLAnchorElement>('a[href*="/video/"]')?.href
    if (!url)
      return
    window.open(url, target)
  }

  /** 打开当前卡片右键菜单（原生卡片 / Bewly 卡片均尽力触发） */
  function openContextMenu(card: HTMLElement | undefined) {
    if (!card)
      return
    const rect = card.getBoundingClientRect()
    card.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + 20,
      clientY: rect.top + 20,
    }))
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing)
      return
    // Ctrl/Cmd + K：命令面板是全局入口，键盘模式关闭时也要可用（用于重新开启）
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      emitter.emit('toggle-command-palette')
      return
    }
    // 键盘模式关闭：不接管其他按键，恢复原版鼠标点选
    if (!settings.value.keyboardNavEnabled)
      return
    if (event.ctrlKey || event.metaKey || event.altKey)
      return
    if (hasOpenModal() || isEditableTarget(event.target))
      return

    const cards = getVisibleCards()
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
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
        event.preventDefault()
        emitter.emit('switch-home-tab', Number(event.key) - 1)
        break
      case '/':
        event.preventDefault()
        focusSearchBar()
        break
      case 'd':
        event.preventDefault()
        openContextMenu(cards[base])
        break
      case 's': {
        event.preventDefault()
        const next = SORT_ORDER[(SORT_ORDER.indexOf(cardSortMode.value) + 1) % SORT_ORDER.length]
        cardSortMode.value = next
        applyFilterAndSort()
        break
      }
      case 'f': {
        event.preventDefault()
        const next = FILTER_ORDER[(FILTER_ORDER.indexOf(cardFilterMode.value) + 1) % FILTER_ORDER.length]
        cardFilterMode.value = next
        applyFilterAndSort()
        break
      }
      case 'i':
        event.preventDefault()
        emitter.emit('toggle-card-info-detail')
        break
      case 'q': {
        event.preventDefault()
        const card = cards[base]
        if (card)
          emitter.emit('queue-card', extractCardInfo(card))
        break
      }
      case 'Q': {
        event.preventDefault()
        void runAiFilter()
        break
      }
      case '?':
        event.preventDefault()
        emitter.emit('toggle-keyboard-help')
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

  /** 页面正常滚动时，让高亮跟随视口内第一张卡片（不触发滚动跟随） */
  function followActiveToViewport() {
    const instance = getInstance()
    const cards = getCards()
    if (!instance || !cards.length)
      return
    try {
      const vpRect = instance.elements().viewport.getBoundingClientRect()
      const visible = cards.filter(card => card.style.display !== 'none').find((card) => {
        const rect = card.getBoundingClientRect()
        return rect.bottom > vpRect.top + 96 && rect.top < vpRect.bottom - 32
      })
      if (!visible)
        return
      const index = cards.indexOf(visible)
      if (index >= 0 && index !== findActiveIndex(cards)) {
        activeIndex = index
        applyActive(cards, index)
      }
    }
    catch {
      // ignore
    }
  }

  function handleWheel(event: WheelEvent) {
    // 键盘模式关闭：不接管滚轮，恢复原版滚动
    if (!settings.value.keyboardNavEnabled)
      return
    // 模式二：不接管滚轮，页面正常滚动，高亮跟随视口内卡片
    if (!settings.value.keyboardNavLockScroll) {
      requestAnimationFrame(followActiveToViewport)
      return
    }
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

  function saveNavigationState() {
    try {
      const cards = getCards()
      const instance = getInstance()
      const active = cards.findIndex(card => card.hasAttribute(ACTIVE_ATTR))
      const url = active >= 0
        ? cards[active].getAttribute('data-video-url')
        : null
      sessionStorage.setItem(NAV_STATE_KEY, JSON.stringify({
        scrollTop: instance?.elements().viewport.scrollTop ?? 0,
        url,
      }))
    }
    catch {
      // ignore
    }
  }

  function restoreNavigationState() {
    try {
      const raw = sessionStorage.getItem(NAV_STATE_KEY)
      if (!raw)
        return
      const state = JSON.parse(raw) as { scrollTop?: number, url?: string | null }
      const cards = getCards()
      if (!cards.length)
        return
      const index = state.url
        ? cards.findIndex(card => card.getAttribute('data-video-url') === state.url)
        : -1
      if (index >= 0) {
        activeIndex = index
        applyActive(cards, index)
        scrollCardIntoView(cards[index])
        return
      }
      const instance = getInstance()
      if (instance && state.scrollTop)
        instance.elements().viewport.scrollTop = state.scrollTop
    }
    catch {
      // ignore
    }
  }

  emitter.on('command-cycle-sort', () => {
    const next = SORT_ORDER[(SORT_ORDER.indexOf(cardSortMode.value) + 1) % SORT_ORDER.length]
    cardSortMode.value = next
    applyFilterAndSort()
  })
  emitter.on('command-cycle-filter', () => {
    const next = FILTER_ORDER[(FILTER_ORDER.indexOf(cardFilterMode.value) + 1) % FILTER_ORDER.length]
    cardFilterMode.value = next
    applyFilterAndSort()
  })
  watch(() => settings.value.keyboardNavEnabled, (enabled) => {
    syncKeyboardModeFlag()
    if (enabled) {
      ensureActive()
    }
    else {
      clearActiveHighlight()
    }
  })

  emitter.on('command-focus-search', () => focusSearchBar())
  function syncKeyboardModeFlag() {
    document.documentElement.toggleAttribute('data-keyboard-nav-disabled', !settings.value.keyboardNavEnabled)
  }

  emitter.on('command-toggle-keyboard-mode', () => {
    settings.value.keyboardNavEnabled = !settings.value.keyboardNavEnabled
    syncKeyboardModeFlag()
    if (!settings.value.keyboardNavEnabled)
      clearActiveHighlight()
    else
      ensureActive()
  })
  emitter.on('command-run-ai-filter', () => {
    void runAiFilter()
  })

  onMounted(() => {
    syncKeyboardModeFlag()
    shadowRootEl = document.querySelector('#bewly')?.shadowRoot ?? null
    window.addEventListener('keydown', handleKeydown)
    window.addEventListener('pagehide', saveNavigationState)
    // capture 阶段接管，先于 OverlayScrollbars 内部的 wheel 处理
    document.addEventListener('wheel', handleWheel, { capture: true, passive: false })
    // 从播放页返回后恢复滚动位置与高亮卡片
    setTimeout(restoreNavigationState, 600)
    setTimeout(restoreNavigationState, 1500)

    if (shadowRootEl) {
      observer = new MutationObserver(() => ensureActive())
      observer.observe(shadowRootEl, { childList: true, subtree: true })
      ensureActive()
    }
  })

  onUnmounted(() => {
    emitter.off('command-cycle-sort')
    emitter.off('command-cycle-filter')
    emitter.off('command-focus-search')
    emitter.off('command-toggle-keyboard-mode')
    emitter.off('command-run-ai-filter')
    window.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('pagehide', saveNavigationState)
    document.removeEventListener('wheel', handleWheel, { capture: true })
    observer?.disconnect()
    shadowRootEl?.querySelectorAll(ACTIVE_ATTR).forEach(el => el.removeAttribute(ACTIVE_ATTR))
  })
}
