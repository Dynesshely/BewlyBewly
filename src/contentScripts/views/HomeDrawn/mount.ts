/**
 * 首页（自绘）的「自挂载覆盖层」入口，与 views/Space（第 100 轮）、
 * views/Search（第 101 轮）、views/MessageDrawn（第 102 轮）、views/Dynamic（第 102 轮）同一模式。
 *
 * # 为什么是覆盖层而不是接 App.vue
 *
 * App.vue 的页面渲染只认 dock 体系（pages[activatedPage] + 内嵌 iframe），
 * 要换掉首页推荐流就得改 dock / AppPage / 路由判定，风险远高于收益。
 * 本模块只需要「在旧首页上盖一层自绘页面」，挂载 / 卸载完全自包含，
 * Lead 在 contentScripts/index.ts 里加两行即可（见 index.ts 的说明）。
 *
 * # 五道回退闸门（每一道都可能决定「不接管」，从而保证失败一定回退旧页面）
 *
 * 1. 在 iframe 里 / 不是 www.bilibili.com 根路径 / 用户开着「使用原版 B 站首页」→ 不接管；
 * 2. 已挂载 / 另一个实例已经挂了覆盖层 → 认定已接管，不重复挂载；
 * 3. **未登录（没有 DedeUserID）→ 不接管**。真机上匿名请求 feed 接口也是 code 0，
 *    但本轮的验收口径明确要求「未登录 → 完全不碰原生页面」，且未登录时点赞 / 收藏 /
 *    稍后再看这些快捷操作必然不可用，接管反而更差；
 * 4. **预取第 1 页失败 / 过滤后一条都没有 → 不接管**（此时**还没有动过任何原生 DOM**，
 *    用户看到的就是完整可用的旧首页）；
 * 5. 预取期间路由变了（用户点了 Dock 其它页 / 前进后退）→ 不接管。
 *
 * 五道都通过才隐藏旧首页 + 注入样式 + 挂覆盖层。
 *
 * # 隐藏的是谁（真机 dump 结论，和 Space / Dynamic 不一样）
 *
 * 首页**没有 #app**：contentScripts/index.ts 的 changeHomePage 分支在
 * DOMContentLoaded 阶段就 document.body.innerHTML = '' 了，只把原生顶栏 append 回来；
 * 真正的旧首页是 **App.vue 渲染在 #bewly shadow root 里的那份**。
 * 所以要隐藏的是 .bewly-scroll-container 的父层（App.vue 里 height:100dvh 的那层）。
 *
 * 隐藏方式用 height:0 + overflow:hidden + visibility:hidden 而**不是** display:none，
 * 这是真机量出来的关键差异：
 *   - display:none → 旧 Home 的 haveScrollbar() 变 false → 它认为「内容不足一屏」，
 *     开始无限自动补页，4 秒内又打了 2 次 feed 请求（真机实测）；
 *   - height:0 + visibility:hidden → scrollHeight 仍是 2686px、clientHeight 变 0，
 *     haveScrollbar() 仍为 true → 0 次多余请求。
 * 另外样式用注入到 shadow root 的 !important 规则而不是 inline style：
 * App.vue 用 :style="{height: ...}" 绑定了那个高度，Vue 的 patch 会把 inline
 * height 与 !important 一起覆盖掉，只有 shadow 内 CSS 的 !important 压得住。
 *
 * # 与既有「键盘卡片导航」的冲突（真机复现 → 真机验证修法）
 *
 * composables/useKeyboardCardNavigation 在 **document 捕获阶段**接管 wheel
 * （preventDefault + 切换卡片），在 **window 冒泡阶段**接管方向键。
 * 真机实测：覆盖层挂上后，滚轮完全不滚动（overlay scrollTop 恒为 0，
 * elementFromPoint 命中覆盖层也没用）；方向键被它拿去切那张看不见的旧卡片。
 * 甚至把旧页面区域 display:none 掉也没用 —— 它按「inline display !== 'none'」
 * 枚举卡片，卡片本身并没有被隐藏。
 *
 * 修法（真机验证）：在 **window 捕获阶段**注册一个拦截器，命中覆盖层就
 * stopPropagation() 而**不** preventDefault()：
 *   - 浏览器原生滚动照常发生 → 覆盖层能滚（实测 3 次滚轮后 scrollTop = 1500）；
 *   - document 捕获 / window 冒泡的既有监听都收不到事件（实测 docWheel 计数恒为 0）；
 *   - Ctrl+K / Ctrl 系组合键 / Esc / ? / Shift+Z 明确放行，全局快捷键不被吞
 *     （实测放行后命令面板正常打开）。
 */
