<script setup lang="ts">
import type { ListCardItem, ListCategoryChip, ListQuickActionId } from '../listShared/types'
import type { FavoriteResource } from '~/components/TopBar/types'
import type { Media as FavoriteItem, FavoritesResult } from '~/models/video/favorite'
import type { List as CategoryItem, FavoritesCategoryResult } from '~/models/video/favoriteCategory'
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'
import { useBewlyApp } from '~/composables/useAppProvider'
import { useListPageActions } from '~/composables/useListPageActions'
import api from '~/utils/api'
import { getCSRF, getUserID, openLinkToNewTab, removeHttpFromUrl } from '~/utils/main'

import ListCategoryChips from '../listShared/components/ListCategoryChips.vue'
import ListEmptyState from '../listShared/components/ListEmptyState.vue'
import ListGroupSection from '../listShared/components/ListGroupSection.vue'
import ListPageHeader from '../listShared/components/ListPageHeader.vue'
import ListSkeleton from '../listShared/components/ListSkeleton.vue'
import ListToolbar from '../listShared/components/ListToolbar.vue'
import { useListI18n } from '../listShared/i18n'
import { useListPreferences } from '../listShared/preferences'
import { formatTimeLabel, groupItemsByTime, sortListItems } from '../listShared/timeline'
import { useListScrollMemory } from '../listShared/useListScrollMemory'
import { useListShortcuts } from '../listShared/useListShortcuts'
import { useListVirtual } from '../listShared/useListVirtual'
import { copyToClipboard } from '../listShared/utils'
import '../listShared/styles/listPage.scss'

const { t } = useI18n()
const { tl } = useListI18n()
const toast = useToast()

const favoriteCategories = reactive<CategoryItem[]>([])
const favoriteResources = reactive<FavoriteItem[]>([])

const selectedCategory = ref<CategoryItem>()
const activatedCategoryCover = ref<string>('')

const currentPageNum = ref<number>(1)
const filterKeyword = ref<string>('')
/** 提交给收藏接口的关键词（回车触发），与本地过滤分开 */
const searchKeyword = ref<string>('')
const { haveScrollbar } = useBewlyApp()
const isLoading = ref<boolean>(false)
const noMoreContent = ref<boolean>(false)
const hasLoadedOnce = ref<boolean>(false)
/** 正在执行重命名 / 删除的收藏夹 id（禁用该胶囊并显示处理中） */
const categoryPendingId = ref<number | null>(null)
/** 「+ 新建收藏夹」请求在途 */
const categoryCreatePending = ref<boolean>(false)

const { viewMode, sortMode, cycleViewMode, cycleSortMode } = useListPreferences('favorites')
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
  reachBottom: () => {
    if (!selectedCategory.value)
      return
    getFavoriteResources(selectedCategory.value.id, ++currentPageNum.value, searchKeyword.value)
  },
  refresh: () => {
    favoriteResources.length = 0
    currentPageNum.value = 1
    noMoreContent.value = false
    handleSearch()
  },
})

async function initData() {
  await getFavoriteCategories()
  if (favoriteCategories[0])
    changeCategory(favoriteCategories[0])
}

async function getFavoriteCategories(): Promise<CategoryItem[]> {
  const res: FavoritesCategoryResult = await api.favorite.getFavoriteCategories({
    up_mid: getUserID(),
  })
  const list = res?.code === 0 && Array.isArray(res?.data?.list)
    ? res.data.list
    : []
  // 用 splice 整体替换：删除 / 重命名后不能残留旧条目
  favoriteCategories.splice(0, favoriteCategories.length, ...list)
  return list
}

/**
 * Get favorite video resources
 * @param media_id
 * @param pn
 * @param keyword
 */
async function getFavoriteResources(
  media_id: number,
  pn: number,
  keyword = '' as string,
) {
  isLoading.value = true
  try {
    const res: FavoritesResult = await api.favorite.getFavoriteResources({
      media_id,
      pn,
      keyword,
    })

    if (res.code === 0) {
      activatedCategoryCover.value = res.data.info.cover

      if (Array.isArray(res.data.medias) && res.data.medias.length > 0)
        favoriteResources.push(...res.data.medias)

      if (!res.data.medias)
        noMoreContent.value = true

      if (!await haveScrollbar() && !noMoreContent.value && selectedCategory.value)
        await getFavoriteResources(selectedCategory.value.id, ++currentPageNum.value, keyword)
    }
  }
  finally {
    isLoading.value = false
    hasLoadedOnce.value = true
  }
}

