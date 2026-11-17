/**
 * 分区页（自绘）的「自挂载覆盖层」入口（与 `views/Popular`、`views/SearchPage` 同一类最小侵入接线）。
 *
 * 为什么不用 App.vue 的 pages / dock 体系：App.vue 的页面渲染只对首页生效（`showBewlyPage` 要求
 * `isHomePage()`），要支持原生 URL 需要改 dock / AppPage / 路由判定，风险高于收益。
 * 本模块只需要「在原生分区页上盖一层自绘页面」，挂载 / 卸载完全自包含。
 *
 * ## 挂载顺序（每一道都可能决定「不接管」，从而保证失败一定回退原生）
 *
 * 1. 路由不是 /c/<slug>（/v/<slug>）/ 不在 iframe / 已挂载 → 直接返回；
 * 2. 等原生分区骨架（`.feedchannel` 等）出现，等不到 → 不接管；
 *    （骨架没出现就藏 `#app`，社死现场是白屏，而错误页 / 加载中的页面都是没有骨架的）
 * 3. 解析 `from_region`（页面自身请求 → 静态兜底表），解析不到 → 不接管；
 * 4. **先预取第一页**，接口失败 → 不接管（此时原生页面还完整可见，用户看到的就是原生页）；
 * 5. 只有 1–4 全过才 hide 原生 DOM + 挂覆盖层。
 *
 * ## DOM 与样式都放在页面 light DOM
 *
 * content script 的 `dist/contentScripts/esm/style.css`（UnoCSS / 设计令牌 / 组件样式）由 manifest
 * 注入到页面，light DOM 里全部可用；shadow root 反而拿不到这些全局样式。
 * 覆盖层结构：
 *
 *   #bewly-channel-drawn-root.bewly-channel-overlay   fixed 全屏、透明、不接事件、z-index 90
 *     └ .bewly-channel-shell                         顶栏下方开始、自己滚动的容器（接事件）
 *         └ .bewly-channel-shell__inner              页宽约束（与 App.vue 的页面容器一致）
 *             └ <ChannelPage />                      Vue 应用挂在这里
 */
import type { App } from 'vue'
import type { ChannelNavItem } from './constants'
import type { RegionArchive } from './types'
import type { BewlyAppProvider } from '~/composables/useAppProvider'
import { createApp, nextTick, ref } from 'vue'
import { AppPage } from '~/enums/appEnums'
import { setupApp } from '~/logic/common-setup'
import { injectCSS, scrollToTop } from '~/utils/dom'
import { teardownChannelPage } from '../../channelPage'
import ChannelPage from './Channel.vue'
import {
  CHANNEL_DRAWN_ACTIVE_CLASS,
  CHANNEL_DRAWN_ROOT_ID,
  CHANNEL_NAV,
  FEED_FIRST_DISPLAY_ID,
} from './constants'
import {
  discoverFromRegion,
  discoverSubRegionTabs,
  getRegionSlug,
  hideNativePage,
  isChannelRegionPage,
  readNativeNav,
  readRegionName,
  restoreNativePage,
  waitForNativeRegionLayout,
} from './dom'
import { fetchRegionFeed } from './fetcher'
import channelCss from './styles/channel-drawn.scss?inline'

interface ChannelMount {
  app: App
  host: HTMLElement
  shell: HTMLElement
  styleEl: HTMLStyleElement
  observer: MutationObserver
}

let current: ChannelMount | null = null

/**
 * 给自绘页面提供最小的 `BEWLY_APP` 注入。
 *
 * `VideoCard` / `ALink` 需要这个 provider（滚动容器、回到顶部、触底回调、「抽屉打开」的兜底）。
 * 这里没有 App.vue 的 iframe 抽屉，所以 `openIframeDrawer` 退化为新标签页打开。
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

/** 读一级导航：原生优先，读不到退回常量表（常量表来自同一份真机 dump，39 → 36 项） */
function resolveNavItems(): ChannelNavItem[] {
  const native = readNativeNav()
  return native.length >= 10
    ? native
    : CHANNEL_NAV
}

/**
 * 自绘分区页。
 *
 * **返回值语义**：`true` = 已由自绘页接管（或早已接管）；`false` = 没有接管，原生页面保持原样。
 * Lead 接线时按它决定要不要再挂 `channelPage` 增强层：
 *
 *   if (!isPopularPage() && !(await setupChannelDrawnPage()))
 *     setupChannelPage()
 *
 * 这样密度 / 排序 / j-k 增强层与自绘页不会叠在一起抢键盘和原生卡。
 */
