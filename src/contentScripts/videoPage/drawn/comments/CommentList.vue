<script setup lang="ts">
/**
 * 自绘评论列表容器（第 110 轮）。
 *
 * 职责：
 *   - 排序 tab（按热度 / 按时间）；
 *   - 无限滚动（IntersectionObserver：距底部 200px 自动拉下一页）；
 *   - 首屏骨架 / 空态 / 错误态（可重试） / 加载更多失败的行内重试；
 *   - 「只看 UP 主」开关（筛选只作用在已加载条目上，不发额外请求）；
 *   - 底部评论输入框（原生输入框在接管后不可用，见 CommentComposer 的说明）。
 *
 * 数据全部来自 `./fetcher`，本组件**不读原生 DOM**。
 */
import type { CommentItem, CommentSort } from './types'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CommentComposer from './CommentComposer.vue'
import CommentThread from './CommentThread.vue'
import { fetchComments } from './fetcher'
import { fillTemplate, useCommentDrawnI18n } from './i18n'
import { formatCount } from './utils'

const props = defineProps<{
  /** 视频 aid（挂载层保证非 0 才会渲染本组件） */
  aid: number
  /** 首屏预取的条目（挂载层已请求过第一页，避免重复请求） */
  initialItems?: CommentItem[]
  initialTotal?: number | null
  initialHasMore?: boolean
  /** 初始排序 */
  initialSort?: CommentSort
  /** 骨架条数 */
  skeletonCount?: number
}>()

const emit = defineEmits<{
  /** 状态变化：挂载层据此知道排序 / 是否有 UP 主评论 */
  (e: 'state', payload: { sort: CommentSort, items: CommentItem[], hasMore: boolean, loading: boolean, failed: boolean }): void
}>()

const { t } = useCommentDrawnI18n()

const sort = ref<CommentSort>(props.initialSort ?? 'hot')
const items = ref<CommentItem[]>(props.initialItems ?? [])
const total = ref<number | null>(props.initialTotal ?? null)
const hasMore = ref(props.initialHasMore ?? true)
const loading = ref(false)
const failed = ref(false)
const errorMessage = ref('')
const page = ref((props.initialItems?.length ?? 0) > 0
  ? 1
  : 0)
/** 只看 UP 主（由挂载层通过 defineExpose 设置） */
const onlyUp = ref(false)

const skeletonCount = computed(() => props.skeletonCount ?? 5)

/** 实际渲染的条目（只看 UP 主时过滤） */
const visibleItems = computed(() => onlyUp.value
  ? items.value.filter(item => item.isUp)
  : items.value)

/** 当前已加载条目里有没有 UP 主评论（挂载层据此启用 / 禁用开关） */
const hasUpComment = computed(() => items.value.some(item => item.isUp))

const totalText = computed(() => formatCount(total.value))

const sentinelRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

/** 通知挂载层同步状态 */
function publishState(): void {
  emit('state', {
    sort: sort.value,
    items: items.value,
    hasMore: hasMore.value,
    loading: loading.value,
    failed: failed.value,
  })
}

async function loadPage(nextPage: number): Promise<void> {
  if (loading.value || !props.aid)
    return
  loading.value = true
  failed.value = false
  errorMessage.value = ''
  publishState()
  try {
    const result = await fetchComments(props.aid, { sort: sort.value, page: nextPage })
    if (result.total !== null)
      total.value = result.total
    items.value = nextPage === 1
      ? result.items
      : [
          ...items.value,
          ...result.items.filter(next => !items.value.some(prev => prev.rpid === next.rpid)),
        ]
    page.value = nextPage
    hasMore.value = result.hasMore
    failed.value = false
  }
  catch (error) {
    failed.value = true
    errorMessage.value = (error as Error)?.message || t.value.errorTitle
  }
  finally {
    loading.value = false
    publishState()
  }
}

async function changeSort(next: CommentSort): Promise<void> {
  if (next === sort.value)
    return
  sort.value = next
  items.value = []
  page.value = 0
  hasMore.value = true
  failed.value = false
  errorMessage.value = ''
  await loadPage(1)
}

/** 错误态重试：首屏失败重拉第 1 页，加载更多失败重拉下一页 */
function retry(): void {
  if (!items.value.length) {
    void loadPage(1)
    return
  }
  void loadPage(page.value + 1 || 1)
}

