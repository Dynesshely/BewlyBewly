<script lang="ts" setup>
import { settings } from '~/logic'

import SettingsItem from '../components/SettingsItem.vue'
import SettingsItemGroup from '../components/SettingsItemGroup.vue'
import { usePagesSettingsMessages } from './i18n'

/**
 * 「页面增强」设置页。
 *
 * 集中管理各轮新增功能的默认偏好：视频播放页（影院模式 / 迷你播放器 / 增强快捷键）、
 * 视频卡片（悬停预览）、列表页（三个页面各自的默认视图 + 共用默认排序）、搜索页（粘贴直达），
 * 以及第 5 轮并入的模块偏好：动态页密度、消息页（只看未读 + 密度）、
 * 搜索结果页密度、用户空间密度、文章页（默认阅读模式 + 字号）。
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

/** 页面密度：舒适 / 紧凑（动态页、消息页、搜索结果页、用户空间共用） */
const densityOptions = computed(() => [
  { label: t.value.densityComfortable, value: 'comfortable' },
  { label: t.value.densityCompact, value: 'compact' },
])

/** 文章正文字号三档 */
const fontSizeOptions = computed(() => [
  { label: t.value.fontSizeS, value: 's' },
  { label: t.value.fontSizeM, value: 'm' },
  { label: t.value.fontSizeL, value: 'l' },
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

    <SettingsItemGroup :title="t.groupVideoCard" :desc="t.groupVideoCardDesc">
      <SettingsItem :title="t.cardPreview" :desc="t.cardPreviewDesc">
        <Radio v-model="settings.enableVideoCardPreview" />
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

    <SettingsItemGroup :title="t.groupMoments">
      <SettingsItem :title="t.momentsDensity" :desc="t.momentsDensityDesc">
        <Select v-model="settings.momentsDensity" :options="densityOptions" w="full" />
      </SettingsItem>
    </SettingsItemGroup>

    <SettingsItemGroup :title="t.groupNotification" :desc="t.groupNotificationDesc">
      <SettingsItem :title="t.notificationOnlyUnread" :desc="t.notificationOnlyUnreadDesc">
        <Radio v-model="settings.notificationOnlyUnread" />
      </SettingsItem>

      <SettingsItem :title="t.notificationDensity">
        <Select v-model="settings.notificationDensity" :options="densityOptions" w="full" />
      </SettingsItem>
    </SettingsItemGroup>

    <SettingsItemGroup :title="t.groupSearchResult" :desc="t.groupSearchResultDesc">
      <SettingsItem :title="t.searchDensity">
        <Select v-model="settings.searchDensity" :options="densityOptions" w="full" />
      </SettingsItem>
    </SettingsItemGroup>

    <SettingsItemGroup :title="t.groupSpace" :desc="t.groupSpaceDesc">
      <SettingsItem :title="t.spaceDensity">
        <Select v-model="settings.spaceDensity" :options="densityOptions" w="full" />
      </SettingsItem>
    </SettingsItemGroup>

    <SettingsItemGroup :title="t.groupArticle" :desc="t.groupArticleDesc">
      <SettingsItem :title="t.articleReadingMode" :desc="t.articleReadingModeDesc">
        <Radio v-model="settings.articleReadingMode" />
      </SettingsItem>

      <SettingsItem :title="t.articleFontSize">
        <Select v-model="settings.articleFontSize" :options="fontSizeOptions" w="full" />
      </SettingsItem>
    </SettingsItemGroup>

    <SettingsItemGroup :title="t.groupHome" :desc="t.groupHomeDesc">
      <SettingsItem :title="t.homeCardDensity" :desc="t.homeCardDensityDesc">
        <Select v-model="settings.homeCardDensity" :options="densityOptions" w="full" />
      </SettingsItem>
    </SettingsItemGroup>
  </div>
</template>

<style lang="scss" scoped>
</style>
