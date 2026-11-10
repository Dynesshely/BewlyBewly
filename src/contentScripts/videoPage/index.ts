/**
 * 视频播放页增强入口。
 *
 * 由 contentScripts/index.ts 调用 setupVideoPage() / teardownVideoPage()。
 * 本模块只服务「原生 B 站播放页」：页面本身仍由 B 站渲染，我们只在其上叠加
 * 一个独立 shadow root 的增强层（影院模式 / 迷你播放器 / 快捷键 / 紧凑信息栏）。
 */
import type { App } from 'vue'
import type { SelectionContext } from './dom'
import type { SelectionItemView } from './state'

import { createApp, watch } from 'vue'

import { settings } from '~/logic'

import { hasNativeOverlay, mountNativeOverlay, unmountNativeOverlay } from '../nativeOverlay'
import {
  advanceToNextItem,
  clearStagePlaceholder,
  clearToastTimer,
  isMiniRestoreSuppressed,
  readStoredAutoplay,
  readStoredCinema,
  setCinema,
  setCompact,
  setMini,
} from './actions'
import PlaylistPanel from './components/PlaylistPanel.vue'
import VideoPageOverlay from './components/VideoPageOverlay.vue'
import {
  clearPlayerStage,
  getNativePlaybackKind,
  getPlayerWrapEl,
  getSelectionContext,
  getSelectionItemTitle,
  getUploaderName,
  getVideoEl,
  getVideoTitle,
  hasEpisodeNavigation,

  isDanmakuEnabled,
  isNativeMiniPlayerActive,
  isNativeVideoPage,
  markPlayerStage,
} from './dom'
import selectionPanelCss from './playlistPanel.shadow.scss?inline'
import { setupShortcuts } from './shortcuts'
import { resetUiState, ui } from './state'
import shadowCss from './videoPage.shadow.scss?inline'

const HOST_ID = 'bewly-video-page'

/** 播放列表面板：独立浮层 host，探测不到播放列表时整个 host 不存在 */
const SELECTION_HOST_ID = 'bewly-video-selection'

/** 页面滚动超过这个距离后出现紧凑信息栏 */
const COMPACT_THRESHOLD = 160
/**
 * 播放器底部低于这个位置时收成迷你播放器。
 *
 * 真实 B 站播放页的 `.left-container` 是 `position: sticky`，播放器会被吸附在顶部、
 * 永远保留一截可见（实测底边停在约 75px），所以不能等它完全滚出视口才触发。
 * 这里改成「只剩顶部一条」就收起，既适配 sticky 布局，也兼容普通文档流（底边会变成负数）。
 */
const MINI_ENTER_BOTTOM = 140
/** 迷你播放器状态下向上滚回这么多像素才还原（滞回，避免边界抖动） */
const MINI_RESTORE_MARGIN = 160
/** 播放器状态轮询间隔 */
const SYNC_INTERVAL = 500

let hostEl: HTMLDivElement | null = null
let vueApp: App | null = null
let disposeShortcuts: (() => void) | null = null
let stopSettingsWatch: (() => void) | null = null
let syncTimer: number | null = null
let scrollFrame = 0
let miniEnteredAt = 0
/** 上一次标记的播放器舞台元素（避免每拍都写 DOM 属性） */
let stageEl: HTMLElement | null = null
/** 已绑定 ended 事件的 video 元素（播放器会换，需要重绑） */
let boundVideoEl: HTMLVideoElement | null = null
let boundEndedHandler: (() => void) | null = null
/** ended 后的延时（让 B 站自己的 ended 处理先跑完） */
let endedTimer: number | null = null
/** 自动连播偏好是否已经从 sessionStorage 还原过 */
let autoplayPreferenceLoaded = false

export function setupVideoPage(): void {
  if (hostEl)
    return
  if (!isNativeVideoPage())
    return
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => setupVideoPage(), { once: true })
    return
  }
  mount()
}

export function teardownVideoPage(): void {
  unmount()
}

