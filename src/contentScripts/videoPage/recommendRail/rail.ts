import type { RailCard, RailPlacement } from './types'

/**
 * 视频页推荐视频轨道的数据采集与原生列表接管（第 27 轮）。
 *
 * 背景：B 站视频页右栏 `.rcmd-tab` 里是 20 张 `.video-page-card-small`（350×84 的横向小卡）。
 * 用户要求把这块改成「和首页一样的横向聚焦轨道，放在页面下部，同时可见 4~7 张，
 * 交互一致，点击走当前标签页内嵌预览」。
 *
 * 约定（与 A 工作流「评论区移到右侧」协调）：
 * - A 只把 `.rcmd-tab` 从右栏移出 / 交给 B，**不隐藏它**；
 * - B 在**成功采集到卡片并且轨道真的渲染出来**之后，才给 `.rcmd-tab` 打
 *   `data-bewly-rail-taken` 并隐藏它；采集失败 / 轨道卸载时把原样式还原。
 *
 * 采集全部按结构启发式（B 站 class 名带哈希，且各版本结构不同）：
 * 先从卡片里找视频链接（`a[href*="/video/"]` 或 `href` 含 BV 号的 $任何元素），
 * 再按「链接 → 图片 → 标题 → 时长 → UP → 播放量」逐项兜底，任一项拿不到就不渲染该卡。
 */

/** 原生卡片元素的选择器（真机 20 张） */
const CARD_SELECTOR = '.video-page-card-small'
/** 原生推荐列表容器的候选（真机是 .rcmd-tab） */
const CONTAINER_SELECTORS = [
  '.rcmd-tab',
  '.recommend-list-v1',
  '.rec-list',
  '[class*="recommend-list"]',
]
/** 被轨道接管的原生列表标记 */
export const TAKEN_ATTR = 'data-bewly-rail-taken'
/** 轨道高度占位元素 id（让页面能滚到轨道下方，避免压住页脚） */
const SPACER_ID = 'bewly-video-rail-spacer'
/** 页面主列（轨道挂在它下面） */
const MAIN_COLUMN_SELECTORS = ['#mirror-vdcon', '.left-container', '#reco_list']

const BV_RE = /(BV[0-9A-Za-z]{8,})/
const DURATION_RE = /^\d{1,2}:\d{2}(?::\d{2})?$/
const VIEW_COUNT_RE = /^(?:\d+(?:\.\d+)?[万億亿]?|\d+(?:\.\d+)?万?\s*(?:播放|观看))$/

function textOf(el: Element | null): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function firstMatch<T extends Element>(root: ParentNode, selectors: string[]): T | null {
  for (const selector of selectors) {
    const el = root.querySelector<T>(selector)
    if (el)
      return el
  }
  return null
}

