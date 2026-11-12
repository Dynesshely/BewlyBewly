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
  setCompact,
  setMini,
} from './actions'
import { setupAdGuard, teardownAdGuard } from './adGuard'
import { setupCommentColumn, syncCommentColumn } from './commentColumn'
import { getCommentStyleStat, setupComments, syncComments } from './comments'
import PlaylistPanel from './components/PlaylistPanel.vue'
import VideoPageOverlay from './components/VideoPageOverlay.vue'
import { refreshDescPopover, setupDescPopover, teardownDescPopover } from './descPopover'
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
import { setupFixedLayout, syncFixedLayout } from './fixedLayout'
import { syncPlayerScreenMode, teardownPlayerScreenMode } from './playerMode'
import selectionPanelCss from './playlistPanel.shadow.scss?inline'
import { bindRailHost, railState, syncRecommendRail, teardownRecommendRail } from './recommendRail'
import { setupShortcuts } from './shortcuts'
import { resetUiState, ui } from './state'
import { refreshToolbarActions, setupToolbarActions, teardownToolbarActions } from './toolbarActions'
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

/**
 * 单拍同步里的「功能同步」统一包装。
 *
 * 第 36 轮真机回归：某个功能同步抛异常 → 整个 `sync()` 中断 → 固定布局那一步没执行
 * → 页面滚动 → B 站评论区懒加载不触发 → 评论组件不渲染。这里逐个隔离，布局永远能跑完。
 */
function safeSync(label: string, fn: () => void): void {
  try {
    fn()
  }
  catch (error) {
    console.warn(`[Bewly] ${label} failed:`, error)
  }
}

/** 上次写入 title 属性的元素与文本：只在标题变化时写，避免每拍改属性 */
let titledElement: HTMLElement | null = null
let titledText = ''

/**
 * 视频标题补 `title` 属性（第 34 轮）。
 *
 * 标题在固定布局里被 2 行截断（native-style 的 typography 段），截断后用户看不到全文，
 * 这里把完整标题写到原生 `title` 上，悬浮即可查看。
 * 只在「元素或文本变化」时写，避免 500ms 拍里反复触发属性变更 / 重排。
 */
function syncVideoTitleAttribute(): void {
  const el = document.querySelector<HTMLElement>('#viewbox_report .video-title')
  if (!el) {
    titledElement = null
    titledText = ''
    return
  }
  const text = (el.textContent ?? '').trim()
  if (!text)
    return
  if (el === titledElement && text === titledText)
    return
  titledElement = el
  titledText = text
  el.title = text
}

let hostEl: HTMLDivElement | null = null

/** Bewly 设置页打开时挂在 <html> 上的类（第 41 轮） */
const SETTINGS_OPEN_CLASS = 'bewly-settings-open'
/** 增强层宿主被设置页压制期间降到这个 z-index（设置面板是 10002） */
const SUPPRESSED_Z_INDEX = '9999'

let settingsOverlayOpen = false

/** 元素是否「真的可见」：尺寸够大 + display/visibility/opacity 都正常 */
function isElementVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  if (rect.width <= 300 || rect.height <= 300)
    return false
  const style = window.getComputedStyle(el)
  return style.display !== 'none'
    && style.visibility !== 'hidden'
    && Number(style.opacity || '1') > 0.01
}

/**
 * Bewly 自己的设置页 / 弹窗是否打开（第 41 轮）。
 *
 * 真机结构：设置面板在 `#bewly` 的 shadow root 里，容器是 `.fixed.w-full.h-full`（z-index 10002），
 * 里面是 `.settings-content`（1000×900）。我们的视频页增强层宿主 z-index 是 2147483200，
 * 远高于它 → 推荐轨道 / 浮层会盖在设置页上（用户报的 bug）。
 *
 * 判定顺序（从最可靠到兜底）：
 * 1. `#bewly` shadow 内可见的 `.settings-content`；
 * 2. 可见的 `[role="dialog"]`（其它弹窗，如确认框 / 抽屉）；
 * 3. 可见的 `.fixed.w-full.h-full` 且其内部含设置标志类。
 */
