/**
 * 消息中心（自绘）的「自挂载覆盖层」入口，与 views/Space（第 100 轮）/
 * views/Search（第 101 轮）同一模式。
 *
 * # 为什么不接 App.vue
 *
 * App.vue 的页面渲染只对首页生效（showBewlyPage 要求 isHomePage()），要支持消息中心
 * 就得改 dock / AppPage / 路由判定，风险远高于收益。本模块只需要「在原生消息中心上盖一层
 * 自绘页面」，挂载 / 卸载完全自包含，Lead 在 contentScripts/index.ts 里接线即可。
 *
 * # 挂载顺序（每一道都可能决定「不接管」，从而保证失败一定回退原生）
 *
 * 1. 在 iframe 里 / 不是 message.bilibili.com → 直接返回；
 * 2. 没有 body → 等 DOMContentLoaded；
 * 3. 已挂载（另一个扩展实例 / 上一次未清理）→ 认定已接管，不重复挂；
 * 4. 取登录态（`/x/web-interface/nav`）：未登录 → **不接管**
 *    （消息数据全部要登录态；原生页在未登录时会引导登录）；
 * 5. 预取当前 tab 的第一页（whisper 还会顺带预取会话列表）：
 *    - whisper：会话列表 + （有会话时）第一个会话的聊天记录；
 *    - reply / at / love / system：对应列表的第一页。
 *    **任何一步失败 → 不接管**；
 *    （4、5 都发生在「动任何原生 DOM 之前」，所以失败时用户看到的就是完整可用的原生页）
 * 6. 全部通过才隐藏原生 DOM + 注入样式 + 挂覆盖层。
 *
 * # DOM 与样式都放在页面 light DOM
 *
 * content script 的 dist/contentScripts/esm/style.css（UnoCSS / 设计令牌 / 组件样式）
 * 由 manifest 注入到页面，light DOM 里全部可用；shadow root 反而拿不到这些全局样式。
 * 覆盖层结构：
 *
 *   #bewly-message-drawn-root.bewly-message-overlay  fixed 全屏、透明、不接事件、z-index 90
 *     └ .bewly-message-shell                        原生顶栏下方开始（接事件）
 *         └ .bewly-message-shell__inner             页宽约束
 *             └ <MessagePage />                     Vue 应用挂在这里
 */
import type { App } from 'vue'
import type { MessageTabId } from './constants'
import type { SelfInfo } from './fetcher'
import type { MessagePageBridge } from './types'
import type { BewlyAppProvider } from '~/composables/useAppProvider'
import { createApp, nextTick, ref } from 'vue'
import { AppPage } from '~/enums/appEnums'
import { setupApp } from '~/logic/common-setup'
import { injectCSS, scrollToTop } from '~/utils/dom'
import {
  MESSAGE_DRAWN_ACTIVE_CLASS,
  MESSAGE_DRAWN_HIDDEN_ATTR,
  MESSAGE_DRAWN_ROOT_ID,
  MESSAGE_PAGE_BRIDGE_KEY,
  NATIVE_HEADER_HEIGHT,
  NATIVE_PAGE_SELECTOR,
} from './constants'
import {
  fetchAts,
  fetchChatMessages,
  fetchLikes,
  fetchReplies,
  fetchSelfInfo,
  fetchSessions,
  fetchSystemNotices,
  fetchUserCards,
  setSelfMid,
} from './fetcher'
import MessagePage from './MessagePage.vue'
import messageCss from './styles/message-drawn.scss?inline'
import { absoluteImage, isMessageHost, parseMessageTab } from './utils'

interface MessageMount {
  app: App
  host: HTMLElement
  shell: HTMLElement
  styleEl: HTMLStyleElement
  observer: MutationObserver
  bridge: MessagePageBridge
}

let current: MessageMount | null = null
/** 曾经成功接管过（用于「SPA 路由回到消息页时自动重新接管」） */
let everMounted = false
/** 路由同步去抖定时器 */
let routeTimer: number | null = null
/** 进行中的挂载流程（避免路由抖动时并发接管） */
let mounting: Promise<boolean> | null = null
/** 路由监听解绑函数 */
let stopRouteWatch: (() => void) | null = null

