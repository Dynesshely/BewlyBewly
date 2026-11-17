/**
 * 分区页（自绘）的对外入口。
 *
 * **自挂载覆盖层**：不经过 App.vue / dock 体系。Lead 在 `contentScripts/index.ts` 里
 * 按下面的顺序接线（`setupChannelDrawnPage()` 是 async 的，要 await 再决定回退）：
 *
 *   if (!isPopularPage()) {
 *     void setupChannelDrawnPage().then((takenOver) => {
 *       if (!takenOver)
 *         setupChannelPage()
 *     })
 *   }
 *
 * 语义：`setupChannelDrawnPage()` 返回 `true` = 自绘页已接管（原生 DOM 已隐藏）；
 * 返回 `false` = **页面完全没被改动**，此时才应该挂 `channelPage` 增强层
 * （密度 / 排序 / j-k），两者不会叠在一起。
 *
 * 页面卸载时调用 `teardownChannelDrawnPage()`（幂等，未接管是空操作）。
 */
export type { ChannelNavItem } from './constants'
export { CHANNEL_DRAWN_ACTIVE_CLASS, CHANNEL_DRAWN_ROOT_ID, CHANNEL_NAV } from './constants'
export type { SubRegionTab } from './dom'

export { discoverSubRegionTabs, getRegionSlug, isChannelRegionPage } from './dom'
export { fetchRegionFeed } from './fetcher'
export {
  isChannelDrawnPageMounted,
  setupChannelDrawnPage,
  teardownChannelDrawnPage,
} from './mount'
export type { RegionArchive, RegionFeedPage } from './types'
export { toVideoCard } from './utils'
