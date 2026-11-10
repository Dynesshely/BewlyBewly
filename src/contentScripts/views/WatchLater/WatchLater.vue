<script setup lang="ts">
import type { ListCardItem, ListQuickActionId } from '../listShared/types'
import type { List as VideoItem, WatchLaterResult } from '~/models/video/watchLater'
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'
import { useBewlyApp } from '~/composables/useAppProvider'
import { useListPageActions } from '~/composables/useListPageActions'
import api from '~/utils/api'
import { getCSRF, openLinkToNewTab, removeHttpFromUrl } from '~/utils/main'

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

const isLoading = ref<boolean>(false)
const noMoreContent = ref<boolean>(false)
const allWatchLaterList = ref<VideoItem[]>([])
const currentWatchLaterList = ref<VideoItem[]>([])
const watchLaterCount = ref<number>(0)
const { haveScrollbar } = useBewlyApp()
const pageNum = ref<number>(1)
const filterKeyword = ref<string>('')
const hasLoadedOnce = ref<boolean>(false)

const { viewMode, sortMode, cycleViewMode, cycleSortMode } = useListPreferences('watch-later')
const toolbarRef = ref<{ focusFilter: () => void, toggleHelp: () => void } | null>(null)

const loggedIn = computed(() => Boolean(getCSRF()))

onMounted(() => {
  initData()
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
  isLoading,
  noMoreContent,
  reachBottom: () => getData(),
  refresh: () => initData(),
})

async function initData() {
  isLoading.value = false
  noMoreContent.value = false
  allWatchLaterList.value.length = 0
  currentWatchLaterList.value.length = 0
  pageNum.value = 1
  await getAllWatchLaterList()
  getData()
}

function getData() {
  getCurrentWatchLaterList()
}

/**
 * Get watch later list
 */
async function getAllWatchLaterList() {
  isLoading.value = true
  currentWatchLaterList.value.length = 0
  try {
    const res = await api.watchlater.getAllWatchLaterList() as WatchLaterResult
    if (res.code === 0) {
      allWatchLaterList.value = res.data.list
      watchLaterCount.value = allWatchLaterList.value.length
    }
  }
  finally {
    isLoading.value = false
    hasLoadedOnce.value = true
  }
}

async function getCurrentWatchLaterList() {
  const allWatchLaterListCopy = JSON.parse(JSON.stringify(allWatchLaterList.value))
  const currentList = allWatchLaterListCopy.slice((pageNum.value - 1) * 10, pageNum.value * 10)

  if (currentList.length === 0) {
    noMoreContent.value = true
    return
  }
  pageNum.value++
  currentWatchLaterList.value.push(...currentList)

  if (!await haveScrollbar() && !noMoreContent.value) {
    getCurrentWatchLaterList()
  }
}

function deleteWatchLaterItem(index: number, aid: number) {
  api.watchlater.removeFromWatchLater({
    aid,
    csrf: getCSRF(),
  })
    .then((res) => {
      if (res.code === 0) {
        currentWatchLaterList.value.splice(index, 1)
        watchLaterCount.value--
      }
    })
}

function handleClearAllWatchLater() {
  const result = confirm(
    t('watch_later.clear_all_confirm'),
  )
  if (result) {
    isLoading.value = true
    api.watchlater.clearAllWatchLater({
      csrf: getCSRF(),
    }).then((res) => {
      if (res.code === 0)
        initData()
    }).finally(() => {
      isLoading.value = false
    })
  }
}

function handleRemoveWatchedVideos() {
  const result = confirm(
    t('watch_later.remove_watched_videos_confirm'),
  )
  if (result) {
    api.watchlater.removeFromWatchLater({
      viewed: true,
      csrf: getCSRF(),
    })
      .then((res) => {
        if (res.code === 0)
          initData()
      })
  }
}

function handlePlayAll() {
  openLinkToNewTab('https://www.bilibili.com/list/watchlater')
}

const heroCover = computed(() => {
  const first = currentWatchLaterList.value[0]
  if (!first?.pic)
    return ''
  return `${removeHttpFromUrl(first.pic)}@480w_270h_1c`
})