function isBewlySettingsOpen(): boolean {
  const shadow = document.getElementById('bewly')?.shadowRoot
  if (!shadow)
    return false

  const settingsContent = shadow.querySelector<HTMLElement>('.settings-content')
  if (settingsContent && isElementVisible(settingsContent))
    return true

  const dialog = shadow.querySelector<HTMLElement>('[role="dialog"]')
  if (dialog && isElementVisible(dialog))
    return true

  return Array.from(shadow.querySelectorAll<HTMLElement>('.fixed.w-full.h-full')).some(el =>
    isElementVisible(el)
    && Boolean(el.querySelector('.settings-content, .b-settings-item-group, [class*="settings"]')),
  )
}

/**
 * 设置页打开时让视频页增强层「让位」（第 41 轮）。
 *
 * - 给 `<html>` 加 `bewly-settings-open`（CSS 兜底：轨道显式 display:none）；
 * - 给宿主临时写 `z-index: 9999`（低于设置面板 10002），关闭后移除行内样式、回落到
 *   `videoPage.shadow.scss` 里 `:host { z-index: 2147483200 }`；
 * - 只切 class / 行内 z-index，**不动固定布局变量**，所以播放器与评论区不会跳变；
 * - 每拍执行，值相同不写（避免每拍触发样式重算）。
 */
function syncSettingsOverlaySuppression(): void {
  const open = isBewlySettingsOpen()
  const host = hostEl

  if (open !== settingsOverlayOpen) {
    settingsOverlayOpen = open
    document.documentElement.classList.toggle(SETTINGS_OPEN_CLASS, open)
    if (host) {
      if (open)
        host.setAttribute('data-bewly-suppressed', '')
      else
        host.removeAttribute('data-bewly-suppressed')
    }
  }

  if (!host)
    return

  const current = host.style.zIndex
  if (open) {
    if (current !== SUPPRESSED_Z_INDEX)
      host.style.zIndex = SUPPRESSED_Z_INDEX
  }
  else if (current !== '') {
    host.style.removeProperty('z-index')
  }
}