/**
 * 只看 UP 主开关。
 *
 * 只在**已加载的条目**里过滤（不发额外请求）：B 站没有「只看 UP」的接口参数，
 * 上一版 `commentList.ts` 是靠连拉 5 页找 UP 评论，代价高且不稳定。
 * 加载更多时新条目会自动带上 UP 标记，过滤是持续的。
 */
function toggleOnlyUp(): void {
  if (!onlyUp.value && !hasUpComment.value)
    return
  onlyUp.value = !onlyUp.value
}

/** 输入框发表成功：重新拉第一页（拿到服务端返回的完整字段，含置顶 / UP 标记） */
async function onPosted(): Promise<void> {
  await loadPage(1)
}

function connectObserver(): void {
  if (typeof IntersectionObserver === 'undefined')
    return
  const target = sentinelRef.value
  if (!target)
    return
  observer?.disconnect()
  observer = new IntersectionObserver((records) => {
    if (!records.some(record => record.isIntersecting))
      return
    if (loading.value || !hasMore.value || failed.value)
      return
    void loadPage(page.value + 1 || 1)
  }, { rootMargin: '200px 0px' })
  observer.observe(target)
}

onMounted(async () => {
  if (!items.value.length)
    await loadPage(1)
  connectObserver()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

watch(() => props.aid, async () => {
  items.value = []
  page.value = 0
  hasMore.value = true
  failed.value = false
  await loadPage(1)
})

// 条目数量变化后 sentinel 可能被移动，重新挂观察器
watch(() => visibleItems.value.length, () => {
  if (hasMore.value)
    connectObserver()
})

/** 供挂载层调用（commentDrawn.ts → comments.ts 的三个导出 / 快捷键 / e2e） */
defineExpose({
  /** 切换排序（等价于点 tab，不弹 toast） */
  setSort: (next: CommentSort) => changeSort(next),
  /** 只看 UP 主开关 */
  setOnlyUp: (on: boolean) => {
    if (on && !hasUpComment.value)
      return
    onlyUp.value = on
  },
  toggleOnlyUp,
  isOnlyUp: () => onlyUp.value,
  getSort: () => sort.value,
  hasUpComment: () => hasUpComment.value,
  getItems: () => items.value,
  /** 重新拉第一页（切视频后由挂载层调用） */
  reload: async () => {
    items.value = []
    page.value = 0
    hasMore.value = true
    failed.value = false
    await loadPage(1)
  },
})
</script>

<template>
  <section class="bcd-list">
    <div class="bcd-list__toolbar">
      <div class="bcd-list__sort" role="tablist">
        <button
          type="button"
          role="tab"
          class="bcd-list__tab"
          :class="{ 'is-active': sort === 'hot' }"
          :aria-selected="sort === 'hot'"
          data-bcd-sort="hot"
          @click="changeSort('hot')"
        >
          {{ t.sortHot }}
        </button>
        <button
          type="button"
          role="tab"
          class="bcd-list__tab"
          :class="{ 'is-active': sort === 'latest' }"
          :aria-selected="sort === 'latest'"
          data-bcd-sort="latest"
          @click="changeSort('latest')"
        >
          {{ t.sortLatest }}
        </button>
      </div>
      <div class="bcd-list__spacer" />
      <button
        type="button"
        class="bcd-list__tab"
        :class="{ 'is-active': onlyUp }"
        :aria-pressed="onlyUp"
        :disabled="!hasUpComment"
        :title="hasUpComment ? (onlyUp ? t.onlyUpOn : t.onlyUpOff) : t.onlyUpUnavailable"
        data-bcd-onlyup
        @click="toggleOnlyUp"
      >
        {{ t.onlyUp }}
      </button>
      <span v-if="totalText" class="bcd-list__total">{{ fillTemplate(t.total, totalText) }}</span>
    </div>

    <div class="bcd-list__body">
      <!-- 首屏骨架 -->
      <div v-if="loading && !items.length" class="bcd-list__skeletons" aria-hidden="true">
        <div v-for="index in skeletonCount" :key="index" class="bcd-list__skeleton">
          <span class="bcd-list__skeleton-avatar" />
          <span class="bcd-list__skeleton-lines">
            <span class="bcd-list__skeleton-line is-title" />
            <span class="bcd-list__skeleton-line" />
            <span class="bcd-list__skeleton-line is-short" />
          </span>
        </div>
      </div>

      <!-- 错误态（首屏失败） -->
      <div v-else-if="failed && !items.length" class="bcd-list__state">
        <p class="bcd-list__state-title">
          {{ t.errorTitle }}
        </p>
        <p class="bcd-list__state-text">
          {{ errorMessage }}
        </p>
        <button type="button" class="bcd-list__retry" @click="retry">
          {{ t.retry }}
        </button>
      </div>

      <!-- 空态 -->
      <div v-else-if="!visibleItems.length" class="bcd-list__state">
        <p class="bcd-list__state-title">
          {{ onlyUp ? t.emptyUpTitle : t.emptyTitle }}
        </p>
        <p class="bcd-list__state-text">
          {{ onlyUp ? t.emptyUpDescription : t.emptyDescription }}
        </p>
      </div>

      <!-- 列表 -->
      <template v-else>
        <CommentThread
          v-for="item in visibleItems"
          :key="item.rpid"
          :item="item"
          :aid="aid"
        />
      </template>

      <div ref="sentinelRef" class="bcd-list__sentinel" aria-hidden="true" />

      <p v-if="loading && items.length" class="bcd-list__hint">
        {{ t.loadingMore }}
      </p>
      <p v-else-if="failed && items.length" class="bcd-list__hint">
        {{ errorMessage }}
        <button type="button" class="bcd-list__retry bcd-list__retry--inline" @click="retry">
          {{ t.retry }}
        </button>
      </p>
      <p v-else-if="items.length && !hasMore" class="bcd-list__hint">
        {{ t.noMore }}
      </p>
    </div>

    <!-- 自绘输入框：原生输入框在接管后拿不到（见 CommentComposer 顶部说明） -->
    <CommentComposer :aid="aid" @posted="onPosted" />
  </section>
</template>

<style scoped>
.bcd-list {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  width: 100%;
  min-height: 0;
}

.bcd-list__toolbar {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
}

.bcd-list__sort {
  display: flex;
  gap: 4px;
}

.bcd-list__tab {
  height: 24px;
  padding: 0 8px;
  font-size: 12.5px;
  line-height: 1;
  color: var(--bew-text-2);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 6px;
}

.bcd-list__tab:hover {
  background: var(--bew-fill-1);
}

.bcd-list__tab.is-active {
  color: var(--bew-theme-color, var(--bew-bili-blue, hsl(195 100% 42%)));
  background: var(--bew-fill-1);
}

.bcd-list__spacer {
  flex: 1 1 auto;
}

.bcd-list__total {
  font-size: 12px;
  color: var(--bew-text-3);
}

.bcd-list__tab:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.bcd-list__body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0 12px;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.bcd-list__state {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  padding: 40px 0;
  text-align: center;
}

.bcd-list__state-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--bew-text-2);
}