/** 从卡片里找视频链接：优先 /video/ 链接，其次任何带 BV 号的 href */
function findLink(card: HTMLElement): HTMLAnchorElement | null {
  const anchors = Array.from(card.querySelectorAll<HTMLAnchorElement>('a[href]'))
  const video = anchors.find(a => /\/video\//.test(a.getAttribute('href') ?? ''))
  if (video)
    return video
  return anchors.find(a => BV_RE.test(a.getAttribute('href') ?? '')) ?? null
}

function absoluteUrl(href: string): string {
  try {
    return new URL(href, location.href).href
  }
  catch {
    return href
  }
}

/** 封面：img 的 src / data-src / srcset / 背景图都试一遍 */
function findCover(card: HTMLElement): string {
  const img = card.querySelector<HTMLImageElement>('img')
  if (img) {
    const candidates = [
      img.getAttribute('src'),
      img.getAttribute('data-src'),
      img.getAttribute('data-original'),
      (img.getAttribute('srcset') ?? '').split(',')[0]?.trim().split(' ')[0],
    ]
    for (const candidate of candidates) {
      if (candidate && !candidate.startsWith('data:'))
        return absoluteUrl(candidate)
    }
  }
  const styleEl = Array.from(card.querySelectorAll<HTMLElement>('[style*="background"]'))
    .find(el => /background-image/.test(el.getAttribute('style') ?? ''))
  const styleUrl = styleEl?.getAttribute('style')?.match(/url\(["']?([^"')]+)["']?\)/)?.[1]
  return styleUrl
    ? absoluteUrl(styleUrl)
    : ''
}

/** 标题：优先带 title 类的元素，其次 link 的 title / img 的 alt */
function findTitle(card: HTMLElement, link: HTMLAnchorElement | null): string {
  const titled = firstMatch<HTMLElement>(card, [
    '[class*="title"]',
    '[class*="name"]',
  ])
  const text = textOf(titled)
  if (text)
    return text
  const fromLink = textOf(link)
  if (fromLink)
    return fromLink
  const alt = card.querySelector<HTMLImageElement>('img')?.getAttribute('alt')
  return alt
    ? alt.trim()
    : ''
}

/** 时长：固定形如 12:34 的文本节点 */
function findDuration(card: HTMLElement): string {
  const candidates = Array.from(card.querySelectorAll<HTMLElement>('span, div, [class*="duration"]'))
  for (const el of candidates) {
    const text = textOf(el)
    if (text.length <= 8 && DURATION_RE.test(text))
      return text
  }
  return ''
}

/** UP 主 / 播放量：先找结构化容器，再退化为「带 万 的数字」文本 */
function findUpAndViews(card: HTMLElement): { upName: string, views: string } {
  let upName = textOf(firstMatch<HTMLElement>(card, [
    '[class*="up-name"]',
    '[class*="upname"]',
    '[class*="author"]',
    '[class*="up"] [class*="name"]',
  ]))

  let views = ''
  const statTexts = Array.from(card.querySelectorAll<HTMLElement>('span, div'))
    .map(el => textOf(el))
    .filter(text => text.length > 0 && text.length <= 12 && /\d/.test(text))
  const viewCandidate = statTexts.find(text => VIEW_COUNT_RE.test(text) && text !== upName)
  if (viewCandidate)
    views = viewCandidate

  if (!upName) {
    // 兜底：卡片里最像「名字」的那段文本（去掉标题、时长、播放量）
    const ignored = new Set([
      findTitle(card, null),
      findDuration(card),
      views,
    ])
    const texts = Array.from(card.querySelectorAll<HTMLElement>('span, div'))
      .map(el => textOf(el))
      .filter(text => text.length >= 1 && text.length <= 24 && !ignored.has(text) && !/^\d+$/.test(text))
    upName = texts.find(text => !VIEW_COUNT_RE.test(text) && !DURATION_RE.test(text)) ?? ''
  }

  return { upName, views }
}

/** 从原生 DOM 采集卡片（去重：同一个 bvid 只保留一次） */
export function collectRailCards(): RailCard[] {
  const containers = CONTAINER_SELECTORS
    .flatMap(selector => Array.from(document.querySelectorAll<HTMLElement>(selector)))
  const cards: RailCard[] = []
  const seen = new Set<string>()

  const pushCard = (card: HTMLElement) => {
    const link = findLink(card)
    const href = link?.getAttribute('href') ?? ''
    const bvid = href.match(BV_RE)?.[1] ?? ''
    const url = href
      ? absoluteUrl(href)
      : ''
    const title = findTitle(card, link)
    if (!bvid || !url || !title || seen.has(bvid))
      return
    seen.add(bvid)
    const { upName, views } = findUpAndViews(card)
    cards.push({
      bvid,
      url,
      title,
      cover: findCover(card),
      duration: findDuration(card),
      upName,
      views,
    })
  }

  if (containers.length) {
    for (const container of containers) {
      container.querySelectorAll<HTMLElement>(CARD_SELECTOR).forEach(pushCard)
    }
  }
  else {
    // 容器选择器全都没命中时，直接按卡片类名全局找（B 站可能换容器类名）
    document.querySelectorAll<HTMLElement>(CARD_SELECTOR).forEach(pushCard)
  }

  return cards
}

/**
 * 原生推荐列表容器（真机 `.rcmd-tab`）。
 *
 * 第 27 轮真机验证发现：页面底部可能还存在**第二份**推荐列表（B 站会在推荐位
 * 同时渲染 `.rcmd-tab` 与底部 `.recommend-list-v1`），只隐藏第一个容器时，
 * 轨道正好盖在未隐藏的那份原生列表上 —— 点击会同时击中轨道卡片与原生 `<a href>`，
 * 于是「抽屉打开了，URL 却被改成推荐视频地址（带 spm_id_from）」。
 * 因此这里改成返回**全部**命中容器。
 */
export function findNativeContainers(): HTMLElement[] {
  const result: HTMLElement[] = []
  const seen = new Set<HTMLElement>()
  for (const selector of CONTAINER_SELECTORS) {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      if (seen.has(el))
        continue
      seen.add(el)
      result.push(el)
    }
  }
  // 每张卡片自身所在的 `.video-page-card-small` 也算一份（有些版本直接平铺在 body 里）
  for (const card of Array.from(document.querySelectorAll<HTMLElement>(CARD_SELECTOR))) {
    if (!seen.has(card)) {
      seen.add(card)
      result.push(card)
    }
  }
  return result
}

