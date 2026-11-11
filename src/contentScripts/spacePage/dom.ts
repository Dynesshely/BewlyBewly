/**
 * B 站用户空间（space.bilibili.com）的 DOM 适配层。
 *
 * 这里集中所有「依赖 B 站页面结构」的查询，方便页面改版时只改这一处。
 * 选择器全部来自仓库里已经出现过、确认属于空间页真实 DOM 的类名
 * （`src/styles/adaptedStyles/pages/userSpacePage.scss`）：
 *   - 视频卡：`.large-item` / `.video-container` / `.small-item`
 *   - 专栏项：`.opus-list .opus-item` / `.article-container`
 *   - 动态卡：`.bili-dyn-item`
 *   - 合集项：`.series-item` / `#page-index .channel .channel-item`
 *   - 顶部导航：`.nav-bar` / `#navigator` / `#navigator-fixed` / `.be-tab`
 * 所有查询都允许返回空数组 / null：空间页是 SPA，切 tab 时内容整段替换。
 */
import type { SpaceContentKind, SpaceQuickJumpId } from './state'

import { HOST_ID } from './constants'

export interface SpaceCard {
  el: HTMLElement
  kind: SpaceContentKind
  title: string
  url: string
}

/** 空间页主机名 */
const SPACE_HOST_RE = /(?:^|\.)space\.bilibili\.com$/i

/** 浮层容器 id（与 index.ts 保持一致） */
export const OVERLAY_HOST_ID = HOST_ID

/**
 * 卡片分组：顺序即优先级。
 * 动态卡排最前，因为它内部常常嵌着转发视频 / 专栏卡（`.bili-dyn-item .video-container`
 * 在既有 scss 里出现过），这些内嵌卡片不应该被当成独立内容再算一条。
 */
const CARD_GROUPS: { kind: SpaceContentKind, selectors: string[] }[] = [
  {
    kind: 'dynamic',
    selectors: ['.bili-dyn-item'],
  },
  {
    kind: 'article',
    selectors: ['.opus-list .opus-item', '.article-container'],
  },
  {
    kind: 'collection',
    selectors: ['#page-index .channel .channel-item', '#page-series-index .channel-item', '.series-item'],
  },
  {
    kind: 'video',
    selectors: ['.large-item', '.video-container', '.small-item'],
  },
]

/** 这些区域里的同名节点不是内容卡（导航、头部、弹层、编辑弹窗、置顶操作面板） */
const EXCLUDE_ZONE_SELECTOR = [
  '.nav-bar',
  '#navigator',
  '#navigator-fixed',
  '.header',
  '.bili-header',
  '#pin-wrapper',
  '.modal-wrapper',
  '.follow-dialog-wrap',
  '.edit-media-list',
  '.i-mp-action-menu',
  '.bp-popup-panel',
  '.be-dropdown-menu',
].join(', ')

/** 卡片内部标题候选（按卡片类型取，取不到时退化为卡片文本） */
const TITLE_SELECTORS: Record<SpaceContentKind, string[]> = {
  video: [
    '.text-area .title',
    '.large-item .title',
    '.title',
    '.small-item .title',
  ],
  article: ['.opus-item-title', '.text-area .title', '.title'],
  dynamic: ['.bili-dyn-title__text', '.bili-dyn-content', '.title'],
  collection: ['.item-title', '.channel-name', '.title'],
}

/** 卡片内部链接候选（按优先级） */
const LINK_SELECTORS = [
  'a[href*="/video/"]',
  'a[href*="/read/"]',
  'a[href*="/opus/"]',
  'a[href*="/list/"]',
  'a[href*="/channel/"]',
  'a[href*="/favlist"]',
  'a[href]',
]

const EDITABLE_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
].join(', ')

/** 顶部导航区（快速跳转只在这些区域里找 tab） */
const NAV_ROOT_SELECTORS = [
  '.nav-bar',
  '#navigator',
  '#navigator-fixed',
  '.be-tab',
]

interface QuickJumpDef {
  id: SpaceQuickJumpId
  href: RegExp[]
  textExact: RegExp[]
  textLoose: RegExp[]
}

