/**
 * B 站搜索结果页（search.bilibili.com）的 DOM 适配层。
 *
 * 这里集中所有「依赖 B 站页面结构」的查询，方便页面改版时只改这一处：
 *   - 结果卡根节点：`.bili-video-card` / `.b-user-video-card`（第 2 轮 native-style
 *     已从真实搜索页快照确认过），并保留 `.video-list-item` / `.search-page-video`
 *     两个历史兜底选择器（同时存在于 src/utils/nativeFilter.ts 的搜索页规则里）；
 *   - 标题、链接同样带多组候选。
 * 所有查询都允许返回空数组 / null：搜索结果是异步渲染的，滚动分页时还会不断追加。
 */

/** 结果卡类型 */
type SearchResultKind = 'video' | 'user'

export interface SearchResultCard {
  el: HTMLElement
  kind: SearchResultKind
  url: string
  title: string
}

/** 搜索页主机名（含 search.bilibili.com 本身与可能的子域） */
const SEARCH_PAGE_HOST_RE = /(?:^|\.)search\.bilibili\.com$/i

/** 结果区根节点候选（按优先级） */
const RESULT_ROOT_SELECTORS = [
  '.search-content',
  '.search-layout',
  '#search-content',
]

/** 视频结果卡候选「已确认 + 历史兜底」 */
const VIDEO_CARD_SELECTORS = [
  '.bili-video-card',
  '.video-list-item',
  '.search-page-video',
]

/** 用户（UP 主）结果卡 */
const USER_CARD_SELECTORS = [
  '.b-user-video-card',
]

/** UP 主卡内部的小视频网格不是独立结果，收集视频卡时要跳过 */
const USER_CARD_SELECTOR = USER_CARD_SELECTORS.join(', ')

/** 这些区域里的卡片不是「搜索结果」，不参与 j/k 浏览 */
const EXCLUDE_ZONE_SELECTOR = [
  '.search-header',
  '.bili-header',
  '#biliMainHeader',
  '.search-tabs',
  '.vui_tabs',
  '.more-conditions',
  '.search-conditions',
].join(', ')

const VIDEO_TITLE_SELECTORS = [
  '.bili-video-card__info--tit',
  'h3',
  '.title',
]

const USER_TITLE_SELECTORS = [
  '.user-name',
  '.b-user-video-card__info--name',
  '.up-name',
]

const EDITABLE_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
].join(', ')

/** 浮层容器 id（与 index.ts 的 HOST_ID 保持一致） */
export const OVERLAY_HOST_ID = 'bewly-search-enhance'

export function isSearchPage(url: string = location.href): boolean {
  try {
    return SEARCH_PAGE_HOST_RE.test(new URL(url).hostname)
  }
  catch {
    return false
  }
}

function getResultRoot(): ParentNode {
  for (const selector of RESULT_ROOT_SELECTORS) {
    const root = document.querySelector<HTMLElement>(selector)
    if (root)
      return root
  }
  return document.body
}

function pickText(el: Element, selectors: string[]): string {
  for (const selector of selectors) {
    const text = el.querySelector<HTMLElement>(selector)?.textContent?.replace(/\s+/g, ' ').trim()
    if (text)
      return text
  }
  return ''
}

function pickHref(el: Element, selectors: string[], fallbackToFirstAnchor = true): string {
  for (const selector of selectors) {
    const href = el.querySelector<HTMLAnchorElement>(selector)?.href
    if (href)
      return href
  }
  if (fallbackToFirstAnchor)
    return el.querySelector<HTMLAnchorElement>('a[href]')?.href ?? ''
  return ''
}

/**
 * 收集当前页面的结果卡，按 DOM 顺序返回。
 *
 * 视频卡与用户卡混在同一个列表里（「综合」标签下两者都会出现），所以这里先各自查询
 * 再按 `compareDocumentPosition` 排回真实顺序，保证 j/k 的移动方向与视觉一致。
 */
export function collectResultCards(): SearchResultCard[] {
  const root = getResultRoot()
  const cards: SearchResultCard[] = []
  const seen = new Set<HTMLElement>()

  const push = (el: HTMLElement, kind: SearchResultKind) => {
    if (seen.has(el))
      return
    // 结果区外的顶栏 / 筛选栏里的同名卡片不算结果
    if (el.closest(EXCLUDE_ZONE_SELECTOR))
      return
    seen.add(el)
    cards.push({
      el,
      kind,
      url: kind === 'user'
        ? pickHref(el, ['a[href*="space.bilibili.com"]', '.user-name'])
        : pickHref(el, ['a[href*="/video/"]']),
      title: kind === 'user'
        ? pickText(el, USER_TITLE_SELECTORS)
        : pickText(el, VIDEO_TITLE_SELECTORS),
    })
  }

  for (const selector of USER_CARD_SELECTORS) {
    root.querySelectorAll<HTMLElement>(selector).forEach(el => push(el, 'user'))
  }

  for (const selector of VIDEO_CARD_SELECTORS) {
    root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      // UP 主卡里的视频小网格不是独立结果
      if (el.closest(USER_CARD_SELECTOR))
        return
      // 用户卡本身也可能带 bili-video-card 类名，已在上面收过就不再重复
      push(el, 'video')
    })
  }

  return cards.sort((a, b) => {
    if (a.el === b.el)
      return 0
    const following = a.el.compareDocumentPosition(b.el) === Node.DOCUMENT_POSITION_FOLLOWING
    return following
      ? -1
      : 1
  })
}

/** 焦点在输入框 / 下拉框 / 可编辑区域里时不劫持快捷键 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (target instanceof Element)
    return target.closest(EDITABLE_SELECTOR) !== null
  return document.activeElement instanceof Element
    && document.activeElement.closest(EDITABLE_SELECTOR) !== null
}

/** 焦点是否落在原生按钮 / 链接上（此时 Enter 应交给原生行为） */
export function isFocusOnInteractive(): boolean {
  const active = document.activeElement
  if (!active || active === document.body || active === document.documentElement)
    return false
  if (active === document.getElementById(OVERLAY_HOST_ID))
    return false
  return active.matches('a[href], button, [role="button"], summary')
}

/** 事件是否来自本模块自己的浮层（shadow root 里的事件会以 host 出现在 composedPath 中） */
export function isFromOverlay(event: Event): boolean {
  const host = document.getElementById(OVERLAY_HOST_ID)
  return Boolean(host && event.composedPath().includes(host))
}

/** 事件是否来自 Bewly 自己的 UI（`#bewly` 浮层） */
export function isFromBewlyUi(event: Event): boolean {
  const bewly = document.getElementById('bewly')
  return Boolean(bewly && event.composedPath().includes(bewly))
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