/** 隐藏原生消息页（幂等；只动本模块标记过的节点） */
function hideNativePage(): void {
  document.querySelectorAll<HTMLElement>(NATIVE_PAGE_SELECTOR).forEach((el) => {
    if (el.hasAttribute(MESSAGE_DRAWN_HIDDEN_ATTR))
      return
    el.setAttribute(MESSAGE_DRAWN_HIDDEN_ATTR, '')
    el.style.setProperty('display', 'none', 'important')
  })
}

/** 还原原生消息页（只还原本模块动过的节点） */
function restoreNativePage(): void {
  const selector = `[${MESSAGE_DRAWN_HIDDEN_ATTR}]`
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    el.removeAttribute(MESSAGE_DRAWN_HIDDEN_ATTR)
    el.style.removeProperty('display')
  })
}

/**
 * 给自绘页面提供最小的 BEWLY_APP 注入。
 *
 * 消息中心不渲染 VideoCard，但 ErrorState / EmptyState / toast 仍可能用到；
 * 与 Space / Search 一致，滚动容器就是 shell 自己。
 */
function createProvider(shell: HTMLElement, host: HTMLElement): BewlyAppProvider {
  const scrollbarRef = ref<HTMLElement | null>(shell)
  return {
    activatedPage: ref(AppPage.Home),
    scrollbarRef,
    reachTop: ref(true),
    mainAppRef: ref(host),
    handleReachBottom: ref<(() => void) | undefined>(undefined),
    handlePageRefresh: ref<(() => void) | undefined>(undefined),
    handleBackToTop: (targetScrollTop = 0) => {
      const el = scrollbarRef.value
      if (el)
        scrollToTop(el, targetScrollTop)
    },
    haveScrollbar: async () => {
      await nextTick()
      const el = scrollbarRef.value
      return el
        ? el.scrollHeight > el.clientHeight + 4
        : false
    },
    openIframeDrawer: (url: string) => {
      if (url)
        window.open(url, '_blank')
    },
  }
}

/** 互动列表一页（回复 / @ / 赞 共用） */
interface FeedPrefetch {
  entries: Awaited<ReturnType<typeof fetchReplies>>['entries']
  hasMore: boolean
  cursor: { id?: number, time?: number } | null
}

/** 预取结果：拿不到当前 tab 的第一页就返回 null（= 不接管） */
interface PrefetchResult {
  tab: MessageTabId
  selfInfo: SelfInfo
  /** 当前 tab 是 reply / at / love 时的第一页（否则 null） */
  initialFeed: FeedPrefetch | null
  /** 当前 tab 是 system 时的第一页（否则 null） */
  initialNotices: Awaited<ReturnType<typeof fetchSystemNotices>> | null
  initialSessions: Awaited<ReturnType<typeof fetchSessions>>['sessions']
  initialSessionsHasMore: boolean
  initialSessionsCursor: number | null
  initialSelectedMid: string
  initialMessages: Awaited<ReturnType<typeof fetchChatMessages>>['messages']
  initialMessagesHasMore: boolean
  initialMessagesCursor: number | null
}

/**
 * 预取当前 tab 的第一页。
 *
 * whisper 需要会话列表（+ 第一个会话的聊天记录）；reply / at / love / system
 * 只拉当前 tab 的第一页，并把它交给页面当首屏 —— 既是「接口是否可用」的探测
 * （失败即不接管），也避免页面挂载后立刻重复请求同一页。
 */
