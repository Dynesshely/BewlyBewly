/**
 * 原生 B 站播放页的 DOM 适配层。
 *
 * 覆盖两套页面结构：
 * - 普通视频页 / 播放列表页（`/video/*`、`/list/*`）
 * - 番剧 / 电影播放页（`/bangumi/play/*`，新版 CSS Modules 与旧版布局都兼容）
 *
 * 所有查询都带 fallback 选择器，并且全部允许返回 null —— 播放器与集数列表都是异步渲染的，
 * 页面改版时只需要改这一个文件。
 */

/** 播放页类型；两类页面共用同一套增强层（影院 / 迷你 / 快捷键 / 紧凑信息栏） */
export type NativePlaybackKind = 'video' | 'bangumi' | 'none'

const VIDEO_PAGE_URL_RE = /^https?:\/\/(?:www\.)?bilibili\.com\/(?:video|list)\//i
const BANGUMI_PLAYBACK_URL_RE = /^https?:\/\/(?:www\.)?bilibili\.com\/bangumi\/play\//i

const TITLE_SELECTORS = [
  // 普通视频页
  'h1.video-title',
  '.video-title',
  '.video-info-title-inner h1',
  '#viewbox_report h1',
  // 番剧 / 电影页（新版 CSS Modules）
  '[class*="mediainfo_mediaTitle"]',
  '[class*="mediainfo_media_title"]',
  '[class*="mediaTitle"]',
  // 番剧 / 电影页（旧版）
  '.media-info .media-right .media-title',
  '.media-info .media-title',
]

const UPLOADER_SELECTORS = [
  // 普通视频页
  '.up-detail .up-name',
  '.up-name',
  '.video-up-name',
  '#v_upinfo .up-name',
  // 番剧 / 电影页
  '[class*="upinfo_upName"]',
  '[class*="upName"]',
  '.up-info .up-name',
  '.up-info > a .up-name',
]

const EDITABLE_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
].join(', ')

/** 播放器「舞台」：迷你播放器 / 影院模式把它 fixed 到视口 */
const PLAYER_STAGE_ATTR = 'data-bewly-player-stage'
/** 舞台的祖先链：需要清掉 transform / filter 等会劫持 position: fixed 的属性 */
const PLAYER_STAGE_ANCESTOR_ATTR = 'data-bewly-player-stage-ancestor'

/** 集数列表项候选选择器：新版番剧页是 CSS Modules 类名，旧版是 .ep-item */
const EPISODE_ITEM_SELECTORS = [
  '[class*="numberListItem_number_list_item"]',
  '.ep-list-wrapper .ep-item',
  '.section-ep-wrapper .ep-item',
]

/** 当前集数项的类名特征：新版 numberListItem_select__xxx / 旧版 .ep-item.cursor */
const CURRENT_EPISODE_TOKEN_RE = /(?:^|_)(?:select|current|active|on)(?:_|$)/i

export function getNativePlaybackKind(url: string = location.href): NativePlaybackKind {
  if (VIDEO_PAGE_URL_RE.test(url))
    return 'video'
  if (BANGUMI_PLAYBACK_URL_RE.test(url))
    return 'bangumi'
  return 'none'
}

export function isNativeVideoPage(url: string = location.href): boolean {
  return getNativePlaybackKind(url) !== 'none'
}

export function isBangumiPlaybackPage(url: string = location.href): boolean {
  return getNativePlaybackKind(url) === 'bangumi'
}

/** 播放器外层容器（迷你播放器就是把它 fixed 到右下角） */
export function getPlayerWrapEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>('#playerWrap')
    ?? document.querySelector<HTMLElement>('#bilibili-player')?.parentElement
    ?? document.querySelector<HTMLElement>('#mirror-vdcon .left-container')
    ?? getPlayerEl()?.parentElement
    ?? getVideoEl()?.parentElement
    ?? null
}

