/**
 * 动态页（自绘）的对外入口。
 *
 * **自挂载覆盖层**：不经过 App.vue / dock 体系。Lead 在 contentScripts/index.ts 里接线：
 *
 *   void setupDynamicDrawnPage()
 *
 * 语义：返回 true = 自绘页已接管（原生 `#app` 已隐藏）；
 * 返回 false = **页面完全没被改动**，原生动态页保持原样可用。
 *
 * # 与 views/Moments/native（第 93 轮 DOM 方案）共存
 *
 * 本模块**不修改 `views/Moments/**` 的任何代码**，两者可以照旧各自挂载，不需要二选一：
 *
 *   // 第 93 轮的 DOM 方案照旧
 *   setupMomentsDrawnPage()
 *   // 第 102 轮的 API 自绘：成功才接管原生页
 *   void setupDynamicDrawnPage()
 *
 * - 本模块接管成功 → 原生 `#app` 被置为 `display: none`，DOM 方案遍历不到可见条目，
 *   会自动移除 `bewly-moments-drawn` 类（它自己的 `syncNow` 就会做这件事），等于空转；
 * - 本模块不接管（未登录 / 接口失败 / 非列表首页）→ **完全没有动过原生 DOM**，
 *   DOM 方案继续按第 93 轮的方式逐条替换，用户看到的就是原来的自绘卡片。
 *
 * 页面卸载时调用 `teardownDynamicDrawnPage()`（幂等，未接管是空操作）。
 */
export {
  DEFAULT_DYNAMIC_TAB,
  DYNAMIC_AVATAR_SIZE,
  DYNAMIC_DETAIL_BASE_URL,
  DYNAMIC_DRAWN_ACTIVE_CLASS,
  DYNAMIC_DRAWN_ROOT_ID,
  DYNAMIC_EXCLUDED_PATH_RE,
  DYNAMIC_FEATURES,
  DYNAMIC_FEED_PATH,
  DYNAMIC_HOST_RE,
  DYNAMIC_MAX_PAGES,
  DYNAMIC_PAGE_BRIDGE_KEY,
  DYNAMIC_PGC_EMPTY_CODE,
  DYNAMIC_REQUEST_MIN_GAP,
  DYNAMIC_SKELETON_COUNT,
  DYNAMIC_TABS,
  DYNAMIC_VIDEO_BASE_URL,
} from './constants'
export type { DynamicTabId } from './constants'
export { DynamicEmptyChannelError, fetchDynamicFeed } from './fetcher'
export {
  isDynamicDrawnPageMounted,
  setupDynamicDrawnPage,
  teardownDynamicDrawnPage,
  watchDynamicRoute,
} from './mount'
export type {
  DynamicApiItem,
  DynamicContent,
  DynamicFeedData,
  DynamicFeedPage,
  DynamicItem,
  DynamicPageBridge,
  DynamicParagraph,
  DynamicPicture,
  DynamicStats,
  DynamicVideo,
} from './types'
export {
  avatarUrl,
  buildDynamicTabUrl,
  detailUrl,
  formatCompactCount,
  formatCount,
  hasMorePages,
  isDynamicPageHost,
  isOwnedDynamicPath,
  normalizeUrl,
  originalImageUrl,
  parseDynamicTab,
  toDynamicItem,
  toDynamicItems,
  toParagraph,
  toPictures,
  withImageSize,
} from './utils'
