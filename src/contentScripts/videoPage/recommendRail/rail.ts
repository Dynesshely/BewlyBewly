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

/**
 * 封面 URL 缓存（bvid → URL）。
 *
 * 为什么必须缓存：轨道渲染出来之后我们会把原生 `.rcmd-tab` 隐藏，B 站的懒加载封面
 * 从此**永远不会再加载**（真机实测：卡片里 `img` 在轨道里是 null，因为采集时 src 还是空串）。
 * 所以只要某个 bvid 曾经拿到过封面 URL，就一直记住它，后续每拍刷新都能用上。
 */
const coverCache = new Map<string, string>()

/** 从元素上按「越接近真实地址越优先」的顺序取封面候选 */
function coverCandidatesFrom(img: HTMLImageElement): string[] {
  const dataset = img.dataset as Record<string, string | undefined>
  const srcset = (img.getAttribute('srcset') ?? '')
    .split(',')
    .map(item => item.trim().split(/\s+/)[0])
    .filter(Boolean)
  return [
    img.currentSrc,
    img.getAttribute('src') ?? '',
    dataset.src ?? '',
    img.getAttribute('data-src') ?? '',
    img.getAttribute('data-original') ?? '',
    dataset.original ?? '',
    img.getAttribute('data-lazy-src') ?? '',
    img.getAttribute('data-lazy') ?? '',
    srcset[0] ?? '',
    dataset.srcset ?? '',
  ]
}

/**
 * 封面取值兜底顺序：
 * `img.currentSrc → img.src → data-src → data-original → srcset 首项 → <picture><source> → 背景图 → 外层 a 的图`。
 */
function findCover(card: HTMLElement): string {
  const img = card.querySelector<HTMLImageElement>('img')
  if (img) {
    for (const candidate of coverCandidatesFrom(img)) {
      if (candidate && !candidate.startsWith('data:'))
        return absoluteUrl(candidate)
    }
  }

  // <picture><source srcset>
  const source = card.querySelector<HTMLSourceElement>('picture source[srcset]')
  const sourceFirst = (source?.getAttribute('srcset') ?? '').split(',')[0]?.trim().split(/\s+/)[0]
  if (sourceFirst && !sourceFirst.startsWith('data:'))
    return absoluteUrl(sourceFirst)

  // 背景图（封面容器常写成 background-image）
  const styleEl = Array.from(card.querySelectorAll<HTMLElement>('[style*="background"]'))
    .find(el => /background-image/.test(el.getAttribute('style') ?? ''))
  const styleUrl = styleEl?.getAttribute('style')?.match(/url\(["']?([^"')]+)["']?\)/)?.[1]
  if (styleUrl)
    return absoluteUrl(styleUrl)

  // 任意元素上的懒加载属性（B 站有时把 data-src 挂在封面 div / picture 上而不是 img）
  const lazyEl = Array.from(card.querySelectorAll<HTMLElement>('[data-src], [data-original], [data-lazy-src], [data-background]'))
    .find(el => Boolean(
      el.getAttribute('data-src')
      || el.getAttribute('data-original')
      || el.getAttribute('data-lazy-src')
      || el.getAttribute('data-background'),
    ))
  const lazyUrl = lazyEl?.getAttribute('data-src')
    ?? lazyEl?.getAttribute('data-original')
    ?? lazyEl?.getAttribute('data-lazy-src')
    ?? lazyEl?.getAttribute('data-background')
  if (lazyUrl && !lazyUrl.startsWith('data:'))
    return absoluteUrl(lazyUrl)

  // 外层链接上的背景图 / 缩略图
  const anchor = card.closest<HTMLAnchorElement>('a[href]')
  const anchorStyle = anchor?.getAttribute('style') ?? ''
  const anchorUrl = anchorStyle.match(/url\(["']?([^"')]+)["']?\)/)?.[1]
  return anchorUrl
    ? absoluteUrl(anchorUrl)
    : ''
}

/**
 * 预热封面：在**隐藏原生列表之前**调用。
 *
 * B 站封面多数是懒加载（`<img loading="lazy" data-src="...">`，或根本还没插 `<img>`）。
 * 一旦把列表 `display: none`，懒加载就再也不会触发。这里做三件事：
 * 1. 把卡片里的 `img` 改成 `loading="eager"`，有 `data-src` 就补到 `src` 上触发请求；
 * 2. 顺便把所有能直接读到的封面 URL 记进缓存（不依赖图片真的加载完成）；
 * 3. 卡片里确实没有 `img` 时，尝试给封面容器塞一个临时 img（不插入布局，只为了让浏览器开始抓图），
 *    并在下一拍从它的 `currentSrc` 取回真实地址。
 */