export function getPlayerEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>('#bilibili-player')
    ?? document.querySelector<HTMLElement>('#playerWrap .bpx-player-container')
    ?? document.querySelector<HTMLElement>('.bpx-player-container')
    ?? document.querySelector<HTMLElement>('#bilibili-player-video')
    ?? null
}

export function getVideoEl(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>('#bilibili-player video')
    ?? document.querySelector<HTMLVideoElement>('#playerWrap video')
    ?? document.querySelector<HTMLVideoElement>('.bpx-player-container video')
    // 兜底：番剧页若换了播放器容器结构，取页面里的第一个 video
    // （只在番剧页启用，避免视频页播放器就绪前误抓到广告位里的 video）
    ?? (isBangumiPlaybackPage()
      ? document.querySelector<HTMLVideoElement>('video')
      : null)
    ?? null
}

/**
 * 标记播放器舞台及其祖先链。
 *
 * 普通视频页的影院 / 迷你样式直接作用在 `#playerWrap` 上；番剧页的播放器外层没有稳定
 * 的 `#playerWrap`，所以改成给「播放器外层」打属性、由 `animePlayback&MoviePage.scss`
 * 按属性命中，避免依赖 CSS Modules 的哈希类名。
 * 祖先链上的属性用于在影院 / 迷你态清掉 transform / filter / contain，
 * 否则 `position: fixed` 会相对祖先而不是视口定位。
 */
export function markPlayerStage(el: HTMLElement | null): void {
  document.querySelectorAll<HTMLElement>(`[${PLAYER_STAGE_ATTR}]`).forEach((node) => {
    if (node !== el)
      node.removeAttribute(PLAYER_STAGE_ATTR)
  })
  document.querySelectorAll<HTMLElement>(`[${PLAYER_STAGE_ANCESTOR_ATTR}]`).forEach((node) => {
    node.removeAttribute(PLAYER_STAGE_ANCESTOR_ATTR)
  })

  if (!el)
    return

  el.setAttribute(PLAYER_STAGE_ATTR, '')

  let parent = el.parentElement
  while (parent && parent !== document.body && parent !== document.documentElement) {
    parent.setAttribute(PLAYER_STAGE_ANCESTOR_ATTR, '')
    parent = parent.parentElement
  }
}

export function clearPlayerStage(): void {
  markPlayerStage(null)
}

function readText(selectors: string[]): string {
  for (const selector of selectors) {
    const text = document.querySelector<HTMLElement>(selector)?.textContent?.trim()
    if (text)
      return text
  }
  return ''
}

export function getVideoTitle(): string {
  const title = readText(TITLE_SELECTORS)
  if (title)
    return title
  // 兜底：从 document.title 里去掉 B 站后缀
  return document.title.replace(/[_|-]?哔哩哔哩.*$/, '').trim()
}

export function getUploaderName(): string {
  return readText(UPLOADER_SELECTORS)
}

function isCurrentEpisodeItem(el: HTMLElement): boolean {
  if (el.getAttribute('aria-current') === 'true' || el.getAttribute('aria-current') === 'page')
    return true

  return el.className
    .split(/\s+/)
    .some(token => token.toLowerCase() === 'cursor' || CURRENT_EPISODE_TOKEN_RE.test(token))
}

/** 找到第一组可用的集数列表（含当前集的位置），没有则返回 null */
function findEpisodeContext(): { items: HTMLElement[], index: number } | null {
  for (const selector of EPISODE_ITEM_SELECTORS) {
    const items = Array.from(document.querySelectorAll<HTMLElement>(selector))
    if (items.length < 2)
      continue

    return {
      items,
      index: items.findIndex(isCurrentEpisodeItem),
    }
  }
  return null
}

/**
 * 番剧 / 电影播放页是否存在可用的「上一集 / 下一集」。
 *
 * 页面没有集数列表（电影单集、页面改版导致选择器失效）时返回 false，
 * 快捷键与帮助面板据此隐藏，不会出现按了没反应的情况。
 */
export function hasEpisodeNavigation(): boolean {
  return findEpisodeContext() !== null
}

