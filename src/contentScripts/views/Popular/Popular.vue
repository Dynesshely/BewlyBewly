<script setup lang="ts">
/**
 * 热门 / 排行榜页（自绘）。
 *
 * 本组件不经过 App.vue / dock 体系，而是由 `mount.ts` 以「自挂载覆盖层」的方式
 * 挂在自己的滚动容器里（与 `views/SearchPage` 同一类最小侵入接线）：
 *   - 打开 `/v/popular/all`、`/v/popular/weekly`、`/v/popular/precious`、`/v/popular/rank/*`
 *     时由 `setupPopularPage()` 挂载；
 *   - 顶层 tab 与排行榜分区 tab 只切换内部状态 + `history.replaceState`，不整页跳转；
 *   - `useBewlyApp()` 由 `mount.ts` 提供的最小 provider 满足（滚动容器就是覆盖层外壳）。
 * 原生 DOM 的隐藏由 `mount.ts` 负责。
 */
import type { PopularTabId, RankRegionDef, RankRegionId } from './constants'
import { useBewlyApp } from '~/composables/useAppProvider'
import PopularFeed from './components/PopularFeed.vue'
import PopularNav from './components/PopularNav.vue'
import PreciousView from './components/PreciousView.vue'
import RankView from './components/RankView.vue'
import WeeklyView from './components/WeeklyView.vue'
import { RANK_REGIONS } from './constants'
import { pathForRegion, pathForTab, resolvePageState } from './utils'

const { handleBackToTop, handleReachBottom, handlePageRefresh } = useBewlyApp()

const tab = ref<PopularTabId>('popular')
const region = ref<RankRegionDef>(RANK_REGIONS[0])

/** 从当前地址解析 tab / 分区（刷新、前进后退、KeepAlive 激活时都走它） */
function syncFromLocation() {
  const state = resolvePageState(location.pathname)
  tab.value = state.tab
  region.value = state.region
}

syncFromLocation()

onMounted(() => {
  window.addEventListener('popstate', syncFromLocation)
})

onUnmounted(() => {
  window.removeEventListener('popstate', syncFromLocation)
})

// 之后若被 KeepAlive 缓存，重新激活时地址可能已经变了（例如从别处返回）
onActivated(syncFromLocation)

/** 只改地址栏，不触发整页导航；即使失败也不影响内部状态 */
function replacePath(path: string) {
  try {
    window.history.replaceState(window.history.state, '', path)
  }
  catch {
    // 某些嵌入环境禁用 history 时忽略
  }
}

/** 切 tab 前解绑上一页的分页动作，避免滚动时旧视图继续加载 */
function resetPageActions() {
  handleReachBottom.value = undefined
  handlePageRefresh.value = undefined
}

function selectTab(next: PopularTabId) {
  if (next === tab.value)
    return
  resetPageActions()
  tab.value = next
  replacePath(pathForTab(next, region.value))
  handleBackToTop()
}

function selectRegion(next: RankRegionId) {
  const def = RANK_REGIONS.find(item => item.id === next)
  if (!def || def.id === region.value.id)
    return
  region.value = def
  replacePath(pathForRegion(def))
  handleBackToTop()
}
</script>

<template>
  <div class="popular-page">
    <PopularNav :active="tab" @select="selectTab" />

    <PopularFeed v-if="tab === 'popular'" />
    <WeeklyView v-else-if="tab === 'weekly'" />
    <PreciousView v-else-if="tab === 'precious'" />
    <RankView v-else :region="region" @select-region="selectRegion" />
  </div>
</template>
