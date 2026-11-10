<script setup lang="ts">
import type { ListCardItem, ListQuickActionId } from '../listShared/types'
import type { List as HistoryItem, HistoryResult } from '~/models/history/history'
import type { List as HistorySearchItem, HistorySearchResult } from '~/models/video/historySearch'
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'
import { useBewlyApp } from '~/composables/useAppProvider'
import { useListPageActions } from '~/composables/useListPageActions'
import { Business } from '~/models/history/history'
import api from '~/utils/api'
import { getCSRF, removeHttpFromUrl } from '~/utils/main'

import ListEmptyState from '../listShared/components/ListEmptyState.vue'
import ListGroupSection from '../listShared/components/ListGroupSection.vue'
import ListPageHeader from '../listShared/components/ListPageHeader.vue'
import ListSkeleton from '../listShared/components/ListSkeleton.vue'
import ListToolbar from '../listShared/components/ListToolbar.vue'
import { useListI18n } from '../listShared/i18n'
import { useListPreferences } from '../listShared/preferences'
import { buildProgress, formatTimeLabel, groupItemsByTime, sortListItems } from '../listShared/timeline'
import { useListShortcuts } from '../listShared/useListShortcuts'
import { copyToClipboard } from '../listShared/utils'
import '../listShared/styles/listPage.scss'

const { t } = useI18n()
const { tl } = useListI18n()
const toast = useToast()
const { haveScrollbar } = useBewlyApp()

const isLoading = ref<boolean>(false)
const noMoreContent = ref<boolean>(false)
const historyList = reactive<Array<HistoryItem>>([])
const currentPageNum = ref<number>(1)
/** 服务端搜索关键词；与工具条里的本地过滤共用同一个输入框 */
const searchKeyword = ref<string>()
const filterKeyword = ref<string>('')
const historyStatus = ref<boolean>()
const hasLoadedOnce = ref<boolean>(false)

const { viewMode, sortMode, cycleViewMode, cycleSortMode } = useListPreferences('history')
const toolbarRef = ref<{ focusFilter: () => void, toggleHelp: () => void } | null>(null)

const loggedIn = computed(() => Boolean(getCSRF()))

onMounted(() => {
  getHistoryList()
  getHistoryPauseStatus()
})

useListPageActions({
  isLoading,
  noMoreContent,
  reachBottom: () => {
    if (searchKeyword.value)
      searchHistoryList()
    else
      getHistoryList()
  },
  refresh: () => {
    historyList.length = 0
    currentPageNum.value = 1
    noMoreContent.value = false
    if (searchKeyword.value)
      searchHistoryList()
    else
      getHistoryList()
  },
})

useListShortcuts({
  viewMode,
  sortMode,
  cycleViewMode,
  cycleSortMode,
  focusFilter: () => toolbarRef.value?.focusFilter(),
  toggleHelp: () => toolbarRef.value?.toggleHelp(),
})

const cards = computed<Array<ListCardItem>>(() => {
  const keyword = filterKeyword.value.trim().toLowerCase()
  const items = keyword
    ? historyList.filter(item => matchesKeyword(item, keyword))
    : [...historyList]
  return sortListItems(items.map(toCard), sortMode.value)
})

const showsTimeGroup = computed(() => sortMode.value === 'time')

const sections = computed<Array<{ key: string, label: string, items: ListCardItem[] }>>(() => {
  if (!showsTimeGroup.value) {
    return [
      { key: 'all', label: '', items: cards.value },
    ]
  }

  return groupItemsByTime(cards.value, card => card.timestamp).map(group => ({
    key: group.key,
    label: tl(`group.${group.key}`),
    items: group.items,
  }))
})

const subtitle = computed(() => {
  if (historyStatus.value)
    return tl('history.paused_subtitle')
  return tl('history.subtitle')
})

const sortNote = computed(() => (showsTimeGroup.value
  ? ''
  : tl('sort.note', {
      dim: tl(`sort.${sortMode.value}`),
      count: cards.value.length,
    })))

const showSkeleton = computed(() => cards.value.length === 0 && (!hasLoadedOnce.value || isLoading.value))
const showEmpty = computed(() => cards.value.length === 0 && hasLoadedOnce.value && !isLoading.value)

// 清空过滤词时回到完整的观看历史（若当前处于服务端搜索结果中）
watch(filterKeyword, (value) => {
  if (value.trim() || !searchKeyword.value)
    return
  historyList.length = 0
  currentPageNum.value = 1
  noMoreContent.value = false
  hasLoadedOnce.value = false
  searchKeyword.value = ''
  getHistoryList()
})

const emptyState = computed(() => {
  const word = filterKeyword.value.trim()
  if (word) {
    return {
      icon: 'i-mingcute:search-2-line',
      title: tl('filter.empty_title'),
      description: tl('filter.empty_desc', { word }),
    }
  }
  return {
    icon: 'i-mingcute:time-line',
    title: tl('history.empty_title'),
    description: tl('history.empty_desc'),
  }
})

