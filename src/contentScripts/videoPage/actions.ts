import { settings } from '~/logic'

import {
  getDanmakuSwitchEl,
  getPlayerEl,
  getPlayerWrapEl,
  getVideoEl,
  goToAdjacentEpisode,
  isDanmakuEnabled,
  notifyPlayerResize,
  prefersReducedMotion,
} from './dom'
import { formatPercent, getMessages } from './i18n'
import { ui } from './state'

/** 影院模式状态存 sessionStorage：同一标签页刷新后保持，新标签页从关闭开始 */
const CINEMA_STORAGE_KEY = 'bewly-video-cinema'

const HTML_CLASS_CINEMA = 'bewly-video-cinema'
const HTML_CLASS_MINI = 'bewly-video-mini'

/** 还原迷你播放器后的短暂抑制窗口，避免平滑滚动途中又被判定为「滚出视口」而重新收缩 */
let suppressMiniUntil = 0

/** 迷你态给「播放器舞台的父级」加的占位高度（番剧页没有 #playerWrap，CSS 变量那条规则管不到它） */
let stagePlaceholderEl: HTMLElement | null = null

let toastTimer: number | null = null

function messages() {
  return getMessages()
}

export function showToast(message: string): void {
  ui.toast = message
  if (toastTimer !== null)
    window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastTimer = null
    ui.toast = ''
  }, 1800)
}

export function clearToastTimer(): void {
  if (toastTimer !== null) {
    window.clearTimeout(toastTimer)
    toastTimer = null
  }
  ui.toast = ''
}

export function readStoredCinema(): boolean {
  try {
    return sessionStorage.getItem(CINEMA_STORAGE_KEY) === '1'
  }
  catch {
    return false
  }
}

function storeCinema(on: boolean): void {
  try {
    sessionStorage.setItem(CINEMA_STORAGE_KEY, on ? '1' : '0')
  }
  catch {
    // sessionStorage 可能被隐私设置禁用，忽略即可
  }
}

/** 影院模式：播放器铺满视口宽度、隐藏右栏与推荐、页面背景压暗 */
export function setCinema(on: boolean, options: { silent?: boolean } = {}): void {
  // 设置页关掉影院模式后，任何入口（快捷键 / 浮动按钮 / 旧 sessionStorage）都不再生效
  if (on && !settings.value.videoPageCinemaMode) {
    return
  }

  if (ui.cinema === on) {
    return
  }

  ui.cinema = on
  document.documentElement.classList.toggle(HTML_CLASS_CINEMA, on)
  storeCinema(on)

  if (on) {
    // 进入影院时先复位迷你播放器，避免两个状态叠加
    setMini(false)
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion()
        ? 'auto'
        : 'smooth',
    })
  }

  notifyPlayerResize()

  if (!options.silent) {
    const t = messages()
    showToast(on ? t.cinemaOn : t.cinemaOff)
  }
}

export function toggleCinema(): void {
  if (!settings.value.videoPageCinemaMode) {
    return
  }
  setCinema(!ui.cinema)
}

export function setMini(on: boolean): void {
  // 迷你播放器开关关闭时不允许进入收缩态（已经收缩的由减少入口统一还原）
  if (on && !settings.value.videoPageMiniPlayer) {
    return
  }

  if (ui.mini === on) {
    return
  }

  ui.mini = on

  if (on) {
    // 先清掉可能残留的旧占位，避免连续进入迷你态时留下多个撑高元素
    clearStagePlaceholder()

    // 记录播放器原始高度，收起成浮窗后左栏仍然占位，避免页面内容跳动
    const wrap = getPlayerWrapEl()
    const height = wrap
      ? Math.round(wrap.getBoundingClientRect().height)
      : 0
    if (height > 0) {
      document.documentElement.style.setProperty('--bvp-mini-placeholder', `${height}px`)

      // 普通视频页由 CSS 变量给 .left-container 撑高；番剧页的容器结构不稳定，
      // 直接给舞台父级写 inline min-height，保证收起浮窗时页面内容不上跳
      const parent = wrap?.parentElement ?? null
      if (parent && parent !== document.body) {
        stagePlaceholderEl = parent
        parent.style.minHeight = `${height}px`
      }
    }
    document.documentElement.classList.add(HTML_CLASS_MINI)
  }
  else {
    document.documentElement.classList.remove(HTML_CLASS_MINI)
    document.documentElement.style.removeProperty('--bvp-mini-placeholder')
    clearStagePlaceholder()
  }

  notifyPlayerResize()
}

/** 清掉迷你态写的占位高度（退出迷你 / 卸载时调用） */
export function clearStagePlaceholder(): void {
  if (stagePlaceholderEl) {
    stagePlaceholderEl.style.minHeight = ''
    stagePlaceholderEl = null
  }
}

