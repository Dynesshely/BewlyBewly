/**
 * 用户空间增强层的交互动作：状态持久化、内容卡打标、筛选 / 密度切换、
 * j/k 高亮与打开、快速跳转、DOM 清理。
 *
 * 筛选与密度都是「给原生 DOM 打标记 + 在 <html> 上加状态类」，真正的隐藏 / 排版在
 * `src/styles/adaptedStyles/pages/userSpacePage.scss` 末尾（第 4 轮区域）。
 * 本模块零网络请求，只做本地 DOM 操作。
 */
import type { SpaceCard } from './dom'
import type { SpaceContentKind, SpaceDensity, SpaceFilterMode, SpaceQuickJumpId } from './state'

import { settings } from '~/logic'
import {
  ACTIVE_ATTR,
  CARD_ATTR,
  EMPTY_SECTION_ATTR,
  KIND_ATTR,
  ROOT_CLASS_COMPACT,
  ROOT_CLASS_FILTER_PREFIX,
  TOAST_DURATION,
} from './constants'
import { collectCards, findQuickJumpAnchor, prefersReducedMotion } from './dom'
import { getMessages } from './i18n'
import {
  migrateLegacyPreferences,
  readPreferenceDensity,
  readStoredFilter,
  readStoredPanelOpen,
  storeFilter,
  storePanelOpen,
  storePreferenceDensity,
} from './preferences'
import { ui } from './state'

const FILTER_MODES: SpaceFilterMode[] = [
  'all',
  'video',
  'article',
  'dynamic',
  'collection',
]
const KINDS: SpaceContentKind[] = [
  'video',
  'article',
  'dynamic',
  'collection',
]

let cards: SpaceCard[] = []
let toastTimer: number | null = null

function t() {
  return getMessages(settings.value.language)
}

// #region 根节点状态类
function applyDensityClass(): void {
  document.documentElement.classList.toggle(ROOT_CLASS_COMPACT, ui.density === 'compact')
}

function applyFilterClass(): void {
  const html = document.documentElement
  for (const mode of FILTER_MODES) {
    if (mode === 'all')
      continue
    html.classList.toggle(`${ROOT_CLASS_FILTER_PREFIX}${mode}`, ui.filter === mode)
  }
}
// #endregion

// #region 偏好
/** 从 sessionStorage 恢复偏好并同步到 <html> 上的状态类 */
export function restorePreferences(): void {
  migrateLegacyPreferences()
  ui.density = readPreferenceDensity()
  ui.filter = readStoredFilter()
  ui.panelOpen = readStoredPanelOpen()
  applyDensityClass()
  applyFilterClass()
}

export function setDensity(next: SpaceDensity, options: { silent?: boolean } = {}): void {
  if (ui.density === next)
    return
  ui.density = next
  storePreferenceDensity(next)
  applyDensityClass()
  if (!options.silent) {
    showToast(next === 'compact'
      ? t().densityOn
      : t().densityOff)
  }
}

/** 设置页改动密度后同步到当前页面（由入口 watch 调用，不写回 settings） */
export function syncDensityFromSettings(): void {
  const density = readPreferenceDensity()
  if (ui.density === density && document.documentElement.classList.contains(ROOT_CLASS_COMPACT) === (density === 'compact'))
    return
  ui.density = density
  applyDensityClass()
}

export function setFilter(next: SpaceFilterMode): void {
  if (ui.filter === next)
    return
  ui.filter = next
  storeFilter(next)
  applyFilterClass()
  syncSectionVisibility()
  syncVisibleCount()
  // 筛选后原来的高亮可能已经被隐藏，清掉让用户重新按 j/k 选择
  clearActive()
}

