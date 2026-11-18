/**
 * 搜索结果页（自绘）的对外入口。
 *
 * **自挂载覆盖层**：不经过 App.vue / dock 体系。Lead 在 contentScripts/index.ts 里接线：
 *
 *   void setupSearchDrawnPage()
 *
 * 语义：返回 true = 自绘页已接管（原生 DOM 已隐藏）；
 * 返回 false = **页面完全没被改动**，原生搜索页保持原样可用。
 *
 * # 与原搜索页增强层（contentScripts/searchPage）的关系
 *
 * `setupSearchEnhance()` 会在原生结果卡上做 j/k 浏览、密度、快速筛选，并在页面右下
 * 挂一个 shadow 浮层。自绘接管后原生卡全部隐藏，它的键盘与浮层只会抢焦点，所以两者应当
 * 二选一（与空间页 → spacePage 的关系一致）：
 *
 *   void setupSearchDrawnPage().then((takenOver) => {
 *     if (!takenOver)
 *       setupSearchEnhance()
 *   })
 *
 * 页面卸载 / 路由离开时调用 teardownSearchDrawnPage()（幂等，未接管是空操作）。
 */
export {
  DEFAULT_SEARCH_ORDER,
  NATIVE_SEARCH_BASE_URL,
  OWNED_SEARCH_PATHS,
  SEARCH_API_PATH,
  SEARCH_DRAWN_ACTIVE_CLASS,
  SEARCH_DRAWN_HIDDEN_ATTR,
  SEARCH_DRAWN_ROOT_ID,
  SEARCH_DURATIONS,
  SEARCH_ORDERS,
  SEARCH_PAGE_SIZE,
  SEARCH_PAGE_SPAN,
  SEARCH_REQUEST_MIN_GAP,
  SEARCH_SKELETON_COUNT,
  SEARCH_TIDS,
} from './constants'
export type { SearchDurationId, SearchOrderId, SearchTidOption } from './constants'
export { fetchSearchVideos } from './fetcher'
export {
  isSearchDrawnPageMounted,
  setupSearchDrawnPage,
  teardownSearchDrawnPage,
  watchSearchRoute,
} from './mount'
export type {
  SearchApiData,
  SearchApiItem,
  SearchFiltersState,
  SearchRouteState,
  SearchVideoPage,
} from './types'
export {
  buildNativeSearchUrl,
  buildSearchUrl,
  isKnownTid,
  isOwnedSearchPath,
  isSameRoute,
  isSearchPageHost,
  normalizeUrl,
  parseSearchDuration,
  parseSearchFilters,
  parseSearchKeyword,
  parseSearchPage,
  parseSearchRoute,
  stripHtml,
  toPageTokens,
  toVideoCard,
  videoKey,
} from './utils'