async function prefetch(tab: MessageTabId, selfInfo: SelfInfo): Promise<PrefetchResult | null> {
  try {
    let initialFeed: FeedPrefetch | null = null
    let initialNotices: PrefetchResult['initialNotices'] = null

    if (tab === 'reply' || tab === 'at' || tab === 'love') {
      const fetcher = tab === 'reply'
        ? fetchReplies
        : tab === 'at'
          ? fetchAts
          : fetchLikes
      const result = await fetcher()
      initialFeed = {
        entries: result.entries,
        hasMore: result.hasMore,
        cursor: result.cursor,
      }
    }
    else if (tab === 'system') {
      initialNotices = await fetchSystemNotices()
    }

    let initialSessions: PrefetchResult['initialSessions'] = []
    let initialSessionsHasMore = false
    let initialSessionsCursor: number | null = null
    let initialSelectedMid = ''
    let initialMessages: PrefetchResult['initialMessages'] = []
    let initialMessagesHasMore = false
    let initialMessagesCursor: number | null = null

    if (tab === 'whisper') {
      const sessions = await fetchSessions()
      initialSessions = sessions.sessions
      initialSessionsHasMore = sessions.hasMore
      initialSessionsCursor = sessions.minTs

      // 会话列表对普通用户不返回昵称 / 头像，这里先补一批（失败不影响接管）
      const missing = initialSessions
        .filter(session => session.name.startsWith('用户 ') || !session.avatar)
        .map(session => session.mid)
      if (missing.length) {
        const cards = await fetchUserCards(missing)
        if (cards.size) {
          initialSessions = initialSessions.map((session) => {
            const card = cards.get(session.mid)
            return card
              ? {
                  ...session,
                  name: card.name || session.name,
                  avatar: absoluteImage(card.face) || session.avatar,
                }
              : session
          })
        }
      }

      // 自动选中第一个会话并预取它的聊天记录（与原生「默认打开最近会话」一致）
      const first = initialSessions[0]
      if (first) {
        initialSelectedMid = first.mid
        const chat = await fetchChatMessages(first.mid)
        initialMessages = chat.messages
        initialMessagesHasMore = chat.hasMore
        initialMessagesCursor = chat.minSeqno
      }
    }

    return {
      tab,
      selfInfo,
      initialFeed,
      initialNotices,
      initialSessions,
      initialSessionsHasMore,
      initialSessionsCursor,
      initialSelectedMid,
      initialMessages,
      initialMessagesHasMore,
      initialMessagesCursor,
    }
  }
  catch (error) {
    console.warn('[bewly] message drawn: prefetch failed, fallback to native', error)
    return null
  }
}

/**
 * 挂载自绘消息页。
 *
 * 返回值语义：true = 已由自绘页接管（原生 DOM 已隐藏）；
 * false = 页面完全没被改动，原生消息中心保持原样（`views/Message` 的混合方案继续生效）。
 */
export async function setupMessageDrawnPage(): Promise<boolean> {
  if (current)
    return true
  if (mounting)
    return mounting

  mounting = doSetup()
  try {
    return await mounting
  }
  finally {
    mounting = null
  }
}

async function doSetup(): Promise<boolean> {
  if (window.self !== window.top)
    return false
  if (!isMessageHost())
    return false

  if (!document.body) {
    await new Promise<void>((resolve) => {
      if (document.body)
        resolve()
      else
        document.addEventListener('DOMContentLoaded', () => resolve(), { once: true })
    })
  }

  // 另一个扩展实例 / 上一次未清理时直接认定「已接管」，避免重复挂载
  if (document.getElementById(MESSAGE_DRAWN_ROOT_ID))
    return true

  const tab = parseMessageTab()

  // 未登录不接管：消息数据全部要登录态，原生页在未登录时会引导登录
  const selfInfo = await fetchSelfInfo()
  if (!selfInfo) {
    console.warn('[bewly] message drawn: not signed in, fallback to native')
    return false
  }
  setSelfMid(selfInfo.mid)

  const data = await prefetch(tab, selfInfo)
  if (!data)
    return false

  // 预取期间用户可能已经切了 tab（hash 变了）→ 放弃接管，
  // 否则会把上一个 tab 的数据盖到新 tab 上
  if (parseMessageTab() !== tab)
    return false

  // 到这里才开始动原生 DOM
  hideNativePage()
  document.documentElement.classList.add(MESSAGE_DRAWN_ACTIVE_CLASS)

  const styleEl = injectCSS(messageCss, document.head)

  const host = document.createElement('div')
  host.id = MESSAGE_DRAWN_ROOT_ID
  host.className = 'bewly-message-overlay'

  // 原生顶栏（#message-pc-header）保留可用，覆盖层从它下方开始。
  // 真机实测高度 64px；取实时 rect 更稳（B 站可能改成 mini/固定式），拿不到时用常量。
  const headerEl = document.getElementById('message-pc-header')
  const headerHeight = Math.max(0, headerEl?.getBoundingClientRect().height || NATIVE_HEADER_HEIGHT)
  host.style.setProperty('--bew-message-shell-top', `${Math.round(headerHeight)}px`)

  const shell = document.createElement('div')
  shell.className = 'bewly-message-shell'

  const inner = document.createElement('div')
  inner.className = 'bewly-message-shell__inner'

  shell.appendChild(inner)
  host.appendChild(shell)
  document.body.appendChild(host)

  const app = createApp(MessagePage, {
    initialTab: data.tab,
    selfInfo: data.selfInfo,
    initialFeed: data.initialFeed,
    initialNotices: data.initialNotices,
    initialSessions: data.initialSessions,
    initialSessionsHasMore: data.initialSessionsHasMore,
    initialSessionsCursor: data.initialSessionsCursor,
    initialSelectedMid: data.initialSelectedMid,
    initialMessages: data.initialMessages,
    initialMessagesHasMore: data.initialMessagesHasMore,
    initialMessagesCursor: data.initialMessagesCursor,
  })
  // 与主 App 共用同一套插件（pinia / i18n / toast / 全局组件），pinia 是 common-setup 里的单例
  void setupApp(app)
  app.provide('BEWLY_APP', createProvider(shell, host))
  const bridge: MessagePageBridge = {}
  app.provide(MESSAGE_PAGE_BRIDGE_KEY, bridge)
  app.mount(inner)

  // 站点可能重建 #app（路由切换后重新渲染），补一次隐藏
  const observer = new MutationObserver(() => hideNativePage())
  observer.observe(document.body, { childList: true, subtree: false })

  current = {
    app,
    host,
    shell,
    styleEl,
    observer,
    bridge,
  }
  everMounted = true
  if (!stopRouteWatch)
    stopRouteWatch = watchMessageRoute()
  return true
}

