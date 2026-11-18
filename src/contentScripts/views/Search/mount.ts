/**
 * 搜索结果页（自绘）的「自挂载覆盖层」入口，与 views/Space / views/Channel / views/Popular
 * 同一模式。
 *
 * # 为什么不接 App.vue
 *
 * App.vue 的页面渲染只对首页生效（showBewlyPage 要求 isHomePage()），要支持搜索页
 * 就得改 dock / AppPage / 路由判定，风险远高于收益。本模块只需要「在原生搜索页上盖一层
 * 自绘页面」，挂载 / 卸载完全自包含，Lead 在 contentScripts/index.ts 里加两行即可。
 *
 * # 挂载顺序（每一道都可能决定「不接管」，从而保证失败一定回退原生）
 *
 * 1. 在 iframe 里 / 不是 search.bilibili.com / 不是接管范围内的路径 → 直接返回；
 * 2. URL 里没有 keyword → 不接管（空关键词接口直接 -400，原生页此时也仍是可用的）；
 * 3. 先预取当前页（走 wbi 签名），失败 → 不接管；
 *    （3 发生在「动任何原生 DOM 之前」，所以失败时用户看到的就是完整可用的原生页）
 * 4. 预取期间路由可能已经变了（SPA / 用户按了后退）→ 重新核对，不匹配就不接管；
 * 5. 全部通过才隐藏原生 DOM + 注入样式 + 挂覆盖层。
 *
 * # DOM 与样式都放在页面 light DOM
 *
 * content script 的 dist/contentScripts/esm/style.css（UnoCSS / 设计令牌 / 组件样式）
 * 由 manifest 注入到页面，light DOM 里全部可用；shadow root 反而拿不到这些全局样式。
 * 覆盖层结构：
 *
 *   #bewly-search-drawn-root.bewly-search-overlay  fixed 全屏、透明、不接事件、z-index 90
 *     └ .bewly-search-shell                        顶栏下方开始、自己滚动的容器（接事件）
 *         └ .bewly-search-shell__inner             页宽约束
 *             └ <SearchPage />                     Vue 应用挂在这里
 */
import type { App } from 'vue'
import type { SearchFiltersState, SearchPageBridge, SearchVideoPage } from './types'
import type { BewlyAppProvider } from '~/composables/useAppProvider'
import { createApp, nextTick, ref } from 'vue'
import { AppPage } from '~/enums/appEnums'
import { setupApp } from '~/logic/common-setup'
import { injectCSS, scrollToTop } from '~/utils/dom'
import {
  NATIVE_PAGE_SELECTOR,
  SEARCH_DRAWN_ACTIVE_CLASS,
  SEARCH_DRAWN_HIDDEN_ATTR,
  SEARCH_DRAWN_ROOT_ID,
  SEARCH_PAGE_BRIDGE_KEY,
} from './constants'
import { fetchSearchVideos } from './fetcher'
import SearchPage from './SearchPage.vue'
import searchCss from './styles/search-drawn.scss?inline'
import {
  isOwnedSearchPath,
  isSearchPageHost,
  parseSearchFilters,
  parseSearchKeyword,
  parseSearchPage,
} from './utils'

interface SearchMount {
  app: App
  host: HTMLElement
  shell: HTMLElement
  styleEl: HTMLStyleElement
  observer: MutationObserver
  /** SearchPage 在 setup 里填好的调用通道（路由同步 / 刷新） */
  bridge: SearchPageBridge
}

let current: SearchMount | null = null
/** 曾经成功接管过（用于「SPA 路由回到搜索页时自动重新接管」） */
let everMounted = false
/** 路由同步去抖定时器 */
let routeTimer: number | null = null
/** 进行中的挂载流程（避免路由抖动时并发接管） */
let mounting: Promise<boolean> | null = null
/** 路由监听解绑函数 */
let stopRouteWatch: (() => void) | null = null

/** 隐藏原生搜索页（幂等；只动本模块标记过的节点） */
function hideNativePage(): void {
  document.querySelectorAll<HTMLElement>(NATIVE_PAGE_SELECTOR).forEach((el) => {
    if (el.hasAttribute(SEARCH_DRAWN_HIDDEN_ATTR))
      return
    el.setAttribute(SEARCH_DRAWN_HIDDEN_ATTR, '')
    el.style.setProperty('display', 'none', 'important')
  })
}

/** 还原原生搜索页（只还原本模块动过的节点） */
function restoreNativePage(): void {
  const selector = `[${SEARCH_DRAWN_HIDDEN_ATTR}]`
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    el.removeAttribute(SEARCH_DRAWN_HIDDEN_ATTR)
    el.style.removeProperty('display')
  })
}

/**
 * 给自绘页面提供最小的 BEWLY_APP 注入。
 *
 * VideoCard / ALink 需要这个 provider（滚动容器、回到顶部、触底回调、
 * 「抽屉打开」的兜底）。这里没有 App.vue 的 iframe 抽屉，所以 openIframeDrawer
 * 退化为新标签页打开 —— 与用户设置「新标签页打开」时的行为一致。
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

/** 预取结果：拿不到第一页就返回 null（= 不接管） */
interface PrefetchResult extends SearchVideoPage {
  keyword: string
  page: number
  filters: SearchFiltersState
}

