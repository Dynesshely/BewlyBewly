/**
 * 搜索结果页增强层的交互动作：状态持久化、结果卡打标、密度 / 筛选切换、
 * j/k 高亮与打开、DOM 清理。
 *
 * 与 Bewly 既有键盘导航（`src/composables/useKeyboardCardNavigation.ts`，原生页上用的
 * 是 `.bili-video-card` + `data-keyboard-active`）共存的做法：
 *   - 本模块高亮 `data-bewly-search-active`；移动到某张卡时，**顺带把既有导航的
 *     `data-keyboard-active` / `aria-current` 也挪到同一张卡**，两边共享同一个
 *     「当前卡」，避免出现两套各自为政的高亮；
 *   - 反方向（按 ↑/↓ 走既有导航）时，本模块不会再移动，因为既有导航先
 *     `preventDefault()`，本模块的按键处理会直接让行（见 keyboard.ts）。
 * 这套同步是 best-effort：上游若改掉属性名，同步失效但不影响本模块功能。
 */
import type { SearchResultCard } from './dom'
import type { SearchDensity, SearchFilterMode } from './state'

import { settings } from '~/logic'

import { collectResultCards, prefersReducedMotion } from './dom'
import { getMessages } from './i18n'
import { ui } from './state'

/** 本模块高亮属性 */
export const ACTIVE_ATTR = 'data-bewly-search-active'
/** 结果卡标记（值 = 在结果列表中的序号，从 1 开始） */
const CARD_ATTR = 'data-bewly-search-card'
/** 结果卡类型：video / user */
const KIND_ATTR = 'data-bewly-search-kind'
/** Bewly 既有键盘导航的当前卡属性（只做同步，不拥有） */
const COMPAT_ACTIVE_ATTR = 'data-keyboard-active'
/** 被屏蔽词过滤器隐藏的卡片属性（src/utils/nativeFilter.ts） */
const NATIVE_FILTERED_ATTR = 'data-bewly-filtered'

const HTML_COMPACT_CLASS = 'bewly-search-compact'
const HTML_FILTER_VIDEO_CLASS = 'bewly-search-filter-video'
const HTML_FILTER_USER_CLASS = 'bewly-search-filter-user'

const DENSITY_KEY = 'bewly-search-density'
const FILTER_KEY = 'bewly-search-filter'
const PANEL_KEY = 'bewly-search-panel'
const TOAST_DURATION = 1600

let cards: SearchResultCard[] = []
let toastTimer: number | null = null
/** 被本模块同步过 `data-keyboard-active` 的卡片，卸载时只清理这一批 */
const mirroredActive = new Set<HTMLElement>()

function t() {
  return getMessages(settings.value.language)
}

function readStored(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key)
  }
  catch {
    return null
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value)
  }
  catch {
    // 隐私模式 / 存储被禁用时静默降级为「不记忆」
  }
}

function readDensity(): SearchDensity {
  return readStored(DENSITY_KEY) === 'compact'
    ? 'compact'
    : 'comfortable'
}

function readFilter(): SearchFilterMode {
  const stored = readStored(FILTER_KEY)
  return stored === 'video' || stored === 'user'
    ? stored
    : 'all'
}

function readPanelOpen(): boolean {
  return readStored(PANEL_KEY) === '1'
}

function applyDensityClass(): void {
  document.documentElement.classList.toggle(HTML_COMPACT_CLASS, ui.density === 'compact')
}

function applyFilterClass(): void {
  const html = document.documentElement
  html.classList.toggle(HTML_FILTER_VIDEO_CLASS, ui.filter === 'video')
  html.classList.toggle(HTML_FILTER_USER_CLASS, ui.filter === 'user')
}

/** 从 sessionStorage 恢复偏好并同步到 `<html>` 上的状态类 */
export function restorePreferences(): void {
  ui.density = readDensity()
  ui.filter = readFilter()
  ui.panelOpen = readPanelOpen()
  applyDensityClass()
  applyFilterClass()
}

export function setDensity(next: SearchDensity, options: { silent?: boolean } = {}): void {
  if (ui.density === next)
    return
  ui.density = next
  writeStored(DENSITY_KEY, next)
  applyDensityClass()
  if (!options.silent) {
    showToast(next === 'compact'
      ? t().densityOn
      : t().densityOff)
  }
}

export function setFilter(next: SearchFilterMode): void {
  if (ui.filter === next)
    return
  ui.filter = next
  writeStored(FILTER_KEY, next)
  applyFilterClass()
  // 筛选后原来的高亮可能已经被隐藏，清掉让用户重新按 j/k 选择
  clearActive()
}

export function togglePanel(open?: boolean): void {
  const next = open ?? !ui.panelOpen
  if (ui.panelOpen === next)
    return
  ui.panelOpen = next
  writeStored(PANEL_KEY, next ? '1' : '0')
}

export function showToast(text: string): void {
  if (!text)
    return
  ui.toast = text
  if (toastTimer !== null)
    window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastTimer = null
    ui.toast = ''
  }, TOAST_DURATION)
}

/** 当前筛选模式下可浏览的卡片（跳过被隐藏 / 被屏蔽词过滤的卡片） */
function navigableCards(): SearchResultCard[] {
  return cards.filter((card) => {
    if (ui.filter === 'video' && card.kind !== 'video')
      return false
    if (ui.filter === 'user' && card.kind !== 'user')
      return false
    if (card.el.hasAttribute(NATIVE_FILTERED_ATTR))
      return false
    const rect = card.el.getBoundingClientRect()
    return rect.width > 0 || rect.height > 0
  })
}