/** 卸载自绘页并还原原生页面（幂等；未接管时是空操作） */
export function teardownMessageDrawnPage(): void {
  const mounted = current
  if (!mounted)
    return
  current = null

  mounted.observer.disconnect()
  try {
    mounted.app.unmount()
  }
  catch {
    // 组件已经卸载过时忽略
  }
  mounted.host.remove()
  mounted.styleEl.remove()
  restoreNativePage()
  document.documentElement.classList.remove(MESSAGE_DRAWN_ACTIVE_CLASS)
}

/** 当前是否已挂载（调试 / e2e 用） */
export function isMessageDrawnPageMounted(): boolean {
  return current !== null
}

/**
 * 路由变化后的重新判定（前进后退 / 别的脚本改 hash）。
 *
 * 三种情况：
 *   - 已接管 → 把新 tab 同步给 MessagePage（换 tab 不重挂载，避免整页重建）；
 *   - 已接管但离开了消息中心 → 拆掉覆盖层、还原原生 DOM；
 *   - 未接管但曾经接管过 → 重新走一遍「预取成功才接管」的流程。
 *     从没接管过的页面永远不主动接管，避免用户在用原生页时突然被盖住。
 */
function syncRoute(): void {
  routeTimer = null
  if (!isMessageHost()) {
    if (current)
      teardownMessageDrawnPage()
    return
  }

  if (current) {
    current.bridge.syncRoute?.(parseMessageTab())
    return
  }

  if (everMounted)
    void setupMessageDrawnPage()
}

function scheduleRouteSync(): void {
  if (routeTimer !== null)
    window.clearTimeout(routeTimer)
  routeTimer = window.setTimeout(syncRoute, 300)
}

/** 开始监听路由（首次成功接管后自动调用一次；重复调用是幂等的） */
export function watchMessageRoute(): () => void {
  if (stopRouteWatch)
    return stopRouteWatch
  window.addEventListener('popstate', scheduleRouteSync)
  window.addEventListener('hashchange', scheduleRouteSync)
  // src/inject/index.js 包装了 history.pushState / replaceState 并派发这个事件
  window.addEventListener('historyChange', scheduleRouteSync)
  stopRouteWatch = () => {
    window.removeEventListener('popstate', scheduleRouteSync)
    window.removeEventListener('hashchange', scheduleRouteSync)
    window.removeEventListener('historyChange', scheduleRouteSync)
    if (routeTimer !== null) {
      window.clearTimeout(routeTimer)
      routeTimer = null
    }
    stopRouteWatch = null
  }
  return stopRouteWatch
}
