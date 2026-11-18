/**
 * 首页推荐流卡片网格 + 无限滚动（自绘）。
 *
 * 数据：GET /x/web-interface/wbi/index/top/feed/rcmd（wbi 签名，见 fetcher.ts）。
 *
 * 无限滚动做两条路，任一条生效即可（与 views/Space 的 SpaceVideoGrid 同一套骨架）：
 *   1. IntersectionObserver 监听列表末尾的哨兵，root 是覆盖层自己的滚动容器
 *      （useBewlyApp().scrollbarRef，由 mount.ts 注入）—— 主路径；
 *   2. 底部「加载更多」按钮 —— 兜底：IntersectionObserver 不可用，
 *      或哨兵被某个 display:none 顶掉时仍能翻页。
 *
 * 停止条件：接口**没有**「到底」信号（真机翻 30 页不断流、不重复），
 * 因此「无更多时停止」靠「这一页过滤后一条都没有」+ 单次会话上限（constants.HOME_MAX_PAGES）。
 *
 * 每张卡外层包一个 [data-bewly-home-card] 的 div（属性值 = bvid / 直播房间号）：
 * 滚动位置记忆靠它做锚点（见 scrollMemory.ts），也方便真机断言卡片数量。
 */
<script setup lang="ts">
import type { HomeFeedItem } from '../types'
import EmptyState from '~/components/Feedback/EmptyState.vue'
import ErrorState from '~/components/Feedback/ErrorState.vue'
import VideoCard from '~/components/VideoCard/VideoCard.vue'
import VideoCardSkeleton from '~/components/VideoCard/VideoCardSkeleton.vue'
import { useBewlyApp } from '~/composables/useAppProvider'
import { useListPageActions } from '~/composables/useListPageActions'
import { HOME_MAX_PAGES, HOME_SKELETON_COUNT } from '../constants'
import { fetchHomeFeed } from '../fetcher'
import { useHomeDrawnI18n } from '../i18n'
import {
  restoreHomeDrawnScroll,
  saveHomeDrawnScroll,
  takeHomeDrawnScroll,
} from '../scrollMemory'
import { appendItems, hasMorePages, nextFreshIdx, toVideoCard, videoKey } from '../utils'

const props = defineProps<{
  /** mount.ts 预取的前两页（已过滤广告） */
  initial: HomeFeedItem[]
  /** 预取结束时已经取到的 fresh_idx（下一页 = +1） */
  initialFreshIdx: number
}>()

const emit = defineEmits<{
  /** 已加载条数变化：页面壳据此显示「已加载 N 个视频」 */
  (e: 'count', value: number): void
}>()

const { t } = useHomeDrawnI18n()
const { haveScrollbar, scrollbarRef } = useBewlyApp()

/** 哨兵提前量：离底部还有 600px 就开始取下一页，滚起来不卡顿 */
const SENTINEL_MARGIN = '600px'
/** 首屏自动补页的次数上限（安全阀：容器高度算不出来时不至于无限请求） */
const AUTO_FILL_LIMIT = 4

const items = ref<HomeFeedItem[]>([...props.initial])
/** 已加载到的 fresh_idx（下一页 = +1） */
const freshIdx = ref<number>(props.initialFreshIdx)
const isLoading = ref<boolean>(false)
const noMore = ref<boolean>(!hasMorePages(props.initialFreshIdx, props.initial.length))
const errorMessage = ref<string>('')
const autoFillAttempts = ref<number>(0)

const sentinelRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
/** 进行中的滚动恢复清理函数 */
let cancelRestore: (() => void) | null = null
/** 滚动节流定时器（保存锚点用） */
let saveTimer: number | null = null

/**
 * 卡片数据：接口条目 → VideoCard 结构。
 *
 * 直播卡片传 `show-watcher-later=false`：直播没有「稍后再看」语义，
 * 而 VideoCard 的悬停操作条默认会渲染那个按钮 —— 点了只会 toast 失败（resolvable aid 为 null）。
 */
const cards = computed(() => items.value.map(item => ({
  key: videoKey(item),
  video: toVideoCard(item),
})))

const moreButtonVisible = computed(() =>
  cards.value.length > 0 && !noMore.value && !isLoading.value && !errorMessage.value,
)

watch(() => items.value.length, () => emit('count', items.value.length), { immediate: true })

async function loadMore() {
  // errorMessage 非空时不自动重试：否则错误态下哨兵每次进入视口都会再打一次请求，
  // 变成无限重试洪流。重试只走「加载更多 / 重试」按钮（它们会先清空 errorMessage）。
  if (isLoading.value || noMore.value || errorMessage.value)
    return

  isLoading.value = true
  try {
    const next = nextFreshIdx(freshIdx.value)
    const page = await fetchHomeFeed(next)
    const merged = appendItems(items.value, page.items)
    // 合并后没有新增（接口回的都是已展示过的）也视为「到底」，避免同一批内容反复拉
    const added = merged.length - items.value.length
    items.value = merged
    freshIdx.value = next
    errorMessage.value = ''
    noMore.value = !hasMorePages(next, page.items.length) || added === 0
  }
  catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : String(error)
  }
  finally {
    isLoading.value = false
  }

  // 首屏 / 补页没填满一屏时继续补，避免「到底了但没内容」。
  // autoFillAttempts 是安全阀（人工滚动触发的那条路径不受它限制）。
  if (!noMore.value && !errorMessage.value && !isLoading.value && autoFillAttempts.value < AUTO_FILL_LIMIT) {
    const scrollable = await haveScrollbar()
    if (!scrollable) {
      autoFillAttempts.value += 1
      await loadMore()
    }
  }
}

/** 追加失败的重试：保留已有列表，只重试下一页 */
function retryNext() {
  errorMessage.value = ''
  void loadMore()
}

