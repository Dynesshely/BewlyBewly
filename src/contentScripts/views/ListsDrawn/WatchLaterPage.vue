<script setup lang="ts">
import type { ListCardItem, ListQuickActionId } from '../listShared/types'
/**
 * 稍后再看（API 拉取 + 完全自绘）。
 *
 * 挂载方式：本组件由 `views/WatchLater/WatchLater.vue` 直接渲染（dock 页面体系），
 * **不是**覆盖层 —— App.vue 里 `[AppPage.WatchLater]` 仍然指向那个既有组件，
 * 旧组件现在只做一件事：把内部实现换成这个自绘页。
 *
 * # 数据（真机 2026-11-19 验证）
 *
 *   GET /x/v2/history/toview      全量，**不分页**，无需签名，只要 cookie
 *
 * 服务端一次给全（真机 7 条：`data.count` 与 `data.list` 长度一致），所以这里的
 * 「加载更多」是**前端分批显示**（首屏 24 张，点一次再放 24 张），不是翻页请求；
 * 这样几百条的稍后再看也不会一上来就渲染几百张卡。
 *
 * # 「减少心智负担」的三项
 *
 * 1. 批量选择模式：卡片左上角方框 + 「全选」+ 「删除所选」（逐条调 del 接口）；
 * 2. 一键全部清空：二次确认里带上条数（`全部 7 个视频`），避免误点；
 * 3. 移除已看完：按 `progress === -1` 判定，调用 `viewed=true` 一次性移掉。
 *
 * # 失败回退
 *
 * 接口失败只切错误态（带重试 + 原版页面链接），**完全不碰原生 DOM**：
 * 本页渲染在 Bewly 的 shadow DOM 里，读写的全是接口数据，原生页面本来就没被改动。
 */
import { computed, onMounted, ref } from 'vue'
import { useToast } from 'vue-toastification'
import { useListPageActions } from '~/composables/useListPageActions'
import { getCSRF, openLinkToNewTab } from '~/utils/main'
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
import ListsCardSection from './components/ListsCardSection.vue'
import ListsErrorState from './components/ListsErrorState.vue'
import { useListsI18n } from './i18n'
import { useWatchLater } from './useWatchLater'
import '../listShared/styles/listPage.scss'
import './styles/listsDrawn.scss'

/** 前端分批显示的首屏 / 每次增量条数 */
const BATCH_SIZE = 24

const toast = useToast()
const { tl } = useListsI18n()
const wl = useWatchLater()
const { viewMode, sortMode, cycleViewMode, cycleSortMode } = useListPreferences(wl.scope)

const filterKeyword = ref('')
const visibleCount = ref(BATCH_SIZE)
const toolbarRef = ref<{ focusFilter: () => void, toggleHelp: () => void } | null>(null)

const loggedIn = computed(() => Boolean(getCSRF()))

/** 前端过滤（标题 / UP 主 / 分区）+ 排序 */
const filteredCards = computed<Array<ListCardItem>>(() => {
  const word = filterKeyword.value.trim().toLowerCase()
  const base = word
    ? wl.cards.value.filter((card) => {
        const raw = card.raw as { title?: string, owner?: { name?: string }, tname?: string } | undefined
        return [raw?.title, raw?.owner?.name, raw?.tname]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(word)
      })
    : [...wl.cards.value]
  return sortListItems(base, sortMode.value)
})

/** 当前实际渲染的卡片（前端分批） */
const visibleCards = computed(() => filteredCards.value.slice(0, visibleCount.value))
const hasLocalMore = computed(() => visibleCount.value < filteredCards.value.length)

/** 稍后再看不做日期分组：排序完直接一张网格（列表页仍沿用「分组」这一层以复用网格样式） */
const sections = computed(() => [
  { key: 'all', label: '', items: visibleCards.value },
])

const heroCover = computed(() => {
  const first = wl.cards.value[0]
  return first?.video.cover
    ? `${first.video.cover}@480w_270h_1c`
    : ''
})

const subtitle = computed(() => tl('watchLaterSubtitle', { count: wl.items.value.length }))
const showSkeleton = computed(() => wl.loading.value && !wl.loaded.value)
const showError = computed(() => Boolean(wl.error.value) && wl.cards.value.length === 0)
const showEmpty = computed(() => !wl.loading.value && wl.loaded.value && !wl.error.value && filteredCards.value.length === 0)

const emptyState = computed(() => {
  const word = filterKeyword.value.trim()
  if (word) {
    return {
      icon: 'i-mingcute:search-2-line',
      title: tl('noMatchTitle'),
      description: tl('noMatchDesc', { word }),
    }
  }
  return {
    icon: 'i-mingcute:carplay-line',
    title: tl('watchLaterEmptyTitle'),
    description: tl('watchLaterEmptyDesc'),
  }
})

onMounted(() => {
  void wl.load()
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
  isLoading: wl.loading,
  noMoreContent: computed(() => !hasLocalMore.value),
  reachBottom: () => showMore(),
  refresh: () => {
    visibleCount.value = BATCH_SIZE
    return wl.load()
  },
})

/** 离屏优化 / 滚动记忆：与旧实现完全一致（属性在 ListsCardSection 的卡片容器上） */
useListVirtual({
  count: () => visibleCards.value.length,
  layoutKey: () => `${viewMode.value}:${sortMode.value}:${filterKeyword.value}`,
})
useListScrollMemory({
  scope: wl.scope,
  count: () => visibleCards.value.length,
})