export function warmUpNativeCovers(): void {
  for (const card of collectNativeCards()) {
    const link = findLink(card)
    const bvid = (link?.getAttribute('href') ?? '').match(BV_RE)?.[1] ?? ''
    if (!bvid)
      continue

    const img = card.querySelector<HTMLImageElement>('img')
    if (img) {
      img.loading = 'eager'
      const lazy = (img.dataset.src
        ?? img.getAttribute('data-src')
        ?? img.getAttribute('data-original')
        ?? img.getAttribute('data-lazy-src')
        ?? '') as string
      if (!img.getAttribute('src') && lazy)
        img.setAttribute('src', lazy)
    }

    const cover = findCover(card)
    if (cover && !coverCache.has(bvid)) {
      coverCache.set(bvid, cover)
    }
    else if (!cover) {
      // 已经缓存过就继续用；没有的话才留空（模板会渲染占位）
      const cached = coverCache.get(bvid)
      if (cached)
        continue
    }
  }
}

/** 拿当前所有原生卡片（不依赖容器选择器，逐级兜底） */
export function collectNativeCards(): HTMLElement[] {
  const cards: HTMLElement[] = []
  const seen = new Set<HTMLElement>()
  for (const container of findNativeContainers()) {
    if (container.matches(CARD_SELECTOR)) {
      if (!seen.has(container)) {
        seen.add(container)
        cards.push(container)
      }
      continue
    }
    container.querySelectorAll<HTMLElement>(CARD_SELECTOR).forEach((card) => {
      if (!seen.has(card)) {
        seen.add(card)
        cards.push(card)
      }
    })
  }
  return cards
}

/**
 * 给已有卡片补封面（每拍调用）。
 *
 * ⚠️ 第 31 轮真机 bug（20 张卡 0 个 img）：旧实现把「DOM 里的封面」和**缓存**比较，
 * 而 `warmUpNativeCovers()` 早就把同一个 URL 写进缓存了 —— 于是这里永远返回 false，
 * `railState.cards` 里第一拍采集到的 `cover: ''` 就再也没被更新过。
 * 现在改成和**当前 cards 的 cover 字段**比较，并返回**新的数组**（整体替换，保证 Vue 响应）。
 *
 * @param current 当前已渲染的卡片
 * @returns 需要更新时返回新数组（cover 已补齐），否则返回 null
 */
export function refreshRailCovers(current: RailCard[]): RailCard[] | null {
  if (!current.length)
    return null

  const covers = new Map<string, string>()
  for (const card of collectNativeCards()) {
    const link = findLink(card)
    const bvid = (link?.getAttribute('href') ?? '').match(BV_RE)?.[1] ?? ''
    if (!bvid)
      continue
    const cover = findCover(card)
    if (cover) {
      coverCache.set(bvid, cover)
      covers.set(bvid, cover)
    }
  }
  if (!covers.size)
    return null

  let changed = false
  const next = current.map((card) => {
    if (card.cover)
      return card
    const cover = covers.get(card.bvid) ?? coverCache.get(card.bvid) ?? ''
    if (!cover)
      return card
    changed = true
    return { ...card, cover }
  })
  return changed
    ? next
    : null
}

