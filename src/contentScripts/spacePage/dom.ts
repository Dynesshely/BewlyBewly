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

// #region 第 92 轮：空间页自绘（头部信息 + 视频网格）
//
// 目标：UP 主空间页的「头部信息卡 + 视频网格」由我们自绘，原生头部在我们接管成功后隐藏。
//
// 设计原则（无法真机验证时的安全策略）：
// - 所有选择器都是**候选集合 + 文本启发**，任一关键字段（昵称）取不到就返回 null，
//   调用方据此**完全回退原生**（不隐藏、不插卡），保证最坏情况下页面与改动前一致；
// - 只读取 DOM，不改原生节点（除了给列表容器打标记），卸载时清理干净。

/** 自绘头部卡需要的字段（全部来自原生 DOM，不请求 API） */
export interface SpaceProfile {
  /** 昵称（必填；取不到就不接管） */
  name: string
  /** 头像地址（可能为空） */
  avatar: string
  /** 签名（可能为空） */
  signature: string
  /** 粉丝数文本（可能为空） */
  followers: string
  /** 关注数文本（可能为空） */
  following: string
  /** 等级（如 `LV6`，可能为空） */
  level: string
  /** 是否有认证徽标 */
  verified: boolean
  /** 原生关注按钮（点击时转发给它，保留 B 站自己的关注弹层/校验） */
  followButton: HTMLElement | null
}

/** 头部区域候选（按优先级） */
const HEADER_SELECTORS = [
  '.header.space-header',
  '.space-header',
  '.header',
  '.upinfo.header-upinfo',
  '[class*="header-content"]',
] as const

/** 昵称候选（先具体类名，再 h1，最后退回「头部里最大的粗体文本」） */
const NAME_SELECTORS = [
  '.upinfo-name',
  '.upinfo [class*="name"]',
  '[class*="upinfo-name"]',
  '[class*="up-name"]',
  '[class*="nickname"]',
  '.header h1',
  '.header [class*="name"]',
] as const

/** 签名候选 */
const SIGNATURE_SELECTORS = [
  '.upinfo-desc',
  '[class*="upinfo-desc"]',
  '[class*="sign"]',
  '[class*="desc"]',
] as const

/** 关注按钮候选（B 站空间页头部按钮） */
const FOLLOW_BUTTON_SELECTORS = [
  '.header .default-btn',
  '.header [class*="follow"] button',
  '.header button[class*="follow"]',
  '.header .follow-btn',
  '.header .btn-follow',
] as const

function firstMatch<T extends Element>(selectors: readonly string[], root: ParentNode = document): T | null {
  for (const selector of selectors) {
    const el = root.querySelector<T>(selector)
    if (el)
      return el
  }
  return null
}

function textOf(el: Element | null): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** 从头部区域文本里抓「N 粉丝 / N 关注」（中英混排都能命中） */
function pickCount(text: string, keyword: RegExp): string {
  const matched = text.match(new RegExp(`([\\d.,]+\\s*[万亿]?)\\s*(?:${keyword.source})`, 'i'))
  return matched?.[1]?.trim() ?? ''
}

/** 头像：头部里第一个尺寸足够大的 img */
function pickAvatar(header: Element | null): string {
  if (!header)
    return ''
  const preferred = header.querySelector<HTMLImageElement>('.upinfo-avatar img, .space-avatar img, .bili-avatar img, [class*="avatar"] img, img')
  if (!preferred)
    return ''
  const src = preferred.getAttribute('src') ?? preferred.getAttribute('data-src') ?? ''
  return src.startsWith('//')
    ? `https:${src}`
    : src
}

/** 等级：优先 `[class*="level"]` 里的文本 / img alt */
function pickLevel(header: Element | null): string {
  if (!header)
    return ''
  const node = header.querySelector<HTMLElement>('[class*="level"]')
  if (!node)
    return ''
  const text = textOf(node)
  if (text)
    return text
  const img = node.querySelector<HTMLImageElement>('img')
  return img?.alt?.replace(/\s+/g, ' ').trim() ?? ''
}

/**
 * 读取空间页头部信息。
 *
 * @returns 关键字段（昵称）拿不到时返回 null —— 调用方必须回退原生
 */
export function readSpaceProfile(): SpaceProfile | null {
  const header = firstMatch<HTMLElement>(HEADER_SELECTORS)
  if (!header)
    return null

  const name = textOf(firstMatch<HTMLElement>(NAME_SELECTORS, header))
  if (!name)
    return null

  const headerText = textOf(header)
  const followButton = firstMatch<HTMLElement>(FOLLOW_BUTTON_SELECTORS, header)

  return {
    name,
    avatar: pickAvatar(header),
    signature: textOf(firstMatch<HTMLElement>(SIGNATURE_SELECTORS, header)),
    followers: pickCount(headerText, /粉丝|fans/i),
    following: pickCount(headerText, /关注|following/i),
    level: pickLevel(header),
    verified: Boolean(header.querySelector('[class*="verify"], [class*="vip"], [class*="auth"]')),
    followButton,
  }
}