const subtitle = computed(() => tl('watch_later.subtitle', { count: watchLaterCount.value }))

const cards = computed<Array<ListCardItem>>(() => {
  const keyword = filterKeyword.value.trim().toLowerCase()
  const items = keyword
    ? currentWatchLaterList.value.filter(item => matchesKeyword(item, keyword))
    : [...currentWatchLaterList.value]
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

const sortNote = computed(() => (showsTimeGroup.value
  ? ''
  : tl('sort.note', {
      dim: tl(`sort.${sortMode.value}`),
      count: cards.value.length,
    })))

const showSkeleton = computed(() => cards.value.length === 0 && (!hasLoadedOnce.value || isLoading.value))
const showEmpty = computed(() => cards.value.length === 0 && hasLoadedOnce.value && !isLoading.value)

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
    icon: 'i-mingcute:carplay-line',
    title: tl('watch_later.empty_title'),
    description: tl('watch_later.empty_desc'),
  }
})

function matchesKeyword(item: VideoItem, keyword: string): boolean {
  const haystack = [item.title, item.owner?.name, item.tname]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(keyword)
}

function getWatchLaterUrl(item: VideoItem): string {
  return `https://www.bilibili.com/list/watchlater?bvid=${item.bvid}`
}

function toCard(item: VideoItem): ListCardItem {
  const url = getWatchLaterUrl(item)
  const timestamp = (item.add_at || item.pubdate)
    ? (item.add_at || item.pubdate) * 1000
    : undefined
  const actions: ListQuickActionId[] = ['copy', 'remove']

  return {
    key: item.aid,
    video: {
      id: item.aid,
      title: item.title,
      cover: item.pic,
      duration: item.duration,
      url,
      author: {
        name: item.owner?.name,
        authorFace: item.owner?.face ?? '',
        mid: item.owner?.mid,
      },
      view: typeof item.stat?.view === 'number'
        ? item.stat.view
        : undefined,
      danmaku: typeof item.stat?.danmaku === 'number'
        ? item.stat.danmaku
        : undefined,
      publishedTimestamp: item.pubdate || undefined,
      // 接口已带 bvid/cid 的直接透传，供卡片悬停预览使用（不会为此新增请求）
      bvid: item.bvid || undefined,
      cid: item.cid || item.page?.cid || undefined,
      threePointV2: [],
    },
    copyUrl: url,
    timestamp,
    timeLabel: timestamp
      ? formatTimeLabel(timestamp)
      : undefined,
    progress: buildProgress(item.progress, item.duration),
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

function removeCard(card: ListCardItem) {
  const item = card.raw as VideoItem | undefined
  if (!item)
    return
  const index = currentWatchLaterList.value.indexOf(item)
  if (index === -1)
    return
  deleteWatchLaterItem(index, item.aid)
}

function handleCardAction(payload: { id: ListQuickActionId, item: ListCardItem }) {
  if (payload.id === 'copy')
    copyCardLink(payload.item)
  else if (payload.id === 'remove')
    removeCard(payload.item)
}

function jumpToLoginPage() {
  location.href = 'https://passport.bilibili.com/login'
}
</script>

<template>
  <div class="bewly-list-page">
    <template v-if="loggedIn">
      <ListPageHeader :title="t('watch_later.title')" :subtitle="subtitle" :cover="heroCover">
        <template #actions>
          <Button type="primary" size="small" @click="handlePlayAll">
            <template #left>
              <div i-tabler:player-play />
            </template>
            {{ t('common.play_all') }}
          </Button>
          <Button size="small" @click="handleRemoveWatchedVideos">
            <template #left>
              <div i-tabler:circle-minus />
            </template>
            {{ t('watch_later.remove_watched_videos') }}
          </Button>
          <Button size="small" @click="handleClearAllWatchLater">
            <template #left>
              <div i-tabler:trash />
            </template>
            {{ t('watch_later.clear_all') }}
          </Button>
        </template>
      </ListPageHeader>

      <ListToolbar
        ref="toolbarRef"
        v-model:view-mode="viewMode"
        v-model:sort-mode="sortMode"
        v-model:filter-keyword="filterKeyword"
        :title="t('watch_later.title')"
        :count="cards.length"
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