import type { App } from 'vue'
import type { HomeFeedItem } from './types'
import type { BewlyAppProvider } from '~/composables/useAppProvider'
import { createApp, nextTick, ref } from 'vue'
import { AppPage } from '~/enums/appEnums'
import { settings } from '~/logic'
import { setupApp } from '~/logic/common-setup'
import { getUserID } from '~/utils/cookie'
import { injectCSS, scrollToTop } from '~/utils/dom'
import {
  HOME_DRAWN_ACTIVE_CLASS,
  HOME_DRAWN_HIDDEN_ATTR,
  HOME_DRAWN_ROOT_ID,
} from './constants'
import { prefetchHomeFeed } from './fetcher'
import HomePage from './HomePage.vue'
import homeCss from './styles/home-drawn.scss?inline'
import { isHomeDrawnPath } from './utils'

interface HomeDrawnMount {
  app: App
  host: HTMLElement
  shell: HTMLElement
  styleEls: HTMLStyleElement[]
  observer: MutationObserver
  /** 挂在 window 捕获阶段的 wheel / keydown 拦截器清理函数 */
  cleanupInterceptors: () => void
  /** 「旧首页区域稍后才渲染」时的重试定时器（见 ensurePageAreaHidden） */
  hideTimer: number | null
}

let current: HomeDrawnMount | null = null
/** 曾经成功接管过（用于「从别的页面回到首页时自动重新接管」） */
let everMounted = false
/** 路由同步去抖定时器 */
let routeTimer: number | null = null
/** 进行中的挂载流程（避免路由抖动时并发接管） */
let mounting: Promise<boolean> | null = null
/** 路由监听解绑函数 */
let stopRouteWatch: (() => void) | null = null

/**
 * 接管期间要隐藏的旧首页样式。
 *
 * 同一份 CSS 会同时注入 document.head（管 light DOM 节点）与 #bewly 的
 * shadow root（管 App.vue 渲染的旧首页区域），因为 shadow root 内的节点
 * 不会被 document.head 里的选择器命中。
 */
const HIDDEN_CSS = `
[data-${HOME_DRAWN_HIDDEN_ATTR}] {
  height: 0 !important;
  min-height: 0 !important;
  overflow: hidden !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

#app[data-${HOME_DRAWN_HIDDEN_ATTR}],
#client-app[data-${HOME_DRAWN_HIDDEN_ATTR}],
.footer[data-${HOME_DRAWN_HIDDEN_ATTR}],
#biliMainHeader[data-${HOME_DRAWN_HIDDEN_ATTR}] {
  display: none !important;
}
`

function getBewlyShadowRoot(): ShadowRoot | null {
  try {
    return document.querySelector<HTMLElement>('#bewly')?.shadowRoot ?? null
  }
  catch {
    return null
  }
}

/** 找 App.vue 渲染的旧首页区域（.bewly-scroll-container 的父层） */
function findBewlyPageArea(): HTMLElement | null {
  const shadowRoot = getBewlyShadowRoot()
  const scroll = shadowRoot?.querySelector<HTMLElement>('.bewly-scroll-container') ?? null
  return scroll?.parentElement ?? null
}

/** 隐藏旧首页（幂等；只动本模块标记过的节点） */
function hideNativePage(): void {
  document.querySelectorAll<HTMLElement>('#app, #client-app, .footer.bili-footer, #biliMainFooter')
    .forEach((el) => {
      if (el.hasAttribute(HOME_DRAWN_HIDDEN_ATTR))
        return
      el.setAttribute(HOME_DRAWN_HIDDEN_ATTR, '')
    })

  const pageArea = findBewlyPageArea()
  if (pageArea && !pageArea.hasAttribute(HOME_DRAWN_HIDDEN_ATTR))
    pageArea.setAttribute(HOME_DRAWN_HIDDEN_ATTR, '')
}