/** 兼容旧调用：返回第一个原生容器 */
export function findNativeContainer(): HTMLElement | null {
  return findNativeContainers()[0] ?? null
}

/**
 * 接管原生列表：给**所有**命中容器打标记 + 隐藏（记下原 display，卸载时还原）。
 *
 * 为什么要隐藏全部而不是第一个：见 findNativeContainers 的注释 —— 页面底部可能有
 * 第二份推荐列表，它与轨道重叠会让点击落到原生 `<a>` 上，产生「URL 被改」的副作用。
 */
export function markNativeTaken(): void {
  for (const container of findNativeContainers()) {
    if (container.hasAttribute(TAKEN_ATTR))
      continue
    container.setAttribute(TAKEN_ATTR, container.style.display || '')
    container.style.display = 'none'
  }
}

/**
 * 兜底：把字体 / 尺寸与轨道重叠、但不在推荐容器里的原生 `<a href="/video/...">` 也标记出来。
 *
 * 真机上曾出现「轨道卡片下面还压着一份原生推荐列表的链接」的情况（容器类名没命中），
 * 点击会同时击中两者。这里按「坐标落入轨道矩形 + href 命中 /video/」找出这类链接并隐藏，
 * 只隐藏链接本身（不动布局），卸载时随 TAKEN_ATTR 一起还原。
 */
export function hideOverlappingNativeLinks(rect: { top: number, left: number, width: number, height: number }): void {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/video/"]'))
  for (const link of links) {
    if (link.closest(`[${TAKEN_ATTR}]`))
      continue
    // 轨道自身在 shadow 内，不会出现在这里；命中说明是页面上的原生链接
    const box = link.getBoundingClientRect()
    if (box.width < 40 || box.height < 20)
      continue
    const overlaps = box.left < rect.left + rect.width
      && box.right > rect.left
      && box.top < rect.top + rect.height
      && box.bottom > rect.top
    if (!overlaps)
      continue
    if (link.hasAttribute(TAKEN_ATTR))
      continue
    link.setAttribute(TAKEN_ATTR, link.style.display || '')
    link.style.display = 'none'
  }
}

/** 归还原生列表 */
export function releaseNativeTaken(): void {
  document.querySelectorAll<HTMLElement>(`[${TAKEN_ATTR}]`).forEach((el) => {
    el.style.display = el.getAttribute(TAKEN_ATTR) || ''
    el.removeAttribute(TAKEN_ATTR)
  })
}

/** 页面主列（轨道挂在它下方） */
export function findMainColumn(): HTMLElement | null {
  for (const selector of MAIN_COLUMN_SELECTORS) {
    const el = document.querySelector<HTMLElement>(selector)
    if (el)
      return el
  }
  return null
}

/**
 * 轨道在视口里的放置位置。
 *
 * 轨道渲染在视频页 shadow root 里（fixed 定位），top 取**主列底边在视口中的位置**：
 * 这样视觉上它贴在页面内容下方、随滚动一起移动（与评论工具条同一套思路），
 * 同时不用把节点插进 B 站的文档流。
 */
export function computeRailPlacement(railHeight: number): RailPlacement | null {
  const column = findMainColumn()
  if (!column)
    return null
  const rect = column.getBoundingClientRect()
  const margin = 24
  const width = Math.min(rect.width, window.innerWidth - margin * 2)
  if (width < 320)
    return null
  return {
    top: Math.round(rect.bottom + margin),
    left: Math.round(rect.left + Math.max(0, (rect.width - width) / 2)),
    width: Math.round(width),
    height: Math.round(railHeight),
  }
}

/** 预留轨道高度：让页面能滚到轨道下方，不压住页脚 */
export function reserveRailSpace(height: number): void {
  const column = findMainColumn()
  if (!column)
    return
  let spacer = document.getElementById(SPACER_ID)
  if (!spacer) {
    spacer = document.createElement('div')
    spacer.id = SPACER_ID
    spacer.setAttribute('aria-hidden', 'true')
    spacer.style.cssText = 'display: block; pointer-events: none; width: 100%;'
    column.insertAdjacentElement('afterend', spacer)
  }
  spacer.style.height = `${Math.max(0, Math.round(height))}px`
}

export function clearRailSpace(): void {
  document.getElementById(SPACER_ID)?.remove()
}
