/**
 * 视频卡片网格 + 无限滚动（自绘）。
 *
 * 数据：GET /x/space/wbi/arc/search（wbi 签名，见 fetcher.ts）。
 *
 * 无限滚动做两条路，任一条生效即可（与 views/Channel 的 ChannelFeed 同一套骨架）：
 *   1. IntersectionObserver 监听列表末尾的哨兵，root 是覆盖层自己的滚动容器
 *      （useBewlyApp().scrollbarRef，由 mount.ts 注入）—— 主路径；
 *   2. 底部「加载更多」按钮 —— 兜底：IntersectionObserver 不可用、或哨兵被
 *      display:none 顶掉时仍能翻页。
 *
 * 停止条件用接口给的 page.count（总投稿数）：pn > ceil(count / ps) 时不再请求；
 * 排序切换会整表重置并重拉第 1 页。
 */
<script setup lang="ts">
import type { SpaceSortId } from '../constants'
import type { ArcSearchItem } from '../types'
import type { SpaceUpBrief } from '../utils'
import EmptyState from '~/components/Feedback/EmptyState.vue'
import ErrorState from '~/components/Feedback/ErrorState.vue'
import VideoCard from '~/components/VideoCard/VideoCard.vue'
import VideoCardSkeleton from '~/components/VideoCard/VideoCardSkeleton.vue'
import { useBewlyApp } from '~/composables/useAppProvider'
import { useListPageActions } from '~/composables/useListPageActions'
import { SPACE_PAGE_SIZE, SPACE_SKELETON_COUNT } from '../constants'
import { fetchSpaceVideos } from '../fetcher'
import { useSpaceI18n } from '../i18n'
import { appendVideos, hasMorePages, toVideoCard } from '../utils'

const props = defineProps<{
  mid: number
  /** 当前排序（由 SpacePage 的 tab 控制） */
  sort: SpaceSortId
  /** mount.ts 预取的第一页 */
  initial: ArcSearchItem[]
  /** 接口给的总投稿数（0 表示接口没给） */
  initialTotal: number
  /** 当前页面 UP 的最小信息（补 arc/search 不返回的头像） */
  up: SpaceUpBrief
}>()

const { t } = useSpaceI18n()
const { haveScrollbar, scrollbarRef } = useBewlyApp()

/** 哨兵提前量：离底部还有 600px 就开始取下一页，滚起来不卡顿 */
const SENTINEL_MARGIN = '600px'
/** 首屏自动补页的次数上限（安全阀，见 loadMore 尾部说明） */
const AUTO_FILL_LIMIT = 5

const videos = ref<ArcSearchItem[]>([...props.initial])
const total = ref<number>(props.initialTotal)
/** 已加载的页码（下一页 = page + 1） */
const page = ref<number>(1)
const isLoading = ref<boolean>(false)
/**
 * 是否已经到底。
 *
 * 初始值就按预取的第一页算一次：投稿数不超过一页时（count <= ps）第一次渲染就应显示
 * 「没有更多了」，而不是等用户滚到底再发一次必然为空的请求。
 */
const noMore = ref<boolean>(
  props.initial.length === 0
  || !hasMorePages(1, SPACE_PAGE_SIZE, props.initialTotal, props.initial.length),
)
const errorMessage = ref<string>('')
/** 首屏「自动补页」已尝试次数 */
const autoFillAttempts = ref<number>(0)

const sentinelRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

/** 原生页地址：错误态里的「在原版页面打开」用它 */
const nativeUrl = computed(() => `https://space.bilibili.com/${props.mid}`)
/** 卡片数据：接口条目 → VideoCard 结构（封面补全绝对地址） */
const cards = computed(() => videos.value.map(item => toVideoCard(item, props.up)))

