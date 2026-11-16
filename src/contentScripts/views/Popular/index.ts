/**
 * 热门 / 排行榜页（自绘）的对外入口。
 *
 * **自挂载覆盖层**：不经过 App.vue / dock 体系，由 Lead 在 `contentScripts/index.ts` 里
 * 调用 `setupPopularPage()` 即可（内部自行判断是否热门 / 排行榜页），页面卸载时调用
 * `teardownPopularPage()`。趋势与 `views/SearchPage` 的 `setupSearchDrawnPage()` 同一模式。
 *
 * 额外导出（便于 Lead 接线或以后扩展）：
 *   - `isPopularPage()`：当前是否 `/v/popular*`；
 *   - `POPULAR_ROOT_ID`：覆盖层容器 id；
 *   - 页面类名常量与 URL ↔ tab 映射。
 */
export {
  NATIVE_POPULAR_URL,
  NATIVE_RANK_URL,
  POPULAR_PAGE_ACTIVE_CLASS,
  POPULAR_TABS,
  RANK_REGIONS,
} from './constants'
export type { PopularTabDef, PopularTabId, RankRegionDef, RankRegionId } from './constants'
export { isPopularPageMounted, POPULAR_ROOT_ID, setupPopularPage, teardownPopularPage } from './mount'
export { isPopularPage, pathForRegion, pathForTab, resolvePageState } from './utils'
