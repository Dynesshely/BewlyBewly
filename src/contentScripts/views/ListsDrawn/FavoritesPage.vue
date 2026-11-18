<script setup lang="ts">
/**
 * 收藏夹（API 拉取 + 完全自绘）。
 *
 * 挂载方式：由 `views/Favorites/Favorites.vue` 直接渲染（dock 页面体系，不是覆盖层）。
 *
 * # 数据（真机 2026-11-19 验证）
 *
 *   GET  /x/v3/fav/folder/created/list-all?up_mid=<mid>&web_location=333.1387  收藏夹列表（无需签名）
 *   GET  /x/v3/fav/resource/list?media_id&pn&ps&platform=web                   收藏内容（无需签名）
 *   POST /x/v3/fav/folder/add | edit | del                                     新建 / 重命名 / 删除
 *   POST /x/v3/fav/resource/deal                                               取消收藏
 *
 * `medias` 可能是 null（空收藏夹）；`has_more` 决定继续翻页；失效条目 `attr=9`
 * 保留卡片但去掉播放地址。
 *
 * # 结构
 *
 * 左侧 = 收藏夹列表（`components/FavoriteFolderSidebar`，含新建 / 重命名 / 删除），
 * 右侧 = 内容网格（复用 `ListsCardSection` → `ListVideoCard` → `VideoCard`）。
 * 窄屏（≤900px）时侧栏变成顶部横向滚动条，网格保持单列 / 双列。
 *
 * # 「减少心智负担」的一项
 *
 * 搜索框只过滤**已加载**的收藏（纯前端，不重新请求）：标题 / UP 主 / 简介都参与匹配。
 * 需要服务端全量搜索时，原生收藏夹页仍然是兜底入口。
 *
 * # 失败回退
 *
 * 接口失败只切错误态（重试 + 原版页面链接），**完全不碰原生 DOM**。
 */
import type { ListCardItem, ListQuickActionId } from '../listShared/types'
import { computed, onMounted, ref } from 'vue'
import { useToast } from 'vue-toastification'
import { useListPageActions } from '~/composables/useListPageActions'
import { getCSRF, getUserID, openLinkToNewTab } from '~/utils/main'
import ListEmptyState from '../listShared/components/ListEmptyState.vue'
import ListPageHeader from '../listShared/components/ListPageHeader.vue'
import ListSkeleton from '../listShared/components/ListSkeleton.vue'
import ListToolbar from '../listShared/components/ListToolbar.vue'
import { useListPreferences } from '../listShared/preferences'
import { sortListItems } from '../listShared/timeline'
import { useListScrollMemory } from '../listShared/useListScrollMemory'
import { useListShortcuts } from '../listShared/useListShortcuts'
import { useListVirtual } from '../listShared/useListVirtual'
import { copyToClipboard } from '../listShared/utils'
import FavoriteFolderSidebar from './components/FavoriteFolderSidebar.vue'
import ListsCardSection from './components/ListsCardSection.vue'
import ListsErrorState from './components/ListsErrorState.vue'
import { addToWatchLater } from './fetcher'
import { useListsI18n } from './i18n'
import { useFavorites } from './useFavorites'
import '../listShared/styles/listPage.scss'
import './styles/listsDrawn.scss'

const toast = useToast()
const { tl } = useListsI18n()
const fav = useFavorites()
const { viewMode, sortMode, cycleViewMode, cycleSortMode } = useListPreferences(fav.scope)

const toolbarRef = ref<{ focusFilter: () => void, toggleHelp: () => void } | null>(null)
const loggedIn = computed(() => Boolean(getCSRF()))
const userId = computed(() => getUserID())

/** 排序后的卡片（搜索框过滤已在 composable 里做） */
const sortedCards = computed<Array<ListCardItem>>(() => sortListItems(fav.filteredCards.value, sortMode.value))
const sections = computed(() => [
  { key: 'all', label: '', items: sortedCards.value },
])

const heroCover = computed(() => {
  const cover = fav.folderCover.value
  return cover
    ? `${cover.replace(/^https?:/, '')}@480w_270h_1c`
    : ''
})

const subtitle = computed(() => (fav.selectedTitle.value
  ? tl('favoritesSubtitle', { name: fav.selectedTitle.value, count: fav.selectedTotal.value })
  : tl('favoritesFolders')))

