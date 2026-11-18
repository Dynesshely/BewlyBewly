<script setup lang="ts">
/**
 * 动态页（自绘）的页面壳：顶部 tab（全部 / 视频 / 番剧 / 专栏）+ 动态列表 + 无限滚动。
 *
 * # 数据
 *
 * props 里的 `initialItems` 是 mount.ts 预取的第 1 页（默认 tab）；
 * 之后翻页 / 切 tab 都由 `fetchDynamicFeed` 自己拉（见 fetcher.ts）。
 *
 * # 翻页游标（真机踩过的坑）
 *
 * 接口的分页**必须带上一页返回的 `offset`**：只传 `page=2` 时返回内容与第 1 页
 * 完全相同（真机逐条比对 20/20 重叠）。所以游标是「页码 + offset」二元组，
 * 存在 `offsetRef` 里，每次请求成功后更新。`has_more` 为 false 时停止。
 *
 * # 四个 tab 的错误语义不同
 *
 * 番剧频道真机恒返回 `4101132`（原生页面自己切过去也是 0 条），
 * 它被翻译成 `DynamicEmptyChannelError` → 显示「该频道暂无内容」的**空态**，
 * 而不是错误态 —— 报错并让用户「重试」一个必然失败的请求是误导。
 */
import type { DynamicTabId } from './constants'
import type { DynamicItem, DynamicPageBridge } from './types'
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import EmptyState from '~/components/Feedback/EmptyState.vue'
import ErrorState from '~/components/Feedback/ErrorState.vue'
import { useBewlyApp } from '~/composables/useAppProvider'
import { useListPageActions } from '~/composables/useListPageActions'
import { settings } from '~/logic'
import { resolveModuleLocale } from '~/utils/moduleI18n'
import DynamicCard from './components/DynamicCard.vue'
import DynamicSkeleton from './components/DynamicSkeleton.vue'
import { DYNAMIC_PAGE_BRIDGE_KEY, DYNAMIC_SKELETON_COUNT } from './constants'
import { DynamicEmptyChannelError, fetchDynamicFeed } from './fetcher'
import { useDynamicI18n } from './i18n'
import { buildDynamicTabUrl, hasMorePages, toDynamicItems } from './utils'

const props = defineProps<{
  /** mount.ts 预取的第 1 页（已按当前 tab 拉取） */
  initialItems: DynamicItem[]
  /** 预取时的 tab */
  initialTab: DynamicTabId
  /** 预取第 1 页时接口给的游标（翻第 2 页必须原样带上，见文件头说明） */
  initialOffset?: string
  /** 预取第 1 页时接口给的 has_more */
  initialHasMore?: boolean
}>()

const { t } = useDynamicI18n()
const { haveScrollbar, scrollbarRef } = useBewlyApp()

/** 哨兵提前量：离底部还有 800px 就开始取下一页（动态卡很高，提前量要大一点） */
const SENTINEL_MARGIN = '800px'
/** 首屏自动补页次数上限（安全阀，防止容器高度算不出来时无限自动翻页） */
const AUTO_FILL_LIMIT = 3

const tab = ref<DynamicTabId>(props.initialTab)
const items = ref<DynamicItem[]>([...props.initialItems])
/** 当前页返回的游标（下一页要原样带回去） */
const offset = ref<string | undefined>(props.initialOffset)
/** 已加载页码 */
const page = ref<number>(1)
const isLoading = ref<boolean>(false)
/** 是否已经到底（初始值取预取时接口给的 has_more） */
const noMore = ref<boolean>(!props.initialHasMore || props.initialItems.length === 0)
const errorMessage = ref<string>('')
/** 当前 tab 是「该频道本来就没有内容」（番剧频道真机恒定 4101132） */
const isEmptyChannel = ref<boolean>(false)
const autoFillAttempts = ref<number>(0)

const sentinelRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const tabOptions = computed(() => [
  { id: 'all' as DynamicTabId, label: t.value.tabAll },
  { id: 'video' as DynamicTabId, label: t.value.tabVideo },
  { id: 'pgc' as DynamicTabId, label: t.value.tabPgc },
  { id: 'article' as DynamicTabId, label: t.value.tabArticle },
])

const nativeUrl = computed(() => buildDynamicTabUrl(tab.value))

/**
 * 当前界面语言（归一化函数需要它来格式化计数单位）。
 *
 * 不缓存成常量：用户可能在设置里切语言，每次调用现取最新值。
 */
function resolveLocale() {
  return resolveModuleLocale(settings.value.language)
}

function resetState(next: DynamicTabId): void {
  tab.value = next
  items.value = []
  offset.value = undefined
  page.value = 1
  noMore.value = false
  errorMessage.value = ''
  isEmptyChannel.value = false
  autoFillAttempts.value = 0
}

/** 拉第 `next` 页并追加 */
async function loadMore(): Promise<void> {
  // errorMessage 非空时不自动重试：否则错误态下哨兵每次进入视口都会再打一次请求，
  // 变成无限重试洪流。重试只走按钮（它会先清空 errorMessage）。
  if (isLoading.value || noMore.value || errorMessage.value || isEmptyChannel.value)
    return

  isLoading.value = true
  const currentTab = tab.value
  try {
    const next = page.value + 1
    const result = await fetchDynamicFeed(currentTab, next, offset.value)
    // 请求期间用户可能切了 tab：这批数据属于旧 tab，直接丢弃
    if (tab.value !== currentTab)
      return
    const existingIds = new Set(items.value.map(item => item.id))
    const appended = toDynamicItems(result.items, resolveLocale(), existingIds)
    items.value = [
      ...items.value,
      ...appended,
    ]
    offset.value = result.offset
    page.value = next
    noMore.value = !hasMorePages(result.hasMore, result.items.length)
  }
  catch (error) {
    if (tab.value !== currentTab)
      return
    if (error instanceof DynamicEmptyChannelError) {
      isEmptyChannel.value = true
    }
    else {
      errorMessage.value = error instanceof Error
        ? error.message
        : String(error)
    }
  }
  finally {
    isLoading.value = false
  }

  // 首屏 / 补页没填满一屏时继续补，避免「到底了但页面是空的」
  if (!noMore.value && !errorMessage.value && !isEmptyChannel.value && autoFillAttempts.value < AUTO_FILL_LIMIT) {
    const scrollable = await haveScrollbar()
    if (!scrollable) {
      autoFillAttempts.value += 1
      void loadMore()
    }
  }
}

/** 追加失败的重试：保留已有列表，只重试下一页 */
function retryNext(): void {
  errorMessage.value = ''
  void loadMore()
}

/** 整表重置并重拉第 1 页（tab 切换 / 覆盖层刷新按钮都走它） */
async function reload(nextTab?: DynamicTabId): Promise<void> {
  const target = nextTab ?? tab.value
  // 切 tab 时先把 UI 状态切过去，骨架立刻出现（不等请求回来）
  if (nextTab && nextTab !== tab.value)
    resetState(nextTab)
  else
    items.value = []

  isLoading.value = true
  try {
    const result = await fetchDynamicFeed(target, 1)
    if (tab.value !== target)
      return
    items.value = toDynamicItems(result.items, resolveLocale())
    offset.value = result.offset
    page.value = 1
    noMore.value = !hasMorePages(result.hasMore, result.items.length)
    errorMessage.value = ''
    isEmptyChannel.value = false
  }
  catch (error) {
    if (tab.value !== target)
      return
    if (error instanceof DynamicEmptyChannelError) {
      isEmptyChannel.value = true
    }
    else {
      errorMessage.value = error instanceof Error
        ? error.message
        : String(error)
    }
  }
  finally {
    isLoading.value = false
  }

  if (!noMore.value && !errorMessage.value && !isEmptyChannel.value && autoFillAttempts.value < AUTO_FILL_LIMIT) {
    const scrollable = await haveScrollbar()
    if (!scrollable) {
      autoFillAttempts.value += 1
      void loadMore()
    }
  }
}

