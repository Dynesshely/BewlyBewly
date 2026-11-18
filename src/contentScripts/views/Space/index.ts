/**
 * 空间页（自绘）的对外入口。
 *
 * **自挂载覆盖层**：不经过 App.vue / dock 体系。Lead 在 contentScripts/index.ts 里接线：
 *
 *   void setupSpaceDrawnPage()
 *
 * 语义：返回 true = 自绘页已接管（原生 DOM 已隐藏）；
 * 返回 false = **页面完全没被改动**，原生空间页保持原样可用。
 *
 * 与 spacePage 增强层的关系：本模块接管后原生头部与视频卡已被隐藏，
 * spacePage 的 j/k 与筛选仍会枚举到看不见的原生卡并把键盘抢走 —— 建议二选一：
 *
 *   void setupSpaceDrawnPage().then((takenOver) => {
 *     if (!takenOver)
 *       setupSpacePage()
 *   })
 *
 * 页面卸载时调用 teardownSpaceDrawnPage()（幂等，未接管是空操作）。
 */
export {
  ACC_INFO_PATH,
  ARC_SEARCH_PATH,
  DEFAULT_SPACE_SORT,
  NATIVE_SPACE_BASE_URL,
  RELATION_MODIFY_PATH,
  RELATION_STAT_PATH,
  SPACE_DRAWN_ACTIVE_CLASS,
  SPACE_DRAWN_ROOT_ID,
  SPACE_PAGE_SIZE,
  SPACE_SORTS,
} from './constants'
export type { SpaceSortId } from './constants'
export {
  fetchSpaceRelationStat,
  fetchSpaceUpInfo,
  fetchSpaceVideos,
  modifySpaceRelation,
} from './fetcher'
export {
  isSpaceDrawnPageMounted,
  setupSpaceDrawnPage,
  teardownSpaceDrawnPage,
  watchSpaceRoute,
} from './mount'
export type { ArcSearchData, ArcSearchItem, SpaceRelationStat, SpaceUpInfo, SpaceVideoPage } from './types'
export {
  appendVideos,
  hasMorePages,
  isSpaceHomePath,
  normalizeUrl,
  parseDuration,
  parseSpaceMid,
  toVideoCard,
} from './utils'