/** 原生头部容器（自绘卡插入位置 / 隐藏对象） */
export function findSpaceHeader(): HTMLElement | null {
  return firstMatch<HTMLElement>(HEADER_SELECTORS)
}

/**
 * 视频卡片选择器（第 92 轮真机实测）：B 站新版空间页用 `.bili-video-card`，
 * 首屏卡片数为 0，滚动到约 y=800 后才懒加载出 25 张。旧类名（`.large-item` 等）保留兜底。
 */
export const VIDEO_CARD_SELECTOR = '.bili-video-card'

/**
 * 收集视频卡：优先用实测的 `.bili-video-card`，没有再回退到旧类名。
 *
 * @returns 视频卡元素（去掉互相嵌套的重复项）
 */
export function collectVideoCards(): HTMLElement[] {
  const primary = Array.from(document.querySelectorAll<HTMLElement>(VIDEO_CARD_SELECTOR))
  const fallback = primary.length
    ? []
    : collectCards().filter(card => card.kind === 'video').map(card => card.el)
  const all = primary.length ? primary : fallback

  // 去嵌套：外层卡片优先（`.bili-video-card` 里可能还嵌着一张卡）
  return all.filter((el, index) => !all.some((other, otherIndex) => otherIndex !== index && other.contains(el)))
}

/** 网格标记属性：加在「所有卡片的共同父容器」上，供页面级 CSS 做 grid 重排 */
export const GRID_ATTR = 'data-bewly-space-grid'
/** 卡片标记属性：给每张卡片打上，便于统一卡片内部视觉 */
export const CARD_ATTR = 'data-bewly-space-card'

/** 列表定位的最小卡片数：少于这个数说明是分组行 / 侧栏小列表，不当作视频主列表 */
const MIN_LIST_CARDS = 6

/**
 * 合集 / 系列 / 分组容器：这些区域里的卡片行必须保持原生 flex 布局。
 *
 * 第 99 轮事故复盘：旧实现取「所有卡片的共同祖先」当网格容器，在「合集和系列」页
 * 命中的是整块 `.contet-list`，把它 grid 化后每张卡被压成 ~24px 的细竖条
 * （用户截图确认）。而空间页每张视频卡外面还有一层独立包装
 * （`.items__item` / `.video-list__item` / `masterpiece-block__item`），
 * 「同父级」条件在真实页面上永远不成立 —— 也就是说**无法可靠区分「主列表」与「分组行」**。
 *
 * 结论（第 99 轮）：**放弃网格改造**，保持 B 站原生列表布局；
 * 自绘只保留头部信息卡 + 卡片内部视觉 + 加载更多按钮。
 */
const COLLECTION_GUARD = [
  '[class*="collection"]',
  '[class*="series"]',
  '[class*="channel"]',
  '[class*="section"]',
  '[class*="lists"]',
  '[class*="contet-list"]',
  '[class*="video-list"]',
].join(', ')

/**
 * 找「视频主列表容器」（仅用于插入加载更多按钮，**不改它的布局**）。
 *
 * @returns 列表容器；不满足条件（卡片太少 / 落在合集分组内）时返回 null
 */
export function findVideoListContainer(): HTMLElement | null {
  const cards = collectVideoCards()
  if (cards.length < MIN_LIST_CARDS)
    return null

  // 从第一张卡往上爬，找到第一个「包含全部卡片」的祖先（即列表容器）
  let candidate: HTMLElement | null = cards[0]?.parentElement ?? null
  while (candidate && !cards.every(card => candidate!.contains(card)))
    candidate = candidate.parentElement
  if (!candidate || candidate === document.body)
    return null
  if (candidate.closest(COLLECTION_GUARD))
    return null
  return candidate
}

/**
 * 网格标记函数（第 99 轮起**不再使用**）。
 *
 * 保留导出只是为了不破坏既有调用点；它不会再给任何元素打 `data-bewly-space-grid`，
 * 因此页面级 CSS 里的网格规则永远不会命中 —— 这是有意的安全回退。
 *
 * @returns 永远是 null
 */
export function markGridContainer(): HTMLElement | null {
  return null
}

/** 清除网格标记（卸载 / 切换 tab 时） */
export function clearGridMarks(): void {
  document.querySelectorAll(`[${GRID_ATTR}]`).forEach(el => el.removeAttribute(GRID_ATTR))
  document.querySelectorAll(`[${CARD_ATTR}]`).forEach(el => el.removeAttribute(CARD_ATTR))
}
// #endregion