const showSkeleton = computed(() => fav.loading.value && !fav.loaded.value)
const showError = computed(() => Boolean(fav.error.value) && fav.cards.value.length === 0)
const showNoFolder = computed(() => (
  !fav.loading.value
  && fav.loadedFolders.value
  && !fav.error.value
  && fav.folderList.value.length === 0
))
const showEmpty = computed(() => (
  !fav.loading.value
  && fav.loaded.value
  && !fav.error.value
  && fav.folderList.value.length > 0
  && sortedCards.value.length === 0
))

const emptyState = computed(() => {
  const word = fav.keyword.value.trim()
  if (word) {
    return {
      icon: 'i-mingcute:search-2-line',
      title: tl('noMatchTitle'),
      description: tl('noMatchDesc', { word }),
    }
  }
  return {
    icon: 'i-mingcute:star-line',
    title: tl('favoritesEmptyTitle'),
    description: tl('favoritesEmptyDesc'),
  }
})

/** 侧栏 / 工具条用的文案包 */
const sidebarLabels = computed(() => ({
  title: tl('favoritesFolders'),
  create: tl('favoritesNewFolder'),
  placeholder: tl('favoritesFolderName'),
  rename: tl('favoritesRename'),
  remove: tl('favoritesDelete'),
  removeTitle: tl('favoritesDeleteConfirmTitle'),
  removeDesc: tl('favoritesDeleteConfirmDesc'),
  cancel: tl('cancel'),
  working: tl('favoritesWorking'),
}))

onMounted(() => {
  void fav.load(userId.value)
})

useListShortcuts({
  viewMode,
  sortMode,
  cycleViewMode,
  cycleSortMode,
  focusFilter: () => toolbarRef.value?.focusFilter(),
  toggleHelp: () => toolbarRef.value?.toggleHelp(),
})

useListPageActions({
  isLoading: computed(() => fav.loading.value || fav.loadingMore.value),
  noMoreContent: computed(() => !fav.hasMore.value),
  reachBottom: () => fav.loadMore(),
  refresh: () => fav.load(userId.value),
})

useListVirtual({
  count: () => sortedCards.value.length,
  layoutKey: () => `${viewMode.value}:${sortMode.value}:${fav.keyword.value}:${fav.selectedId.value}`,
})
useListScrollMemory({
  scope: fav.scope,
  count: () => sortedCards.value.length,
})

function handlePlayAll() {
  openLinkToNewTab(fav.playAllUrl())
}

async function handleRename(id: number, title: string) {
  const reason = await fav.renameFolder(id, title)
  if (reason === 'exists')
    toast.warning(tl('favoritesNameExists'))
  else if (reason)
    toast.error(tl('favoritesRenameFailed'))
  else
    toast.success(tl('favoritesRenamedOk'))
}

async function handleRemoveFolder(id: number) {
  const reason = await fav.removeFolder(id)
  if (reason)
    toast.error(tl('favoritesDeleteFailed'))
  else
    toast.success(tl('favoritesDeletedOk'))
}

async function handleCreateFolder(title: string) {
  fav.createDraft.value = title
  const result = await fav.createFolder(userId.value)
  if (result.ok) {
    toast.success(tl('favoritesCreateOk'))
    return
  }
  if (result.reason === 'exists')
    toast.warning(tl('favoritesNameExists'))
  else if (result.reason === 'empty')
    toast.warning(tl('favoritesFolderName'))
  else
    toast.error(tl('favoritesCreateFailed'))
}

async function handleUnfavorite(card: ListCardItem) {
  if (!confirm(tl('favoritesUnfavoriteConfirm', { title: card.video.title })))
    return
  const reason = await fav.unfavorite(String(card.key))
  if (reason)
    toast.error(tl('favoritesUnfavoriteFailed'))
  else
    toast.success(tl('favoritesUnfavorited'))
}

async function copyCardLink(card: ListCardItem) {
  if (!card.copyUrl)
    return
  const ok = await copyToClipboard(card.copyUrl)
  if (ok)
    toast.success(tl('copied'))
  else
    toast.error(tl('copyFailed'))
}

