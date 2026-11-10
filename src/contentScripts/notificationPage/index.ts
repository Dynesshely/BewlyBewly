/**
 * 消息页交互增强入口。
 *
 * 由 contentScripts/index.ts 调用 setupNotificationPage() / teardownNotificationPage()。
 * 消息页本身是 B 站原生页面（message.bilibili.com），我们只在它上面叠加一个
 * 独立 shadow root 的浮层：右下角浮动按钮 + 展开面板（未读筛选 / 分类跳转 /
 * 全部已读 / 列表密度）。
 *
 * 非消息页是空操作；重复调用是幂等的（nativeOverlay 按 hostId 去重）。
 */
import { watch } from 'vue'

import { settings } from '~/logic'

import { hasNativeOverlay, mountNativeOverlay, unmountNativeOverlay } from '../nativeOverlay'
import {
  applySettingsPreferences,
  resetPageState,
  restorePreferences,
  syncNotificationState,
} from './actions'
import NotificationOverlay from './components/NotificationOverlay.vue'
import { HOST_ID } from './constants'
import { getObserveRoot, isNativeNotificationPage } from './dom'
import shadowCss from './notificationPage.shadow.scss?inline'
import { setupShortcuts } from './shortcuts'
import { resetUiState } from './state'

/** DOM 变化合并窗口：消息列表频繁重排，逐条同步会很浪费 */
const SYNC_DEBOUNCE = 150
/** 兜底轮询：未读状态有时由前端状态管理更新，不一定会触发我们观察的 DOM 变化 */
const SYNC_INTERVAL = 1500
/** 打开某条消息后稍等一拍再同步（已读状态是异步回写的） */
const SYNC_AFTER_INTERACTION = 350

let disposeShortcuts: (() => void) | null = null
let stopSettingsWatch: (() => void) | null = null
let observer: MutationObserver | null = null
let intervalTimer: number | null = null
let debounceTimer: number | null = null
let interactionTimer: number | null = null

export function setupNotificationPage(): void {
  if (!isNativeNotificationPage())
    return
  if (hasNativeOverlay(HOST_ID))
    return
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => setupNotificationPage(), { once: true })
    return
  }
  mount()
}

export function teardownNotificationPage(): void {
  unmount()
}

function mount(): void {
  // 先恢复偏好（同时会做一次 DOM 同步），再挂 UI，避免面板先以默认状态闪一下
  restorePreferences()

  mountNativeOverlay({
    hostId: HOST_ID,
    component: NotificationOverlay,
    css: shadowCss,
    hostAttributes: { 'data-bewly-notif-overlay': '' },
  })

  disposeShortcuts = setupShortcuts()

  // 设置页改动实时生效（settings 通过 storage.local 跨上下文同步）
  stopSettingsWatch = watch(
    () => [settings.value.notificationOnlyUnread, settings.value.notificationDensity] as const,
    () => applySettingsPreferences(),
  )

  const observeRoot = getObserveRoot() ?? document.body
  observer = new MutationObserver(() => scheduleSync())
  observer.observe(observeRoot, { childList: true, subtree: true })

  // hash 路由切分类 / 打开详情后列表会整段替换
  window.addEventListener('hashchange', scheduleSync)
  // 点开一条消息后已读状态是异步回写的，延迟一拍再读
  document.addEventListener('click', handleInteraction, true)

  intervalTimer = window.setInterval(() => {
    if (document.hidden)
      return
    syncNotificationState()
  }, SYNC_INTERVAL)
}

function unmount(): void {
  if (observer) {
    observer.disconnect()
    observer = null
  }
  if (intervalTimer !== null) {
    window.clearInterval(intervalTimer)
    intervalTimer = null
  }
  if (debounceTimer !== null) {
    window.clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (interactionTimer !== null) {
    window.clearTimeout(interactionTimer)
    interactionTimer = null
  }
  if (stopSettingsWatch) {
    stopSettingsWatch()
    stopSettingsWatch = null
  }
  if (disposeShortcuts) {
    disposeShortcuts()
    disposeShortcuts = null
  }

  window.removeEventListener('hashchange', scheduleSync)
  document.removeEventListener('click', handleInteraction, true)

  unmountNativeOverlay(HOST_ID)
  resetPageState()
  resetUiState()
}

function scheduleSync(): void {
  if (debounceTimer !== null)
    return
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null
    if (!document.hidden)
      syncNotificationState()
  }, SYNC_DEBOUNCE)
}

function handleInteraction(): void {
  if (interactionTimer !== null)
    window.clearTimeout(interactionTimer)
  interactionTimer = window.setTimeout(() => {
    interactionTimer = null
    if (!document.hidden)
      syncNotificationState()
  }, SYNC_AFTER_INTERACTION)
}
