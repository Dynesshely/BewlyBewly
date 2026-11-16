/**
 * 消息中心页自绘入口（第 93 轮 E）。
 *
 * 思路：原生 `message.bilibili.com` 仍然是数据的唯一来源与全部行为的执行者，
 * 我们只做「换皮 + 自绘实体」：
 *   - 顶部：把原生左栏的分类改成顶部 tab pill（自绘）；
 *   - 左侧：自绘会话列表（头像 40 圆 / 昵称 / 单行摘要 / 时间 / 未读红点数字），
 *     数据来自原生会话项 + 会话列表接口补时间；
 *   - 右侧：保留原生消息区，用页面级 CSS 画成自己 / 对方两种气泡。
 *
 * 所有交互（切分类、开会话、消息设置）都转发给原生 DOM 点击，自绘层不发明新行为。
 * 原生结构不认识（B 站改版）时完全不接管：不加类、不插 DOM，页面保持原样。
 *
 * 接线：contentScripts/index.ts 调用 setupMessageDrawn() / teardownMessageDrawn()。
 */
import type { App } from 'vue'
import { createApp } from 'vue'

import { syncCategories, syncSessions } from './actions'
import MessageSessions from './components/MessageSessions.vue'
import MessageTabs from './components/MessageTabs.vue'
import {
  DRAWN_CLASS,
  getHeaderEl,
  getMainEl,
  getMessageRoute,
  getSessionListHostEl,
  isMessageCenterPage,
  isNativeLayoutReady,
} from './dom'
import { resetState, state } from './state'

const TABS_HOST_ID = 'bewly-message-tabs'
const SESSIONS_HOST_ID = 'bewly-message-sessions'

/** DOM 变化合并窗口 */
const SYNC_DEBOUNCE = 180
/** 兜底轮询：未读数与选中态由原生框架更新，不一定触发我们观察的节点变化 */
const SYNC_INTERVAL = 1500
/** 原生骨架最长等待时间，超时即认为结构不认识 → 完全回退 */
const READY_TIMEOUT = 8000
const READY_POLL = 200

let started = false
let startedAt = 0
let readyPoll: number | null = null

let tabsApp: App | null = null
let tabsHost: HTMLElement | null = null
let sessionsApp: App | null = null
let sessionsHost: HTMLElement | null = null

let observer: MutationObserver | null = null
let observerTarget: HTMLElement | null = null
let intervalTimer: number | null = null
let debounceTimer: number | null = null

export function setupMessageDrawn(): void {
  if (started)
    return
  if (!isMessageCenterPage())
    return
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => setupMessageDrawn(), { once: true })
    return
  }

  started = true
  startedAt = Date.now()

  if (isNativeLayoutReady()) {
    activate()
    return
  }

  // 消息页是异步渲染的：等骨架出现；等不到就当作不认识的结构，直接放弃
  readyPoll = window.setInterval(() => {
    if (!started) {
      clearReadyPoll()
      return
    }
    if (isNativeLayoutReady()) {
      clearReadyPoll()
      activate()
    }
    else if (Date.now() - startedAt > READY_TIMEOUT) {
      clearReadyPoll()
      teardownMessageDrawn()
    }
  }, READY_POLL)
}

export function teardownMessageDrawn(): void {
  if (!started)
    return
  started = false

  clearReadyPoll()
  if (debounceTimer !== null) {
    window.clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (intervalTimer !== null) {
    window.clearInterval(intervalTimer)
    intervalTimer = null
  }
  observer?.disconnect()
  observer = null
  observerTarget = null
  window.removeEventListener('hashchange', handleRouteChange)

  removeTabsHost()
  removeSessionsHost()

  document.documentElement.classList.remove(DRAWN_CLASS)
  resetState()
}

function activate(): void {
  try {
    document.documentElement.classList.add(DRAWN_CLASS)
    state.ready = true

    ensureTabsHost()
    sync()

    observerTarget = document.querySelector<HTMLElement>('.message-layout')
    observer = new MutationObserver(() => scheduleSync())
    observeTarget()

    window.addEventListener('hashchange', handleRouteChange)
    intervalTimer = window.setInterval(() => {
      if (document.hidden)
        return
      ensureObserver()
      sync()
    }, SYNC_INTERVAL)

    scheduleSync()
  }
  catch {
    // 自绘初始化失败 → 完全回退原生
    teardownMessageDrawn()
  }
}

function scheduleSync(): void {
  if (debounceTimer !== null)
    return
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null
    if (!document.hidden)
      sync()
  }, SYNC_DEBOUNCE)
}

function handleRouteChange(): void {
  // 切分类会重建 main 区域，等框架渲染完再同步
  window.setTimeout(() => {
    if (started)
      sync()
  }, 120)
}

function observeTarget(): void {
  if (!observer)
    return
  observer.disconnect()
  const target = observerTarget?.isConnected ? observerTarget : document.body
  observer.observe(target, { childList: true, subtree: true })
}

function ensureObserver(): void {
  if (!observer)
    return
  if (observerTarget?.isConnected)
    return
  observerTarget = document.querySelector<HTMLElement>('.message-layout')
  observeTarget()
}

function sync(): void {
  if (!started)
    return

  state.route = getMessageRoute()
  syncCategories()
  ensureTabsHost()

  if (state.route === 'whisper') {
    ensureSessionsHost()
    void syncSessions()
  }
  else {
    removeSessionsHost()
    if (state.sessions.length)
      state.sessions = []
  }
}

function ensureTabsHost(): void {
  const anchor = getHeaderEl() ?? getMainEl()
  if (!anchor)
    return

  if (!tabsHost) {
    tabsHost = document.createElement('div')
    tabsHost.id = TABS_HOST_ID
    tabsHost.className = 'bewly-msg-tabs-host'
    tabsApp = createApp(MessageTabs)
    tabsApp.mount(tabsHost)
  }

  if (tabsHost.parentElement !== anchor)
    anchor.prepend(tabsHost)
}

function removeTabsHost(): void {
  if (tabsApp) {
    try {
      tabsApp.unmount()
    }
    catch {
      // 已卸载时忽略
    }
    tabsApp = null
  }
  tabsHost?.remove()
  tabsHost = null
}

function ensureSessionsHost(): void {
  const content = getSessionListHostEl()
  if (!content)
    return

  if (!sessionsHost) {
    sessionsHost = document.createElement('div')
    sessionsHost.id = SESSIONS_HOST_ID
    sessionsHost.className = 'bewly-msg-sessions-host'
    sessionsApp = createApp(MessageSessions)
    sessionsApp.mount(sessionsHost)
  }

  if (sessionsHost.parentElement !== content)
    content.append(sessionsHost)
}

function removeSessionsHost(): void {
  if (sessionsApp) {
    try {
      sessionsApp.unmount()
    }
    catch {
      // 已卸载时忽略
    }
    sessionsApp = null
  }
  sessionsHost?.remove()
  sessionsHost = null
}

function clearReadyPoll(): void {
  if (readyPoll !== null) {
    window.clearInterval(readyPoll)
    readyPoll = null
  }
}

/** 兼容命名：也可以按页面名接线 */
export const setupMessagePage = setupMessageDrawn
export const teardownMessagePage = teardownMessageDrawn