let vueApp: App | null = null
let disposeShortcuts: (() => void) | null = null
let disposeComments: (() => void) | null = null
let disposeCommentColumn: (() => void) | null = null
let disposeFixedLayout: (() => void) | null = null
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
  // 推荐轨道需要按可见性临时打开宿主命中（见 recommendRail/index.ts 的注释）
  bindRailHost(hostEl)

  vueApp = createApp(VideoPageOverlay)
  vueApp.mount(mountPoint)

  if (settings.value.videoPageShortcuts)
    disposeShortcuts = setupShortcuts()

  // 评论区增强（排序 / 只看 UP / 长评论折叠）：没有评论区时组件自身不渲染
  disposeComments = setupComments()

  // 真机诊断（第 34 轮）：**读 DOM 属性**，因为 content script 在 isolated world，
  // 给 window 赋的函数页面控制台看不到。
  //   document.documentElement.dataset.bewlyCommentsStyle  → 形如 "2/2;fs=14px"
  // window 钩子保留给 content script 自身调试用。
  ;(window as unknown as Record<string, unknown>).__bewlyCommentsStyleStat = getCommentStyleStat

  // 简介收拢为工具栏按钮 + 自绘 tooltip（第 32 轮）：没有简介时自身不注入
  setupDescPopover()

  // 工具栏原生入口「选集 / 快捷键」（第 33 轮）：把右下角浮动按钮挪进原生工具栏
  setupToolbarActions()

  // 评论区移到播放器右侧、与播放器同高（第 27 轮）：找不到结构 / 窄屏会自动回退
  disposeCommentColumn = setupCommentColumn()

  // 广告清理（第 28 轮）：CSS 清单 + MutationObserver 兜底动态插入
  setupAdGuard()

  // 固定单页布局（第 28 轮）：窗口太小 / 番剧页 / 迷你态会自动回退到原生可滚动布局
  disposeFixedLayout = setupFixedLayout()

  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('resize', handleScroll, { passive: true })

  // 先同步一次（打舞台标记 / 探测集数列表），再恢复影院模式
  sync()

  // 设置页可能在播放页打开期间修改开关，这里实时响应（设置存在浏览器存储里，跨上下文同步）
  stopSettingsWatch = watch(
    () => [
      settings.value.videoPageShortcuts,
      settings.value.videoPageMiniPlayer,
      settings.value.videoPageRecommendRail,
      settings.value.videoPageFixedLayout,
    ] as const,
    ([shortcutsEnabled, miniEnabled, recommendRailEnabled]) => {
      // 推荐轨道开关：关掉时立刻还原原生列表
      if (!recommendRailEnabled)
        syncRecommendRail({ enabled: false })
      if (shortcutsEnabled && !disposeShortcuts) {
        disposeShortcuts = setupShortcuts()
      }
      else if (!shortcutsEnabled && disposeShortcuts) {
        disposeShortcuts()
        disposeShortcuts = null
      }

      // 关掉迷你播放器时立刻还原
      if (!miniEnabled && ui.mini)
        setMini(false)

      updateScrollState()
      safeSync('syncRecommendRail', () => syncRecommendRail({ enabled: settings.value.videoPageRecommendRail }))
      // 固定布局开关：立刻生效 / 立刻还原
      syncFixedLayout()
    },
  )

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
  if (disposeComments) {
    disposeComments()
    disposeComments = null
  }
  // 第 33 轮 wrap 版本：简介按钮被移进 #bewly-toolbar-actions wrapper，
  // 所以先拆 toolbar（它会把简介按钮放回 wrapper 原位、再整体移除 wrapper），
  // 然后再拆 descPopover（移除按钮本身）。顺序反过来也不会漏清理，但会少一次「放回原位」。
  teardownToolbarActions()
  teardownPlayerScreenMode()
  teardownDescPopover()
  if (disposeCommentColumn) {
    disposeCommentColumn()
    disposeCommentColumn = null
  }
  if (disposeFixedLayout) {
    disposeFixedLayout()
    disposeFixedLayout = null
  }
  teardownAdGuard()

  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('resize', handleScroll)

  teardownRecommendRail()

  unbindVideoEnded()
  if (endedTimer !== null) {
    window.clearTimeout(endedTimer)
    endedTimer = null
  }

  document.documentElement.classList.remove('bewly-video-mini', SETTINGS_OPEN_CLASS)
  settingsOverlayOpen = false
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

  bindRailHost(null)
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
  // 标题 2 行截断后补全文提示（第 34 轮）
  syncVideoTitleAttribute()
  ui.danmakuOn = isDanmakuEnabled()

  // 播放器显示模式（第 37 轮）：网页全屏 / 宽屏 / 普通。必须先于轨道与布局同步，
  // 让 rail 决定是否渲染、fixedLayout 决定是否给右列留位置。
  const modeChanged = syncPlayerScreenMode()

  // 设置页让位（第 41 轮）：Bewly 设置页打开时把增强层压到它下面，关闭立即还原。
  safeSync('syncSettingsOverlaySuppression', syncSettingsOverlaySuppression)

  // 推荐视频轨道（第 27 轮）：读不到卡片时内部会保持原生列表不动
  safeSync('syncRecommendRail', () => syncRecommendRail({ enabled: settings.value.videoPageRecommendRail }))
  const railVisible = Boolean(railState.placement && railState.cards.length)
  if (ui.recommendRailVisible !== railVisible)
    ui.recommendRailVisible = railVisible

  // 固定单页布局（第 29 轮）：**唯一**的布局所有者。
  // ⚠️ 第 36 轮起把它提到评论区同步之前：评论区 / 轨道 / 简介任何一处抛异常都不能阻止
  // 布局类落地（真机回归就是「评论组件没挂载 → 固定布局也没生效 → 整页塌」）。
  syncFixedLayout()

  // 模式刚切换：立即再校正一次评论列（隐藏 / 恢复后高度与位置都变了）
  if (modeChanged)
    safeSync('syncCommentColumn(modeChanged)', syncCommentColumn)

  // 评论区：标记 UP / 注入筛选按钮 / 折叠长评论。包一层 try/catch，
  // 保证单点异常不会中断整拍（下面还有评论列校正与布局刷新）。
  safeSync('syncComments', syncComments)

  // 简介按钮（第 32 轮）：切视频 / 切分P 后重读文本，变空则撤掉自己
  safeSync('refreshDescPopover', refreshDescPopover)

  // 工具栏入口（第 33 轮）：切视频 / 切分P 后工具栏会被 B 站重建，这里每拍补齐
  safeSync('refreshToolbarActions', refreshToolbarActions)

  // 评论区右列布局：B 站可能重渲染 #commentapp / 右栏，每拍校正一次（不满足条件时内部直接还原）
  safeSync('syncCommentColumn', syncCommentColumn)
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

  // 固定单页布局下页面不滚动，不需要迷你播放器
  if (ui.fixedLayout) {
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
