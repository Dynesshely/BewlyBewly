/**
 * 用户空间（原生 `space.bilibili.com`）交互增强入口。
 *
 * 由 contentScripts/index.ts 调用 setupSpacePage() / teardownSpacePage()。
 * 用户空间是 B 站原生页面，Bewly 不能替换它的 DOM，只能在上面叠加一个独立
 * shadow root 的浮层（右下角按钮 + 面板），并通过给原生内容卡打标记 + 页面级
 * CSS 实现内容筛选、密度切换与 j/k 浏览。
 *
 * 非空间页是空操作；重复调用是幂等的（nativeOverlay 按 hostId 去重）。
 */
import { watch } from 'vue'

import { settings } from '~/logic'

import { hasNativeOverlay, mountNativeOverlay, unmountNativeOverlay } from '../nativeOverlay'
import {
  cleanupDom,
  restorePreferences,
  scanCards,
  syncDensityFromSettings,
  watchSpacePage,
} from './actions'
import SpaceEnhanceOverlay from './components/SpaceEnhanceOverlay.vue'
import { HOST_ID } from './constants'
import { isSpacePage } from './dom'
import { setupKeyboard } from './keyboard'
import shadowCss from './spacePage.shadow.scss?inline'
import { resetUiState } from './state'

/** 首屏内容异步渲染：挂载后再补一次扫描 */
const RESCAN_DELAY = 900

let disposeKeyboard: (() => void) | null = null
let stopWatching: (() => void) | null = null
let stopSettingsWatch: (() => void) | null = null
let rescanTimer: number | null = null

export function setupSpacePage(): void {
  // 幂等：重复调用直接返回
  if (disposeKeyboard)
    return
  // 非用户空间是空操作
  if (!isSpacePage())
    return
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => setupSpacePage(), { once: true })
    return
  }

  if (!hasNativeOverlay(HOST_ID)) {
    mountNativeOverlay({
      hostId: HOST_ID,
      component: SpaceEnhanceOverlay,
      css: shadowCss,
      hostAttributes: { 'data-bewly-space-overlay': '' },
    })
  }

  restorePreferences()
  scanCards()
  stopWatching = watchSpacePage()
  disposeKeyboard = setupKeyboard()

  // 设置页改动实时生效
  stopSettingsWatch = watch(
    () => settings.value.spaceDensity,
    () => syncDensityFromSettings(),
  )

  rescanTimer = window.setTimeout(() => {
    rescanTimer = null
    scanCards()
  }, RESCAN_DELAY)
}

export function teardownSpacePage(): void {
  if (rescanTimer !== null) {
    window.clearTimeout(rescanTimer)
    rescanTimer = null
  }
  if (stopSettingsWatch) {
    stopSettingsWatch()
    stopSettingsWatch = null
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