async function changeCategory(categoryItem: CategoryItem | undefined) {
  if (!categoryItem || isLoading.value)
    return
  currentPageNum.value = 1
  selectedCategory.value = categoryItem
  favoriteResources.length = 0
  noMoreContent.value = false
  searchKeyword.value = ''
  hasLoadedOnce.value = false

  getFavoriteResources(categoryItem.id, 1)
}

function handleCategorySelect(id: number) {
  const category = favoriteCategories.find(item => item.id === id)
  if (category)
    changeCategory(category)
}

/** 写操作统一登录判断：未登录只提示，不发请求 */
function ensureLoggedInForManage(): boolean {
  if (loggedIn.value)
    return true
  toast.warning(tl('favorites.need_login'))
  return false
}

/** 收藏夹列表变化后，尽量保持当前选中：被删 / 不存在时回退到第一个可用夹 */
async function syncSelectionAfterManage(preferredId?: number) {
  const list = await getFavoriteCategories()
  const target = preferredId !== undefined
    ? list.find(item => item.id === preferredId)
    : list.find(item => item.id === selectedCategory.value?.id)

  if (target) {
    if (target.id !== selectedCategory.value?.id)
      changeCategory(target)
    else
      selectedCategory.value = target
    return
  }

  const first = list[0]
  if (first) {
    changeCategory(first)
    return
  }

  // 一个收藏夹都不剩：清空列表与选中，让空态出现（避免一直停在骨架屏）
  selectedCategory.value = undefined
  favoriteResources.length = 0
  noMoreContent.value = true
  hasLoadedOnce.value = true
}

/** 新建收藏夹（公开）：成功后刷新胶囊并自动切到新夹 */
async function handleCategoryCreate(title: string) {
  if (!ensureLoggedInForManage() || categoryCreatePending.value)
    return

  const name = title.trim()
  if (!name)
    return
  // 同名收藏夹本地先提示（最终仍以接口校验为准）
  if (favoriteCategories.some(item => item.title === name)) {
    toast.warning(tl('favorites.name_exists'))
    return
  }

  const beforeIds = new Set(favoriteCategories.map(item => item.id))
  categoryCreatePending.value = true
  try {
    const res = await api.favorite.createFavoriteFolder({
      title: name,
      privacy: 0,
      csrf: getCSRF(),
    })

    if (res?.code !== 0) {
      if (res?.code === -101 || res?.code === -111)
        toast.warning(tl('favorites.need_login'))
      else
        toast.error(tl('favorites.create_failed'))
      return
    }

    const list = await getFavoriteCategories()
    const created = list.find(item => !beforeIds.has(item.id))
      ?? list.find(item => item.title === name)
    if (created) {
      changeCategory(created)
    }
    else if (list[0]) {
      changeCategory(list[0])
    }
    toast.success(tl('favorites.create_ok'))
  }
  catch {
    toast.error(tl('favorites.create_failed'))
  }
  finally {
    categoryCreatePending.value = false
  }
}

/** 重命名收藏夹：成功后就地更新标题（同步更新当前选中夹的标题） */
async function handleCategoryRename(id: number, title: string) {
  if (!ensureLoggedInForManage() || categoryPendingId.value !== null)
    return

  const name = title.trim()
  if (!name)
    return
  if (favoriteCategories.some(item => item.id !== id && item.title === name)) {
    toast.warning(tl('favorites.name_exists'))
    return
  }

  categoryPendingId.value = id
  try {
    const res = await api.favorite.editFavoriteFolder({
      title: name,
      media_id: id,
      csrf: getCSRF(),
    })

    if (res?.code !== 0) {
      if (res?.code === -101 || res?.code === -111)
        toast.warning(tl('favorites.need_login'))
      else
        toast.error(tl('favorites.rename_failed'))
      return
    }

    const target = favoriteCategories.find(item => item.id === id)
    if (target)
      target.title = title.trim()
    if (selectedCategory.value?.id === id) {
      selectedCategory.value = {
        ...selectedCategory.value,
        title: title.trim(),
      }
    }
    toast.success(tl('favorites.rename_ok'))
  }
  catch {
    toast.error(tl('favorites.rename_failed'))
  }
  finally {
    categoryPendingId.value = null
  }
}

