/**
 * 原生 B 站播放页的 DOM 适配层。
 *
 * 这里集中所有「依赖 B 站页面结构」的查询，方便将来页面改版时只改这一处。
 * 所有查询都带 fallback 选择器，并且全部允许返回 null —— 播放器是异步渲染的。
 */

/** 普通视频页 / 播放列表页（番剧与电影播放页有自己的适配样式，不在本模块接管范围） */
const VIDEO_PAGE_URL_RE = /^https?:\/\/(?:www\.)?bilibili\.com\/(?:video|list)\//i

const TITLE_SELECTORS = [
  'h1.video-title',
  '.video-title',
  '.video-info-title-inner h1',
  '#viewbox_report h1',
]

const UPLOADER_SELECTORS = [
  '.up-detail .up-name',
  '.up-name',
  '.video-up-name',
  '#v_upinfo .up-name',
]

const EDITABLE_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
].join(', ')

export function isNativeVideoPage(url: string = location.href): boolean {
  if (!VIDEO_PAGE_URL_RE.test(url))
    return false
  // 番剧 / 电影播放页走 animePlayback&MoviePage 的样式，避免两套增强互相打架
  return !document.documentElement.classList.contains('animePlaybackAndMoviePage')
}

/** 播放器外层容器（迷你播放器就是把它 fixed 到右下角） */
export function getPlayerWrapEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>('#playerWrap')
    ?? document.querySelector<HTMLElement>('#bilibili-player')?.parentElement
    ?? document.querySelector<HTMLElement>('#mirror-vdcon .left-container')
    ?? null
}

export function getPlayerEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>('#bilibili-player')
    ?? document.querySelector<HTMLElement>('#playerWrap .bpx-player-container')
    ?? document.querySelector<HTMLElement>('.bpx-player-container')
    ?? null
}

export function getVideoEl(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>('#bilibili-player video')
    ?? document.querySelector<HTMLVideoElement>('#playerWrap video')
    ?? document.querySelector<HTMLVideoElement>('.bpx-player-container video')
    ?? null
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