/** 切到上一集 / 下一集：点击集数列表中相邻的一项（与点原生按钮等价） */
export function goToAdjacentEpisode(direction: -1 | 1): boolean {
  const context = findEpisodeContext()
  if (!context)
    return false

  const targetIndex = context.index >= 0
    ? context.index + direction
    : (direction > 0
        ? 0
        : context.items.length - 1)
  const target = context.items[targetIndex]
  if (!target)
    return false

  const clickable = target.querySelector<HTMLElement>('a, button') ?? target
  clickable.click()
  return true
}

/** 焦点在输入框 / 评论框里时不劫持快捷键 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element))
    return false
  return target.closest(EDITABLE_SELECTOR) !== null
}

/** 事件是否来自 Bewly 自己的 UI（设置弹窗等），来自它就不处理播放器快捷键 */
export function isFromBewlyUi(event: Event): boolean {
  const bewly = document.querySelector('#bewly')
  if (!bewly)
    return false
  return event.composedPath().includes(bewly)
}

/**
 * B 站原生「小窗播放」是否已接管。
 *
 * 滚动到播放器之外后，B 站自己会把 `.bpx-player-container` 置为 fixed 收到右下角。
 * 这时再叠加我们自己的迷你播放器会出现两个浮窗，所以以原生为准。
 */
export function isNativeMiniPlayerActive(): boolean {
  const el = document.querySelector<HTMLElement>('#bilibili-player .bpx-player-container')
  if (!el)
    return false
  return getComputedStyle(el).position === 'fixed'
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 影院 / 迷你状态改变了播放器尺寸，通知原生播放器重新计算布局 */
export function notifyPlayerResize(): void {
  window.dispatchEvent(new Event('resize'))
  window.setTimeout(() => window.dispatchEvent(new Event('resize')), 120)
  window.setTimeout(() => window.dispatchEvent(new Event('resize')), 320)
}

/** 弹幕开关（新版播放器是 .bpx-player-dm-switch 里的 checkbox，旧版是 .bui-danmaku-switch） */
export function getDanmakuSwitchEl(): HTMLElement | null {
  const input = document.querySelector<HTMLInputElement>(
    '#bilibili-player .bpx-player-dm-switch input[type="checkbox"]',
  )
  ?? document.querySelector<HTMLInputElement>('#bilibili-player .bui-danmaku-switch-input')
  ?? document.querySelector<HTMLInputElement>('.bui-danmaku-switch-input')

  if (input)
    return input

  return document.querySelector<HTMLElement>('#bilibili-player .bpx-player-dm-switch')
    ?? document.querySelector<HTMLElement>('#bilibili-player .bui-danmaku-switch')
}

export function isDanmakuEnabled(): boolean {
  const el = getDanmakuSwitchEl()
  if (el instanceof HTMLInputElement)
    return el.checked
  if (!el)
    return true
  return !el.classList.contains('bpx-state-off') && !el.classList.contains('bui-danmaku-switch-off')
}
// #region 播放列表页（/list/*）

/** 播放列表页 URL：/list/watchlater、/list/ml…、/list/… 合集播放页 */
const PLAYLIST_PAGE_URL_RE = /^https?:\/\/(?:www\.)?bilibili\.com\/list\//i

/**
 * 播放列表条目选择器（按优先级）。
 *
 * 真实类名证据来自 src/styles/adaptedStyles/thirdParties/bilibiliEnhanceVideoList.scss：
 * 分P / 合集列表都渲染在 `.video-pod__list` 里，普通条目是 `.video-pod__item`，
 * 分P 的是 `.simple-base-item`。两个都收，先命中先用。
 */
const PLAYLIST_ITEM_SELECTORS = [
  '.video-pod__item',
  '.video-pod__list .simple-base-item',
  '.video-pod__list [class*="item"]',
]

/** 播放器上的原生「下一个」按钮（自动连播优先点它，保留 B 站自己的行为） */
const NATIVE_NEXT_SELECTORS = [
  '#bilibili-player .bpx-player-ctrl-next',
  '.bpx-player-ctrl-next',
  '#bilibili-player .bilibili-player-video-btn-next',
  '#bilibili-player [class*="ctrl-next"]',
]

export function isPlaylistPage(url: string = location.href): boolean {
  return PLAYLIST_PAGE_URL_RE.test(url)
}

/** 当前播放列表容器（找不到就返回 null，面板据此不渲染） */
export function getPlaylistContainerEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>('#playlist-container')
    ?? document.querySelector<HTMLElement>('.video-pod')
    ?? document.querySelector<HTMLElement>('[class*="video-pod"]')
}