function deselectAll(): void {
  cards.forEach((card) => {
    card.el.removeAttribute(ACTIVE_ATTR)
    card.el.removeAttribute('aria-current')
  })
  mirroredActive.forEach(el => el.removeAttribute(COMPAT_ACTIVE_ATTR))
  mirroredActive.clear()
}

function activateCard(card: SearchResultCard): void {
  deselectAll()
  card.el.setAttribute(ACTIVE_ATTR, '')
  // 与既有键盘导航共享「当前卡」
  card.el.setAttribute(COMPAT_ACTIVE_ATTR, '')
  card.el.setAttribute('aria-current', 'true')
  mirroredActive.add(card.el)
  const list = navigableCards()
  ui.activeIndex = list.indexOf(card)
  ui.activeTotal = list.length
  ui.activeTitle = card.title
  card.el.scrollIntoView({
    block: 'center',
    behavior: prefersReducedMotion()
      ? 'auto'
      : 'smooth',
  })
}

/** 让下一条 / 上一条结果成为当前卡；到头循环 */
export function moveActive(delta: number): void {
  const list = navigableCards()
  if (!list.length) {
    showToast(t().noCards)
    return
  }

  const current = document.querySelector<HTMLElement>(`[${ACTIVE_ATTR}]`)
  let index = current
    ? list.findIndex(card => card.el === current)
    : -1
  if (index === -1) {
    index = delta > 0
      ? -1
      : 0
  }
  const next = (index + delta + list.length) % list.length
  activateCard(list[next])
}

export function openActiveCard(): void {
  const current = document.querySelector<HTMLElement>(`[${ACTIVE_ATTR}]`)
  if (!current)
    return
  const card = cards.find(item => item.el === current)
  if (!card || !card.url) {
    showToast(t().noUrl)
    return
  }
  try {
    window.open(card.url, '_blank')
    showToast(t().opened)
  }
  catch {
    showToast(t().openFailed)
  }
}

export function clearActive(): void {
  deselectAll()
  ui.activeIndex = -1
  ui.activeTotal = 0
  ui.activeTitle = ''
}

/** 重新识别结果卡（首次渲染、滚动分页、切换标签、筛选栏变化都会调用） */
export function scanResultCards(): void {
  const previousActive = document.querySelector<HTMLElement>(`[${ACTIVE_ATTR}]`)
  cards = collectResultCards()
  const alive = new Set(cards.map(card => card.el))

  // 站点会复用 / 移除节点：清掉已经不存在的卡片的标记
  document.querySelectorAll<HTMLElement>(`[${CARD_ATTR}]`).forEach((el) => {
    if (alive.has(el))
      return
    el.removeAttribute(CARD_ATTR)
    el.removeAttribute(KIND_ATTR)
  })

  cards.forEach((card, index) => {
    card.el.setAttribute(CARD_ATTR, String(index + 1))
    card.el.setAttribute(KIND_ATTR, card.kind)
  })

  ui.cardCount = cards.length
  ui.hasVideoCards = cards.some(card => card.kind === 'video')
  ui.hasUserCards = cards.some(card => card.kind === 'user')

  // 记忆里的筛选模式在当前页没有对应结果时回退「全部」；
  // 只在确实识别到结果后判断，避免首屏还没渲染完就把用户的偏好冲掉
  if (cards.length > 0) {
    if (ui.filter === 'video' && !ui.hasVideoCards) {
      setFilter('all')
      showToast(t().filterNoMatch)
    }
    else if (ui.filter === 'user' && !ui.hasUserCards) {
      setFilter('all')
      showToast(t().filterNoMatch)
    }
  }

  if (previousActive && alive.has(previousActive)) {
    const list = navigableCards()
    const index = list.findIndex(card => card.el === previousActive)
    ui.activeIndex = index
    ui.activeTotal = list.length
    ui.activeTitle = index >= 0
      ? list[index].title
      : ''
    return
  }
  if (previousActive)
    clearActive()
}

/** 监听结果区变化（滚动分页 / 切换标签 / 筛选），去抖后重新扫描 */
export function watchResultCards(): () => void {
  let timer: number | null = null
  const observer = new MutationObserver(() => {
    if (timer !== null)
      return
    timer = window.setTimeout(() => {
      timer = null
      scanResultCards()
    }, 300)
  })
  observer.observe(document.body, { childList: true, subtree: true })
  return () => {
    observer.disconnect()
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
  }
}

/** 卸载时把挂在原生 DOM 上的痕迹全部撤掉，B 站页面恢复原样 */
export function cleanupDom(): void {
  clearActive()
  if (toastTimer !== null) {
    window.clearTimeout(toastTimer)
    toastTimer = null
  }
  document.querySelectorAll<HTMLElement>(`[${CARD_ATTR}]`).forEach((el) => {
    el.removeAttribute(CARD_ATTR)
    el.removeAttribute(KIND_ATTR)
  })
  document.querySelectorAll<HTMLElement>(`[${ACTIVE_ATTR}]`).forEach(el => el.removeAttribute(ACTIVE_ATTR))
  cards = []
  const html = document.documentElement
  html.classList.remove(HTML_COMPACT_CLASS, HTML_FILTER_VIDEO_CLASS, HTML_FILTER_USER_CLASS)
}