/**
 * Get history list
 */
function getHistoryList() {
  isLoading.value = true
  api.history.getHistoryList({
    type: 'all',
    view_at:
        historyList.length > 0
          ? historyList[historyList.length - 1].view_at
          : 0,
  })
    .then(async (res: HistoryResult) => {
      if (res.code === 0) {
        if (Array.isArray(res.data.list) && res.data.list.length > 0)
          historyList.push(...res.data.list)

        if (historyList.length !== 0 && res.data.list.length < 20) {
          isLoading.value = false
          noMoreContent.value = true
          return
        }

        noMoreContent.value = false

        if (!await haveScrollbar() && !noMoreContent.value) {
          getHistoryList()
        }
      }
    })
    .finally(() => {
      isLoading.value = false
      hasLoadedOnce.value = true
    })
}

function searchHistoryList() {
  isLoading.value = true
  api.history.searchHistoryList({
    pn: currentPageNum.value++,
    keyword: searchKeyword.value,
  })
    .then((res: HistorySearchResult) => {
      if (res.code === 0) {
        if (historyList.length !== 0 && res.data.list.length < 20) {
          isLoading.value = false
          noMoreContent.value = true
          return
        }

        res.data.list.forEach((item: HistorySearchItem) => {
          historyList.push(item as unknown as HistoryItem)
        })

        noMoreContent.value = false
      }
    })
    .finally(() => {
      isLoading.value = false
      hasLoadedOnce.value = true
    })
}

function handleSearch() {
  historyList.length = 0
  currentPageNum.value = 1
  noMoreContent.value = false
  searchKeyword.value = filterKeyword.value.trim()
  if (searchKeyword.value)
    searchHistoryList()
  else getHistoryList()
}

function deleteHistoryItem(index: number, historyItem: HistoryItem) {
  api.history.deleteHistoryItem({
    kid: `${historyItem.history.business}_${historyItem.history.oid}`,
    csrf: getCSRF(),
  })
    .then((res) => {
      if (res.code === 0)
        historyList.splice(index, 1)
    })
}

/**
 * Return the URL of the history item
 * @param item history item
 * @return {string} url
 */
function getHistoryUrl(item: HistoryItem): string {
  if (item.uri)
    return item.uri

  // Video
  if (item.history.business === Business.ARCHIVE) {
    if (item?.videos && item.videos > 0)
      return `https://www.bilibili.com/video/${item.history.bvid}?p=${item.history.page}`
    return `https://www.bilibili.com/video/${item.history.bvid}`
  }
  // Live
  else if (item.history.business === Business.LIVE) {
    return `https://live.bilibili.com/${item.history.oid}`
  }
  // Article
  else if (item.history.business === Business.ARTICLE || item.history.business === Business.ARTICLE_LIST) {
    if (item.history.cid === 0)
      return `https://www.bilibili.com/read/cv${item.history.oid}`
    else
      return `https://www.bilibili.com/read/cv${item.history.cid}`
  }
  return ''
}

function getHistoryItemCover(item: HistoryItem) {
  if (item.history.business === 'article' || item.history.business === 'article-list') {
    if (item.covers)
      return removeHttpFromUrl(`${item.covers[0]}`)
  }

  return removeHttpFromUrl(item.cover)
}

function getHistoryPauseStatus() {
  api.history.getHistoryPauseStatus()
    .then((res) => {
      if (res.code === 0)
        historyStatus.value = res.data
    })
}

function setHistoryPauseStatus(isPause: boolean) {
  api.history.setHistoryPauseStatus({
    csrf: getCSRF(),
    switch: isPause,
  })
    .then((res) => {
      if (res.code === 0)
        getHistoryPauseStatus()
    })
}

function clearAllHistory() {
  api.history.clearAllHistory({
    csrf: getCSRF(),
  })
    .then((res) => {
      if (res.code === 0)
        historyList.length = 0
    })
}

function handleClearAllWatchHistory() {
  const result = confirm(
    t('history.clear_all_watch_history_confirm'),
  )
  if (result)
    clearAllHistory()
}

function handlePauseWatchHistory() {
  const result = confirm(
    t('history.pause_watch_history_confirm'),
  )
  if (result)
    setHistoryPauseStatus(true)
}

function handleTurnOnWatchHistory() {
  const result = confirm(
    t('history.turn_on_watch_history_confirm'),
  )
  if (result)
    setHistoryPauseStatus(false)
}

function jumpToLoginPage() {
  location.href = 'https://passport.bilibili.com/login'
}

