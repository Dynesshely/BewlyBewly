/**
 * 动态页（自绘）的「自挂载覆盖层」入口，与 views/Space（第 100 轮）、
 * views/Search（第 101 轮）、views/Channel / views/Popular 同一模式。
 *
 * # 为什么是覆盖层而不是接 App.vue
 *
 * App.vue 的页面渲染只对首页生效（showBewlyPage 要求 isHomePage()），要支持动态页
 * 就得改 dock / AppPage / 路由判定，风险远高于收益。本模块只需要「在原生动态页上盖
 * 一层自绘页面」，挂载 / 卸载完全自包含，Lead 在 contentScripts/index.ts 里加两行即可。
 *
 * # 五道回退闸门（每一道都可能决定「不接管」，从而保证失败一定回退原生）
 *
 * 1. 在 iframe 里 / 不是 t.bilibili.com / 不是列表首页 → 不接管；
 * 2. 已挂载 / 另一个实例已经挂了覆盖层 → 认定已接管，不重复挂载；
 * 3. 未登录（没有 DedeUserID）→ 不接管：接口对匿名请求返回 `-101 账号未登录`
 *    （真机验证），自绘页必然是一个「加载失败」，而原生动态页在未登录时本身可用；
 * 4. 预取第 1 页失败 → 不接管（**此时还没有动过任何原生 DOM**，
 *    用户看到的就是完整可用的原生动态页）；
 * 5. 预取期间路由变了（SPA 前进后退 / 用户点了别的 tab）→ 不接管，
 *    否则会把上一个频道的数据盖到新页面上。
 *
 * 五道都通过才隐藏原生 `#app` + 注入样式 + 挂覆盖层。
 *
 * # 与 views/Moments/native 的关系（第 93 轮的 DOM 方案）
 *
 * 本模块**不修改** views/Moments/** 的任何代码。两者是互补关系：
 *   - 本模块成功接管 → 原生 `#app` 被隐藏，DOM 方案自然无卡可换（它遍历不到可见条目会
 *     自己移除 `bewly-moments-drawn` 类，等于空转）；
 *   - 本模块不接管（未登录 / 接口失败）→ 原生页面原样保留，DOM 方案继续按第 93 轮的方式工作。
 * 因此在 contentScripts/index.ts 里两者可以照旧各自挂载，**不需要二选一**。
 *
 * # DOM 与样式都放在页面 light DOM
 *
 * content script 的 style.css（UnoCSS / 设计令牌 / 组件样式）由 manifest 注入到页面，
 * light DOM 里全部可用；shadow root 反而拿不到这些全局样式。覆盖层结构：
 *
 *   #bewly-dynamic-drawn-root.bewly-dynamic-overlay  fixed 全屏、透明、不接事件、z-index 90
 *     └ .bewly-dynamic-shell                        顶栏下方开始、自己滚动的容器（接事件）
 *         └ .bewly-dynamic-shell__inner             页宽约束
 *             └ <DynamicPage />                     Vue 应用挂在这里
 */
import type { App } from 'vue'
import type { DynamicTabId } from './constants'
import type { DynamicItem, DynamicPageBridge } from './types'
import type { BewlyAppProvider } from '~/composables/useAppProvider'
import { createApp, nextTick, ref } from 'vue'
import { AppPage } from '~/enums/appEnums'
import { settings } from '~/logic'
import { setupApp } from '~/logic/common-setup'
import { getUserID } from '~/utils/cookie'
import { injectCSS, scrollToTop } from '~/utils/dom'
import { resolveModuleLocale } from '~/utils/moduleI18n'
import {
  DYNAMIC_DRAWN_ACTIVE_CLASS,
  DYNAMIC_DRAWN_HIDDEN_ATTR,
  DYNAMIC_DRAWN_ROOT_ID,
  DYNAMIC_PAGE_BRIDGE_KEY,
  NATIVE_PAGE_SELECTOR,
} from './constants'
import DynamicPage from './DynamicPage.vue'
import { DynamicEmptyChannelError, fetchDynamicFeed } from './fetcher'
import dynamicCss from './styles/dynamic-drawn.scss?inline'
import { isDynamicPageHost, isOwnedDynamicPath, parseDynamicTab, toDynamicItems } from './utils'

interface DynamicMount {
  app: App
  host: HTMLElement
  shell: HTMLElement
  styleEl: HTMLStyleElement
  observer: MutationObserver
  tab: DynamicTabId
  /** DynamicPage 在 setup 里填好的调用通道（路由同步用） */
  bridge: DynamicPageBridge
}