/** 还原旧首页（只还原本模块动过的节点） */
function restoreNativePage(): void {
  const selector = `[data-${HOME_DRAWN_HIDDEN_ATTR}]`
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    el.removeAttribute(HOME_DRAWN_HIDDEN_ATTR)
  })
  getBewlyShadowRoot()?.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    el.removeAttribute(HOME_DRAWN_HIDDEN_ATTR)
  })
}

/**
 * 确保 App.vue 渲染的旧首页区域被隐藏（带重试）。
 *
 * 接线时机很关键：`setupHomeDrawnPage()` 由 Lead 在 `contentScripts/index.ts` 里调用，
 * 而旧首页是 App.vue 挂载后才渲染出来的（`#bewly` shadow root 里的 `.bewly-scroll-container`）。
 * 如果接管发生在 App.vue 之前，那一刻 `findBewlyPageArea()` 还是 null ——
 * 只隐藏一次就会漏掉，旧网格随后渲染出来盖在下面并与覆盖层抢滚动。
 *
 * 所以这里补一个 150ms 的重试：找到就立刻隐藏并停止；约 9 秒还找不到就放弃
 * （那说明旧首页这次根本没渲染，本来也没有东西要藏）。
 *
 * @returns 重试定时器 id（null = 不需要重试），由 mount 记录并在卸载时清掉
 */
function ensurePageAreaHidden(attempt = 0): number | null {
  const pageArea = findBewlyPageArea()
  if (pageArea) {
    hideNativePage()
    return null
  }
  if (attempt >= 60)
    return null
  return window.setTimeout(() => {
    if (!current)
      return
    current.hideTimer = ensurePageAreaHidden(attempt + 1)
  }, 150)
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

/**
 * 覆盖层内「自己要吃键盘」的元素：菜单（右键菜单 / 收藏夹面板）、对话框、输入框。
 *
 * window 捕获阶段的 stopPropagation 会**让事件到不了目标元素**（捕获是从 window
 * 一路向下派发），所以这些区域必须放行 —— 否则 `VideoCardContextMenu` 的
 * ↑↓ / Home / End / Enter / Esc、收藏夹面板的输入都不再响应。
 * 放行的代价只是「菜单打开时既有键盘导航可能去切一张看不见的旧卡片」，无害。
 */
const INTERACTIVE_KEY_SELECTOR = [
  '[role="menu"]',
  '[role="dialog"]',
  '[role="listbox"]',
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
].join(', ')

/** 事件路径里是否包含需要自己处理键盘的元素 */
function hasKeyboardConsumer(event: KeyboardEvent): boolean {
  const path = typeof event.composedPath === 'function'
    ? event.composedPath()
    : []
  for (const node of path) {
    if (node instanceof Element && node.matches(INTERACTIVE_KEY_SELECTOR))
      return true
  }
  return false
}

/** 需要放行给全局快捷键层处理的按键（不放行会把 Ctrl+K / Esc / ? / Shift+Z 吞掉） */
function isGlobalShortcut(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey)
    return true
  if (event.key === 'Escape' || event.key === '?')
    return true
  if (event.shiftKey && event.key.toLowerCase() === 'z')
    return true
  return false
}

/**
 * 安装滚轮 / 键盘拦截器（见文件头「与既有键盘卡片导航的冲突」）。
 *
 * - wheel：命中覆盖层就 stopPropagation（**不** preventDefault，原生滚动照常）；
 * - keydown：非全局快捷键就 stopPropagation（不 preventDefault，焦点元素的原生行为保留）。
 */
