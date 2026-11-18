/**
 * 首页推荐流（自绘）的对外入口。
 *
 * **自挂载覆盖层**：不经过 App.vue / dock 体系。Lead 在 contentScripts/index.ts 里接线：
 *
 *   void setupHomeDrawnPage()
 *
 * 语义：返回 true = 自绘页已接管（旧首页已隐藏）；
 * 返回 false = **页面完全没被改动**，旧首页（views/Home）保持原样可用。
 *
 * 与 views/Home 的关系：本模块接管后旧首页区域被隐藏，但**不修改 views/Home 的任何代码**
 * —— 两者是互补关系，失败回退时 views/Home 继续按原有方式工作。
 *
 * 与既有的 useKeyboardCardNavigation / useFocusBrowse 的关系（真机验证过）：
 * 本模块在 window 捕获阶段拦截了覆盖层内的 wheel / 方向键并 stopPropagation，
 * 所以那两套逻辑收不到事件、不会去操作被隐藏的旧卡片；
 * Ctrl 系组合键 / Esc / ? / Shift+Z 明确放行，全局快捷键仍然可用。
 *
 * 页面卸载时调用 teardownHomeDrawnPage()（幂等，未接管是空操作）。
 *
 * 建议接线（与 views/Space / views/Dynamic 同款）：首页本来就有旧版 Bewly 页面，
 * 所以**不需要**「没接管才挂增强层」这类二选一逻辑，直接调即可：
 *
 *   void setupHomeDrawnPage()
 *   ...
 *   window.addEventListener('pagehide', () => teardownHomeDrawnPage(), { once: true })
 */
export {
  HOME_DRAWN_ACTIVE_CLASS,
  HOME_FEED_BASE_PARAMS,
  HOME_FEED_PATH,
  HOME_GOTO_AD,
  HOME_GOTO_BANGUMI,
  HOME_GOTO_LIVE,
  HOME_LIVE_BASE_URL,
  HOME_MAX_PAGES,
  HOME_PAGE_SIZE,
  HOME_REQUEST_MIN_GAP,
  HOME_SIBLING_LINKS,
  HOME_SKELETON_COUNT,
  HOME_VIDEO_BASE_URL,
} from './constants'
export { fetchHomeFeed, prefetchHomeFeed } from './fetcher'
export {
  isHomeDrawnPageMounted,
  setupHomeDrawnPage,
  teardownHomeDrawnPage,
  watchHomeDrawnRoute,
} from './mount'
export {
  hasHomeDrawnScroll,
  resetHomeDrawnScroll,
  restoreHomeDrawnScroll,
  saveHomeDrawnScroll,
  takeHomeDrawnScroll,
} from './scrollMemory'
export type { HomeFeedData, HomeFeedItem, HomeFeedPage } from './types'
export {
  appendItems,
  hasMorePages,
  isAdItem,
  isHomeDrawnPath,
  isRenderableItem,
  nextFreshIdx,
  normalizePageItems,
  normalizeUrl,
  toVideoCard,
  videoKey,
} from './utils'
