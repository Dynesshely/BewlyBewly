/**
 * 空间页（自绘）的「自挂载覆盖层」入口，与 views/Channel / views/Popular 同一模式。
 *
 * # 为什么不接 App.vue
 *
 * App.vue 的页面渲染只对首页生效（showBewlyPage 要求 isHomePage()），要支持空间页
 * 就得改 dock / AppPage / 路由判定，风险远高于收益。本模块只需要「在原生空间页上盖一层
 * 自绘页面」，挂载 / 卸载完全自包含，Lead 在 contentScripts/index.ts 里加两行即可。
 *
 * # 挂载顺序（每一道都可能决定「不接管」，从而保证失败一定回退原生）
 *
 * 1. 不是空间页 / 不是 /<mid> 主页 / 在 iframe 里 / 已挂载 → 直接返回；
 * 2. 没有 mid（/v/note-list 这类）→ 不接管；
 * 3. 先预取 UP 信息（/x/space/wbi/acc/info，走 wbi 签名），失败 → 不接管；
 * 4. 再预取第一页投稿（/x/space/wbi/arc/search），失败 → 不接管；
 *    （3、4 都发生在「动任何原生 DOM 之前」，所以失败时用户看到的就是完整可用的原生页）
 * 5. 粉丝 / 关注数是可选增强，失败只影响这两项的显示，不阻断接管；
 * 6. 全部通过才隐藏原生 DOM + 注入样式 + 挂覆盖层。
 *
 * # DOM 与样式都放在页面 light DOM
 *
 * content script 的 dist/contentScripts/esm/style.css（UnoCSS / 设计令牌 / 组件样式）
 * 由 manifest 注入到页面，light DOM 里全部可用；shadow root 反而拿不到这些全局样式。
 * 覆盖层结构：
 *
 *   #bewly-space-drawn-root.bewly-space-overlay   fixed 全屏、透明、不接事件、z-index 90
 *     └ .bewly-space-shell                        顶栏下方开始、自己滚动的容器（接事件）
 *         └ .bewly-space-shell__inner             页宽约束（与 App.vue 的页面容器一致）
 *             └ <SpacePage />                     Vue 应用挂在这里
 *
 * # SPA 路由
 *
 * 空间页是 SPA（/2 → /2/dynamic 是 pushState）。本模块只接管主页视频列表，
 * 监听到路由变化时：
 *   - 已接管但离开主页 → 拆掉覆盖层、还原原生 DOM（动态 / 投稿等子页保持原生可用）；
 *   - 再次回到主页且本模块曾接管过 → 重新走一遍「预取成功才接管」的流程。
 */
import type { App } from 'vue'
import type { ArcSearchItem, SpaceRelationStatResult, SpaceUpInfo } from './types'
import type { BewlyAppProvider } from '~/composables/useAppProvider'
import { createApp, nextTick, ref } from 'vue'
import { AppPage } from '~/enums/appEnums'
import { setupApp } from '~/logic/common-setup'
import { getUserID } from '~/utils/cookie'
import { injectCSS, scrollToTop } from '~/utils/dom'
import {
  DEFAULT_SPACE_SORT,
  NATIVE_PAGE_SELECTOR,
  SPACE_DRAWN_ACTIVE_CLASS,
  SPACE_DRAWN_HIDDEN_ATTR,
  SPACE_DRAWN_ROOT_ID,
} from './constants'
import { fetchSpaceRelationStat, fetchSpaceUpInfo, fetchSpaceVideos } from './fetcher'
import SpacePage from './SpacePage.vue'
import spaceCss from './styles/space-drawn.scss?inline'
import { isSpaceHomePath, parseSpaceMid } from './utils'

interface SpaceMount {
  app: App
  host: HTMLElement
  shell: HTMLElement
  styleEl: HTMLStyleElement
  observer: MutationObserver
  mid: number
}

let current: SpaceMount | null = null
/** 曾经成功接管过（用于「从子页返回主页时自动重新接管」） */
let everMounted = false
/** 路由同步去抖定时器 */
let routeTimer: number | null = null
/** 进行中的挂载流程（避免路由抖动时并发接管） */
let mounting: Promise<boolean> | null = null
/** 路由监听解绑函数 */
let stopRouteWatch: (() => void) | null = null

/** 隐藏原生空间页（幂等；只动本模块标记过的节点） */
function hideNativePage(): void {
  document.querySelectorAll<HTMLElement>(NATIVE_PAGE_SELECTOR).forEach((el) => {
    if (el.hasAttribute(SPACE_DRAWN_HIDDEN_ATTR))
      return
    el.setAttribute(SPACE_DRAWN_HIDDEN_ATTR, '')
    el.style.setProperty('display', 'none', 'important')
  })
}

