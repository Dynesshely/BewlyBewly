/**
 * 视频播放页增强入口。
 *
 * 由 contentScripts/index.ts 调用 setupVideoPage() / teardownVideoPage()。
 * 本模块只服务「原生 B 站播放页」：页面本身仍由 B 站渲染，我们只在其上叠加
 * 一个独立 shadow root 的增强层（影院模式 / 迷你播放器 / 快捷键 / 紧凑信息栏）。
 */
import type { App } from 'vue'
import { createApp } from 'vue'

import {
  clearToastTimer,
  isMiniRestoreSuppressed,
  readStoredCinema,
  setCinema,
  setCompact,
  setMini,
} from './actions'
import VideoPageOverlay from './components/VideoPageOverlay.vue'
import {
  getPlayerWrapEl,
  getUploaderName,
  getVideoEl,
  getVideoTitle,
  isDanmakuEnabled,
  isNativeMiniPlayerActive,
  isNativeVideoPage,
} from './dom'
import { setupShortcuts } from './shortcuts'
import { resetUiState, ui } from './state'
import shadowCss from './videoPage.shadow.scss?inline'

const HOST_ID = 'bewly-video-page'

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
let syncTimer: number | null = null
let scrollFrame = 0
let miniEnteredAt = 0

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

  disposeShortcuts = setupShortcuts()
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('resize', handleScroll, { passive: true })

  // 影院模式在同一标签页内跨页面刷新保持
  if (readStoredCinema())
    setCinema(true, { silent: true })

  sync()
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
  if (disposeShortcuts) {
    disposeShortcuts()
    disposeShortcuts = null
  }

  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('resize', handleScroll)

  document.documentElement.classList.remove('bewly-video-cinema', 'bewly-video-mini')
  document.documentElement.style.removeProperty('--bvp-mini-placeholder')
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

  if (!isNativeVideoPage()) {
    teardownVideoPage()
    return
  }

  if (document.hidden)
    return

  const video = getVideoEl()
  const wrap = getPlayerWrapEl()

  ui.ready = Boolean(video && wrap)

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
