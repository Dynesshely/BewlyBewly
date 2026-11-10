/**
 * 分区 / 频道页增强层的交互动作：状态持久化、视频卡打标、密度切换、排序快捷、
 * j/k 高亮与打开、页面级样式注入、DOM 清理。
 *
 * 密度 / 高亮是「给原生 DOM 打标记 + 在 <html> 上加状态类」；
 * 排序是「点原生排序 tab」（交给 B 站自己的逻辑），本模块零网络请求。
 */
import type { ChannelCard } from './dom'
import type { ChannelDensity, ChannelPageKind, ChannelRankPeriod, ChannelSortId } from './state'

import { settings } from '~/logic'
import { injectCSS } from '~/utils/main'

import {
  ACTIVE_ATTR,
  CARD_ATTR,
  PAGE_KIND_ATTR,
  PAGE_STYLE_ID,
  RANK_ATTR,
  RANK_NATIVE_ATTR,
  RANK_TIER_ATTR,
  ROOT_CLASS_COMPACT,
  ROOT_CLASS_PAGE,
  TOAST_DURATION,
} from './constants'
import {
  collectCards,
  findRankTab,
  findSortTab,
  getChannelPageKind,
  prefersReducedMotion,
  readNativeRank,
} from './dom'
import { getMessages } from './i18n'
import { readStoredDensity, readStoredPanelOpen, storeDensity, storePanelOpen } from './preferences'
import { ui } from './state'

const SORT_IDS: ChannelSortId[] = ['default', 'views', 'newest']
const RANK_PERIODS: ChannelRankPeriod[] = ['day', 'week', 'month']

let cards: ChannelCard[] = []
let toastTimer: number | null = null
/** 页面级样式文本（由 index.ts 传入，用于两个注入点的去重） */
let pageCss = ''

function t() {
  return getMessages(settings.value.language)
}

// #region 页面级样式注入
/**
 * 页面级 CSS 的注入点有两个：
 *   1. tv / movie / variety / mooc / documentary 这几个子频道由 adaptedStyles 注入
 *      `channelPage`（见 `src/styles/adaptedStyles/index.ts`），其中 @use 了本模块的
 *      `pageStyles.scss`，因此这些页面**不需要**再注入；
 *   2. `/v/*`、`/channel/*` 不在 adaptedStyles 的注入清单里，由本模块自己注入
 *      `pageStyles.scss?inline`，两个入口共用同一份规则，不会出现两套样式。
 */
export function injectPageStyles(css: string): void {
  pageCss = css
  syncPageStyles()
}

/**
 * 让「页面级样式」恰好存在一份：
 *   - adaptedStyles 已经接管（tv / movie / variety / mooc / documentary）时，
 *     规则由它的 <link> 提供，本模块注入的 <style> 就撤掉；
 *   - 其余路径（/v/*、/channel/*）由本模块注入。
 * 每轮扫描都会再对一次，避免 adaptedStyles 的类名比本模块晚到造成的重复。
 */
export function syncPageStyles(): void {
  const adaptedTakeover = document.documentElement.classList.contains('channelPage')
  const existing = document.getElementById(PAGE_STYLE_ID)
  if (adaptedTakeover) {
    existing?.remove()
    return
  }
  if (existing || !pageCss)
    return
  const styleEl = injectCSS(pageCss)
  styleEl.id = PAGE_STYLE_ID
}

function removePageStyles(): void {
  document.getElementById(PAGE_STYLE_ID)?.remove()
}
// #endregion

// #region 偏好
/** 从 sessionStorage 恢复偏好并同步到 <html> 上的状态类 */
export function restorePreferences(): void {
  ui.density = readStoredDensity()
  ui.panelOpen = readStoredPanelOpen()
  applyDensityClass()
}

function applyDensityClass(): void {
  document.documentElement.classList.toggle(ROOT_CLASS_COMPACT, ui.density === 'compact')
}