function mount(): void {
  hostEl = document.createElement('div')
  hostEl.id = HOST_ID

  const shadow = hostEl.attachShadow({ mode: 'open' })
  const styleEl = document.createElement('style')
  styleEl.textContent = shadowCss
  shadow.appendChild(styleEl)

  const mountPoint = document.createElement('div')
  shadow.appendChild(mountPoint)
  document.body.appendChild(hostEl)

  vueApp = createApp(VideoPageOverlay)
  vueApp.mount(mountPoint)

  if (settings.value.videoPageShortcuts)
    disposeShortcuts = setupShortcuts()

  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('resize', handleScroll, { passive: true })

  // 先同步一次（打舞台标记 / 探测集数列表），再恢复影院模式
  sync()

  // 设置页可能在播放页打开期间修改开关，这里实时响应（设置存在浏览器存储里，跨上下文同步）
  stopSettingsWatch = watch(
    () => [settings.value.videoPageShortcuts, settings.value.videoPageCinemaMode, settings.value.videoPageMiniPlayer] as const,
    ([shortcutsEnabled, cinemaEnabled, miniEnabled]) => {
      if (shortcutsEnabled && !disposeShortcuts) {
        disposeShortcuts = setupShortcuts()
      }
      else if (!shortcutsEnabled && disposeShortcuts) {
        disposeShortcuts()
        disposeShortcuts = null
      }

      // 关掉影院模式时立刻退出；关掉迷你播放器时立刻还原
      if (!cinemaEnabled && ui.cinema)
        setCinema(false, { silent: true })
      if (!miniEnabled && ui.mini)
        setMini(false)

      updateScrollState()
    },
  )

  // 影院模式在同一标签页内跨页面刷新保持（功能关闭时不恢复）
  if (settings.value.videoPageCinemaMode && readStoredCinema())
    setCinema(true, { silent: true })

  // 自动连播默认关，只在同一标签页里记忆用户的开启状态
  if (ui.selectionNav)
    restoreAutoplayPreference()

  syncTimer = window.setInterval(sync, SYNC_INTERVAL)
  updateScrollState()
}

function unmount(): void {
  if (!hostEl)
    return

  if (syncTimer !== null) {
    window.clearInterval(syncTimer)
    syncTimer = null
  }
  if (scrollFrame) {
    window.cancelAnimationFrame(scrollFrame)
    scrollFrame = 0
  }
  if (stopSettingsWatch) {
    stopSettingsWatch()
    stopSettingsWatch = null
  }
  if (disposeShortcuts) {
    disposeShortcuts()
    disposeShortcuts = null
  }

  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('resize', handleScroll)

  unbindVideoEnded()
  if (endedTimer !== null) {
    window.clearTimeout(endedTimer)
    endedTimer = null
  }

  document.documentElement.classList.remove('bewly-video-cinema', 'bewly-video-mini')
  document.documentElement.style.removeProperty('--bvp-mini-placeholder')
  clearStagePlaceholder()
  clearPlayerStage()
  stageEl = null
  unmountSelectionOverlay()
  clearToastTimer()

  if (vueApp) {
    vueApp.unmount()
    vueApp = null
  }

  hostEl.remove()
  hostEl = null
  resetUiState()
}

/** 轮询同步播放器与页面状态（播放器是异步渲染的，且会随分 P 切换被替换） */
function sync(): void {
  if (!hostEl)
    return

  const kind = getNativePlaybackKind()
  if (kind === 'none') {
    teardownVideoPage()
    return
  }

  ui.isBangumi = kind === 'bangumi'

  if (document.hidden)
    return

  const video = getVideoEl()
  const wrap = getPlayerWrapEl()

  ui.ready = Boolean(video && wrap)

  // 舞台标记只在元素变化时写一次：番剧页的影院 / 迷你布局靠这个属性命中
  if (wrap !== stageEl) {
    stageEl = wrap
    markPlayerStage(wrap)
  }

  // 番剧 / 电影才有集数列表；没有时切集快捷键与帮助项都隐藏
  ui.episodeNav = kind === 'bangumi' && hasEpisodeNavigation()

  // 选集（播放列表 / 分P）：没有选集结构时面板、快捷键、自动连播全部不出现
  // 三类页面互斥：番剧页走集数列表，/list/* 走播放列表，普通多P 视频走分P
  syncSelectionState(kind === 'video'
    ? getSelectionContext()
    : null)

  // 播放器可能被分 P / 换集替换，ended 监听需要跟着重绑
  bindVideoEnded()

  if (video) {
    ui.currentTime = Number.isFinite(video.currentTime)
      ? video.currentTime
      : 0
    ui.duration = Number.isFinite(video.duration)
      ? video.duration
      : 0
    ui.muted = video.muted
    ui.paused = video.paused
  }

  // 赋值相同字符串不会触发 Vue 更新，这里可以直接每拍刷新
  ui.title = getVideoTitle()
  ui.upName = getUploaderName()
  ui.danmakuOn = isDanmakuEnabled()
}

function handleScroll(): void {
  if (scrollFrame)
    return
  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = 0
    updateScrollState()
  })
}

