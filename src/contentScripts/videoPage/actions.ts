import { settings } from '~/logic'

import {
  canAdvanceToNextItem,
  clickSelectionItem,
  findNativeNextButton,
  getDanmakuSwitchEl,
  getPlayerEl,
  getPlayerWrapEl,
  getVideoEl,
  goToAdjacentEpisode,
  goToAdjacentPlaylistItem,
  goToAdjacentSelectionItem,
  isDanmakuEnabled,
  notifyPlayerResize,
  prefersReducedMotion,
} from './dom'
import { formatPercent, getMessages } from './i18n'
import { ui } from './state'

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
// #region 选集（播放列表 / 分P）

/** 自动连播状态存 sessionStorage：默认关，同一标签页刷新后保持（仅播放列表页可用） */
const AUTOPLAY_STORAGE_KEY = 'bewly-playlist-autoplay'

export function readStoredAutoplay(): boolean {
  try {
    return sessionStorage.getItem(AUTOPLAY_STORAGE_KEY) === '1'
  }
  catch {
    return false
  }
}

function storeAutoplay(on: boolean): void {
  try {
    sessionStorage.setItem(AUTOPLAY_STORAGE_KEY, on ? '1' : '0')
  }
  catch {
    // sessionStorage 被禁用时忽略，只影响记忆不影响本次会话
  }
}

export function setSelectionPanelOpen(open: boolean): void {
  if (ui.selectionPanelOpen === open)
    return
  ui.selectionPanelOpen = open && ui.selectionNav
}

export function toggleSelectionPanel(): void {
  if (!ui.selectionNav)
    return
  setSelectionPanelOpen(!ui.selectionPanelOpen)
}

export function closeSelectionPanel(): void {
  setSelectionPanelOpen(false)
}

/** 自动连播开关：默认关；只服务 /list/* 播放列表（分P 由 B 站自己连播） */
export function setPlaylistAutoplay(on: boolean): void {
  if (on && ui.selectionKind !== 'playlist')
    return

  ui.playlistAutoplay = on
  storeAutoplay(on)
  const t = messages()
  showToast(on ? t.autoplayOn : t.autoplayOff)
}

export function togglePlaylistAutoplay(): void {
  if (ui.selectionKind !== 'playlist')
    return

  if (!ui.playlistAutoplay && !canAdvanceToNextItem()) {
    showToast(messages().autoplayUnavailable)
    return
  }
  setPlaylistAutoplay(!ui.playlistAutoplay)
}

/** 点击面板里的一项：直接点原生条目（播放列表链接 / 分P 链接），路由交给 B 站 */
export function selectSelectionItem(index: number): void {
  if (!ui.selectionNav)
    return
  clickSelectionItem(index)
}

/** 快捷键 [ / ]：切上一个 / 下一个选集项（播放列表条目或分P） */
export function stepSelectionItem(direction: -1 | 1): void {
  if (!ui.selectionNav)
    return
  goToAdjacentSelectionItem(direction)
}

/**
 * 自动连播的一步：视频 ended 时触发（仅播放列表页）。
 *
 * 优先点播放器原生的「下一个」按钮（保留 B 站自己的行为）；
 * 找不到原生按钮时退化为点播放列表里的下一项；两者都没有就关闭自动连播并说明。
 */
export function advanceToNextItem(): boolean {
  if (ui.selectionKind !== 'playlist')
    return false

  const nativeNext = findNativeNextButton()
  if (nativeNext) {
    nativeNext.click()
    return true
  }

  if (goToAdjacentPlaylistItem(1))
    return true

  setPlaylistAutoplay(false)
  showToast(messages().autoplayUnavailable)
  return false
}

// #endregion
