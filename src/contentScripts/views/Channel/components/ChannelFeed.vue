<script setup lang="ts">
/**
 * 分区视频卡片网格 + 无限滚动。
 *
 * 数据：`GET /x/web-interface/region/feed/rcmd`（真机同款，见 `fetcher.ts`），
 * 每页 15 条（真机原生 5 列 × 3 行），`display_id` 从 2 开始逐页 +1。
 *
 * 无限滚动做两条路，任一条生效即可：
 *   1. `IntersectionObserver` 监听列表末尾的哨兵，`root` 是覆盖层自己的滚动容器
 *      （`useBewlyApp().scrollbarRef`，由 `mount.ts` 注入）—— 这是主路径；
 *   2. 底部「加载更多」按钮 —— 兜底：`IntersectionObserver` 不可用、或用户把
 *      「滚动加载」关了、或哨兵被 `display:none` 顶掉时仍能翻页。
 * 另外首屏不足一屏时会自动再补一页（与 `views/Popular` 的 `haveScrollbar()` 一致），
 * 避免「看起来没有内容」。
 */
import type { RegionArchive } from '../types'
import EmptyState from '~/components/Feedback/EmptyState.vue'
import ErrorState from '~/components/Feedback/ErrorState.vue'
import VideoCard from '~/components/VideoCard/VideoCard.vue'
import { useBewlyApp } from '~/composables/useAppProvider'
import { useListPageActions } from '~/composables/useListPageActions'
import { FEED_FIRST_DISPLAY_ID } from '../constants'
import { fetchRegionFeed } from '../fetcher'
import { useChannelI18n } from '../i18n'
import { appendArchives, toVideoCard } from '../utils'

const props = defineProps<{
  /** 分区 feed 编号（真机里动画 = 1005，见 dom.ts 的 discoverFromRegion） */
  fromRegion: number
  /** `mount.ts` 预取好的第一页 */
  initial: RegionArchive[]
}>()

const { t } = useChannelI18n()
const { haveScrollbar, scrollbarRef } = useBewlyApp()

const SKELETON_COUNT = 15
/** 哨兵提前量：离底部还有 600px 就开始取下一页，滚起来不卡顿 */
const SENTINEL_MARGIN = '600px'
/** 首屏自动补页的次数上限（安全阀，见 loadMore 尾部说明） */
const AUTO_FILL_LIMIT = 5

const archives = ref<RegionArchive[]>(props.initial)
const isLoading = ref<boolean>(false)
const noMore = ref<boolean>(false)
const errorMessage = ref<string>('')
/** 下一页要请求的 `display_id`（第一页是 2，所以下一页是 3） */
const nextDisplayId = ref<number>(FEED_FIRST_DISPLAY_ID + 1)
/** 首屏「自动补页」已尝试次数（安全阀，见到 AUTO_FILL_LIMIT 就停，改由滚动 / 按钮触发） */
const autoFillAttempts = ref<number>(0)

const sentinelRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

/** 原生页地址：错误态里的「在原版页面打开」用它 */
const nativeUrl = computed(() => window.location.href)

async function loadMore() {
  if (isLoading.value || noMore.value)
    return

  isLoading.value = true
  try {
    const page = await fetchRegionFeed(props.fromRegion, nextDisplayId.value)
    if (page.noMore) {
      noMore.value = true
      return
    }
    archives.value = appendArchives(archives.value, page.archives)
    nextDisplayId.value += 1
    errorMessage.value = ''
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
  // `autoFillAttempts` 是安全阀：接口一直返回满页、而容器高度又算不出来时，
  // 无限自动补页会把请求打爆（人工滚动触发的那条路径不受它限制）。
  if (!noMore.value && !errorMessage.value && !isLoading.value && autoFillAttempts.value < AUTO_FILL_LIMIT) {
    const scrollable = await haveScrollbar()
    if (!scrollable) {
      autoFillAttempts.value += 1
      void loadMore()
    }
  }
}

/** 重试：保留已有列表，只重试下一页 */
function retry() {
  errorMessage.value = ''
  void loadMore()
}

/** 整页刷新（覆盖层的「刷新」动作）：回到第一页重新拉 */
function refresh() {
  archives.value = []
  nextDisplayId.value = FEED_FIRST_DISPLAY_ID
  noMore.value = false
  errorMessage.value = ''
  autoFillAttempts.value = 0
  void loadMore()
}

onMounted(() => {
  // 首屏不足一屏时补页
  void (async () => {
    const scrollable = await haveScrollbar()
    if (!scrollable) {
      autoFillAttempts.value += 1
      void loadMore()
    }
  })()

  if (typeof IntersectionObserver === 'undefined')
    return
  observer = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting))
      void loadMore()
  }, {
    root: (scrollbarRef.value as HTMLElement | null) ?? null,
    rootMargin: SENTINEL_MARGIN,
  })
  if (sentinelRef.value)
    observer.observe(sentinelRef.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

useListPageActions({
  isLoading,
  noMoreContent: noMore,
  reachBottom: () => loadMore(),
  refresh: () => refresh(),
})
</script>

<template>
  <section class="channel-feed">
    <div v-if="archives.length" class="channel-feed__grid">
      <VideoCard
        v-for="archive in archives"
        :key="archive.bvid || archive.aid"
        :video="toVideoCard(archive)"
        show-preview
      />
    </div>

    <!-- 首屏骨架（`mount.ts` 已预取第一页，正常看不到；刷新后短暂出现） -->
    <div v-else-if="isLoading" class="channel-feed__grid" aria-hidden="true">
      <VideoCardSkeleton v-for="index in SKELETON_COUNT" :key="index" />
    </div>

    <ErrorState
      v-else-if="errorMessage"
      :title="t.errorTitle"
      :message="errorMessage"
      :retry-label="t.retry"
      :fallback-hint="t.errorFallbackHint"
      @retry="refresh"
    >
      <a class="channel-feed__link" :href="nativeUrl">
        {{ t.errorNative }}
      </a>
    </ErrorState>

    <!-- 空态：给「去热门」与「原版页面」两条明确出路，而不是只留一句说明 -->
    <EmptyState v-else :title="t.emptyTitle" :description="t.emptyDescription">
      <a class="channel-feed__link" href="https://www.bilibili.com/v/popular/all">
        {{ t.emptyPopular }}
      </a>
      <a class="channel-feed__link" :href="nativeUrl">
        {{ t.emptyNative }}
      </a>
    </EmptyState>

    <!-- 追加失败的提示 + 重试（保留已有列表） -->
    <p v-if="archives.length && errorMessage" class="channel-feed__error" role="alert">
      {{ errorMessage }}
      <button class="channel-feed__retry" type="button" @click="retry">
        {{ t.retry }}
      </button>
    </p>

    <!-- 哨兵：无限滚动的触发点 -->
    <div ref="sentinelRef" class="channel-feed__sentinel" aria-hidden="true" />

    <p v-if="isLoading && archives.length" class="channel-feed__loading" role="status">
      {{ t.loading }}
    </p>

    <button
      v-if="archives.length && !noMore && !isLoading"
      class="channel-feed__more"
      type="button"
      @click="loadMore"
    >
      {{ t.loadMore }}
    </button>

    <p v-if="archives.length && noMore" class="channel-feed__end" role="status">
      {{ t.emptyTitle }}
    </p>
  </section>
</template>