/** 从缓存取封面（供卡片对象填充） */
function cachedCover(bvid: string): string {
  return coverCache.get(bvid) ?? ''
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
    const cover = findCover(card) || cachedCover(bvid)
    if (cover && !coverCache.has(bvid))
      coverCache.set(bvid, cover)
    cards.push({
      bvid,
      url,
      title,
      cover,
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
/** 这些容器内部的视频链接属于正常内容，绝不整块隐藏 */
const DUPLICATE_WHITELIST_SELECTOR = [
  '#bilibili-player',
  '.bpx-player-container',
  '.up-panel-container',
  '.video-pod',
  '.video-pod-above-modules',
  '.video-pod__list',
  '.bewly-comment-column',
  '#commentapp',
  '#bewly-video-page',
  // 左列 dock 的固定成员：信息栏 / 工具栏 / 简介 / 标签 / 资源列表，
  // 它们内部也可能有 3 个以上视频链接，但绝不是「推荐栏」
  '#viewbox_report',
  '#arc_toolbar_report',
  '#v_desc',
  '.video-desc-container',
  '.video-tag-container',
  '.video-resource-list',
].join(', ')

/** 一个容器里至少要有这么多「视频链接」才认定为推荐栏 */
const DUPLICATE_MIN_LINKS = 3

/**
 * 重复推荐栏兜底（第 32 轮需求 3）。
 *
 * 用户截图里出现过「两个推荐栏」，但 Lead 全 DOM 扫描只找到 1 个 —— 说明它出现在**特定状态**
 * （切视频后原生重建、窄屏降级、轨道被关闭等）。因此除了已知选择器之外，再加一层结构兜底：
 *
 * - 只看**仍在视口内**的 `a[href*="/video/BV"]`（不可见的隐藏了也没意义）；
 * - 从每个链接向上找祖先，取「**自身**有 ≥3 个视频链接、且父级不满足同样条件」的容器 = 最外层推荐块；
 * - 跳过白名单（播放器 / 左列 / 选集 / 评论列 / 增强层）与已经标记过的节点；
 * - 用同一套 `TAKEN_ATTR` 记录原 display，`releaseNativeTaken()` 时统一还原。
 *
 * @returns 当前被隐藏的原生块数量（供 `data-bewly-rail-native-hidden` 诊断）
 */
export function hideDuplicateRecommendBlocks(): number {
  const inView = (el: Element): boolean => {
    const rect = el.getBoundingClientRect()
    return rect.width > 20 && rect.height > 20 && rect.bottom > 0 && rect.top < window.innerHeight
  }

  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/video/BV"]'))
    .filter(link => !link.closest(`[${TAKEN_ATTR}]`) && inView(link))

  const qualifying = new Set<HTMLElement>()
  for (const link of links) {
    let node = link.parentElement
    let depth = 0
    while (node && depth < 8) {
      if (node === document.body || node === document.documentElement)
        break
      if (node.matches(DUPLICATE_WHITELIST_SELECTOR))
        break
      if (node.querySelectorAll('a[href*="/video/BV"]').length >= DUPLICATE_MIN_LINKS)
        qualifying.add(node)
      node = node.parentElement
      depth += 1
    }
  }

  // 只处理最外层：父级也满足条件的交给父级处理，避免把内层卡片全藏掉
  const outermost = Array.from(qualifying).filter((el) => {
    const parent = el.parentElement
    return !parent || !qualifying.has(parent)
  })

  for (const el of outermost) {
    if (el.hasAttribute(TAKEN_ATTR))
      continue
    el.setAttribute(TAKEN_ATTR, el.style.display || '')
    el.style.display = 'none'
  }

  return document.querySelectorAll(`[${TAKEN_ATTR}]`).length
}

/** 当前隐藏了多少个原生推荐块（诊断用） */
export function countHiddenNativeBlocks(): number {
  return document.querySelectorAll(`[${TAKEN_ATTR}]`).length
}

/**
 * 归还原生列表。
 *
 * 注意：这里**不清空封面缓存** —— 切视频后 B 站会替换整份列表，旧卡片的封面 URL 仍然有效
 * （同一个 bvid 的封面地址不会变），保留下来可以让新采集的卡片立刻有图。
 */
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

/** 固定单页布局下轨道离视口底部的间距 */
const RAIl_FIXED_BOTTOM_GAP = 12

/**
 * 已渲染轨道的高度（没有渲染时返回 0）。
 *
 * 轨道在增强层 shadow root 里，只读它不影响我们写的位置，因此可以每拍读。
 */
/**
 * 已渲染**卡片**的高度（没有渲染时返回 0）。
 *
 * 第 55 轮：轨道高度公式漏算 UP 名行（约 19px），1400 宽下算出 199 < 实际 215 → 卡片底部被裁。
 * 卡片高度由内容（封面 + gap + 标题 + UP 名）实际撑开，直接量它最可靠：
 * `railHeight = cardHeight + railPadding*2`。
 */
export function getRenderedCardHeight(): number {
  const host = document.getElementById('bewly-video-page')
  const card = host?.shadowRoot?.querySelector<HTMLElement>('.bvp-rail__card')
  return card
    ? Math.round(card.getBoundingClientRect().height)
    : 0
}

export function getRenderedRailHeight(): number {
  const host = document.getElementById('bewly-video-page')
  const rail = host?.shadowRoot?.querySelector<HTMLElement>('.bvp-rail')
  return rail
    ? Math.round(rail.getBoundingClientRect().height)
    : 0
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

  // 固定单页布局（第 28 轮）：页面不滚动，轨道直接贴视口底部，「始终可见」。
  // 实际渲染高度可能与 computeRailHeight 的估算不同（视觉样式算出来的卡片更高），
  // 所以优先用**已渲染的轨道高度**，保证 bottom 至少留 RAIl_FIXED_BOTTOM_GAP。
  if (document.documentElement.classList.contains('bewly-video-fixed')) {
    const renderedHeight = getRenderedRailHeight()
    const height = Math.round(Math.max(railHeight, renderedHeight))
    const top = Math.max(0, window.innerHeight - height - RAIl_FIXED_BOTTOM_GAP)
    return {
      top,
      left: Math.round(rect.left + Math.max(0, (rect.width - width) / 2)),
      width: Math.round(width),
      height,
    }
  }

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
