<script setup lang="ts">
/**
 * 历史记录（API 拉取 + 完全自绘）。
 *
 * 挂载方式：由 `views/History/History.vue` 直接渲染（dock 页面体系，不是覆盖层）。
 *
 * # 数据（真机 2026-11-19 验证 —— 任务书路径有误，这里以真机为准）
 *
 *   GET /x/web-interface/history/cursor?max&view_at&business&ps&type=all
 *
 * **不是 wbi 路径**：任务书写的 `/x/web-interface/wbi/history/cursor` 真机是 HTTP 404；
 * 正确路径没有 wbi 前缀，且带不带 wbi 签名都返回 code 0（原生页面自己发请求也不带 w_rid/wts）。
 * 翻页必须把上一页 `cursor` 里的 **max + view_at + business** 三个字段一起带回去；
 * 只传 max 会重复拿到第一页。
 *
 * # 「减少心智负担」的两项
 *
 * 1. 按日期分组：按 `view_at` 分「今天 / 昨天 / 更早」三段（纯前端计算，不额外请求）；
 * 2. 单条删除：每张卡右上角垃圾桶 → `POST /x/v2/history/delete`（kid = `business_oid`，真机验证），
 *    删除成功后只从本地列表移除，不整页重拉。
 *
 * 另外保留：暂停 / 恢复记录、清空历史、关键词前端过滤（只过滤已加载项）。
 *
 * # 失败回退
 *
 * 接口失败只切错误态（重试 + 原版页面链接），**完全不碰原生 DOM**。
 */
import type { ListCardItem, ListQuickActionId } from '../listShared/types'
import { computed, onMounted, ref } from 'vue'
import { useToast } from 'vue-toastification'
import { useListPageActions } from '~/composables/useListPageActions'
import { getCSRF } from '~/utils/main'
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
import { addToWatchLater } from './fetcher'
import { useListsI18n } from './i18n'
import { useHistory } from './useHistory'
import { groupByDate } from './utils'
import '../listShared/styles/listPage.scss'
import './styles/listsDrawn.scss'

const NATIVE_URL = 'https://www.bilibili.com/account/history'

const toast = useToast()
const { tl } = useListsI18n()
const history = useHistory()
const { viewMode, sortMode, cycleViewMode, cycleSortMode } = useListPreferences(history.scope)

const toolbarRef = ref<{ focusFilter: () => void, toggleHelp: () => void } | null>(null)
const loggedIn = computed(() => Boolean(getCSRF()))

/** 排序后再分组：时间排序保持接口顺序，其它排序也各自分组 */
const sortedCards = computed<Array<ListCardItem>>(() => sortListItems(history.filteredCards.value, sortMode.value))

/** 今天 / 昨天 / 更早（组内按当前排序；分组算法与 utils.groupByDate 完全一致） */
const sections = computed(() =>
  groupByDate(sortedCards.value, card => card.timestamp).map(group => ({
    key: group.key,
    label: groupLabel(group.key),
    items: group.items,
  })),
)

const subtitle = computed(() => (history.paused.value
  ? tl('historyPausedSubtitle')
  : tl('historySubtitle')))
const showSkeleton = computed(() => history.loading.value && !history.loaded.value)
const showError = computed(() => Boolean(history.error.value) && history.cards.value.length === 0)
const showEmpty = computed(() => (
  !history.loading.value
  && history.loaded.value
  && !history.error.value
  && sortedCards.value.length === 0
))

const emptyState = computed(() => {
  const word = history.keyword.value.trim()
  if (word) {
    return {
      icon: 'i-mingcute:search-2-line',
      title: tl('noMatchTitle'),
      description: tl('noMatchDesc', { word }),
    }
  }
  return {
    icon: 'i-mingcute:time-line',
    title: tl('historyEmptyTitle'),
    description: tl('historyEmptyDesc'),
  }
})

onMounted(() => {
  void history.load()
  void history.refreshPausedState()
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
  isLoading: computed(() => history.loading.value || history.loadingMore.value),
  noMoreContent: computed(() => !history.hasMore.value),
  reachBottom: () => history.loadMore(),
  refresh: () => history.load(),
})

