<script setup lang="ts">
/**
 * 分区页（自绘）的页面壳。
 *
 * 由 `mount.ts` 以「自挂载覆盖层」的方式挂在原生分区页之上（原生 DOM 已被它隐藏），
 * 所以这里拿到的一切都是挂载时从原生页 / 接口读出来的快照（props），不再读原生 DOM：
 *   - `navItems`：一级大分类 pill 行（原生导航优先，读不到用真机 dump 出来的常量表）；
 *   - `subTabs`：二级分区 tab（当前 /c/* 布局没有二级入口 → 空数组 → 整行不渲染）；
 *   - `initialArchives`：第一页数据（`mount.ts` 已在接管前预取，失败就不会接管）。
 */
import type { ChannelNavItem } from './constants'
import type { SubRegionTab } from './dom'
import type { RegionArchive } from './types'
import ChannelFeed from './components/ChannelFeed.vue'
import ChannelNav from './components/ChannelNav.vue'
import SubRegionTabs from './components/SubRegionTabs.vue'
import { useChannelI18n } from './i18n'

const props = defineProps<{
  slug: string
  regionName: string
  navItems: ChannelNavItem[]
  subTabs: SubRegionTab[]
  fromRegion: number
  initialArchives: RegionArchive[]
}>()

const { t } = useChannelI18n()

/** 原生页没给分区名时用 slug 兜底，避免标题空白 */
const title = computed(() => {
  const name = props.regionName || props.slug
  return t.value.pageTitle.replace('{name}', name)
})
</script>

<template>
  <div class="channel-drawn-page" :data-bewly-channel-drawn="slug">
    <ChannelNav :items="navItems" :current="slug" />

    <header class="channel-drawn-head">
      <h1 class="channel-drawn-head__title">
        {{ title }}
      </h1>
      <SubRegionTabs v-if="subTabs.length" :tabs="subTabs" />
    </header>

    <ChannelFeed :from-region="fromRegion" :initial="initialArchives" />
  </div>
</template>