/** 还原原生空间页（只还原本模块动过的节点） */
function restoreNativePage(): void {
  const selector = `[${SPACE_DRAWN_HIDDEN_ATTR}]`
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    el.removeAttribute(SPACE_DRAWN_HIDDEN_ATTR)
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

/** 预取结果：拿不到 mid / UP 信息 / 第一页就返回 null（= 不接管） */
interface PrefetchResult {
  mid: number
  upInfo: SpaceUpInfo
  videos: ArcSearchItem[]
  total: number
  relationStat: SpaceRelationStatResult
}

async function prefetch(mid: number): Promise<PrefetchResult | null> {
  let upInfo: SpaceUpInfo
  try {
    upInfo = await fetchSpaceUpInfo(mid)
  }
  catch (error) {
    console.warn('[bewly] space drawn: acc/info failed, fallback to native', error)
    return null
  }

  // 粉丝 / 关注数并行拉（可选增强，失败返回 null 不影响接管）
  const relationPromise = fetchSpaceRelationStat(mid)

  let videos: ArcSearchItem[] = []
  let total = 0
  try {
    const firstPage = await fetchSpaceVideos(mid, DEFAULT_SPACE_SORT, 1)
    videos = firstPage.items
    total = firstPage.total
  }
  catch (error) {
    console.warn('[bewly] space drawn: arc/search failed, fallback to native', error)
    return null
  }

  return {
    mid,
    upInfo,
    videos,
    total,
    relationStat: await relationPromise,
  }
}

/**
 * 挂载自绘空间页。
 *
 * 返回值语义：true = 已由自绘页接管（原生 DOM 已隐藏）；
 * false = 页面完全没被改动，原生空间页保持原样。
 */
export async function setupSpaceDrawnPage(): Promise<boolean> {
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

  const mid = parseSpaceMid()
  if (!mid || !isSpaceHomePath())
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
  if (document.getElementById(SPACE_DRAWN_ROOT_ID))
    return true

  // 未登录不接管：/x/space/wbi/acc/info 在未登录 + 高频请求下更容易被判风控，
  // 关注按钮也必然不可用；而原生空间页未登录时本身是完整可看的。
  // 这是「失败回退原生」里明确的第三类条件，宁可少接管也不要把页面换成半残的自绘页。
  if (!getUserID()) {
    console.warn('[bewly] space drawn: not signed in, fallback to native')
    return false
  }

  const data = await prefetch(mid)
  if (!data)
    return false

  // 预取期间用户可能已经导航走（SPA pushState）。此时 mid / 路由不再匹配就放弃接管，
  // 否则会把上一个 UP 的数据盖到新页面上。
  if (parseSpaceMid() !== mid || !isSpaceHomePath())
    return false

  // 到这里才开始动原生 DOM
  hideNativePage()
  document.documentElement.classList.add(SPACE_DRAWN_ACTIVE_CLASS)
  document.documentElement.dataset.bewlySpaceDrawnMid = String(mid)

  const styleEl = injectCSS(spaceCss, document.head)

  const host = document.createElement('div')
  host.id = SPACE_DRAWN_ROOT_ID
  host.className = 'bewly-space-overlay'

  // Bewly 顶栏（z-index 99）不能被盖住，页面内容从顶栏下方开始
  const hasBewlyTopBar = Boolean(document.getElementById('bewly'))
  host.style.setProperty(
    '--bew-space-shell-top',
    hasBewlyTopBar ? 'var(--bew-top-bar-height, 64px)' : '0px',
  )

  const shell = document.createElement('div')
  shell.className = 'bewly-space-shell'

  const inner = document.createElement('div')
  inner.className = 'bewly-space-shell__inner'

  shell.appendChild(inner)
  host.appendChild(shell)
  document.body.appendChild(host)

  const app = createApp(SpacePage, {
    mid: data.mid,
    upInfo: data.upInfo,
    initialVideos: data.videos,
    initialTotal: data.total,
    relationStat: data.relationStat,
  })
  // 与主 App 共用同一套插件（pinia / i18n / toast / 全局组件），pinia 是 common-setup 里的单例
  void setupApp(app)
  app.provide('BEWLY_APP', createProvider(shell, host))
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
    mid,
  }
  everMounted = true
  if (!stopRouteWatch)
    stopRouteWatch = watchSpaceRoute()
  return true
}

/** 卸载自绘页并还原原生页面（幂等；未接管时是空操作） */
export function teardownSpaceDrawnPage(): void {
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
  document.documentElement.classList.remove(SPACE_DRAWN_ACTIVE_CLASS)
  delete document.documentElement.dataset.bewlySpaceDrawnMid
}

/** 当前是否已挂载（调试 / e2e 用） */
export function isSpaceDrawnPageMounted(): boolean {
  return current !== null
}

/**
 * 路由变化后的重新判定（SPA pushState / 前进后退）。
 *
 * 只在「已接管」或「本模块曾接管过」时动作：未接管过的页面永远不主动接管，
 * 避免用户正在用原生页浏览时突然被盖住。
 */
function syncRoute(): void {
  routeTimer = null
  const mid = parseSpaceMid()
  const shouldOwn = Boolean(mid) && isSpaceHomePath()

  if (current && (!shouldOwn || current.mid !== mid)) {
    teardownSpaceDrawnPage()
    if (shouldOwn && everMounted)
      void setupSpaceDrawnPage()
    return
  }

  if (!current && shouldOwn && everMounted)
    void setupSpaceDrawnPage()
}

function scheduleRouteSync(): void {
  if (routeTimer !== null)
    window.clearTimeout(routeTimer)
  routeTimer = window.setTimeout(syncRoute, 400)
}

/** 开始监听路由（首次成功接管后自动调用一次；重复调用是幂等的） */
export function watchSpaceRoute(): () => void {
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