export function setCompact(compact: boolean): void {
  if (ui.compact !== compact)
    ui.compact = compact
}

export function isMiniRestoreSuppressed(): boolean {
  return Date.now() < suppressMiniUntil
}

/** 从迷你播放器还原：解除收缩并滚回播放器 */
export function restorePlayer(): void {
  if (!settings.value.videoPageMiniPlayer) {
    return
  }

  const wrap = getPlayerWrapEl()
  // 抑制窗口要覆盖平滑滚动的全过程，且期间既不进也不出迷你态
  suppressMiniUntil = Date.now() + 2200
  setMini(false)
  if (wrap) {
    // 用确定的滚动目标而不是 scrollIntoView：后者受滚动容器与平滑滚动影响，
    // 步骤中途仍可能被判定为「播放器在视口外」而立刻重新收缩。
    const top = Math.max(0, window.scrollY + wrap.getBoundingClientRect().top - 80)
    window.scrollTo({
      top,
      behavior: prefersReducedMotion()
        ? 'auto'
        : 'smooth',
    })
  }
  showToast(messages().restored)
}

export function toggleShortcutsHelp(force?: boolean): void {
  ui.helpOpen = force ?? !ui.helpOpen
}

/**
 * 番剧 / 电影播放页：切到上一集 / 下一集。
 *
 * 页面上没有集数列表时什么也不做（快捷键与帮助面板已按 ui.episodeNav 隐藏）。
 */
export function stepEpisode(direction: -1 | 1): void {
  if (!ui.episodeNav)
    return
  goToAdjacentEpisode(direction)
}

export function seekBy(seconds: number): void {
  const video = getVideoEl()
  if (!video) {
    showToast(messages().playerNotFound)
    return
  }

  const duration = Number.isFinite(video.duration)
    ? video.duration
    : 0
  const target = video.currentTime + seconds
  const clamped = duration > 0
    ? Math.min(Math.max(target, 0), duration)
    : Math.max(target, 0)
  video.currentTime = clamped
}

export function seekToPercent(percent: number): void {
  const video = getVideoEl()
  if (!video) {
    showToast(messages().playerNotFound)
    return
  }

  const duration = Number.isFinite(video.duration)
    ? video.duration
    : 0
  if (duration <= 0) {
    return
  }

  video.currentTime = (duration * percent) / 100
  const t = messages()
  showToast(formatPercent(t.percent, percent))
}

export function togglePlay(): void {
  const video = getVideoEl()
  if (!video) {
    showToast(messages().playerNotFound)
    return
  }

  if (video.paused)
    video.play().catch(() => {})
  else
    video.pause()
}

export function toggleMute(): void {
  const video = getVideoEl()
  if (!video) {
    showToast(messages().playerNotFound)
    return
  }

  video.muted = !video.muted
  ui.muted = video.muted
  const t = messages()
  showToast(video.muted ? t.muted : t.unmuted)
}

/** 弹幕开关交给原生控件，保证播放器自己的状态机与 UI 同步 */
export function toggleDanmaku(): void {
  const switchEl = getDanmakuSwitchEl()
  if (!switchEl) {
    return
  }

  switchEl.click()
  // 原生控件会同步刷新，先给一个乐观值，轮询会在下一拍纠正
  ui.danmakuOn = !ui.danmakuOn
  const t = messages()
  showToast(ui.danmakuOn ? t.danmakuOn : t.danmakuOff)
  window.setTimeout(() => {
    ui.danmakuOn = isDanmakuEnabled()
  }, 120)
}

export async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }

    // 优先点原生全屏按钮，保留 B 站自己的网页全屏 / 浏览器全屏逻辑
    const nativeButton = document.querySelector<HTMLElement>(
      '#bilibili-player .bpx-player-ctrl-full',
    )
    if (nativeButton) {
      nativeButton.click()
      return
    }

    const player = getPlayerEl()
    if (!player) {
      showToast(messages().playerNotFound)
      return
    }
    await player.requestFullscreen()
  }
  catch {
    // 全屏被拒绝（无用户手势等）时静默失败，不影响其它快捷键
  }
}

export async function togglePictureInPicture(): Promise<void> {
  const video = getVideoEl()
  if (!video) {
    showToast(messages().playerNotFound)
    return
  }

  const t = messages()
  if (!document.pictureInPictureEnabled) {
    showToast(t.pipUnsupported)
    return
  }

  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture()
      return
    }
    await video.requestPictureInPicture()
  }
  catch {
    showToast(t.pipFailed)
  }
}
