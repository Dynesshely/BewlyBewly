/**
 * 热门 / 排行榜页的「自挂载覆盖层」入口（与 `views/SearchPage` 同一类最小侵入接线）。
 *
 * 为什么不用 App.vue 的 pages / dock 体系：
 *   - App.vue 的页面渲染只对首页生效（`showBewlyPage` 要求 `isHomePage()`），
 *     要支持原生 URL 需要改 dock / AppPage / 路由判定，风险高于收益；
 *   - 本页只需要「在原生热门页上盖一层自绘页面」，挂载 / 卸载完全自包含，
 *     Lead 在 `contentScripts/index.ts` 里加两行调用即可。
 *
 * 挂载结构（DOM 与样式都在**页面 light DOM**，因为 content script 的 CSS
 * `dist/contentScripts/esm/style.css` 由 manifest 注入到页面，light DOM 里
 * UnoCSS / 设计令牌 / 组件样式全部可用；shadow root 反而拿不到这些全局样式）：
 *
 *   #bewly-popular-root.bewly-popular-overlay   fixed 全屏、透明、不接事件、z-index 90
 *     └ .bewly-popular-shell                    顶栏下方开始、自己滚动的容器（接事件）
 *         └ .bewly-popular-shell__inner         页宽约束（与 App.vue 的页面容器一致）
 *             └ <PopularPage />                 Vue 应用挂在这里
 *
 * 原生 DOM（CDP 真机 dump：`#app > .popular-container`、顶栏 `#biliMainHeader`、
 * 页脚 `.footer.bili-footer`）用 inline `display: none !important` + 标记属性隐藏，
 * 卸载时逐个还原；站点若重新渲染出新的 `#app`，MutationObserver 会补一次隐藏。
 */
import type { App } from 'vue'
import type { BewlyAppProvider } from '~/composables/useAppProvider'

import { createApp, nextTick, ref } from 'vue'

import { AppPage } from '~/enums/appEnums'
import { setupApp } from '~/logic/common-setup'
import { injectCSS, scrollToTop } from '~/utils/dom'

import { POPULAR_PAGE_ACTIVE_CLASS } from './constants'
import PopularPage from './Popular.vue'
import popularCss from './styles/popular.scss?inline'
import { isPopularPage } from './utils'

/** 覆盖层容器 id（e2e / 调试 / Lead 接线都可按它定位） */
export const POPULAR_ROOT_ID = 'bewly-popular-root'

/**
 * 原生热门页需要隐藏的 DOM（类名来自 CDP 真机 dump）。
 *
 * 除了页面容器与页脚，还顺带把结果卡本身置为 inline `display: none`：
 * Bewly 既有的键盘卡片导航用「inline display !== 'none'」判断卡片是否可见，
 * 只隐藏 `#app` 父节点的话它仍会枚举到这些卡并且拦下方向键 / Enter，
 * 按 Enter 甚至会打开一张用户根本看不见的视频。
 */
const NATIVE_PAGE_SELECTOR = [
  '#app',
  '#biliMainHeader',
  '.footer.bili-footer',
  '#app .bili-video-card',
  '#app .video-card',
  '#app .video-list-item',
  '#app .rank-item',
  '#app .b-user-video-card',
].join(', ')
/** 标记属性：只还原本模块隐藏过的节点，不动 B 站自己的 inline 样式 */
const NATIVE_HIDDEN_ATTR = 'data-bewly-popular-hidden'

interface PopularMount {
  app: App
  host: HTMLElement
  shell: HTMLElement
  styleEl: HTMLStyleElement
  observer: MutationObserver
}

let current: PopularMount | null = null

/** 隐藏原生页面 DOM（幂等） */
function hideNativePage(): void {
  document.querySelectorAll<HTMLElement>(NATIVE_PAGE_SELECTOR).forEach((el) => {
    if (el.hasAttribute(NATIVE_HIDDEN_ATTR))
      return
    el.setAttribute(NATIVE_HIDDEN_ATTR, '')
    el.style.setProperty('display', 'none', 'important')
  })
}

/** 还原原生页面 DOM（只动本模块标记过的节点） */
function restoreNativePage(): void {
  document.querySelectorAll<HTMLElement>(`[${NATIVE_HIDDEN_ATTR}]`).forEach((el) => {
    el.removeAttribute(NATIVE_HIDDEN_ATTR)
    el.style.removeProperty('display')
  })
}

/**
 * 给自绘页面提供最小的 `BEWLY_APP` 注入。
 *
 * 页面与 `VideoCard` / `ALink` 需要这个 provider（滚动容器、回到顶部、触底回调、
 * 「抽屉打开」的兜底）。这里没有 App.vue 的 iframe 抽屉，所以 `openIframeDrawer`
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
 * 挂载自绘热门 / 排行榜页。
 *
 * - 非 `/v/popular*` 页：空操作；
 * - 重复调用：幂等（已挂载直接返回）；
 * - DOM 未就绪：等 `DOMContentLoaded` 再挂一次。
 */
export function setupPopularPage(): void {
  if (current)
    return
  if (!isPopularPage())
    return
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => setupPopularPage(), { once: true })
    return
  }
  // 另一个扩展实例 / 上一次未清理时，避免重复挂载
  if (document.getElementById(POPULAR_ROOT_ID))
    return

  hideNativePage()
  document.documentElement.classList.add(POPULAR_PAGE_ACTIVE_CLASS)

  // 页面样式：popular.scss 以 ?inline 编译成字符串，挂在 <head> 上（类名带 .popular- / #bewly-popular-root
  // 前缀，不会污染原生页；卸载时随容器一起移除）。选 light DOM 而不是 shadow：
  // UnoCSS / 设计令牌 / VideoCard 的样式都来自 manifest 注入到页面的 style.css，只有 light DOM 能用到。
  const styleEl = injectCSS(popularCss, document.head)

  const host = document.createElement('div')
  host.id = POPULAR_ROOT_ID
  host.className = 'bewly-popular-overlay'

  // Bewly App 只在 supported pages 上注入：有 #bewly 时才有顶栏，需要让开它的高度；
  // 例如 /v/popular/rank/* 目前不在 supported pages 里，此时从视口顶部开始铺满。
  const hasBewlyTopBar = Boolean(document.getElementById('bewly'))
  host.style.setProperty(
    '--bew-popular-shell-top',
    hasBewlyTopBar ? 'var(--bew-top-bar-height, 64px)' : '0px',
  )

  const shell = document.createElement('div')
  shell.className = 'bewly-popular-shell'

  const inner = document.createElement('div')
  inner.className = 'bewly-popular-shell__inner'

  shell.appendChild(inner)
  host.appendChild(shell)
  document.body.appendChild(host)

  const app = createApp(PopularPage)
  // 与主 App 共用同一套插件（pinia / i18n / toast / 全局组件），pinia 是 common-setup 里的单例
  void setupApp(app)
  app.provide('BEWLY_APP', createProvider(shell, host))
  app.mount(inner)

  // 站点可能重建 #app（例如路由切换后重新渲染），补一次隐藏
  const observer = new MutationObserver(() => hideNativePage())
  observer.observe(document.body, { childList: true, subtree: false })

  current = { app, host, shell, styleEl, observer }
}

/** 卸载自绘页并还原原生页面（幂等；未挂载时是空操作） */
export function teardownPopularPage(): void {
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
  document.documentElement.classList.remove(POPULAR_PAGE_ACTIVE_CLASS)
}

/** 当前是否已挂载（调试 / e2e 用） */
export function isPopularPageMounted(): boolean {
  return current !== null
}