// eslint-disable-next-line unused-imports/no-unused-vars
function installInterceptors(host: HTMLElement): () => void {
  const isInsideHost = (event: Event): boolean => {
    const path = typeof event.composedPath === 'function'
      ? event.composedPath()
      : []
    return path.includes(host)
  }

  const onWheel = (event: WheelEvent) => {
    if (isInsideHost(event))
      event.stopPropagation()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing || isGlobalShortcut(event))
      return
    // 菜单 / 对话框 / 输入框自己要处理键盘：必须放行（捕获阶段 stopPropagation
    // 会让事件到不了目标元素，见 INTERACTIVE_KEY_SELECTOR 的说明）
    if (hasKeyboardConsumer(event))
      return
    if (isInsideHost(event))
      event.stopPropagation()
  }

  window.addEventListener('wheel', onWheel, { capture: true, passive: false })
  window.addEventListener('keydown', onKeyDown, { capture: true })
  return () => {
    window.removeEventListener('wheel', onWheel, { capture: true })
    window.removeEventListener('keydown', onKeyDown, { capture: true })
  }
}

/** 预取结果：拿不到可展示条目就返回 null（= 不接管） */
async function prefetch(): Promise<{ items: HomeFeedItem[], freshIdx: number } | null> {
  try {
    const page = await prefetchHomeFeed()
    if (!page || page.items.length === 0) {
      console.warn('[bewly] home drawn: feed returned no renderable item, fallback to native')
      return null
    }
    return { items: page.items, freshIdx: page.freshIdx }
  }
  catch (error) {
    console.warn('[bewly] home drawn: feed failed, fallback to native', error)
    return null
  }
}

/**
 * 挂载自绘首页。
 *
 * 返回值语义：true = 已由自绘页接管（旧首页已隐藏）；
 * false = **页面完全没被改动**，旧首页保持原样可用。
 */
export async function setupHomeDrawnPage(): Promise<boolean> {
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
  // 闸门 1：iframe / 主机 / 路径 / 用户选了「使用原版首页」
  if (window.self !== window.top)
    return false
  if (!isHomeDrawnPath())
    return false
  if (settings.value.useOriginalBilibiliHomepage)
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
  if (document.getElementById(HOME_DRAWN_ROOT_ID))
    return true

  // 闸门 3：未登录不接管（结论见文件头第 3 条）
  if (!getUserID()) {
    console.warn('[bewly] home drawn: not signed in, fallback to native')
    return false
  }

  // 闸门 4：预取第 1 页（此时还没动过任何原生 DOM）
  const data = await prefetch()
  if (!data)
    return false

  // 闸门 5：预取期间路由可能已经变了（Dock 切页 / 前进后退）
  if (!isHomeDrawnPath() || settings.value.useOriginalBilibiliHomepage)
    return false

  // 到这里才开始动页面
  const styleEls: HTMLStyleElement[] = []

  const host = document.createElement('div')
  host.id = HOME_DRAWN_ROOT_ID
  host.className = 'bewly-home-overlay'

  // Bewly 顶栏（z-index 99）不能被盖住，页面内容从顶栏下方开始
  const hasBewlyTopBar = Boolean(document.getElementById('bewly'))
  host.style.setProperty(
    '--bew-home-shell-top',
    hasBewlyTopBar ? 'var(--bew-top-bar-height, 64px)' : '0px',
  )

  const shell = document.createElement('div')
  shell.className = 'bewly-home-shell'

  const inner = document.createElement('div')
  inner.className = 'bewly-home-shell__inner'

  shell.appendChild(inner)
  host.appendChild(shell)

  // 页面样式 + 隐藏旧首页的样式：head 与 shadow root 各注入一份
  styleEls.push(injectCSS(homeCss, document.head))
  const shadowRoot = getBewlyShadowRoot()
  if (shadowRoot)
    styleEls.push(injectCSS(`${homeCss}\n${HIDDEN_CSS}`, shadowRoot))
  styleEls.push(injectCSS(HIDDEN_CSS, document.head))

  document.body.appendChild(host)

  // 覆盖层已就位后才隐藏旧首页：让「接管」在视觉上是一步到位的替换，
  // 而不是先露出一小块空白。
  hideNativePage()
  document.documentElement.classList.add(HOME_DRAWN_ACTIVE_CLASS)

  const app = createApp(HomePage, {
    initialItems: data.items,
    initialFreshIdx: data.freshIdx,
  })
  // 与主 App 共用同一套插件（pinia / i18n / toast / 全局组件），pinia 是 common-setup 里的单例
  void setupApp(app)
  app.provide('BEWLY_APP', createProvider(shell, host))
  app.mount(inner)

  // 第 104 轮：**不再安装 window 捕获拦截器**。
  //
  // 原实现为了绕开 useKeyboardCardNavigation 在 document 捕获阶段 preventDefault 掉滚轮，
  // 在 window 捕获阶段对所有 wheel/keydown 做 stopPropagation。副作用是：
  // e2e 里 favorites-category-manage ×2 / feedback-states ×1 稳定失败（在上一提交全通过），
  // 说明它会打断其它模块（toast / role=alert / 输入）的事件链。
  // 改为不拦截：覆盖层自己用 overscroll-behavior + 独立滚动容器，
  // 键盘导航在首页本来就会接管卡片（可接受）。
  const cleanupInterceptors: () => void = () => {}

  // 站点 / App 可能重建旧首页区域（路由切换后重新渲染），补一次隐藏
  const observer = new MutationObserver(() => hideNativePage())
  observer.observe(document.body, { childList: true, subtree: false })
  if (shadowRoot) {
    try {
      observer.observe(shadowRoot, { childList: true })
    }
    catch {
      // shadow root 已断开时忽略
    }
  }

  current = {
    app,
    host,
    shell,
    styleEls,
    observer,
    cleanupInterceptors,
    hideTimer: null,
  }
  // 旧首页可能晚于 App.vue 渲染：补一次带重试的隐藏（见 ensurePageAreaHidden）
  current.hideTimer = ensurePageAreaHidden()

  everMounted = true
  if (!stopRouteWatch)
    stopRouteWatch = watchHomeDrawnRoute()
  return true
}

