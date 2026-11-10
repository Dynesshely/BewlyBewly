/**
 * 直播页（live.bilibili.com）增强层入口。
 *
 * 由 contentScripts/index.ts 调用 setupLivePage() / teardownLivePage()（Lead 已接线）。
 * 直播页是 B 站原生页面，Bewly 不能替换它的 DOM，只能在上面叠加一个独立 shadow root
 * 的浮层（右下角按钮 + 面板），并通过给原生播放器 / 侧栏打标记 + 页面级 CSS 实现
 * 影院模式、隐藏侧栏、弹幕开关与全屏。
 *
 * 非直播页是空操作；重复调用是幂等的（nativeOverlay 按 hostId 去重）。
 */
import { hasNativeOverlay, mountNativeOverlay, unmountNativeOverlay } from '../nativeOverlay'
import {
  cleanupDom,
  injectPageStyles,
  restorePreferences,
  syncPage,
  watchLivePage,
} from './actions'
import LivePageOverlay from './components/LivePageOverlay.vue'
import { HOST_ID } from './constants'
import { isLivePage } from './dom'
import { setupKeyboard } from './keyboard'
import pageCss from './livePage.page.scss?inline'
import shadowCss from './livePage.shadow.scss?inline'
import { resetUiState } from './state'

/** 首屏播放器是异步渲染的：挂载后再补一次同步 */
const RESCAN_DELAY = 900

let disposeKeyboard: (() => void) | null = null
let stopWatching: (() => void) | null = null
let rescanTimer: number | null = null

export function setupLivePage(): void {
  // 幂等：重复调用直接返回
  if (disposeKeyboard)
    return
  // 非直播页是空操作
  if (!isLivePage())
    return
  // 被嵌在 iframe（例如顶栏消息抽屉）里时不叠加
  if (window.self !== window.top)
    return
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => setupLivePage(), { once: true })
    return
  }

  // 直播页没有 adaptedStyles 分支，页面级样式由模块自己注入
  injectPageStyles(pageCss)

  if (!hasNativeOverlay(HOST_ID)) {
    mountNativeOverlay({
      hostId: HOST_ID,
      component: LivePageOverlay,
      css: shadowCss,
      hostAttributes: { 'data-bewly-live-overlay': '' },
    })
  }

  restorePreferences()
  syncPage()
  stopWatching = watchLivePage()
  disposeKeyboard = setupKeyboard()

  rescanTimer = window.setTimeout(() => {
    rescanTimer = null
    syncPage()
  }, RESCAN_DELAY)
}

export function teardownLivePage(): void {
  if (rescanTimer !== null) {
    window.clearTimeout(rescanTimer)
    rescanTimer = null
  }
  if (stopWatching) {
    stopWatching()
    stopWatching = null
  }
  if (disposeKeyboard) {
    disposeKeyboard()
    disposeKeyboard = null
  }

  unmountNativeOverlay(HOST_ID)
  cleanupDom()
  resetUiState()
}