async function prefetch(keyword: string, page: number, filters: SearchFiltersState): Promise<PrefetchResult | null> {
  try {
    const result = await fetchSearchVideos(keyword, page, filters)
    return { ...result, keyword, page, filters }
  }
  catch (error) {
    console.warn('[bewly] search drawn: search/type failed, fallback to native', error)
    return null
  }
}

/**
 * 挂载自绘搜索页。
 *
 * 返回值语义：true = 已由自绘页接管（原生 DOM 已隐藏）；
 * false = 页面完全没被改动，原生搜索页保持原样。
 */
export async function setupSearchDrawnPage(): Promise<boolean> {
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
  if (!isSearchPageHost())
    return false
  if (!isOwnedSearchPath())
    return false

  const keyword = parseSearchKeyword()
  // 没有关键词就没有可拉的结果（接口对空 keyword 返回 -400），交给原生页
  if (!keyword)
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
  if (document.getElementById(SEARCH_DRAWN_ROOT_ID))
    return true

  const page = parseSearchPage()
  const filters = parseSearchFilters()
  const data = await prefetch(keyword, page, filters)
  if (!data)
    return false

  // 预取期间用户可能已经导航走（SPA pushState / 后退）。此时关键词或路径不再匹配
  // 就放弃接管，否则会把上一个关键词的结果盖到新页面上。
  if (parseSearchKeyword() !== keyword || !isOwnedSearchPath())
    return false

  // 到这里才开始动原生 DOM
  hideNativePage()
  document.documentElement.classList.add(SEARCH_DRAWN_ACTIVE_CLASS)

  const styleEl = injectCSS(searchCss, document.head)

  const host = document.createElement('div')
  host.id = SEARCH_DRAWN_ROOT_ID
  host.className = 'bewly-search-overlay'

  // Bewly 顶栏（z-index 99）不能被盖住，页面内容从顶栏下方开始
  const hasBewlyTopBar = Boolean(document.getElementById('bewly'))
  host.style.setProperty(
    '--bew-search-shell-top',
    hasBewlyTopBar ? 'var(--bew-top-bar-height, 64px)' : '0px',
  )

  const shell = document.createElement('div')
  shell.className = 'bewly-search-shell'

  const inner = document.createElement('div')
  inner.className = 'bewly-search-shell__inner'

  shell.appendChild(inner)
  host.appendChild(shell)
  document.body.appendChild(host)

  const app = createApp(SearchPage, {
    initialKeyword: data.keyword,
    initialPage: data.page,
    initialFilters: data.filters,
    initialItems: data.items,
    initialTotal: data.total,
    initialNumPages: data.numPages,
  })
  // 与主 App 共用同一套插件（pinia / i18n / toast / 全局组件），pinia 是 common-setup 里的单例
  void setupApp(app)
  app.provide('BEWLY_APP', createProvider(shell, host))
  // 页面在 setup 里把自己的 syncRoute / reload 写进这个对象，挂载后的路由监听直接调它
  // （不依赖 app.mount() 的返回值：那是公共实例代理，能否读到 defineExpose 的方法属于实现细节）
  const bridge: SearchPageBridge = {}
  app.provide(SEARCH_PAGE_BRIDGE_KEY, bridge)
  app.mount(inner)

  // 站点可能重建 #app（原生页自己重渲染），补一次隐藏
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
    stopRouteWatch = watchSearchRoute()
  return true
}

/** 卸载自绘页并还原原生页面（幂等；未接管时是空操作） */
export function teardownSearchDrawnPage(): void {
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
  document.documentElement.classList.remove(SEARCH_DRAWN_ACTIVE_CLASS)
}

/** 当前是否已挂载（调试 / e2e 用） */
export function isSearchDrawnPageMounted(): boolean {
  return current !== null
}

/** 当前视图是否「应该由本模块接管」 */
function shouldOwnPage(): boolean {
  return isSearchPageHost() && isOwnedSearchPath() && Boolean(parseSearchKeyword())
}

/**
 * 路由变化后的重新判定（前进后退 / 别的脚本改 URL / SPA 切 tab）。
 *
 * 三种情况：
 *   - 已接管但新地址不该接管 → 拆掉覆盖层、还原原生 DOM；
 *   - 已接管且仍该接管 → 把 URL 状态同步给 SearchPage（换关键词 / 翻页都由它处理，
 *     不重挂载，避免整页重建）；
 *   - 未接管但该接管过（everMounted）→ 重新走一遍「预取成功才接管」的流程。
 *     从没接管过的页面永远不主动接管，避免用户在用原生页时突然被盖住。
 */
function syncRoute(): void {
  routeTimer = null
  const shouldOwn = shouldOwnPage()

  if (current) {
    if (!shouldOwn) {
      teardownSearchDrawnPage()
      return
    }
    current.bridge.syncRoute?.({
      keyword: parseSearchKeyword(),
      page: parseSearchPage(),
      filters: parseSearchFilters(),
    })
    return
  }

  if (shouldOwn && everMounted)
    void setupSearchDrawnPage()
}

function scheduleRouteSync(): void {
  if (routeTimer !== null)
    window.clearTimeout(routeTimer)
  routeTimer = window.setTimeout(syncRoute, 300)
}

/** 开始监听路由（首次成功接管后自动调用一次；重复调用是幂等的） */
export function watchSearchRoute(): () => void {
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
