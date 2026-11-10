<script lang="ts" setup>
import { settings } from '~/logic'

import SettingsItem from '../components/SettingsItem.vue'
import SettingsItemGroup from '../components/SettingsItemGroup.vue'
import { usePagesSettingsMessages } from './i18n'

/**
 * 「页面增强」设置页。
 *
 * 集中管理第 1/2 轮新增功能开关：视频播放页（影院模式 / 迷你播放器 / 增强快捷键）、
 * 列表页（三个页面各自的默认视图 + 共用默认排序）、搜索页（粘贴直达）。
 * 文案走模块内 i18n（cmn-CN + en），不进入全局 _locales。
 */
const t = usePagesSettingsMessages()

const viewModeOptions = computed(() => [
  { label: t.value.viewModeComfortable, value: 'comfortable' },
  { label: t.value.viewModeCompact, value: 'compact' },
  { label: t.value.viewModeList, value: 'list' },
])

const sortOptions = computed(() => [
  { label: t.value.sortTime, value: 'time' },
  { label: t.value.sortDuration, value: 'duration' },
  { label: t.value.sortTitle, value: 'title' },
])
</script>

<template>
  <div>
    <SettingsItemGroup :title="t.groupVideoPage" :desc="t.groupVideoPageDesc">
      <SettingsItem :title="t.videoPageCinemaMode" :desc="t.videoPageCinemaModeDesc">
        <Radio v-model="settings.videoPageCinemaMode" />
      </SettingsItem>

      <SettingsItem :title="t.videoPageMiniPlayer" :desc="t.videoPageMiniPlayerDesc">
        <Radio v-model="settings.videoPageMiniPlayer" />
      </SettingsItem>

      <SettingsItem :title="t.videoPageShortcuts" :desc="t.videoPageShortcutsDesc">
        <Radio v-model="settings.videoPageShortcuts" />
      </SettingsItem>
    </SettingsItemGroup>

    <SettingsItemGroup :title="t.groupListPage" :desc="t.groupListPageDesc">
      <SettingsItem :title="t.historyViewMode">
        <Select v-model="settings.historyViewMode" :options="viewModeOptions" w="full" />
      </SettingsItem>

      <SettingsItem :title="t.watchLaterViewMode">
        <Select v-model="settings.watchLaterViewMode" :options="viewModeOptions" w="full" />
      </SettingsItem>

      <SettingsItem :title="t.favoritesViewMode">
        <Select v-model="settings.favoritesViewMode" :options="viewModeOptions" w="full" />
      </SettingsItem>

      <SettingsItem :title="t.defaultSort" :desc="t.defaultSortDesc">
        <Select v-model="settings.listDefaultSort" :options="sortOptions" w="full" />
      </SettingsItem>
    </SettingsItemGroup>

    <SettingsItemGroup :title="t.groupSearchPage" :desc="t.groupSearchPageDesc">
      <SettingsItem :title="t.directPaste" :desc="t.directPasteDesc">
        <Radio v-model="settings.searchPageDirectPasteEnabled" />
      </SettingsItem>
    </SettingsItemGroup>
  </div>
</template>

<style lang="scss" scoped>
</style>
