/**
 * 分区 / 频道页（原生 `bilibili.com/v/*`、`bilibili.com/channel/*`）交互增强入口。
 *
 * 由 contentScripts/index.ts 调用 setupChannelPage() / teardownChannelPage()。
 * 分区页是 B 站原生页面，Bewly 不能替换它的 DOM，只能在上面叠加一个独立 shadow root
 * 的浮层（右下角按钮 + 面板），并通过给原生视频卡打标记 + 页面级 CSS 实现
 * 密度切换、排序快捷与 j/k 浏览。
 *
 * 非分区页是空操作；重复调用是幂等的（nativeOverlay 按 hostId 去重）。
 */
import { hasNativeOverlay, mountNativeOverlay, unmountNativeOverlay } from '../nativeOverlay'
import {
  cleanupDom,
  injectPageStyles,
  restorePreferences,
  scanCards,
  watchChannelPage,
} from './actions'
import shadowCss from './channelPage.shadow.scss?inline'
import ChannelEnhanceOverlay from './components/ChannelEnhanceOverlay.vue'
import { HOST_ID, ROOT_CLASS_PAGE } from './constants'
import { isChannelPage } from './dom'
import { setupKeyboard } from './keyboard'
import pageCss from './pageStyles.scss?inline'
import { resetUiState } from './state'

/** 首屏内容异步渲染：挂载后再补一次扫描 */
const RESCAN_DELAY = 900

let disposeKeyboard: (() => void) | null = null
let stopWatching: (() => void) | null = null
let rescanTimer: number | null = null

export function setupChannelPage(): void {
  // 幂等：重复调用直接返回
  if (disposeKeyboard)
    return
  // 非分区页是空操作
  if (!isChannelPage())
    return
  // 被嵌在 iframe（例如顶栏消息抽屉）里时不叠加
  if (window.self !== window.top)
    return
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => setupChannelPage(), { once: true })
    return
  }

  // 页面级样式的作用域标记 + 注入（/v/*、/channel/* 不在 adaptedStyles 的注入清单里）
  document.documentElement.classList.add(ROOT_CLASS_PAGE)
  injectPageStyles(pageCss)

  if (!hasNativeOverlay(HOST_ID)) {
    mountNativeOverlay({
      hostId: HOST_ID,
      component: ChannelEnhanceOverlay,
      css: shadowCss,
      hostAttributes: { 'data-bewly-channel-overlay': '' },
    })
  }

  restorePreferences()
  scanCards()
  stopWatching = watchChannelPage()
  disposeKeyboard = setupKeyboard()

  rescanTimer = window.setTimeout(() => {
    rescanTimer = null
    scanCards()
  }, RESCAN_DELAY)
}

export function teardownChannelPage(): void {
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