/**
 * 整页重置并重拉第 1 页（顶部「刷新推荐」按钮走它）。
 *
 * 刷新是「重新开始」：列表清空 → 出现骨架 → 拉 fresh_idx=1，并回到顶部。
 */
async function reload() {
  items.value = []
  freshIdx.value = 0
  noMore.value = false
  errorMessage.value = ''
  autoFillAttempts.value = 0
  isLoading.value = true

  const shell = scrollbarRef.value as HTMLElement | null
  if (shell)
    shell.scrollTop = 0

  try {
    const page = await fetchHomeFeed(1)
    items.value = page.items
    freshIdx.value = page.freshIdx
    noMore.value = !hasMorePages(page.freshIdx, page.items.length)
  }
  catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : String(error)
  }
  finally {
    isLoading.value = false
  }

  if (!noMore.value && !errorMessage.value && !isLoading.value) {
    const scrollable = await haveScrollbar()
    if (!scrollable) {
      autoFillAttempts.value += 1
      await loadMore()
    }
  }
}

/** 节流保存滚动锚点（200ms，够用且不抖） */
function scheduleSave() {
  if (saveTimer !== null)
    return
  saveTimer = window.setTimeout(() => {
    saveTimer = null
    saveHomeDrawnScroll(scrollbarRef.value as HTMLElement | null)
  }, 200)
}

/** 首屏不足一屏时补页 */
async function fillFirstScreen() {
  const scrollable = await haveScrollbar()
  if (!scrollable) {
    autoFillAttempts.value += 1
    await loadMore()
  }
}

onMounted(async () => {
  const shell = scrollbarRef.value as HTMLElement | null
  if (shell)
    shell.addEventListener('scroll', scheduleSave, { passive: true })

  // 恢复上次离开时的位置（切走再回来）：必须等卡片渲染出来才有锚点可查，
  // 所以放到 nextTick 之后，并交给 scrollMemory 自己做重试。
  // takeHomeDrawnScroll 会消费掉记录（同一次停留只恢复一次），所以这里不用再判空。
  const anchor = takeHomeDrawnScroll()
  if (anchor) {
    await nextTick()
    cancelRestore = restoreHomeDrawnScroll(anchor, () => scrollbarRef.value as HTMLElement | null)
  }
  else {
    await fillFirstScreen()
  }

  if (typeof IntersectionObserver === 'undefined')
    return
  observer = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting))
      void loadMore()
  }, {
    root: shell ?? null,
    rootMargin: SENTINEL_MARGIN,
  })
  if (sentinelRef.value)
    observer.observe(sentinelRef.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  cancelRestore?.()
  cancelRestore = null
  const shell = scrollbarRef.value as HTMLElement | null
  if (shell)
    shell.removeEventListener('scroll', scheduleSave)
  if (saveTimer !== null) {
    window.clearTimeout(saveTimer)
    saveTimer = null
  }
  // 离开页面（切到视频页 / Dock 其它页）时记一下位置，回来能接上
  saveHomeDrawnScroll(shell)
})

useListPageActions({
  isLoading,
  noMoreContent: noMore,
  reachBottom: () => loadMore(),
  refresh: () => reload(),
})

defineExpose({ reload, loadMore })
</script>

<template>
  <section class="home-drawn-feed">
    <div v-if="cards.length" class="home-drawn-grid">
      <div
        v-for="card in cards"
        :key="card.key"
        class="home-drawn-grid__item"
        :data-bewly-home-card="card.key"
      >
        <VideoCard
          :video="card.video"
          :show-watcher-later="card.video.liveStatus !== 1"
          show-preview
          more-btn
        />
      </div>
    </div>

    <!-- 首屏骨架（mount.ts 已预取前两页，正常看不到；刷新后短暂出现） -->
    <div v-else-if="isLoading" class="home-drawn-grid" aria-hidden="true">
      <VideoCardSkeleton v-for="index in HOME_SKELETON_COUNT" :key="index" />
    </div>

    <ErrorState
      v-else-if="errorMessage"
      :title="t.errorTitle"
      :message="errorMessage"
      :retry-label="t.retry"
      @retry="reload()"
    >
      <a class="home-drawn-feed__link" href="https://www.bilibili.com/">
        {{ t.errorNative }}
      </a>
    </ErrorState>

    <EmptyState v-else :title="t.emptyTitle" :description="t.emptyDescription" />

    <!-- 追加失败的提示 + 重试（保留已有列表） -->
    <p v-if="cards.length && errorMessage" class="home-drawn-feed__error" role="alert">
      {{ errorMessage }}
      <button class="home-drawn-feed__retry" type="button" @click="retryNext">
        {{ t.retry }}
      </button>
    </p>

    <!-- 哨兵：无限滚动的触发点 -->
    <div ref="sentinelRef" class="home-drawn-feed__sentinel" aria-hidden="true" />

    <p v-if="isLoading && cards.length" class="home-drawn-feed__status" role="status">
      {{ t.loading }}
    </p>

    <!-- 有追加错误时不显示「加载更多」：此时 loadMore 会被错误态短路，
         点了没反应；重试入口是上面那条行内错误提示的按钮 -->
    <button
      v-if="moreButtonVisible"
      class="home-drawn-feed__more"
      type="button"
      @click="loadMore"
    >
      {{ t.loadMore }}
    </button>

    <p v-if="cards.length && noMore && freshIdx >= HOME_MAX_PAGES" class="home-drawn-feed__status" role="status">
      {{ t.reachedLimit }}
    </p>
    <p v-else-if="cards.length && noMore" class="home-drawn-feed__status" role="status">
      {{ t.end }}
    </p>
  </section>
</template>