function updateScrollState(): void {
  setCompact(window.scrollY > COMPACT_THRESHOLD)

  // 迷你播放器开关关闭时不再收缩播放器
  if (!settings.value.videoPageMiniPlayer) {
    if (ui.mini)
      setMini(false)
    return
  }

  // 影院模式下不启用迷你播放器（播放器本来就占满视口）
  if (ui.cinema) {
    if (ui.mini)
      setMini(false)
    return
  }

  if (!ui.ready)
    return

  // 刚点过「还原播放器」：平滑滚动途中的中间态不应该再次判定为「滚出视口」，
  // 否则会立刻重新收成迷你播放器（实测就是这个竞态导致 P 看起来无效）
  if (isMiniRestoreSuppressed())
    return

  if (ui.mini) {
    if (!isMiniRestoreSuppressed() && window.scrollY < miniEnteredAt - MINI_RESTORE_MARGIN)
      setMini(false)
    return
  }

  const wrap = getPlayerWrapEl()
  if (!wrap)
    return

  // B 站原生「小窗播放」已经接管时不再叠加我们自己的浮窗
  if (isNativeMiniPlayerActive()) {
    if (ui.mini)
      setMini(false)
    return
  }

  // 播放器只剩顶部一条（sticky 布局）或完全滚出视口（普通布局）时收成右下角浮窗
  if (wrap.getBoundingClientRect().bottom < MINI_ENTER_BOTTOM) {
    miniEnteredAt = window.scrollY
    setMini(true)
  }
}
// #region 播放列表（/list/*）

function restoreAutoplayPreference(): void {
  if (autoplayPreferenceLoaded)
    return
  autoplayPreferenceLoaded = true
  ui.playlistAutoplay = readStoredAutoplay()
}

function sameSelectionItems(a: SelectionItemView[], b: SelectionItemView[]): boolean {
  if (a.length !== b.length)
    return false
  return a.every((item, index) => item.index === b[index].index
    && item.title === b[index].title
    && item.active === b[index].active)
}

/**
 * 同步播放列表到 UI 状态。
 *
 * 每 500ms 只读一次 DOM；内容（长度 / 标题 / 当前项）完全一致时不写 reactive 状态，
 * 避免面板每拍重渲染。
 */
function syncSelectionState(selection: SelectionContext | null): void {
  if (!selection) {
    unmountSelectionOverlay()
    if (ui.selectionNav)
      ui.selectionNav = false
    if (ui.selectionKind !== 'none')
      ui.selectionKind = 'none'
    if (ui.selectionPanelOpen)
      ui.selectionPanelOpen = false
    if (ui.selectionItems.length)
      ui.selectionItems = []
    if (ui.selectionCurrentIndex !== -1)
      ui.selectionCurrentIndex = -1
    return
  }

  if (!ui.selectionNav)
    ui.selectionNav = true
  if (ui.selectionKind !== selection.kind)
    ui.selectionKind = selection.kind

  mountSelectionOverlay()
  restoreAutoplayPreference()

  const next = selection.items.map<SelectionItemView>((el, index) => ({
    index,
    title: getSelectionItemTitle(el),
    active: index === selection.index,
  }))

  if (ui.selectionCurrentIndex !== selection.index)
    ui.selectionCurrentIndex = selection.index

  if (!sameSelectionItems(ui.selectionItems, next))
    ui.selectionItems = next
}

function mountSelectionOverlay(): void {
  if (hasNativeOverlay(SELECTION_HOST_ID))
    return
  mountNativeOverlay({
    hostId: SELECTION_HOST_ID,
    component: PlaylistPanel,
    css: selectionPanelCss,
    hostAttributes: { 'data-bewly-video-selection': '' },
  })
}

function unmountSelectionOverlay(): void {
  if (!hasNativeOverlay(SELECTION_HOST_ID))
    return
  unmountNativeOverlay(SELECTION_HOST_ID)
}

function bindVideoEnded(): void {
  const video = getVideoEl()
  if (video === boundVideoEl)
    return

  unbindVideoEnded()

  boundVideoEl = video
  if (!video)
    return

  boundEndedHandler = () => handleVideoEnded()
  video.addEventListener('ended', boundEndedHandler)
}

function unbindVideoEnded(): void {
  if (boundVideoEl && boundEndedHandler)
    boundVideoEl.removeEventListener('ended', boundEndedHandler)
  boundVideoEl = null
  boundEndedHandler = null
}

/**
 * 自动连播：视频播完后切下一个。
 *
 * B 站自己也可能在 ended 后弹「自动连播」提示，这里延后一拍再动作，
 * 让原生逻辑先跑；节点里没有下一个可用项时 advanceToNextItem 会关闭自动连播并提示。
 */
function handleVideoEnded(): void {
  if (!ui.playlistAutoplay || ui.selectionKind !== 'playlist')
    return

  if (endedTimer !== null)
    window.clearTimeout(endedTimer)
  endedTimer = window.setTimeout(() => {
    endedTimer = null
    if (!ui.playlistAutoplay || ui.selectionKind !== 'playlist')
      return
    advanceToNextItem()
  }, 400)
}

// #endregion