export function getPlaylistItems(): HTMLElement[] {
  const container = getPlaylistContainerEl()
  if (!container)
    return []

  for (const selector of PLAYLIST_ITEM_SELECTORS) {
    const items = Array.from(container.querySelectorAll<HTMLElement>(selector))
    if (items.length)
      return items
  }
  return []
}

/** 选集条目的显示标题：播放列表与分P 共用 */
export function getSelectionItemTitle(item: HTMLElement): string {
  return item.querySelector<HTMLElement>('.title-txt')?.textContent?.trim()
    ?? item.querySelector<HTMLElement>('[class*="title"]')?.textContent?.trim()
    ?? item.getAttribute('title')?.trim()
    ?? item.textContent?.trim()
    ?? ''
}

const ACTIVE_PLAYLIST_TOKEN_RE = /(?:^|[-_])(?:active|current|selected)(?:[-_]|$)/i

function isActivePlaylistItem(item: HTMLElement): boolean {
  if (item.getAttribute('aria-current'))
    return true

  return item.className
    .split(/\s+/)
    .some(token => token.toLowerCase() === 'on'
      || token.toLowerCase() === 'cursor'
      || ACTIVE_PLAYLIST_TOKEN_RE.test(token))
}

/** 当前视频的 BV 号：从查询串 bvid=… 或路径 /video/BV… 里取 */
export function getCurrentBvid(): string {
  try {
    const fromQuery = new URL(location.href).searchParams.get('bvid')
    if (fromQuery)
      return fromQuery
  }
  catch {
    // URL 解析失败时走路径兜底
  }

  const match = location.pathname.match(/(BV[0-9A-Z]+)/i)
  return match?.[1] ?? ''
}

/** 当前项在列表中的下标；判定失败返回 -1 */
export function getPlaylistCurrentIndex(items: HTMLElement[] = getPlaylistItems()): number {
  if (!items.length)
    return -1

  // 优先信原生高亮（切集后 B 站会实时改 active 类）
  const activeIndex = items.findIndex(isActivePlaylistItem)
  if (activeIndex >= 0)
    return activeIndex

  // 兜底：按当前 BV 号匹配条目里的链接
  const bvid = getCurrentBvid()
  if (!bvid)
    return -1

  return items.findIndex(item => Array.from(item.querySelectorAll('a'))
    .some(anchor => (anchor.getAttribute('href') ?? '').includes(bvid)))
}

/** 点击列表里的第 index 项：点原生条目的链接，交给 B 站自己路由 */
export function clickPlaylistItem(index: number): boolean {
  const item = getPlaylistItems()[index]
  if (!item)
    return false

  const clickable = item.querySelector<HTMLElement>('a') ?? item
  clickable.click()
  return true
}

export function goToAdjacentPlaylistItem(direction: -1 | 1): boolean {
  const items = getPlaylistItems()
  if (!items.length)
    return false

  const current = getPlaylistCurrentIndex(items)
  const targetIndex = current >= 0
    ? current + direction
    : (direction > 0
        ? 0
        : items.length - 1)
  if (targetIndex < 0 || targetIndex >= items.length)
    return false

  return clickPlaylistItem(targetIndex)
}