export function togglePanel(open?: boolean): void {
  const next = open ?? !ui.panelOpen
  if (ui.panelOpen === next)
    return
  ui.panelOpen = next
  storePanelOpen(next)
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
// #endregion

// #region 卡片标记 / 可见性
/** 当前筛选下可见的卡片（被 CSS 隐藏的卡片矩形为 0，直接跳过） */
function navigableCards(): SpaceCard[] {
  return cards.filter((card) => {
    if (ui.filter !== 'all' && card.kind !== ui.filter)
      return false
    const rect = card.el.getBoundingClientRect()
    return rect.width > 0 || rect.height > 0
  })
}

function syncVisibleCount(): void {
  ui.visibleCount = navigableCards().length
  ui.activeTotal = ui.visibleCount
  if (ui.activeIndex >= ui.visibleCount) {
    ui.activeIndex = -1
    ui.activeTitle = ''
  }
}

/**
 * 筛选后整块只剩别的内容时，把这一块收起来（原生页面没有 :has，只能由 JS 计算）。
 * 只处理确认存在的 `.section` 区块；卡片不在 `.section` 里的页面不受影响。
 */
function syncSectionVisibility(): void {
  const sections = document.querySelectorAll<HTMLElement>('.section')
  sections.forEach((section) => {
    if (ui.filter === 'all') {
      section.removeAttribute(EMPTY_SECTION_ATTR)
      return
    }
    const tagged = Array.from(section.querySelectorAll<HTMLElement>(`[${CARD_ATTR}]`))
    if (!tagged.length) {
      section.removeAttribute(EMPTY_SECTION_ATTR)
      return
    }
    const hasMatch = tagged.some(el => el.getAttribute(KIND_ATTR) === ui.filter)
    section.toggleAttribute(EMPTY_SECTION_ATTR, !hasMatch)
  })
}

function deselectAll(): void {
  document.querySelectorAll<HTMLElement>(`[${ACTIVE_ATTR}]`).forEach((el) => {
    el.removeAttribute(ACTIVE_ATTR)
    el.removeAttribute('aria-current')
  })
}

function activateCard(card: SpaceCard): void {
  deselectAll()
  card.el.setAttribute(ACTIVE_ATTR, '')
  card.el.setAttribute('aria-current', 'true')
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

/** 重新识别内容卡（首屏渲染、切 tab、滚动加载都会调用） */
export function scanCards(): void {
  const previousActive = document.querySelector<HTMLElement>(`[${ACTIVE_ATTR}]`)
  cards = collectCards()
  const alive = new Set(cards.map(card => card.el))

  // 站点会复用 / 移除节点：清掉已经不存在的卡片的标记
  document.querySelectorAll<HTMLElement>(`[${CARD_ATTR}]`).forEach((el) => {
    if (alive.has(el))
      return
    el.removeAttribute(CARD_ATTR)
    el.removeAttribute(KIND_ATTR)
  })

  cards.forEach((card) => {
    card.el.setAttribute(CARD_ATTR, '')
    card.el.setAttribute(KIND_ATTR, card.kind)
  })

  ui.cardCount = cards.length
  ui.availableKinds = {
    video: cards.some(card => card.kind === 'video'),
    article: cards.some(card => card.kind === 'article'),
    dynamic: cards.some(card => card.kind === 'dynamic'),
    collection: cards.some(card => card.kind === 'collection'),
  }
  ui.quickJumps = ui.quickJumps.map(item => ({
    ...item,
    available: findQuickJumpAnchor(item.id) !== null,
  }))

  // 记忆里的筛选在当前页没有对应内容时回退「全部」；
  // 只在这一页确实有内容后判断，避免首屏还没渲染完就把用户的偏好冲掉
  if (cards.length > 0 && ui.filter !== 'all' && !ui.availableKinds[ui.filter]) {
    ui.filter = 'all'
    storeFilter('all')
    applyFilterClass()
    showToast(t().filterNoMatch)
  }

  syncSectionVisibility()
  syncVisibleCount()

  if (previousActive && alive.has(previousActive)) {
    const list = navigableCards()
    const index = list.findIndex(card => card.el === previousActive)
    // 高亮卡被筛掉（或被站点移出可见区）时直接取消高亮，避免描边停在看不见的卡上
    if (index < 0) {
      clearActive()
      return
    }
    ui.activeIndex = index
    ui.activeTitle = list[index].title
    return
  }
  if (previousActive)
    clearActive()
}
// #endregion

// #region j/k 浏览
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

export function clearActive(): void {
  deselectAll()
  ui.activeIndex = -1
  ui.activeTotal = ui.visibleCount
  ui.activeTitle = ''
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
// #endregion

// #region 快速跳转
/** 点击原生 tab（交给 B 站自己的路由），找不到时返回 false 并提示 */
export function jumpTo(id: SpaceQuickJumpId): boolean {
  const anchor = findQuickJumpAnchor(id)
  if (!anchor) {
    showToast(t().jumpFailed)
    return false
  }
  anchor.click()
  // 跳转后内容整段替换，面板挡住新内容没意义，顺手收起
  togglePanel(false)
  return true
}
// #endregion

// #region 监听与清理
/** 监听内容变化（切 tab / 滚动加载），去抖后重新扫描；返回解绑函数 */
export function watchSpacePage(): () => void {
  let timer: number | null = null
  const schedule = () => {
    if (timer !== null)
      return
    timer = window.setTimeout(() => {
      timer = null
      if (!document.hidden)
        scanCards()
    }, 300)
  }
  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('popstate', schedule)
  window.addEventListener('hashchange', schedule)
  return () => {
    observer.disconnect()
    window.removeEventListener('popstate', schedule)
    window.removeEventListener('hashchange', schedule)
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
  }
}

/** 卸载时把挂在原生 DOM 上的痕迹全部撤掉，B 站页面恢复原样 */
export function cleanupDom(): void {
  if (toastTimer !== null) {
    window.clearTimeout(toastTimer)
    toastTimer = null
  }
  document.querySelectorAll<HTMLElement>(`[${CARD_ATTR}]`).forEach((el) => {
    el.removeAttribute(CARD_ATTR)
    el.removeAttribute(KIND_ATTR)
  })
  document.querySelectorAll<HTMLElement>(`[${ACTIVE_ATTR}]`).forEach((el) => {
    el.removeAttribute(ACTIVE_ATTR)
    el.removeAttribute('aria-current')
  })
  document.querySelectorAll<HTMLElement>(`[${EMPTY_SECTION_ATTR}]`).forEach((el) => {
    el.removeAttribute(EMPTY_SECTION_ATTR)
  })
  cards = []
  const html = document.documentElement
  html.classList.remove(ROOT_CLASS_COMPACT)
  for (const kind of KINDS)
    html.classList.remove(`${ROOT_CLASS_FILTER_PREFIX}${kind}`)
}
// #endregion