export async function setupChannelDrawnPage(): Promise<boolean> {
  if (current)
    return true
  if (!isChannelRegionPage())
    return false
  if (window.self !== window.top)
    return false
  if (!document.body) {
    await new Promise<void>((resolve) => {
      document.addEventListener('DOMContentLoaded', () => resolve(), { once: true })
    })
  }
  // 另一个实例 / 上一次未清理时直接认定「已接管」，避免重复挂载
  if (document.getElementById(CHANNEL_DRAWN_ROOT_ID))
    return true

  // 1) 等原生骨架：等不到就完全不接管（错误页 / 极慢网络都走这条）
  if (!await waitForNativeRegionLayout())
    return false

  const slug = getRegionSlug()
  if (!slug)
    return false

  // 2) from_region：页面自身请求优先（timeout 传 0 = 只看当下已有的资源记录，不阻塞接管）
  const fromRegion = await discoverFromRegion(slug, 0)
  if (fromRegion === null)
    return false

  // 3) 预取第一页：失败就不接管，原生页面此时还完整可见
  let initialArchives: RegionArchive[] = []
  try {
    const firstPage = await fetchRegionFeed(fromRegion, FEED_FIRST_DISPLAY_ID)
    initialArchives = firstPage.archives
  }
  catch (error) {
    console.warn('[bewly] channel drawn: first page failed, fallback to native', error)
    return false
  }

  // 4) 到这里才开始动原生 DOM。
  //    先把 channelPage 增强层收掉：它的 j/k 与密度切换按 `data-bewly-channel-card` 标记工作，
  //    原生卡被我们藏起来以后它仍会枚举到这些卡并把键盘抢走（按 j 会跳到看不见的卡）。
  //    首选方案是 Lead 接线时就不挂它（见 index.ts 头部的接线说明）；这里再兜一层，
  //    保证即使接线没改，两层浮层也不会叠在一起。teardownChannelPage() 本身幂等。
  if (document.getElementById('bewly-channel-enhance'))
    teardownChannelPage()

  const navItems = resolveNavItems()
  const regionName = readRegionName()
  const subTabs = discoverSubRegionTabs()

  hideNativePage()
  document.documentElement.classList.add(CHANNEL_DRAWN_ACTIVE_CLASS)
  // 诊断标记（调试 / e2e / Lead 验收都按它判断「谁接管了哪个分区」）：
  //   html[data-bewly-channel-drawn-slug] = douga
  //   html[data-bewly-channel-subtabs]    = 0（当前布局没有二级分区入口）
  document.documentElement.dataset.bewlyChannelDrawnSlug = slug
  document.documentElement.dataset.bewlyChannelSubtabs = String(subTabs.length)

  const styleEl = injectCSS(channelCss, document.head)

  const host = document.createElement('div')
  host.id = CHANNEL_DRAWN_ROOT_ID
  host.className = 'bewly-channel-overlay'

  // Bewly 顶栏（z-index 99）不能被盖住，页面内容从顶栏下方开始
  const hasBewlyTopBar = Boolean(document.getElementById('bewly'))
  host.style.setProperty(
    '--bew-channel-shell-top',
    hasBewlyTopBar ? 'var(--bew-top-bar-height, 64px)' : '0px',
  )

  const shell = document.createElement('div')
  shell.className = 'bewly-channel-shell'

  const inner = document.createElement('div')
  inner.className = 'bewly-channel-shell__inner'

  shell.appendChild(inner)
  host.appendChild(shell)
  document.body.appendChild(host)

  const app = createApp(ChannelPage, {
    slug,
    regionName,
    navItems,
    subTabs,
    fromRegion,
    initialArchives,
  })
  // 与主 App 共用同一套插件（pinia / i18n / toast / 全局组件），pinia 是 common-setup 里的单例
  void setupApp(app)
  app.provide('BEWLY_APP', createProvider(shell, host))
  app.mount(inner)

  // 站点可能重建 #app（路由切换后重新渲染），补一次隐藏
  const observer = new MutationObserver(() => hideNativePage())
  observer.observe(document.body, { childList: true, subtree: false })

  current = { app, host, shell, styleEl, observer }
  return true
}

/** 卸载自绘页并还原原生页面（幂等；未接管时是空操作） */
export function teardownChannelDrawnPage(): void {
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
  document.documentElement.classList.remove(CHANNEL_DRAWN_ACTIVE_CLASS)
  delete document.documentElement.dataset.bewlyChannelDrawnSlug
  delete document.documentElement.dataset.bewlyChannelSubtabs
}

/** 当前是否已接管（调试 / 诊断 / Lead 接线用） */
export function isChannelDrawnPageMounted(): boolean {
  return current !== null
}