/** 播放器自带的「下一个」按钮（有就优先点它，保留 B 站自动连播的完整行为） */
export function findNativeNextButton(): HTMLElement | null {
  for (const selector of NATIVE_NEXT_SELECTORS) {
    const el = document.querySelector<HTMLElement>(selector)
    if (el && !el.hasAttribute('disabled'))
      return el
  }
  return null
}

/** 当前页面能不能真的「连播到下一个」：原生按钮或列表下一项至少有一个 */
export function canAdvanceToNextItem(): boolean {
  if (findNativeNextButton())
    return true
  const items = getPlaylistItems()
  const current = getPlaylistCurrentIndex(items)
  return current >= 0 && current + 1 < items.length
}

// #endregion
// #region 选集（播放列表 / 分P）

/** 选集来源：播放列表（/list/*）、普通视频页分P，或合集（collection） */
export type SelectionKind = 'none' | 'playlist' | 'parts' | 'collection'

export interface SelectionContext {
  kind: 'playlist' | 'parts' | 'collection'
  items: HTMLElement[]
  /** 当前项下标，-1 表示判定失败 */
  index: number
}

/**
 * 旧版分P 容器（`#multi_page` / `.multi-page-v1`）：命中即可基本确定是分P 列表。
 *
 * 类名证据来自仓库内的 `videoPage.scss`：
 * `.multi-page-v1 .cur-list .list-box li.on` 是当前 P；`#multi_page` / `.list-box` 是旧版分P 列表。
 */
const EXPLICIT_PART_ITEM_SELECTORS = [
  '#multi_page .list-box li',
  '.multi-page-v1 .cur-list .list-box li',
  '.multi-page-v1 .list-box li',
  '[class*="multi-page"] .list-box li',
  '#multi_page li',
  '[class*="multi-page"] li',
]

const ACTIVE_SELECTION_TOKEN_RE = /(?:^|[-_])(?:active|current|selected)(?:[-_]|$)/i

function hasActiveToken(el: HTMLElement): boolean {
  if (el.getAttribute('aria-current'))
    return true

  return el.className
    .split(/\s+/)
    .some(token => token.toLowerCase() === 'on'
      || token.toLowerCase() === 'cursor'
      || ACTIVE_SELECTION_TOKEN_RE.test(token))
}

function isActivePartItem(item: HTMLElement): boolean {
  if (hasActiveToken(item))
    return true

  // 条目本身是 <a> 时，高亮通常挂在父级 <li> 上
  const parent = item.closest<HTMLElement>('li')
  return Boolean(parent && parent !== item && hasActiveToken(parent))
}

function getCurrentPartNumber(): number {
  try {
    const param = new URL(location.href).searchParams.get('p')
    const parsed = param
      ? Number(param)
      : 1
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : 1
  }
  catch {
    return 1
  }
}

interface ParsedPartLink {
  bvid: string
  part: number | null
}

function getItemAnchors(item: HTMLElement): HTMLAnchorElement[] {
  const anchors = Array.from(item.querySelectorAll<HTMLAnchorElement>('a[href]'))
  if (item instanceof HTMLAnchorElement)
    anchors.unshift(item)
  return anchors
}

function parsePartLink(anchor: HTMLAnchorElement): ParsedPartLink | null {
  const href = anchor.getAttribute('href')
  // 旧版分P 列表有些条目是 javascript:; + JS 切换，解析不出链接
  if (!href || href.startsWith('javascript:'))
    return null

  try {
    const url = new URL(href, location.href)
    const match = url.pathname.match(/(BV[0-9A-Za-z]+)/)
    const param = url.searchParams.get('p')
    const parsed = param
      ? Number(param)
      : Number.NaN
    return {
      bvid: match?.[1] ?? '',
      part: Number.isFinite(parsed)
        ? parsed
        : null,
    }
  }
  catch {
    return null
  }
}

/** 条目里有没有指向「某个 bvid」的链接 */
function getItemBvid(item: HTMLElement): string {
  for (const anchor of getItemAnchors(item)) {
    const parsed = parsePartLink(anchor)
    if (parsed?.bvid)
      return parsed.bvid
  }
  return ''
}