export function setDensity(next: ChannelDensity, options: { silent?: boolean } = {}): void {
  if (ui.density === next)
    return
  ui.density = next
  storeDensity(next)
  applyDensityClass()
  if (!options.silent) {
    showToast(next === 'compact'
      ? t().densityOn
      : t().densityOff)
  }
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

// #region 卡片标记 / j/k
function visibleCards(): ChannelCard[] {
  return cards.filter((card) => {
    const rect = card.el.getBoundingClientRect()
    return rect.width > 0 || rect.height > 0
  })
}

function deselectAll(): void {
  document.querySelectorAll<HTMLElement>(`[${ACTIVE_ATTR}]`).forEach((el) => {
    el.removeAttribute(ACTIVE_ATTR)
    el.removeAttribute('aria-current')
  })
}

function activateCard(card: ChannelCard): void {
  deselectAll()
  card.el.setAttribute(ACTIVE_ATTR, '')
  card.el.setAttribute('aria-current', 'true')
  const list = visibleCards()
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

/** 重新识别视频卡（首屏渲染、切排序 / 翻页、滚动加载都会调用） */
export function scanCards(): void {
  const previousActive = document.querySelector<HTMLElement>(`[${ACTIVE_ATTR}]`)
  const kind = getChannelPageKind()
  ui.pageKind = kind
  document.documentElement.setAttribute(PAGE_KIND_ATTR, kind)
  cards = collectCards(kind)
  const alive = new Set(cards.map(card => card.el))

  // 站点会复用 / 移除节点：清掉已经不存在的卡片的标记
  document.querySelectorAll<HTMLElement>(`[${CARD_ATTR}]`).forEach((el) => {
    if (alive.has(el))
      return
    el.removeAttribute(CARD_ATTR)
  })

  cards.forEach(card => card.el.setAttribute(CARD_ATTR, ''))

  syncPageStyles()
  applyRankBadges(kind)

  ui.cardCount = cards.length
  ui.activeTotal = cards.length
  // 排序快捷只属于分区页；榜单快捷只属于排行榜页，找不到的原生 tab 一律隐藏
  ui.sortTabs = SORT_IDS.map(id => ({
    id,
    available: kind === 'channel' && findSortTab(id) !== null,
  }))
  ui.rankTabs = RANK_PERIODS.map(period => ({
    period,
    available: kind === 'rank' && findRankTab(period) !== null,
  }))

  if (previousActive && alive.has(previousActive)) {
    const list = visibleCards()
    const index = list.findIndex(card => card.el === previousActive)
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

export function moveActive(delta: number): void {
  const list = visibleCards()
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
  ui.activeTotal = cards.length
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

// #region 排名徽标
/**
 * 排行榜页的名次徽标。
 *
 * 名次优先读原生名次元素（`.num` / `.rank` 等，见 dom.ts 的 NATIVE_RANK_SELECTORS），
 * 读不到就退回卡片在当前列表里的 DOM 顺序 —— 排行榜的排列顺序本身就是名次。
 * 非排行榜页不写任何标记（样式也就不会出现徽标）。
 */
function applyRankBadges(kind: ChannelPageKind): void {
  document.querySelectorAll<HTMLElement>(`[${RANK_ATTR}]`).forEach((el) => {
    el.removeAttribute(RANK_ATTR)
    el.removeAttribute(RANK_TIER_ATTR)
  })
  document.querySelectorAll<HTMLElement>(`[${RANK_NATIVE_ATTR}]`).forEach((el) => {
    el.removeAttribute(RANK_NATIVE_ATTR)
  })

  if (kind !== 'rank')
    return

  cards.forEach((card, index) => {
    const native = readNativeRank(card.el)
    const rank = native?.rank ?? index + 1
    if (rank < 1 || rank > 9999)
      return
    card.el.setAttribute(RANK_ATTR, String(rank))
    card.el.setAttribute(RANK_TIER_ATTR, rank <= 3
      ? 'top3'
      : rank <= 10
        ? 'top10'
        : '')
    // 同一个名次不要显示两次：徽标接管后隐藏原生数字
    if (native)
      native.el.setAttribute(RANK_NATIVE_ATTR, '')
  })
}
// #endregion

// #region 排序快捷
/** 排序 tab 映射到 i18n 文案 */
export function sortLabel(id: ChannelSortId): string {
  if (id === 'views')
    return t().sortViews
  if (id === 'newest')
    return t().sortNewest
  return t().sortDefault
}

/**
 * 点击原生排序 tab（交给 B 站自己的逻辑），找不到时返回 false 并提示。
 * 点击后内容会整段替换，面板顺手收起，避免挡住新内容。
 */
export function applySort(id: ChannelSortId): boolean {
  const tab = findSortTab(id)
  if (!tab) {
    showToast(t().sortFailed)
    return false
  }
  tab.click()
  togglePanel(false)
  showToast(sortLabel(id))
  return true
}
/** 点原生榜单 tab（日 / 周 / 月榜），找不到时返回 false 并提示 */
export function applyRank(period: ChannelRankPeriod): boolean {
  const tab = findRankTab(period)
  if (!tab) {
    showToast(t().rankFailed)
    return false
  }
  tab.click()
  togglePanel(false)
  showToast(rankLabel(period))
  return true
}

/** 榜单周期映射到 i18n 文案 */
export function rankLabel(period: ChannelRankPeriod): string {
  if (period === 'week')
    return t().rankWeek
  if (period === 'month')
    return t().rankMonth
  return t().rankDay
}
// #endregion

// #region 监听与清理
/** 监听内容变化（切排序 / 翻页 / 无限加载），去抖后重新扫描；返回解绑函数 */
export function watchChannelPage(): () => void {
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
  })
  document.querySelectorAll<HTMLElement>(`[${ACTIVE_ATTR}]`).forEach((el) => {
    el.removeAttribute(ACTIVE_ATTR)
    el.removeAttribute('aria-current')
  })
  document.querySelectorAll<HTMLElement>(`[${RANK_ATTR}]`).forEach((el) => {
    el.removeAttribute(RANK_ATTR)
    el.removeAttribute(RANK_TIER_ATTR)
  })
  document.querySelectorAll<HTMLElement>(`[${RANK_NATIVE_ATTR}]`).forEach((el) => {
    el.removeAttribute(RANK_NATIVE_ATTR)
  })
  cards = []
  const html = document.documentElement
  html.removeAttribute(PAGE_KIND_ATTR)
  html.classList.remove(ROOT_CLASS_COMPACT, ROOT_CLASS_PAGE)
  removePageStyles()
}
// #endregion
