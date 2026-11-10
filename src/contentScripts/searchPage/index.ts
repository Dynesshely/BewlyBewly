/**
 * 搜索结果页（原生 `search.bilibili.com`）交互增强入口。
 *
 * 由 contentScripts/index.ts 调用 setupSearchEnhance() / teardownSearchEnhance()。
 * 搜索结果页是 B 站原生页面，Bewly 不能替换它的 DOM，只能在上面叠加一个独立
 * shadow root 的浮层（右下角按钮 + 面板），并通过给原生结果卡打标记 + 页面级
 * CSS 实现 j/k 高亮、密度切换与快速筛选。
 */
import { hasNativeOverlay, mountNativeOverlay, unmountNativeOverlay } from '../nativeOverlay'
import { cleanupDom, restorePreferences, scanResultCards, watchResultCards } from './actions'
import SearchEnhanceOverlay from './components/SearchEnhanceOverlay.vue'
import { isSearchPage } from './dom'
import { setupKeyboard } from './keyboard'
import shadowCss from './searchEnhance.shadow.scss?inline'
import { resetUiState } from './state'

const HOST_ID = 'bewly-search-enhance'
/** 首屏结果是异步渲染的：挂载后再补一次扫描 */
const RESCAN_DELAY = 800

let disposeKeyboard: (() => void) | null = null
let stopWatching: (() => void) | null = null
let rescanTimer: number | null = null

export function setupSearchEnhance(): void {
  // 幂等：重复调用直接返回
  if (disposeKeyboard)
    return
  // 非搜索结果页是空操作
  if (!isSearchPage())
    return
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => setupSearchEnhance(), { once: true })
    return
  }

  if (!hasNativeOverlay(HOST_ID)) {
    mountNativeOverlay({
      hostId: HOST_ID,
      component: SearchEnhanceOverlay,
      css: shadowCss,
      hostAttributes: { 'data-bewly-search-enhance': '' },
    })
  }

  restorePreferences()
  scanResultCards()
  stopWatching = watchResultCards()
  disposeKeyboard = setupKeyboard()

  rescanTimer = window.setTimeout(() => {
    rescanTimer = null
    scanResultCards()
  }, RESCAN_DELAY)
}

export function teardownSearchEnhance(): void {
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