function hasCurrentVideoLink(item: HTMLElement, bvid: string): boolean {
  if (!bvid)
    return false
  return getItemAnchors(item).some((anchor) => {
    const parsed = parsePartLink(anchor)
    return Boolean(parsed && parsed.bvid === bvid)
  })
}

/** 条目里是否明确链接到别的视频（旧版相关推荐的特征，用于旧容器兜底过滤） */
function isForeignVideoItem(item: HTMLElement, bvid: string): boolean {
  return getItemAnchors(item).some((anchor) => {
    const parsed = parsePartLink(anchor)
    return Boolean(parsed?.bvid && bvid && parsed.bvid !== bvid)
  })
}

function getItemPartNumber(item: HTMLElement): number | null {
  for (const anchor of getItemAnchors(item)) {
    const parsed = parsePartLink(anchor)
    if (parsed?.part != null)
      return parsed.part
  }
  return null
}

// #region 现代播放页的 .video-pod（分P / 合集 / 相关推荐 共用）

/**
 * 真机实测（2026-11，/video/BV1wvWM6RE3Z/ 多P 视频）：
 *
 * 分P：`.video-pod.video-pod` > header「视频选集 （1/8）」+ 列表 `video-pod__list multip list`
 *      + 条目 `simple-base-item video-pod__item active normal`（**条目内部没有 <a>**，点条目 DIV 切换）
 * 相关推荐：同样是 `.video-pod`，但列表 class **没有 multip**，header 是「相关推荐 / 接下来播放」
 *
 * 所以判定顺序必须是：列表 multip → header「视频选集/分P/（x/y）」→ header「合集」→ 其余一律不算。
 */
const POD_CONTAINER_SELECTOR = '[class*="video-pod"]'
const POD_HEADER_SELECTOR = '[class*="video-pod__header"], [class*="video-pod"][class*="header"]'

/** 分P 语义：`视频选集 （1/8）` 等 */
const PARTS_HEADER_RE = /视频选集|选集|分P|（\d+\/\d+）|\(\d+\/\d+\)/
/** 合集语义：合集标题 / collection / 「共 N 集」进度文案 */
const COLLECTION_HEADER_RE = /合集|collection|共\s*\d+\s*[集个]/i
/** 推荐语义：出现即不是选集 */
const RECOMMEND_HEADER_RE = /相关推荐|接下来播放|推荐|猜你喜欢/

/** 只认 class 里带独立 `video-pod` 标记的容器（排除 `video-pod__list` / `video-pod__item` 等子元素） */
function getPodContainers(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(POD_CONTAINER_SELECTOR))
    .filter(el => /(?:^|\s)video-pod(?:\s|$)/.test(el.className))
}

function getPodItems(container: HTMLElement): HTMLElement[] {
  const items = Array.from(container.querySelectorAll<HTMLElement>('.video-pod__item'))
  if (items.length > 1)
    return items
  return Array.from(container.querySelectorAll<HTMLElement>('.simple-base-item'))
}

/** pod 头部文案；拿不到就返回空串（空 header 不是选集信号） */
function getPodHeaderText(container: HTMLElement): string {
  const header = container.querySelector<HTMLElement>(POD_HEADER_SELECTOR)
  const headerText = header?.textContent?.trim()
  if (headerText)
    return headerText

  const headingNodes = Array.from(
    container.querySelectorAll<HTMLElement>('h1, h2, h3, h4, [class*="header"], [class*="title"]'),
  )
  for (const node of headingNodes) {
    if (node.closest('.video-pod__item, .simple-base-item'))
      continue
    const text = node.textContent?.trim()
    if (text)
      return text
  }
  return ''
}

/** 列表 class 里是否有独立的 `multip` 标记（分P 最强信号） */
function podListHasMultip(container: HTMLElement): boolean {
  const lists = Array.from(container.querySelectorAll<HTMLElement>('[class*="video-pod__list"]'))
  return lists.some(list => /(?:^|\s)multip(?:\s|$)/.test(list.className))
}