/** 前端分批：点「加载更多」或滚到底都走它 */
function showMore() {
  if (!hasLocalMore.value)
    return
  visibleCount.value = Math.min(
    visibleCount.value + BATCH_SIZE,
    filteredCards.value.length,
  )
}

function handlePlayAll() {
  openLinkToNewTab(wl.playAllUrl())
}

async function handleRemoveOne(card: ListCardItem) {
  const reason = await wl.removeOne(String(card.key))
  if (reason)
    toast.error(tl('removeFailed'))
  else
    toast.success(tl('removed'))
}

async function handleClearAll() {
  if (!confirm(tl('watchLaterClearAllConfirm', { count: wl.items.value.length })))
    return
  const reason = await wl.clearAll()
  if (reason)
    toast.error(tl('watchLaterClearFailed'))
  else
    toast.success(tl('watchLaterCleared'))
}

async function handleRemoveWatched() {
  if (!confirm(tl('watchLaterRemoveWatchedConfirm')))
    return
  const reason = await wl.removeWatched()
  if (reason)
    toast.error(tl('removeFailed'))
  else
    toast.success(tl('watchLaterRemoveWatchedOk'))
}

async function handleRemoveSelected() {
  const count = wl.selectedCount.value
  if (!count)
    return
  if (!confirm(tl('batchRemoveConfirm', { count })))
    return
  const result = await wl.removeSelected()
  if (result.failed > 0)
    toast.error(`${tl('removeFailed')} (${result.removed}/${count})`)
  else
    toast.success(tl('removed'))
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

function handleCardAction(payload: { id: ListQuickActionId, item: ListCardItem }) {
  if (payload.id === 'copy')
    void copyCardLink(payload.item)
  else if (payload.id === 'remove')
    void handleRemoveOne(payload.item)
}

function jumpToLoginPage() {
  location.href = 'https://passport.bilibili.com/login'
}
</script>

<template>
  <div class="bewly-list-page lists-drawn-page" data-bewly-lists-drawn="watch-later">
    <template v-if="loggedIn">
      <ListPageHeader :title="tl('watchLaterTitle')" :subtitle="subtitle" :cover="heroCover">
        <template #actions>
          <Button type="primary" size="small" @click="handlePlayAll">
            <template #left>
              <div i-tabler:player-play />
            </template>
            {{ tl('favoritesPlayAll') }}
          </Button>
          <Button
            size="small"
            :disabled="wl.watchedCount.value === 0 || wl.pending.value"
            @click="handleRemoveWatched"
          >
            <template #left>
              <div i-tabler:circle-minus />
            </template>
            {{ tl('watchLaterRemoveWatched') }}
          </Button>
          <Button size="small" :disabled="wl.loading.value" @click="handleClearAll">
            <template #left>
              <div i-tabler:trash />
            </template>
            {{ tl('watchLaterClearAll') }}
          </Button>
          <Button
            size="small"
            :type="wl.selectMode.value ? 'primary' : 'default'"
            @click="wl.toggleSelectMode()"
          >
            <template #left>
              <div i-tabler:checklist />
            </template>
            {{ wl.selectMode.value ? tl('exitSelect') : tl('selectMode') }}
          </Button>
        </template>
      </ListPageHeader>

      <!-- 批量选择工具条 -->
      <div v-if="wl.selectMode.value" class="lists-batch-bar" role="region" :aria-label="tl('selectMode')">
        <span class="lists-batch-bar__count">{{ tl('selectedCount', { count: wl.selectedCount.value }) }}</span>
        <button type="button" class="lists-batch-bar__btn" @click="wl.allSelected.value ? wl.clearSelection() : wl.selectAll()">
          {{ wl.allSelected.value ? tl('deselectAll') : tl('selectAll') }}
        </button>
        <button
          type="button"
          class="lists-batch-bar__btn is-danger"
          :disabled="wl.selectedCount.value === 0 || wl.pending.value"
          @click="handleRemoveSelected"
        >
          {{ tl('batchRemove') }}
        </button>
        <span class="lists-batch-bar__hint">{{ tl('watchLaterBatchHint') }}</span>
      </div>

      <ListToolbar
        ref="toolbarRef"
        v-model:view-mode="viewMode"
        v-model:sort-mode="sortMode"
        v-model:filter-keyword="filterKeyword"
        :title="tl('watchLaterTitle')"
        :count="visibleCards.length"
      />

      <ListSkeleton v-if="showSkeleton" :view-mode="viewMode" />

      <ListsErrorState
        v-else-if="showError"
        :title="tl('errorTitle')"
        :message="wl.error.value"
        :retry-label="tl('retry')"
        :native-url="wl.nativeUrl"
        :native-label="tl('openNative')"
        @retry="wl.load()"
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
          :selectable="wl.selectMode.value"
          :selected-keys="wl.selectedKeys.value"
          :select-disabled="wl.pending.value"
          :select-label="tl('selectMode')"
          @action="handleCardAction"
          @toggle-select="wl.toggleSelect"
        />

        <div v-if="hasLocalMore" class="lists-load-more">
          <Button size="small" @click="showMore">
            {{ tl('loadMore') }}
          </Button>
          <span class="lists-load-more__note">
            {{ tl('loadedCount', { count: visibleCards.length }) }} / {{ tl('totalCount', { count: filteredCards.length }) }}
          </span>
        </div>
        <p v-else-if="filteredCards.length > 0" class="lists-end">
          {{ tl('noMore') }}
        </p>
      </template>
    </template>

    <Empty v-else mt-6 :description="$t('common.please_log_in_first')">
      <Button type="primary" @click="jumpToLoginPage()">
        {{ $t('common.login') }}
      </Button>
    </Empty>
  </div>
</template>
