import { injectCSS } from '~/utils/main'
/**
 * 直播页增强层的交互动作：状态持久化、影院模式、隐藏侧栏、弹幕开关、全屏、
 * 页面级样式注入、DOM 标记与清理。
 *
 * 影院模式是「给 <html> 加状态类 + 给原生播放器 / 侧栏 / 祖先链打属性标记」，
 * 真正的布局在 `livePage.page.scss`（模块自行注入 <style>）。
 * 零网络请求、零写操作（弹幕 / 全屏都是点原生控件或调用浏览器 API）。
 */
import {
  PAGE_STYLE_ID,
  ROOT_CLASS_CINEMA,
  ROOT_CLASS_HIDE_ASIDE,
  ROOT_CLASS_PAGE,
  TOAST_DURATION,
} from './constants'
import {
  clearLiveStage,
  findDanmakuToggle,
  findFullscreenButton,
  findPlayer,
  isDanmakuEnabled,
  isLivePage,
  markLiveStage,
  notifyPlayerResize,
} from './dom'
import { getMessages } from './i18n'
import {
  readStoredCinema,
  readStoredHideAside,
  readStoredPanelOpen,
  storeCinema,
  storeHideAside,
  storePanelOpen,
} from './preferences'
import { ui } from './state'

let toastTimer: number | null = null
let pageCss = ''
/** 播放器是否至少出现过一次：用于区分「首屏还没渲染」与「真的没有播放器」 */
let playerSeenOnce = false
function t() {
  return getMessages()
}

// #region 页面级样式注入
/** 直播页没有 adaptedStyles 分支，页面级样式由模块自己注入一份（幂等） */
export function injectPageStyles(css: string): void {
  pageCss = css
  if (document.getElementById(PAGE_STYLE_ID))
    return
  const styleEl = injectCSS(pageCss)
  styleEl.id = PAGE_STYLE_ID
  document.documentElement.classList.add(ROOT_CLASS_PAGE)
}

function removePageStyles(): void {
  document.getElementById(PAGE_STYLE_ID)?.remove()
  document.documentElement.classList.remove(ROOT_CLASS_PAGE)
}
// #endregion

// #region 提示
export function showToast(text: string): void {
  if (!text)
    return
  ui.toast = text
  if (toastTimer !== null)
    window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastTimer = null
    ui.toast = ''
  }, TOAST_DURATION)
}
// #endregion

// #region 偏好恢复
export function restorePreferences(): void {
  ui.cinema = readStoredCinema()
  ui.hideAside = readStoredHideAside()
  ui.panelOpen = readStoredPanelOpen()
  applyRootClasses()
}

function applyRootClasses(): void {
  const html = document.documentElement
  html.classList.toggle(ROOT_CLASS_CINEMA, ui.cinema)
  html.classList.toggle(ROOT_CLASS_HIDE_ASIDE, ui.hideAside)
}
// #endregion

// #region 影院模式
export function setCinema(on: boolean, options: { silent?: boolean } = {}): void {
  if (on && !ui.playerReady) {
    if (!options.silent)
      showToast(t().cinemaUnavailable)
    return
  }
  if (ui.cinema === on)
    return

  ui.cinema = on
  document.documentElement.classList.toggle(ROOT_CLASS_CINEMA, on)
  storeCinema(on)
  notifyPlayerResize()

  if (!options.silent) {
    showToast(on
      ? t().cinemaOn
      : t().cinemaOff)
  }
}

export function toggleCinema(): void {
  setCinema(!ui.cinema)
}
// #endregion

// #region 隐藏侧栏
export function setHideAside(on: boolean, options: { silent?: boolean } = {}): void {
  if (on && !ui.asideAvailable) {
    if (!options.silent)
      showToast(t().asideUnavailable)
    return
  }
  if (ui.hideAside === on)
    return

  ui.hideAside = on
  document.documentElement.classList.toggle(ROOT_CLASS_HIDE_ASIDE, on)
  storeHideAside(on)
  notifyPlayerResize()

  if (!options.silent) {
    showToast(on
      ? t().asideOn
      : t().asideOff)
  }
}

export function toggleHideAside(): void {
  setHideAside(!ui.hideAside)
}
// #endregion

// #region 弹幕 / 全屏
/** 弹幕开关交给原生控件，保证播放器自己的状态机与 UI 同步 */
export function toggleDanmaku(): void {
  const toggle = findDanmakuToggle()
  if (!toggle) {
    showToast(t().danmakuUnavailable)
    return
  }

  toggle.click()
  // 原生控件会异步回写状态：先给乐观值，下一拍再从 DOM 读回
  ui.danmakuOn = !ui.danmakuOn
  showToast(ui.danmakuOn
    ? t().danmakuOn
    : t().danmakuOff)
  window.setTimeout(() => {
    if (isLivePage())
      ui.danmakuOn = isDanmakuEnabled()
  }, 150)
}

export async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }

    // 优先点原生全屏按钮，保留 B 站自己的网页全屏逻辑
    const nativeButton = findFullscreenButton()
    if (nativeButton) {
      nativeButton.click()
      return
    }

    const player = findPlayer()
    if (!player) {
      showToast(t().fullscreenUnavailable)
      return
    }
    await player.requestFullscreen()
  }
  catch {
    showToast(t().fullscreenFailed)
  }
}
// #endregion

// #region 面板 / 同步
export function togglePanel(open?: boolean): void {
  const next = open ?? !ui.panelOpen
  if (ui.panelOpen === next)
    return
  ui.panelOpen = next
  storePanelOpen(next)
}

/** 重新识别播放器 / 侧栏 / 控件，并同步面板可用性与状态（首屏、切房间、DOM 变化时调用） */
export function syncPage(): void {
  const { player, aside } = markLiveStage()
  if (player)
    playerSeenOnce = true

  const hadPlayer = ui.playerReady
  ui.playerReady = Boolean(player)
  ui.asideAvailable = Boolean(aside)
  ui.danmakuAvailable = findDanmakuToggle() !== null
  ui.danmakuOn = isDanmakuEnabled()
  ui.fullscreenAvailable = findFullscreenButton() !== null || Boolean(player)

  // 切房间 / 页面重渲染后播放器可能整段替换：影院模式自动退出，避免留下半透明遮罩
  if (!player && ui.cinema && (playerSeenOnce || hadPlayer))
    setCinema(false, { silent: true })
}

/** 监听页面变化（切房间 / 聊天室重渲染），去抖后重新同步；返回解绑函数 */
export function watchLivePage(): () => void {
  let timer: number | null = null
  const schedule = () => {
    if (timer !== null)
      return
    timer = window.setTimeout(() => {
      timer = null
      if (!document.hidden)
        syncPage()
    }, 300)
  }
  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('popstate', schedule)
  window.addEventListener('hashchange', schedule)
  return () => {
    observer.disconnect()
    window.removeEventListener('popstate', schedule)
    window.removeEventListener('hashchange', schedule)
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
  }
}

/** 卸载时把挂在原生 DOM 上的痕迹全部撤掉，直播页恢复原样 */
export function cleanupDom(): void {
  if (toastTimer !== null) {
    window.clearTimeout(toastTimer)
    toastTimer = null
  }
  clearLiveStage()
  removePageStyles()
  const html = document.documentElement
  html.classList.remove(ROOT_CLASS_CINEMA, ROOT_CLASS_HIDE_ASIDE)
  playerSeenOnce = false
  ui.toast = ''
}
// #endregion