// #endregion

function getPartCurrentIndex(items: HTMLElement[]): number {
  // 当前 P 通常带 .active（真机实测）
  const activeIndex = items.findIndex(isActivePartItem)
  if (activeIndex >= 0)
    return activeIndex

  // 旧版：条目链接带 p=
  const currentPart = getCurrentPartNumber()
  const byLink = items.findIndex(item => getItemPartNumber(item) === currentPart)
  if (byLink >= 0)
    return byLink

  // 现代：条目是 div、没有链接，只能按 URL 的 p= 序号推导
  if (currentPart > 0 && currentPart <= items.length)
    return currentPart - 1

  return -1
}

/** 兜底启发式：当前视频下 2 个以上带 p= 的链接（分P 链接的通用特征） */
function findPartAnchors(bvid: string): HTMLElement[] {
  if (!bvid)
    return []

  const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="p="]'))
    .filter((anchor) => {
      const parsed = parsePartLink(anchor)
      return Boolean(parsed && parsed.bvid === bvid && parsed.part != null)
    })

  return anchors.length > 1
    ? anchors
    : []
}

function findPartItems(): HTMLElement[] {
  const bvid = getCurrentBvid()

  // 1) 旧版显式分P 容器优先：容器本身就是分P 列表，只剔除明确指向其它视频的条目
  for (const selector of EXPLICIT_PART_ITEM_SELECTORS) {
    const items = Array.from(document.querySelectorAll<HTMLElement>(selector))
    if (items.length < 2)
      continue

    const filtered = bvid
      ? items.filter(item => !isForeignVideoItem(item, bvid))
      : items
    if (filtered.length > 1)
      return filtered
  }

  // 2) 现代 .video-pod：列表 class 含 multip（最强信号）或 header 是「视频选集 （x/y）」→ 分P
  for (const container of getPodContainers()) {
    const items = getPodItems(container)
    if (items.length < 2)
      continue

    const headerText = getPodHeaderText(container)
    const hasMultip = podListHasMultip(container)

    // 有推荐文案且没有 multip：是相关推荐，不是分P
    if (!hasMultip && RECOMMEND_HEADER_RE.test(headerText))
      continue

    if (hasMultip || PARTS_HEADER_RE.test(headerText))
      return items
  }

  // 3) 兜底：当前视频下 2 个以上带 p= 的链接
  return findPartAnchors(bvid)
}

// #region 合集（collection）

/** 兼容：容器 class / 属性直接标了 collection 的旧结构 */
const COLLECTION_CONTAINER_SELECTORS = [
  '[class*="collection"]',
  '[class*="Collection"]',
  '[data-collection-id]',
  '[data-collectionid]',
  '[data-season-id]',
]

const COLLECTION_ITEM_SELECTORS = [
  '.video-pod__item',
  '.video-pod__list .simple-base-item',
  '.simple-base-item',
]

const COLLECTION_ID_ATTRS = ['data-collection-id', 'data-collectionid', 'data-season-id']

function hasCollectionClassOrAttr(node: HTMLElement): boolean {
  if (/collection/i.test(node.className))
    return true
  return COLLECTION_ID_ATTRS.some(attr => Boolean(node.getAttribute(attr)))
}

function getCollectionItems(container: HTMLElement): HTMLElement[] {
  for (const selector of COLLECTION_ITEM_SELECTORS) {
    const items = Array.from(container.querySelectorAll<HTMLElement>(selector))
    if (items.length > 1)
      return items
  }

  const anchors = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href*="/video/"]'))
  return anchors.length > 1
    ? anchors
    : []
}

function getCollectionCurrentIndex(items: HTMLElement[], bvid: string): number {
  // 先信原生高亮（切集后 B 站会立即改 active 类），再用当前 bvid 匹配
  const activeIndex = items.findIndex(isActivePartItem)
  if (activeIndex >= 0)
    return activeIndex

  return bvid
    ? items.findIndex(item => hasCurrentVideoLink(item, bvid))
    : -1
}