async function saveToWatchLater(card: ListCardItem) {
  // 音频收藏的 id 是音频 id，不是 aid，加进稍后再看只会失败
  if (fav.isAudioKey(String(card.key)))
    return
  const aid = Number(card.video.id)
  if (!aid)
    return
  const result = await addToWatchLater(aid)
  if (result.ok)
    toast.success(tl('watchLaterAdded'))
  else
    toast.error(tl('watchLaterAddFailed'))
}

function handleCardAction(payload: { id: ListQuickActionId, item: ListCardItem }) {
  if (payload.id === 'copy')
    void copyCardLink(payload.item)
  else if (payload.id === 'unfavorite')
    void handleUnfavorite(payload.item)
  else if (payload.id === 'watchLater')
    void saveToWatchLater(payload.item)
}

function jumpToLoginPage() {
  location.href = 'https://passport.bilibili.com/login'
}
</script>

<template>
  <div class="bewly-list-page lists-drawn-page lists-drawn-favorites" data-bewly-lists-drawn="favorites">
    <template v-if="loggedIn">
      <ListPageHeader :title="tl('favoritesTitle')" :subtitle="subtitle" :cover="heroCover">
        <template #actions>
          <Button
            type="primary"
            size="small"
            :disabled="fav.selectedId.value === undefined"
            @click="handlePlayAll"
          >
            <template #left>
              <div i-tabler:player-play />
            </template>
            {{ tl('favoritesPlayAll') }}
          </Button>
        </template>
      </ListPageHeader>

      <div class="lists-fav-layout">
        <FavoriteFolderSidebar
          :folders="fav.folderList.value"
          :selected-id="fav.selectedId.value"
          :pending="fav.pending.value"
          :create-pending="fav.pending.value"
          :creating="fav.creating.value"
          :create-draft="fav.createDraft.value"
          :labels="sidebarLabels"
          @select="fav.selectFolder"
          @rename="handleRename"
          @remove="handleRemoveFolder"
          @open-create="fav.openCreate()"
          @cancel-create="fav.closeCreate()"
          @create="handleCreateFolder"
        />

        <div class="lists-fav-main">
          <ListToolbar
            ref="toolbarRef"
            v-model:view-mode="viewMode"
            v-model:sort-mode="sortMode"
            :filter-keyword="fav.keyword.value"
            :title="fav.selectedTitle.value"
            :count="sortedCards.length"
            :placeholder="tl('favoritesSearchPlaceholder')"
            @update:filter-keyword="fav.keyword.value = $event"
          />

          <ListSkeleton v-if="showSkeleton" :view-mode="viewMode" />

          <ListsErrorState
            v-else-if="showError"
            :title="tl('errorTitle')"
            :message="fav.error.value"
            :retry-label="tl('retry')"
            native-url="https://www.bilibili.com/account/favlist"
            :native-label="tl('openNative')"
            @retry="fav.load(userId)"
          />

          <ListEmptyState
            v-else-if="showNoFolder"
            :title="tl('favoritesNoFolder')"
            :description="tl('favoritesNoFolderDesc')"
            icon="i-mingcute:folder-line"
          />

          <ListEmptyState
            v-else-if="showEmpty"
            :title="emptyState.title"
            :description="emptyState.description"
            :icon="emptyState.icon"
          />

          <template v-else>
            <ListsCardSection
              v-for="section in sections"
              :key="section.key"
              :label="section.label"
              :count="section.items.length"
              :items="section.items"
              :view-mode="viewMode"
              @action="handleCardAction"
            />

            <div v-if="fav.hasMore.value" class="lists-load-more">
              <Button size="small" :disabled="fav.loadingMore.value" @click="fav.loadMore()">
                {{ fav.loadingMore.value ? tl('loadingMore') : tl('loadMore') }}
              </Button>
              <span class="lists-load-more__note">{{ tl('loadedCount', { count: sortedCards.length }) }}</span>
            </div>
            <p v-else-if="sortedCards.length > 0" class="lists-end">
              {{ tl('noMore') }}
            </p>
          </template>
        </div>
      </div>
    </template>

    <Empty v-else mt-6 :description="$t('common.please_log_in_first')">
      <Button type="primary" @click="jumpToLoginPage()">
        {{ $t('common.login') }}
      </Button>
    </Empty>
  </div>
</template>
