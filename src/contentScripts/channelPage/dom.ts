/**
 * B 站分区 / 频道页（`bilibili.com/v/*`、`bilibili.com/channel/*`）的 DOM 适配层。
 *
 * 这里集中所有「依赖 B 站页面结构」的查询，页面改版时只改这一处。
 *
 * 类名来源（都已在仓库里确认过）：
 *   - 视频卡：`.bili-video-card` —— `src/composables/useKeyboardCardNavigation.ts`
 *     的原生卡选择器（`NATIVE_CARD_SELECTOR`）、`src/utils/nativeFilter.ts` 的分区页规则、
 *     `src/styles/adaptedStyles/pages/searchPage.scss` 都在用；
 *   - 历史兜底：`.video-card` / `.video-list-item` / `.rank-item` ——
 *     `src/utils/nativeFilter.ts` 的 `page` 规则；
 *   - 页面容器：`.channel-container` —— `src/styles/adaptedStyles/pages/channelPage.scss`。
 * 排序 tab 在仓库 scss 里没有确认的类名，只能按「容器内 + 标签文本」发现（见
 * `SORT_LABELS`）；找不到时面板里隐藏该排序项，不做任何猜测性样式。
 */
import type { ChannelPageKind, ChannelRankPeriod, ChannelSortId } from './state'

import { HOST_ID } from './constants'

export interface ChannelCard {
  el: HTMLElement
  title: string
  url: string
}

/** 分区页主机名与路径（`/v/`、`/channel/`；两者都只在 www 上出现） */
const CHANNEL_HOST_RE = /(?:^|\.)(?:www\.)?bilibili\.com$/i
const CHANNEL_PATH_RE = /^\/(?:v|channel|c)(?:\/|$)/

/** 浮层容器 id（与 index.ts 保持一致） */
export const OVERLAY_HOST_ID = HOST_ID

/** 视频卡候选：「已确认」+ nativeFilter 里的历史兜底 */
const CARD_SELECTORS = [
  '.bili-video-card',
  '.video-card',
  '.video-list-item',
  '.rank-item',
]

/**
 * 排行榜页的卡片根优先用 `.rank-item`：名次徽标要挂在整条目上，
 * 而不是里面的 `.bili-video-card`（否则卡片与排名数字会错位）。
 * `.rank-item` 同样来自 nativeFilter 的分区 / 排行页规则，仓库已确认。
 */
const RANK_CARD_SELECTORS = [
  '.rank-item',
  '.bili-video-card',
  '.video-card',
  '.video-list-item',
]

/** 排行榜页上原生名次元素的候选（读到就沿用，读不到退回 DOM 顺序） */
const NATIVE_RANK_SELECTORS = [
  '.num',
  '.rank',
  '.rank-num',
  '[class*="rank-num"]',
  '[class*="rankNum"]',
  '[class*="rank_num"]',
]

/** 页面容器（确认存在）；排序 tab 只在这个容器里找 */
const PAGE_CONTAINER_SELECTOR = '.channel-container'

/** 这些区域里的同名节点不是内容卡（头部 / 导航 / 排序区 / 弹层） */
const EXCLUDE_ZONE_SELECTOR = [
  '.bili-header',
  '#biliMainHeader',
  '.banner-wrapper',
  '.nav-bar',
  '#navigator',
  '.section-title',
  '.modal-wrapper',
  '.bp-popup-panel',
].join(', ')

const TITLE_SELECTORS = [
  '.bili-video-card__info--tit',
  '.video-name',
  '.title',
  'h3',
]

const LINK_SELECTORS = [
  'a[href*="/video/"]',
  'a[href]',
]

const EDITABLE_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
].join(', ')

/** 排序 tab 的文本（B 站分区页的三种排序）；英文站点用英文标签兜底 */
const SORT_LABELS: Record<ChannelSortId, RegExp[]> = {
  default: [/^综合$/, /^默认$/, /^default$/i],
  views: [
    /^播放多$/,
    /^最多播放$/,
    /^播放最多$/,
    /^most\s*views?$/i,
  ],
  newest: [
    /^最新$/,
    /^最新发布$/,
    /^newest$/i,
    /^latest$/i,
  ],
}

/** 可点击的排序 tab 候选（文本节点往上找到这些元素再点） */
const CLICKABLE_SELECTOR = 'a, button, [role="button"], li'

export function isChannelPage(url: string = location.href): boolean {
  try {
    const parsed = new URL(url)
    if (!CHANNEL_HOST_RE.test(parsed.hostname))
      return false
    return CHANNEL_PATH_RE.test(parsed.pathname)
  }
  catch {
    return false
  }
}

/**
 * 页面种类：
 *   rank    —— `/v/popular/rank/*`（排行榜：日榜 / 周榜 / 月榜）
 *   popular —— `/v/popular*`（热门，含 /v/popular/all）
 *   channel —— 其余 `/v/*`、`/channel/*`、`/c/*`（分区 / 频道页）
 */