/**
 * 探测合集上下文。
 *
 * 合集条目 bvid 各不相同是**正常**的（同一合集里的不同视频），所以不能按「同 bvid」排除；
 * 与「相关推荐」的唯一可靠区分是**容器语义**：
 *   1. `.video-pod` 的 header 文案含「合集 / collection」，且不含推荐类文案；
 *   2. 或容器 class / data-* 属性直接标了 collection；
 * 另外仍要求条目 ≥2；能解析出 bvid 时要求 ≥2 个不同 bvid（防止单视频面板误判）。
 * 拿不到 header、列表也没有 multip 的 `.video-pod` 一律不当作选集（宁缺勿滥）。
 */
function findCollectionContext(): SelectionContext | null {
  const bvid = getCurrentBvid()

  // 1) 现代 .video-pod：header 说「合集」
  for (const container of getPodContainers()) {
    const items = getPodItems(container)
    if (items.length < 2)
      continue

    const headerText = getPodHeaderText(container)
    if (RECOMMEND_HEADER_RE.test(headerText))
      continue
    if (!COLLECTION_HEADER_RE.test(headerText))
      continue

    const bvids = new Set(items.map(getItemBvid).filter(Boolean))
    if (bvids.size === 1)
      continue

    return {
      kind: 'collection',
      items,
      index: getCollectionCurrentIndex(items, bvid),
    }
  }

  // 2) 兼容：容器 class / 属性直接标了 collection（没有 pod header 的旧结构）
  const candidates = new Set<HTMLElement>()
  for (const selector of COLLECTION_CONTAINER_SELECTORS)
    document.querySelectorAll<HTMLElement>(selector).forEach(el => candidates.add(el))

  for (const container of candidates) {
    if (!hasCollectionClassOrAttr(container))
      continue

    const items = getCollectionItems(container)
    if (items.length < 2)
      continue

    const bvids = new Set(items.map(getItemBvid).filter(Boolean))
    if (bvids.size === 1)
      continue

    return {
      kind: 'collection',
      items,
      index: getCollectionCurrentIndex(items, bvid),
    }
  }

  return null
}

// #endregion

/**
 * 当前页面的「选集」上下文：`/list/*` 优先取播放列表，其次显式分P / 同 bvid 的 `.video-pod` 分P，
 * 最后才是合集；都探测不到时返回 null，面板整体不渲染。
 *
 * 四类页面按能力互斥：番剧页走集数列表（不进入本函数），播放列表页走 playlist，
 * 普通多P 视频走 parts，合集视频页走 collection。
 */
export function getSelectionContext(): SelectionContext | null {
  if (isPlaylistPage()) {
    const playlistItems = getPlaylistItems()
    if (playlistItems.length) {
      return {
        kind: 'playlist',
        items: playlistItems,
        index: getPlaylistCurrentIndex(playlistItems),
      }
    }
  }

  const partItems = findPartItems()
  if (partItems.length > 1) {
    return {
      kind: 'parts',
      items: partItems,
      index: getPartCurrentIndex(partItems),
    }
  }

  return findCollectionContext()
}

export function hasSelectionNavigation(): boolean {
  return getSelectionContext() !== null
}

/** 点击选集里的第 index 项：点原生条目的链接，交给 B 站自己路由 */
export function clickSelectionItem(index: number): boolean {
  const item = getSelectionContext()?.items[index]
  if (!item)
    return false

  const clickable = item.querySelector<HTMLElement>('a') ?? item
  clickable.click()
  return true
}

export function goToAdjacentSelectionItem(direction: -1 | 1): boolean {
  const context = getSelectionContext()
  if (!context)
    return false

  const targetIndex = context.index >= 0
    ? context.index + direction
    : (direction > 0
        ? 0
        : context.items.length - 1)
  if (targetIndex < 0 || targetIndex >= context.items.length)
    return false

  return clickSelectionItem(targetIndex)
}

// #endregion