async function loadMore() {
  // errorMessage 非空时不自动重试：否则错误态下哨兵每次进入视口都会再打一次请求，
  // 变成无限重试洪流。重试只走「加载更多 / 重试」按钮（它们会先清空 errorMessage）。
  if (isLoading.value || noMore.value || errorMessage.value)
    return

  isLoading.value = true
  try {
    const next = page.value + 1
    const result = await fetchSpaceVideos(props.mid, props.sort, next)
    videos.value = appendVideos(videos.value, result.items)
    if (result.total > 0)
      total.value = result.total
    page.value = next
    errorMessage.value = ''
    noMore.value = !hasMorePages(next, result.ps || SPACE_PAGE_SIZE, total.value, result.items.length)
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
  // autoFillAttempts 是安全阀：接口一直返回满页、而容器高度又算不出来时，
  // 无限自动补页会把请求打爆（人工滚动触发的那条路径不受它限制）。
  if (!noMore.value && !errorMessage.value && !isLoading.value && autoFillAttempts.value < AUTO_FILL_LIMIT) {
    const scrollable = await haveScrollbar()
    if (!scrollable) {
      autoFillAttempts.value += 1
      void loadMore()
    }
  }
}

/** 追加失败的重试：保留已有列表，只重试下一页 */
function retryNext() {
  errorMessage.value = ''
  void loadMore()
}

/**
 * 整页重置并重拉第一页（排序切换 / 覆盖层刷新按钮都走它）。
 *
 * 第一页数据由 mount.ts 预取过，但排序切换后必须按新 order 重拉第 1 页；
 * 这里先清空列表让骨架出现，避免旧排序的内容闪在下面。
 *
 * `sortOverride`：父组件切排序时是「先改自己的状态、再调本方法」，此时本组件的
 * `props.sort` 还没更新（Vue 的 props 更新在下一拍），所以排序必须由调用方显式传进来，
 * 否则会拿着旧排序再拉一次第一页。不传则用当前 `props.sort`（覆盖层的刷新按钮走这条路）。
 */
async function reload(sortOverride?: SpaceSortId) {
  const sort = sortOverride ?? props.sort
  videos.value = []
  total.value = 0
  page.value = 1
  noMore.value = false
  errorMessage.value = ''
  autoFillAttempts.value = 0

  isLoading.value = true
  try {
    const result = await fetchSpaceVideos(props.mid, sort, 1)
    videos.value = result.items
    total.value = result.total
    noMore.value = !hasMorePages(1, result.ps || SPACE_PAGE_SIZE, result.total, result.items.length)
  }
  catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : String(error)
  }
  finally {
    isLoading.value = false
  }

  // 重置后首屏不足一屏同样补一页
  if (!noMore.value && !errorMessage.value && !isLoading.value) {
    const scrollable = await haveScrollbar()
    if (!scrollable) {
      autoFillAttempts.value += 1
      void loadMore()
    }
  }
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
  // 触底加载：错误态下也不重试（重试只走按钮），由 loadMore 内部的 errorMessage 短路保证
  reachBottom: () => loadMore(),
  // 覆盖层的「刷新」动作：按当前排序整页重拉
  refresh: () => reload(),
})

defineExpose({ reload, loadMore })
</script>

<template>
  <section class="space-grid">
    <div v-if="cards.length" class="space-grid__cards">
      <VideoCard
        v-for="card in cards"
        :key="card.bvid || card.aid"
        :video="card"
        show-preview
      />
    </div>

    <!-- 首屏骨架（mount.ts 已预取第一页，正常看不到；切排序 / 刷新后短暂出现） -->
    <div v-else-if="isLoading" class="space-grid__cards" aria-hidden="true">
      <VideoCardSkeleton v-for="index in SPACE_SKELETON_COUNT" :key="index" />
    </div>

    <ErrorState
      v-else-if="errorMessage"
      :title="t.errorTitle"
      :message="errorMessage"
      :retry-label="t.retry"
      @retry="reload()"
    >
      <a class="space-grid__link" :href="nativeUrl">
        {{ t.errorNative }}
      </a>
    </ErrorState>

    <EmptyState v-else :title="t.emptyTitle" :description="t.emptyDescription" />

    <!-- 追加失败的提示 + 重试（保留已有列表） -->
    <p v-if="cards.length && errorMessage" class="space-grid__error" role="alert">
      {{ errorMessage }}
      <button class="space-grid__retry" type="button" @click="retryNext">
        {{ t.retry }}
      </button>
    </p>

    <!-- 哨兵：无限滚动的触发点 -->
    <div ref="sentinelRef" class="space-grid__sentinel" aria-hidden="true" />

    <p v-if="isLoading && cards.length" class="space-grid__loading" role="status">
      {{ t.loading }}
    </p>

    <!-- 有追加错误时不显示「加载更多」：此时 loadMore 会被错误态短路，
         点了没反应；重试入口是上面那条行内错误提示的按钮 -->
    <button
      v-if="cards.length && !noMore && !isLoading && !errorMessage"
      class="space-grid__more"
      type="button"
      @click="loadMore"
    >
      {{ t.loadMore }}
    </button>

    <p v-if="cards.length && noMore" class="space-grid__end" role="status">
      {{ t.end }}
    </p>
  </section>
</template>