/** 切 tab：改地址栏（刷新 / 前进后退能还原），再重拉第 1 页 */
function selectTab(next: DynamicTabId): void {
  if (next === tab.value)
    return
  const url = buildDynamicTabUrl(next)
  if (location.pathname + location.search !== url)
    history.pushState({}, '', url)
  void reload(next)
}

// 把方法写进 mount.ts 注入的通道：路由变化（后退 / 切 tab）由它驱动，不依赖
// app.mount() 的返回值（那是公共实例代理，读 defineExpose 属于 Vue 内部实现细节）
const bridge = inject<DynamicPageBridge | null>(DYNAMIC_PAGE_BRIDGE_KEY, null)
if (bridge) {
  bridge.selectTab = (next: DynamicTabId) => selectTab(next)
  bridge.reload = () => void reload()
}

onMounted(() => {
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
  refresh: () => reload(),
})

defineExpose({ reload, loadMore, selectTab, bridge })
</script>

<template>
  <div class="dynamic-page" :data-bewly-dynamic-tab="tab">
    <div class="dynamic-tabs" role="tablist" :aria-label="t.tabsAria">
      <button
        v-for="option in tabOptions"
        :key="option.id"
        class="dynamic-tabs__tab"
        :class="{ 'is-active': option.id === tab }"
        type="button"
        role="tab"
        :aria-selected="option.id === tab"
        @click="selectTab(option.id)"
      >
        {{ option.label }}
      </button>
    </div>

    <section class="dynamic-feed">
      <div v-if="items.length" class="dynamic-feed__items">
        <DynamicCard v-for="item in items" :key="item.id" :item="item" />
      </div>

      <!-- 首屏骨架（mount.ts 已预取第一页，正常看不到；切 tab / 刷新后短暂出现） -->
      <DynamicSkeleton v-else-if="isLoading" :count="DYNAMIC_SKELETON_COUNT" />

      <!-- 番剧频道：接口恒 4101132（原生页面也是 0 条）→ 空态，不是错误态 -->
      <EmptyState
        v-else-if="isEmptyChannel"
        :title="t.emptyTitle"
        :description="t.emptyDescription"
        icon="i-mingcute:tv-line"
      />

      <ErrorState
        v-else-if="errorMessage"
        :title="t.errorTitle"
        :message="errorMessage"
        :retry-label="t.retry"
        @retry="reload()"
      >
        <a class="dynamic-feed__link" :href="nativeUrl">
          {{ t.errorNative }}
        </a>
      </ErrorState>

      <EmptyState v-else :title="t.emptyTitle" :description="t.emptyDescription" />

      <!-- 追加失败的提示 + 重试（保留已有列表） -->
      <p v-if="items.length && errorMessage" class="dynamic-feed__error" role="alert">
        {{ errorMessage }}
        <button class="dynamic-feed__retry" type="button" @click="retryNext">
          {{ t.retry }}
        </button>
      </p>

      <!-- 哨兵：无限滚动的触发点 -->
      <div ref="sentinelRef" class="dynamic-feed__sentinel" aria-hidden="true" />

      <p v-if="isLoading && items.length" class="dynamic-feed__loading" role="status">
        {{ t.loading }}
      </p>

      <!-- 有追加错误时不显示「加载更多」：此时 loadMore 会被错误态短路，点了没反应 -->
      <button
        v-if="items.length && !noMore && !isLoading && !errorMessage"
        class="dynamic-feed__more"
        type="button"
        @click="loadMore"
      >
        {{ t.loadMore }}
      </button>

      <p v-if="items.length && noMore" class="dynamic-feed__end" role="status">
        {{ t.end }}
      </p>
    </section>
  </div>
</template>