/** 快速跳转目标：先按 tab 文本精确匹配，再按 href 路径，最后按文本包含 */
const QUICK_JUMP_DEFS: QuickJumpDef[] = [
  {
    id: 'home',
    href: [/^\/\d+\/?$/, /^\/?$/],
    textExact: [/^主页$/, /^首页$/, /^home$/i],
    textLoose: [/主页/, /首页/],
  },
  {
    id: 'video',
    href: [/\/video(?:\/|$)/, /\/upload(?:\/|$)/],
    textExact: [/^投稿$/, /^视频$/, /^videos?$/i],
    textLoose: [/投稿/],
  },
  {
    id: 'collection',
    href: [/\/channel(?:\/|$)/, /\/series(?:\/|$)/],
    textExact: [
      /^合集$/,
      /^合集和列表$/,
      /^collections?$/i,
      /^series$/i,
    ],
    textLoose: [/合集/],
  },
  {
    id: 'favorites',
    href: [/\/favlist(?:\/|$)/],
    textExact: [
      /^收藏夹$/,
      /^收藏$/,
      /^favorites?$/i,
      /^favourites?$/i,
    ],
    textLoose: [/收藏夹/],
  },
]

export function isSpacePage(url: string = location.href): boolean {
  try {
    const parsed = new URL(url)
    if (!SPACE_HOST_RE.test(parsed.hostname))
      return false
    // 笔记页有单独的 page 样式适配（notePage.scss），不在这里重复叠一层
    return !/^\/v\/note-list/.test(parsed.pathname)
  }
  catch {
    return false
  }
}

function pickText(el: Element, selectors: string[]): string {
  for (const selector of selectors) {
    const text = el.querySelector<HTMLElement>(selector)?.textContent?.replace(/\s+/g, ' ').trim()
    if (text)
      return text
  }
  return ''
}

function pickHref(el: Element): string {
  for (const selector of LINK_SELECTORS) {
    const href = el.querySelector<HTMLAnchorElement>(selector)?.href
    if (href)
      return href
  }
  return ''
}

function compareDocumentOrder(a: HTMLElement, b: HTMLElement): number {
  if (a === b)
    return 0
  const following = a.compareDocumentPosition(b) === Node.DOCUMENT_POSITION_FOLLOWING
  return following
    ? -1
    : 1
}

/**
 * 收集当前页面的内容卡，按 DOM 顺序返回。
 *
 * 同一张卡可能命中多组选择器（例如 `.large-item` 里还套着 `.video-container`），
 * 这里用「互相包含即跳过」的方式去重：外层卡片优先，保证 j/k 每按一次只移动一张卡。
 */
export function collectCards(): SpaceCard[] {
  const cards: SpaceCard[] = []
  const seen = new Set<HTMLElement>()

  const add = (el: HTMLElement, kind: SpaceContentKind) => {
    if (seen.has(el))
      return
    if (el.closest(EXCLUDE_ZONE_SELECTOR))
      return
    const nested = cards.some(card => card.el !== el && (card.el.contains(el) || el.contains(card.el)))
    if (nested)
      return
    seen.add(el)
    cards.push({
      el,
      kind,
      title: pickText(el, TITLE_SELECTORS[kind]) || (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
      url: pickHref(el),
    })
  }

  for (const group of CARD_GROUPS) {
    for (const selector of group.selectors)
      document.querySelectorAll<HTMLElement>(selector).forEach(el => add(el, group.kind))
  }

  return cards.sort((a, b) => compareDocumentOrder(a.el, b.el))
}

function navAnchors(): HTMLAnchorElement[] {
  const anchors: HTMLAnchorElement[] = []
  const seen = new Set<HTMLAnchorElement>()
  for (const rootSelector of NAV_ROOT_SELECTORS) {
    document.querySelectorAll<HTMLAnchorElement>(`${rootSelector} a[href]`).forEach((anchor) => {
      if (seen.has(anchor))
        return
      seen.add(anchor)
      anchors.push(anchor)
    })
  }
  return anchors
}

function anchorText(anchor: HTMLAnchorElement): string {
  return (anchor.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function anchorPath(anchor: HTMLAnchorElement): string {
  try {
    return new URL(anchor.href, location.href).pathname
  }
  catch {
    return ''
  }
}

/** 找到某个快速跳转目标对应的原生 tab；找不到返回 null（面板里隐藏该项） */
export function findQuickJumpAnchor(id: SpaceQuickJumpId): HTMLAnchorElement | null {
  const def = QUICK_JUMP_DEFS.find(item => item.id === id)
  if (!def)
    return null
  const anchors = navAnchors()

  const exact = anchors.find(anchor => def.textExact.some(re => re.test(anchorText(anchor))))
  if (exact)
    return exact

  const byHref = anchors.find(anchor => def.href.some(re => re.test(anchorPath(anchor))))
  if (byHref)
    return byHref

  return anchors.find(anchor => def.textLoose.some(re => re.test(anchorText(anchor)))) ?? null
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

/**
 * 页面自检用的关键选择器（第 24 轮，只读导出）。
 */
export const probeSelectors: string[] = [
  ...CARD_GROUPS.slice(0, 2).flatMap(group => group.selectors.slice(0, 2)),
  '.nav-bar',
  '#navigator',
]