let current: DynamicMount | null = null
/** 曾经成功接管过（用于「SPA 路由回到动态页时自动重新接管」） */
let everMounted = false
/** 路由同步去抖定时器 */
let routeTimer: number | null = null
/** 进行中的挂载流程（避免路由抖动时并发接管） */
let mounting: Promise<boolean> | null = null
/** 路由监听解绑函数 */
let stopRouteWatch: (() => void) | null = null

/** 隐藏原生动态页（幂等；只动本模块标记过的节点） */
function hideNativePage(): void {
  document.querySelectorAll<HTMLElement>(NATIVE_PAGE_SELECTOR).forEach((el) => {
    if (el.hasAttribute(DYNAMIC_DRAWN_HIDDEN_ATTR))
      return
    el.setAttribute(DYNAMIC_DRAWN_HIDDEN_ATTR, '')
    el.style.setProperty('display', 'none', 'important')
  })
}

/** 还原原生动态页（只还原本模块动过的节点） */
function restoreNativePage(): void {
  const selector = `[${DYNAMIC_DRAWN_HIDDEN_ATTR}]`
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    el.removeAttribute(DYNAMIC_DRAWN_HIDDEN_ATTR)
    el.style.removeProperty('display')
  })
}

/**
 * 给自绘页面提供最小的 BEWLY_APP 注入。
 *
 * DynamicPage 只需要这个 provider 里的滚动容器与触底 / 刷新回调；
 * `openIframeDrawer` 这里没有 App.vue 的 iframe 抽屉，退化为新标签页打开
 * —— 与用户设置「新标签页打开」时的行为一致。
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

interface PrefetchResult {
  tab: DynamicTabId
  items: DynamicItem[]
  /**
   * 第 1 页返回的游标。
   *
   * **必须一起交给页面**：接口翻页要靠它（只传 page 会重复返回第一页，真机验证
   * 20/20 重叠），页面拿不到这个值的话第一次「加载更多」就会把第 1 页再拿一遍。
   */
  offset?: string
  /** 第 1 页的 has_more（页面据此决定是否还有下一页） */
  hasMore: boolean
}

/**
 * 预取第 1 页。
 *
 * 番剧频道真机恒返回 4101132（原生页面自己切过去也是 0 条）：这种情况下
 * **仍然接管**，只是把 items 给空数组 —— 因为它不是「接口坏了」，而是「这个频道没内容」，
 * 回退原生也只能看到空页面，反而会闪一下。
 */
async function prefetch(tab: DynamicTabId): Promise<PrefetchResult | null> {
  const locale = resolveModuleLocale(settings.value.language)
  try {
    const page = await fetchDynamicFeed(tab, 1)
    return {
      tab,
      items: toDynamicItems(page.items, locale),
      offset: page.offset,
      hasMore: page.hasMore,
    }
  }
  catch (error) {
    if (error instanceof DynamicEmptyChannelError)
      return { tab, items: [], hasMore: false }
    console.warn('[bewly] dynamic drawn: feed/all failed, fallback to native', error)
    return null
  }
}

/**
 * 挂载自绘动态页。
 *
 * 返回值语义：true = 已由自绘页接管（原生 `#app` 已隐藏）；
 * false = **页面完全没被改动**，原生动态页保持原样可用。
 */