export function getChannelPageKind(url: string = location.href): ChannelPageKind {
  try {
    const pathname = new URL(url).pathname
    if (/^\/v\/popular\/rank(?:\/|$)/.test(pathname))
      return 'rank'
    if (/^\/v\/popular(?:\/|$)/.test(pathname))
      return 'popular'
    return 'channel'
  }
  catch {
    return 'channel'
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
 * 收集分区页的视频卡，按 DOM 顺序返回。
 *
 * 同一张卡可能同时命中 `.bili-video-card` 与历史兜底类名，用「互相包含即跳过」去重。
 */
export function collectCards(kind: ChannelPageKind = 'channel'): ChannelCard[] {
  const cards: ChannelCard[] = []
  const seen = new Set<HTMLElement>()

  const add = (el: HTMLElement) => {
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
      title: pickText(el, TITLE_SELECTORS) || (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
      url: pickHref(el),
    })
  }

  const selectors = kind === 'rank'
    ? RANK_CARD_SELECTORS
    : CARD_SELECTORS
  for (const selector of selectors)
    document.querySelectorAll<HTMLElement>(selector).forEach(el => add(el))

  return cards.sort((a, b) => compareDocumentOrder(a.el, b.el))
}

function pageContainer(): ParentNode {
  return document.querySelector<HTMLElement>(PAGE_CONTAINER_SELECTOR) ?? document.body
}

/**
 * 找到某个排序目标对应的原生 tab；找不到返回 null（面板里隐藏该项）。
 *
 * 没有类名可依，只能按文本找：先用 exclusions 过滤掉明显不是排序区的元素
 * （视频卡的标题 / 作者 / 时长等），再往上取最近的 a / button / [role=button] / li。
 */
export function findSortTab(id: ChannelSortId): HTMLElement | null {
  const labels = SORT_LABELS[id]
  const root = pageContainer()
  const candidates = Array.from(root.querySelectorAll<HTMLElement>('a, button, li, span, div'))
  for (const el of candidates) {
    if (el.closest(CARD_SELECTORS.join(', ')))
      continue
    if (el.children.length > 2)
      continue
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (!text || text.length > 8)
      continue
    if (!labels.some(re => re.test(text)))
      continue
    const clickable = el.closest<HTMLElement>(CLICKABLE_SELECTOR) ?? el
    return clickable
  }
  return null
}

/** 当前页是否存在排序区（三项里任意一项找得到就算有） */
export function hasSortTabs(): boolean {
  return (['default', 'views', 'newest'] as ChannelSortId[]).some(id => findSortTab(id) !== null)
}

/**
 * 在页面里按标签文本找一个可点击的 tab（榜单切换用）。
 *
 * 排行榜页的日 / 周 / 月 tab 在仓库 scss 里没有确认的类名，只能按文本找；
 * 这里排除内容卡、头部与弹层，并且只接受「短文本 + 子元素不超过 2 个」的节点。
 */
function findLabelTab(labels: RegExp[]): HTMLElement | null {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('a, button, li, span, div'))
  for (const el of candidates) {
    if (el.closest(CARD_SELECTORS.join(', ')))
      continue
    if (el.closest(EXCLUDE_ZONE_SELECTOR))
      continue
    if (el.children.length > 2)
      continue
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (!text || text.length > 8)
      continue
    if (!labels.some(re => re.test(text)))
      continue
    const clickable = el.closest<HTMLElement>(CLICKABLE_SELECTOR) ?? el
    // 别把我们的浮层 / 原生弹窗里的按钮当成榜单 tab
    if (clickable.closest('#bewly, [data-bewly-native-overlay]'))
      continue
    return clickable
  }
  return null
}

/** 榜单 tab 的文本（日榜 / 周榜 / 月榜，含英文兜底） */
const RANK_PERIOD_LABELS: Record<ChannelRankPeriod, RegExp[]> = {
  day: [/^日榜$/, /^每日$/, /^day$/, /^daily$/i],
  week: [/^周榜$/, /^每周$/, /^week$/, /^weekly$/i],
  month: [
    /^月榜$/,
    /^每月$/,
    /^month$/,
    /^monthly$/i,
  ],
}

/** 找到某个榜单周期对应的原生 tab；找不到返回 null（面板里隐藏该项） */
export function findRankTab(period: ChannelRankPeriod): HTMLElement | null {
  return findLabelTab(RANK_PERIOD_LABELS[period])
}

/**
 * 读取卡片上的原生名次（排行榜页）。
 *
 * 只认 1–4 位纯数字文本，避免把播放量 / 日期误当名次；读不到返回 null，
 * 由调用方决定是否退回 DOM 顺序。
 */
export function readNativeRank(card: HTMLElement): { el: HTMLElement, rank: number } | null {
  for (const selector of NATIVE_RANK_SELECTORS) {
    const els = Array.from(card.querySelectorAll<HTMLElement>(selector))
    for (const el of els) {
      const text = (el.textContent ?? '').replace(/\s+/g, '').trim()
      if (!/^\d{1,4}$/.test(text))
        continue
      const rank = Number.parseInt(text, 10)
      if (rank > 0 && rank < 10000)
        return { el, rank }
    }
  }
  return null
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