useListVirtual({
  count: () => sortedCards.value.length,
  layoutKey: () => `${viewMode.value}:${sortMode.value}:${history.keyword.value}`,
})
useListScrollMemory({
  scope: history.scope,
  count: () => sortedCards.value.length,
})

function groupLabel(key: string): string {
  if (key === 'today')
    return tl('groupToday')
  if (key === 'yesterday')
    return tl('groupYesterday')
  return tl('groupEarlier')
}

async function handleRemoveOne(card: ListCardItem) {
  const reason = await history.removeOne(String(card.key))
  if (reason)
    toast.error(tl('historyDeleteFailed'))
  else
    toast.success(tl('historyDeleted'))
}

async function handleClearAll() {
  if (!confirm(tl('historyClearAllConfirm')))
    return
  const reason = await history.clearAll()
  if (reason)
    toast.error(tl('historyClearFailed'))
  else
    toast.success(tl('historyCleared'))
}

async function handleTogglePaused() {
  const next = !history.paused.value
  const question = next
    ? tl('historyPauseConfirm')
    : tl('historyResumeConfirm')
  if (!confirm(question))
    return
  const reason = await history.togglePaused(next)
  if (reason) {
    toast.error(tl('removeFailed'))
  }
  else {
    toast.success(next
      ? tl('historyPause')
      : tl('historyResume'))
  }
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
  const raw = card.raw as { history?: { business?: string, oid?: number } } | undefined
  const oid = Number(raw?.history?.oid ?? 0)
  if (!oid || raw?.history?.business !== 'archive')
    return
  const result = await addToWatchLater(oid)
  if (result.ok)
    toast.success(tl('watchLaterAdded'))
  else
    toast.error(tl('watchLaterAddFailed'))
}

function handleCardAction(payload: { id: ListQuickActionId, item: ListCardItem }) {
  if (payload.id === 'copy')
    void copyCardLink(payload.item)
  else if (payload.id === 'remove')
    void handleRemoveOne(payload.item)
  else if (payload.id === 'watchLater')
    void saveToWatchLater(payload.item)
}

function jumpToLoginPage() {
  location.href = 'https://passport.bilibili.com/login'
}
</script>

<template>
  <div class="bewly-list-page lists-drawn-page" data-bewly-lists-drawn="history">
    <template v-if="loggedIn">
      <ListPageHeader :title="tl('historyTitle')" :subtitle="subtitle">
        <template #actions>
          <Button size="small" :disabled="history.pending.value" @click="handleClearAll">
            <template #left>
              <div i-tabler:trash />
            </template>
            {{ tl('historyClearAll') }}
          </Button>
          <Button
            size="small"
            :type="history.paused.value ? 'primary' : 'default'"
            :disabled="history.pending.value"
            @click="handleTogglePaused"
          >
            <template #left>
              <div :class="history.paused.value ? 'i-ph:play-circle-bold' : 'i-ph:pause-circle-bold'" />
            </template>
            {{ history.paused.value ? tl('historyResume') : tl('historyPause') }}
          </Button>
        </template>
      </ListPageHeader>

      <ListToolbar
        ref="toolbarRef"
        v-model:view-mode="viewMode"
        v-model:sort-mode="sortMode"
        :filter-keyword="history.keyword.value"
        :title="tl('historyTitle')"
        :count="sortedCards.length"
        :placeholder="tl('historySearchPlaceholder')"
        @update:filter-keyword="history.keyword.value = $event"
      />

      <ListSkeleton v-if="showSkeleton" :view-mode="viewMode" />

      <ListsErrorState
        v-else-if="showError"
        :title="tl('errorTitle')"
        :message="history.error.value"
        :retry-label="tl('retry')"
        :native-url="NATIVE_URL"
        :native-label="tl('openNative')"
        @retry="history.load()"
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

        <div v-if="history.hasMore.value" class="lists-load-more">
          <Button size="small" :disabled="history.loadingMore.value" @click="history.loadMore()">
            {{ history.loadingMore.value ? tl('loadingMore') : tl('loadMore') }}
          </Button>
          <span class="lists-load-more__note">{{ tl('loadedCount', { count: sortedCards.length }) }}</span>
        </div>
        <p v-else-if="sortedCards.length > 0" class="lists-end">
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