export async function setupDynamicDrawnPage(): Promise<boolean> {
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
  // 闸门 1：iframe / 主机 / 路径
  if (window.self !== window.top)
    return false
  if (!isDynamicPageHost())
    return false
  if (!isOwnedDynamicPath())
    return false

  if (!document.body) {
    await new Promise<void>((resolve) => {
      if (document.body)
        resolve()
      else
        document.addEventListener('DOMContentLoaded', () => resolve(), { once: true })
    })
  }

  // 闸门 2：已经挂过（另一个扩展实例 / 上一次未清理）
  if (document.getElementById(DYNAMIC_DRAWN_ROOT_ID))
    return true

  // 闸门 3：未登录不接管。接口对匿名请求返回 -101（真机验证），
  // 而原生动态页未登录时可用（会显示登录引导 + 公开动态）。
  if (!getUserID()) {
    console.warn('[bewly] dynamic drawn: not signed in, fallback to native')
    return false
  }

  const tab = parseDynamicTab()

  // 闸门 4：预取第 1 页（此时还没动过任何原生 DOM）
  const data = await prefetch(tab)
  if (!data)
    return false

  // 闸门 5：预取期间路由可能已经变了
  if (!isOwnedDynamicPath() || parseDynamicTab() !== tab)
    return false

  // 到这里才开始动原生 DOM
  hideNativePage()
  document.documentElement.classList.add(DYNAMIC_DRAWN_ACTIVE_CLASS)

  const styleEl = injectCSS(dynamicCss, document.head)

  const host = document.createElement('div')
  host.id = DYNAMIC_DRAWN_ROOT_ID
  host.className = 'bewly-dynamic-overlay'

  // Bewly 顶栏（z-index 99）不能被盖住，页面内容从顶栏下方开始。
  // 动态页在 remove-top-bar 下顶栏是 visibility:hidden 但**仍占 64px**（真机量过），
  // 所以这里照样让出这段高度，与原生页的顶部留白一致。
  const hasBewlyTopBar = Boolean(document.getElementById('bewly'))
  host.style.setProperty(
    '--bew-dynamic-shell-top',
    hasBewlyTopBar ? 'var(--bew-top-bar-height, 64px)' : '0px',
  )

  const shell = document.createElement('div')
  shell.className = 'bewly-dynamic-shell'

  const inner = document.createElement('div')
  inner.className = 'bewly-dynamic-shell__inner'

  shell.appendChild(inner)
  host.appendChild(shell)
  document.body.appendChild(host)

  const app = createApp(DynamicPage, {
    initialItems: data.items,
    initialTab: data.tab,
    initialOffset: data.offset,
    initialHasMore: data.hasMore,
  })
  // 与主 App 共用同一套插件（pinia / i18n / toast / 全局组件），pinia 是 common-setup 里的单例
  void setupApp(app)
  app.provide('BEWLY_APP', createProvider(shell, host))
  // 页面在 setup 里把 selectTab / reload 写进这个对象，路由监听直接调它
  const bridge: DynamicPageBridge = {}
  app.provide(DYNAMIC_PAGE_BRIDGE_KEY, bridge)
  app.mount(inner)

  // 站点可能重建 #app（动态页是异步渲染的，重新挂载时会重建），补一次隐藏
  const observer = new MutationObserver(() => hideNativePage())
  observer.observe(document.body, { childList: true, subtree: false })

  current = {
    app,
    host,
    shell,
    styleEl,
    observer,
    tab,
    bridge,
  }
  everMounted = true
  if (!stopRouteWatch)
    stopRouteWatch = watchDynamicRoute()
  return true
}

/** 卸载自绘页并还原原生页面（幂等；未接管时是空操作） */
export function teardownDynamicDrawnPage(): void {
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
  document.documentElement.classList.remove(DYNAMIC_DRAWN_ACTIVE_CLASS)
}

/** 当前是否已挂载（调试 / e2e 用） */
export function isDynamicDrawnPageMounted(): boolean {
  return current !== null
}

/**
 * 路由变化后的重新判定（SPA pushState / 前进后退 / 切 tab）。
 *
 * 只在「已接管」或「本模块曾接管过」时动作：从没接管过的页面永远不主动接管，
 * 避免用户正在用原生动态页时突然被盖住。
 */
function syncRoute(): void {
  routeTimer = null
  const shouldOwn = isDynamicPageHost() && isOwnedDynamicPath()

  if (current) {
    if (!shouldOwn) {
      teardownDynamicDrawnPage()
      return
    }
    // 地址栏切了 tab（用户按后退，或原生 tab 被点）：把新 tab 推给页面，
    // 页面自己去拉第 1 页，不重挂载（避免整页重建 + 覆盖层闪烁）。
    const tab = parseDynamicTab()
    if (tab !== current.tab) {
      current.tab = tab
      current.bridge.selectTab?.(tab)
    }
    return
  }

  if (shouldOwn && everMounted)
    void setupDynamicDrawnPage()
}

function scheduleRouteSync(): void {
  if (routeTimer !== null)
    window.clearTimeout(routeTimer)
  routeTimer = window.setTimeout(syncRoute, 300)
}

/** 开始监听路由（首次成功接管后自动调用一次；重复调用是幂等的） */
export function watchDynamicRoute(): () => void {
  if (stopRouteWatch)
    return stopRouteWatch
  window.addEventListener('popstate', scheduleRouteSync)
  // src/inject/index.js 包装了 history.pushState / replaceState 并派发这个事件
  window.addEventListener('historyChange', scheduleRouteSync)
  stopRouteWatch = () => {
    window.removeEventListener('popstate', scheduleRouteSync)
    window.removeEventListener('historyChange', scheduleRouteSync)
    if (routeTimer !== null) {
      window.clearTimeout(routeTimer)
      routeTimer = null
    }
    stopRouteWatch = null
  }
  return stopRouteWatch
}
