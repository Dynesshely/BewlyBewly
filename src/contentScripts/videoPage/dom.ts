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