/** 删除收藏夹：成功后刷新胶囊；删的是当前夹则切到第一个可用夹 */
async function handleCategoryDelete(id: number) {
  if (!ensureLoggedInForManage() || categoryPendingId.value !== null)
    return

  const wasSelected = selectedCategory.value?.id === id
  categoryPendingId.value = id
  try {
    const res = await api.favorite.deleteFavoriteFolder({
      media_ids: String(id),
      csrf: getCSRF(),
    })

    if (res?.code !== 0) {
      if (res?.code === -101 || res?.code === -111)
        toast.warning(tl('favorites.need_login'))
      else
        toast.error(tl('favorites.delete_failed'))
      return
    }

    if (wasSelected) {
      // 当前夹被删：清掉旧内容，避免刷新期间短暂显示已删除夹的视频
      favoriteResources.length = 0
      noMoreContent.value = false
      hasLoadedOnce.value = false
    }
    await syncSelectionAfterManage()
    toast.success(tl('favorites.delete_ok'))
  }
  catch {
    toast.error(tl('favorites.delete_failed'))
  }
  finally {
    categoryPendingId.value = null
  }
}

function handleSearch() {
  if (!selectedCategory.value)
    return
  currentPageNum.value = 1
  favoriteResources.length = 0
  noMoreContent.value = false
  hasLoadedOnce.value = false
  searchKeyword.value = filterKeyword.value.trim()

  getFavoriteResources(selectedCategory.value.id, currentPageNum.value, searchKeyword.value)
}

function handlePlayAll() {
  openLinkToNewTab(`https://www.bilibili.com/list/ml${selectedCategory.value?.id}`)
}

function jumpToLoginPage() {
  location.href = 'https://passport.bilibili.com/login'
}

function handleUnfavorite(favoriteResource: FavoriteResource) {
  const result = confirm(
    t('favorites.unfavorite_confirm'),
  )
  if (result) {
    api.favorite.patchDelFavoriteResources({
      resources: `${favoriteResource.id}:${favoriteResource.type}`,
      media_id: selectedCategory.value?.id,
      csrf: getCSRF(),
    }).then((res) => {
      if (res.code === 0)
        favoriteResources.splice(favoriteResources.indexOf(favoriteResource as FavoriteItem), 1)
    })
  }
}

function isMusic(item: FavoriteResource) {
  return item.link.includes('bilibili://music')
}

const categoryChips = computed<Array<ListCategoryChip>>(() => favoriteCategories.map(item => ({
  id: item.id,
  title: item.title,
  count: item.media_count,
})))

const heroCover = computed(() => {
  if (!activatedCategoryCover.value)
    return ''
  return `${removeHttpFromUrl(activatedCategoryCover.value)}@480w_270h_1c`
})

const subtitle = computed(() => tl('favorites.subtitle', {
  name: selectedCategory.value?.title ?? '',
  count: favoriteResources.length,
}))