function matchesKeyword(item: HistoryItem, keyword: string): boolean {
  const haystack = [
    item.title,
    item.show_title,
    item.author_name,
    item.tag_name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(keyword)
}

/** 把历史条目映射成列表页统一卡片 */
function toCard(item: HistoryItem): ListCardItem {
  const url = getHistoryUrl(item)
  const isArchive = item.history.business === Business.ARCHIVE
  const isPlayable = isArchive || item.history.business === Business.PGC
  const timestamp = item.view_at
    ? item.view_at * 1000
    : undefined

  const actions: ListQuickActionId[] = []
  if (isArchive)
    actions.push('watchLater')
  actions.push('copy', 'remove')

  return {
    key: item.kid || `${item.history.business}-${item.history.oid}`,
    video: {
      id: item.history.oid || item.kid,
      title: item.show_title || item.title,
      cover: getHistoryItemCover(item),
      duration: item.duration,
      url,
      author: {
        name: item.author_name || undefined,
        authorFace: item.author_face || '',
        mid: item.author_mid || undefined,
      },
      capsuleText: timestamp
        ? formatTimeLabel(timestamp)
        : undefined,
      threePointV2: [],
    },
    copyUrl: url,
    timestamp,
    timeLabel: timestamp
      ? formatTimeLabel(timestamp)
      : undefined,
    progress: isPlayable
      ? buildProgress(item.progress, item.duration)
      : undefined,
    actions,
    raw: item,
  }
}

async function copyCardLink(card: ListCardItem) {
  if (!card.copyUrl)
    return
  const succeeded = await copyToClipboard(card.copyUrl)
  if (succeeded)
    toast.success(tl('action.copied'))
  else
    toast.error(tl('action.copy_failed'))
}

function saveToWatchLater(card: ListCardItem) {
  const item = card.raw as HistoryItem | undefined
  if (!item || item.history.business !== Business.ARCHIVE)
    return

  api.watchlater.saveToWatchLater({
    aid: item.history.oid,
    csrf: getCSRF(),
  })
    .then((res) => {
      if (res.code === 0)
        toast.success(tl('action.watchLater_ok'))
      else
        toast.error(res.message || tl('action.watchLater_failed'))
    })
    .catch(() => {
      toast.error(tl('action.watchLater_failed'))
    })
}

function removeCard(card: ListCardItem) {
  const item = card.raw as HistoryItem | undefined
  if (!item)
    return
  const index = historyList.indexOf(item)
  if (index === -1)
    return
  deleteHistoryItem(index, item)
}

function handleCardAction(payload: { id: ListQuickActionId, item: ListCardItem }) {
  if (payload.id === 'copy')
    copyCardLink(payload.item)
  else if (payload.id === 'remove')
    removeCard(payload.item)
  else if (payload.id === 'watchLater')
    saveToWatchLater(payload.item)
}
</script>

<template>
  <div class="bewly-list-page">
    <template v-if="loggedIn">
      <ListPageHeader :title="t('history.title')" :subtitle="subtitle">
        <template #actions>
          <Button size="small" @click="handleClearAllWatchHistory">
            <template #left>
              <div i-tabler:trash />
            </template>
            {{ t('history.clear_all_watch_history') }}
          </Button>
          <Button v-if="!historyStatus" size="small" @click="handlePauseWatchHistory">
            <template #left>
              <div i-ph:pause-circle-bold />
            </template>
            {{ t('history.pause_watch_history') }}
          </Button>
          <Button v-else size="small" type="primary" @click="handleTurnOnWatchHistory">
            <template #left>
              <div i-ph:play-circle-bold />
            </template>
            {{ t('history.turn_on_watch_history') }}
          </Button>
        </template>
      </ListPageHeader>

      <ListToolbar
        ref="toolbarRef"
        v-model:view-mode="viewMode"
        v-model:sort-mode="sortMode"
        v-model:filter-keyword="filterKeyword"
        :title="t('history.title')"
        :count="cards.length"
        :placeholder="tl('search.placeholder')"
        @search="handleSearch"
      />

      <p v-if="sortNote" class="bewly-list-sort-note">
        {{ sortNote }}
      </p>

      <ListSkeleton v-if="showSkeleton" :view-mode="viewMode" />

      <ListEmptyState
        v-else-if="showEmpty"
        :title="emptyState.title"
        :description="emptyState.description"
        :icon="emptyState.icon"
      />

      <template v-else>
        <ListGroupSection
          v-for="section in sections"
          :key="section.key"
          :label="section.label"
          :count="section.items.length"
          :items="section.items"
          :view-mode="viewMode"
          @action="handleCardAction"
        />

        <!-- no more content -->
        <Empty v-if="noMoreContent" class="py-4" :description="$t('common.no_more_content')" />

        <!-- loading -->
        <Transition name="fade">
          <Loading v-if="isLoading && cards.length !== 0 && !noMoreContent" m="-t-4" />
        </Transition>
      </template>
    </template>

    <Empty v-else mt-6 :description="t('common.please_log_in_first')">
      <Button type="primary" @click="jumpToLoginPage()">
        {{ $t('common.login') }}
      </Button>
    </Empty>
  </div>
</template>