.bcd-list__state-text {
  font-size: 12.5px;
  color: var(--bew-text-3);
}

.bcd-list__retry {
  height: 28px;
  padding: 0 14px;
  font-size: 12.5px;
  color: var(--bew-text-2);
  cursor: pointer;
  background: var(--bew-fill-1);
  border: 0;
  border-radius: 14px;
}

.bcd-list__retry--inline {
  height: 22px;
  padding: 0 10px;
  margin-left: 6px;
}

.bcd-list__skeletons {
  display: flex;
  flex-direction: column;
}

.bcd-list__skeleton {
  display: flex;
  gap: 12px;
  padding: 12px 4px;
  border-bottom: 1px solid var(--bew-fill-1);
}

.bcd-list__skeleton-avatar {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  background: var(--bew-fill-1);
  border-radius: 50%;
}

.bcd-list__skeleton-lines {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 6px;
}

.bcd-list__skeleton-line {
  height: 12px;
  background: var(--bew-fill-1);
  border-radius: 4px;
}

.bcd-list__skeleton-line.is-title {
  width: 30%;
}

.bcd-list__skeleton-line.is-short {
  width: 60%;
}

.bcd-list__sentinel {
  height: 1px;
}

.bcd-list__hint {
  padding: 12px 0;
  font-size: 12.5px;
  color: var(--bew-text-3);
  text-align: center;
}
</style>