const cards = computed<Array<ListCardItem>>(() => {
  const keyword = filterKeyword.value.trim().toLowerCase()
  const items = keyword
    ? favoriteResources.filter(item => matchesKeyword(item, keyword))
    : [...favoriteResources]
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

/** 列表页离屏优化（复用动态页开关 settings.momentsOptimizeEnabled，关闭即完全退回原渲染） */
useListVirtual({
  count: () => cards.value.length,
  layoutKey: () => `${viewMode.value}:${sortMode.value}:${filterKeyword.value}`,
})

/** 滚动位置记忆：浏览器「返回」时按最近卡片锚点恢复（第 20 轮） */
useListScrollMemory({
  scope: 'favorites',
  count: () => cards.value.length,
})

const sortNote = computed(() => (showsTimeGroup.value
  ? ''
  : tl('sort.note', {
      dim: tl(`sort.${sortMode.value}`),
      count: cards.value.length,
    })))

const showSkeleton = computed(() => cards.value.length === 0 && (!hasLoadedOnce.value || isLoading.value))
const showEmpty = computed(() => cards.value.length === 0 && hasLoadedOnce.value && !isLoading.value)

// 清空过滤词时回到完整收藏内容（若当前处于服务端搜索结果中）
watch(filterKeyword, (value) => {
  if (value.trim() || !searchKeyword.value || !selectedCategory.value)
    return
  handleSearch()
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
    icon: 'i-mingcute:star-line',
    title: tl('favorites.empty_title'),
    description: tl('favorites.empty_desc'),
  }
})

function matchesKeyword(item: FavoriteItem, keyword: string): boolean {
  const haystack = [item.title, item.upper?.name, item.intro]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(keyword)
}

function getFavoriteUrl(item: FavoriteItem): string {
  if (isMusic(item as unknown as FavoriteResource))
    return `https://www.bilibili.com/audio/au${item.id}`
  if (item.bvid)
    return `https://www.bilibili.com/video/${item.bvid}`
  return item.link || ''
}

function toCard(item: FavoriteItem): ListCardItem {
  const music = isMusic(item as unknown as FavoriteResource)
  const url = getFavoriteUrl(item)
  const timestamp = item.fav_time
    ? item.fav_time * 1000
    : undefined

  const actions: ListQuickActionId[] = []
  if (!music)
    actions.push('watchLater')
  actions.push('copy', 'unfavorite')

  return {
    key: item.id,
    video: {
      id: item.id,
      title: item.title,
      cover: item.cover,
      duration: item.duration,
      url,
      author: {
        name: item.upper?.name,
        authorFace: item.upper?.face ?? '',
        mid: item.upper?.mid,
      },
      view: item.cnt_info?.play,
      danmaku: item.cnt_info?.danmaku,
      publishedTimestamp: item.pubtime || undefined,
      bvid: music ? undefined : item.bvid,
      // 收藏接口只在 ugc.first_cid 里给出 cid，音频没有，直接透传（不会为此新增请求）
      cid: music
        ? undefined
        : (item.ugc?.first_cid || undefined),
      threePointV2: [],
    },
    copyUrl: url,
    timestamp,
    timeLabel: timestamp
      ? formatTimeLabel(timestamp)
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
  const item = card.raw as FavoriteItem | undefined
  if (!item || isMusic(item as unknown as FavoriteResource))
    return

  api.watchlater.saveToWatchLater({
    aid: item.id,
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

function handleCardAction(payload: { id: ListQuickActionId, item: ListCardItem }) {
  if (payload.id === 'copy') {
    copyCardLink(payload.item)
  }
  else if (payload.id === 'unfavorite') {
    const raw = payload.item.raw as FavoriteItem | undefined
    if (raw)
      handleUnfavorite(raw as unknown as FavoriteResource)
  }
  else if (payload.id === 'watchLater') {
    saveToWatchLater(payload.item)
  }
}
</script>

<template>
  <div class="bewly-list-page">
    <template v-if="loggedIn">
      <ListPageHeader :title="t('dock.favorites')" :subtitle="subtitle" :cover="heroCover">
        <template #actions>
          <Button type="primary" size="small" @click="handlePlayAll">
            <template #left>
              <div i-tabler:player-play />
            </template>
            {{ t('common.play_all') }}
          </Button>
        </template>
      </ListPageHeader>

      <ListCategoryChips
        :categories="categoryChips"
        :selected-id="selectedCategory?.id"
        manageable
        :pending-id="categoryPendingId"
        :create-pending="categoryCreatePending"
        @select="handleCategorySelect"
        @rename="handleCategoryRename"
        @delete="handleCategoryDelete"
        @create="handleCategoryCreate"
      />

      <ListToolbar
        ref="toolbarRef"
        v-model:view-mode="viewMode"
        v-model:sort-mode="sortMode"
        v-model:filter-keyword="filterKeyword"
        :title="selectedCategory?.title"
        :count="cards.length"
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