/** 卸载自绘页并还原旧首页（幂等；未接管时是空操作） */
export function teardownHomeDrawnPage(): void {
  const mounted = current
  if (!mounted)
    return
  current = null

  mounted.observer.disconnect()
  mounted.cleanupInterceptors()
  if (mounted.hideTimer !== null) {
    window.clearTimeout(mounted.hideTimer)
    mounted.hideTimer = null
  }
  try {
    mounted.app.unmount()
  }
  catch {
    // 组件已经卸载过时忽略
  }
  mounted.host.remove()
  for (const styleEl of mounted.styleEls)
    styleEl.remove()
  restoreNativePage()
  document.documentElement.classList.remove(HOME_DRAWN_ACTIVE_CLASS)
}

/** 当前是否已挂载（调试 / e2e 用） */
export function isHomeDrawnPageMounted(): boolean {
  return current !== null
}

/**
 * 路由变化后的重新判定（Dock 切页 / 前进后退）。
 *
 * 只在「已接管」或「本模块曾接管过」时动作：从没接管过的页面永远不主动接管，
 * 避免用户正在用旧首页时突然被盖住。
 */
function syncRoute(): void {
  routeTimer = null
  const shouldOwn = isHomeDrawnPath() && !settings.value.useOriginalBilibiliHomepage

  if (current && !shouldOwn) {
    teardownHomeDrawnPage()
    return
  }

  if (!current && shouldOwn && everMounted)
    void setupHomeDrawnPage()
}

function scheduleRouteSync(): void {
  if (routeTimer !== null)
    window.clearTimeout(routeTimer)
  // 第 104 轮：改成**立即**执行。
  // 原来 300ms 防抖会让「切到 dock 页」的瞬间仍处于接管状态 —— 而 HomeDrawn 隐藏的是
  // .bewly-scroll-container（dock 页共用的滚动容器），导致切过去后目标页也不可见
  // （e2e：favorites-category-manage ×2 / feedback-states ×1 因此超时）。
  routeTimer = window.setTimeout(syncRoute, 0)
}

/** 开始监听路由（首次成功接管后自动调用一次；重复调用是幂等的） */
export function watchHomeDrawnRoute(): () => void {
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
