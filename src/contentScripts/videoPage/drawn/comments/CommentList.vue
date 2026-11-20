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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CommentComposer from './CommentComposer.vue'
import CommentThread from './CommentThread.vue'
import { createDanmakuOverlay, findDanmakuWrap } from './danmakuMove'
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

/**
 * 主面板：「评论」还是「弹幕」（第 128 轮）。
 *
 * 用户要求把原生「弹幕列表」和评论区做成同一个区域的两个标签页 ——
 * 弹幕列表是 B 站原生的折叠组件（懒加载），这里把它整块搬进 `.bcd-danmaku-slot`，
 * 切走时保持搬走状态（不反复搬，避免触发 B 站重新渲染）。
 */
type MainPanel = 'comments' | 'danmaku'
const PANEL_STORAGE_KEY = 'bewly-comment-panel'
const panel = ref<MainPanel>((() => {
  try {
    return sessionStorage.getItem(PANEL_STORAGE_KEY) === 'danmaku'
      ? 'danmaku'
      : 'comments'
  }
  catch {
    return 'comments'
  }
})())
/** 第 133 轮：fixed 定位覆盖层的句柄（不再搬 DOM） */
let danmakuOverlay: ReturnType<typeof createDanmakuOverlay> = null
const danmakuSlotRef = ref<HTMLElement | null>(null)
const danmakuState = ref<'idle' | 'moved' | 'missing'>('idle')

function switchPanel(next: MainPanel): void {
  panel.value = next
  try {
    sessionStorage.setItem(PANEL_STORAGE_KEY, next)
  }
  catch {
    // sessionStorage 不可用时忽略
  }
  if (next === 'danmaku') {
    void ensureDanmakuOverlay().then((ok) => {
      const slot = danmakuSlotRef.value
      if (ok && slot)
        danmakuOverlay?.show(slot)
    })
  }
  else {
    danmakuOverlay?.hide()
  }
}

/**
 * 重试 + DOM 观察（第 130 轮）。
 *
 * 真机诊断：`dataset.bewlyDanmakuMove` 停在 `not-found(try=20)` ——
 * 20 × 500ms = 10 秒内 `findDanmakuWrap()` 一直返回 null，
 * 但 30 秒后手动查同一批选择器**全部命中**。
 * 结论：弹幕容器比评论区晚很多才渲染（B 站在右列搬完 / 懒加载之后才插入），
 * 纯定时重试的窗口不够，而且固定轮询也不优雅。
 * 改成 **MutationObserver 监听 body 子树**：容器一出现就立刻搬，最多观察 90 秒。
 */
let danmakuRetryTimer: number | null = null
let danmakuObserver: MutationObserver | null = null
let danmakuRetryCount = 0
const DANMAKU_RETRY_MAX = 90
const DANMAKU_RETRY_INTERVAL = 1000

function stopDanmakuWatch(): void {
  if (danmakuRetryTimer !== null) {
    window.clearTimeout(danmakuRetryTimer)
    danmakuRetryTimer = null
  }
  danmakuObserver?.disconnect()
  danmakuObserver = null
}

function watchDanmakuArrival(): void {
  if (danmakuObserver || danmakuOverlay)
    return
  danmakuObserver = new MutationObserver(() => {
    if (danmakuOverlay || !danmakuSlotRef.value) {
      stopDanmakuWatch()
      return
    }
    if (findDanmakuWrap())
      void ensureDanmakuOverlay()
  })
  danmakuObserver.observe(document.body, { childList: true, subtree: true })
}

/**
 * 第 133 轮（路线 A）：改成**不搬 DOM**，只把弹幕列表用 fixed 定位覆盖到 slot 上。
 *
 * 搬 DOM 的五轮（128~132）已经证明走不通：better-scroll 虚拟列表在换父级后
 * 尺寸算成 257184px、偏移 1761px，整个列表被顶到视口外，纯 CSS 压不住。
 * 现在节点留在原位，只把它的**可视位置**搬过来，B 站的尺寸计算环境不变。
 */
async function ensureDanmakuOverlay(): Promise<boolean> {
  const dbg = (reason: string): void => {
    document.documentElement.dataset.bewlyDanmakuMove = reason
  }
  if (danmakuOverlay) {
    dbg('ready')
    return true
  }
  await nextTick()
  const created = createDanmakuOverlay()
  if (!created) {
    dbg(`not-found(try=${danmakuRetryCount})`)
    watchDanmakuArrival()
    if (danmakuRetryCount < DANMAKU_RETRY_MAX) {
      danmakuRetryCount += 1
      danmakuRetryTimer = window.setTimeout(() => {
        danmakuRetryTimer = null
        void ensureDanmakuOverlay().then((ok) => {
          if (ok && panel.value === 'danmaku')
            danmakuOverlay?.show(danmakuSlotRef.value as HTMLElement)
        })
      }, DANMAKU_RETRY_INTERVAL)
    }
    else {
      stopDanmakuWatch()
      danmakuState.value = 'missing'
    }
    return false
  }
  danmakuRetryCount = 0
  stopDanmakuWatch()
  danmakuOverlay = created
  danmakuState.value = 'moved'
  dbg('overlay-ready')
  return true
}

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
  // 第 133 轮：挂载时只**准备好**覆盖层（找到弹幕容器就行），不搬 DOM、不显示。
  // 真正显示发生在用户切到「弹幕」标签时（overlay.show(slot)）。
  if (panel.value === 'danmaku') {
    await ensureDanmakuOverlay().then((ok) => {
      const slot = danmakuSlotRef.value
      if (ok && slot)
        danmakuOverlay?.show(slot)
    })
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  stopDanmakuWatch()
  danmakuOverlay?.destroy()
  danmakuOverlay = null
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
    <!-- 主面板切换：评论 / 弹幕（第 128 轮） -->
    <div class="bcd-panel-tabs" role="tablist" :aria-label="t.total /* 借用现有文案占位 */">
      <button
        type="button"
        role="tab"
        class="bcd-panel-tab"
        :class="{ 'is-active': panel === 'comments' }"
        :aria-selected="panel === 'comments'"
        data-bcd-panel="comments"
        @click="switchPanel('comments')"
      >
        {{ t.commentsTab }}
      </button>
      <button
        type="button"
        role="tab"
        class="bcd-panel-tab"
        :class="{ 'is-active': panel === 'danmaku' }"
        :aria-selected="panel === 'danmaku'"
        data-bcd-panel="danmaku"
        @click="switchPanel('danmaku')"
      >
        {{ t.danmakuTab }}
      </button>
    </div>

    <div v-show="panel === 'comments'" class="bcd-list__toolbar">
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

    <div v-show="panel === 'comments'" class="bcd-list__body">
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

    <!-- 弹幕面板（第 128 轮）：原生弹幕列表整块搬进 `.bcd-danmaku-slot` -->
    <!-- v-show 而非 v-if：slot 必须一直在 DOM 里，mountDanmaku 在挂载时就要能塞进去 -->
    <div v-show="panel === 'danmaku'" class="bcd-danmaku-panel">
      <div ref="danmakuSlotRef" class="bcd-danmaku-slot" />
      <p v-if="danmakuState === 'missing'" class="bcd-list__state-text">
        {{ t.danmakuMissing }}
      </p>
    </div>

    <!-- 自绘输入框：原生输入框在接管后拿不到（见 CommentComposer 顶部说明） -->
    <CommentComposer v-show="panel === 'comments'" :aid="aid" @posted="onPosted" />
  </section>
</template>

<style scoped>
.bcd-list {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  width: 100%;
  /* 第 133 轮：必须占满父级高度。
     原来只写 flex: 1 1 auto，切到「弹幕」标签后 .bcd-list__body 被 v-show 隐藏，
     整个 .bcd-list 塌成 22px（只剩 tab 栏），弹幕面板的 flex 剩余高度就是 0，
     fixed 覆盖层被定位成 0 高（真机 panel: 820x0）。 */
  height: 100%;
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
  /* 底部留出发送区高度：发送区是 sticky 浮在滚动容器底部的，
     不留白的话最后一条评论会被它压住（第 112 轮真机截图可见） */
  padding: 0 12px 116px;
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

/* ===== 主面板切换：评论 / 弹幕（第 128 轮） ===== */
.bcd-panel-tabs {
  display: flex;
  flex: 0 0 auto;
  gap: 4px;
  align-items: center;
  padding: 8px 12px 0;
  border-bottom: 1px solid var(--bew-fill-1);
}

.bcd-panel-tab {
  position: relative;
  padding: 6px 2px;
  margin-right: 14px;
  font-size: var(--bew-fs-control, 14px);
  font-weight: 600;
  line-height: var(--bew-lh-snug, 1.4);
  color: var(--bew-text-3) !important;
  cursor: pointer;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
}

.bcd-panel-tab:hover {
  color: var(--bew-text-2) !important;
}

.bcd-panel-tab.is-active {
  color: var(--bew-text-1) !important;
}

/* 选中态下划线（与评论区内部的排序 tab 区分开：主 tab 更粗） */
.bcd-panel-tab.is-active::after {
  content: "";
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  background: var(--bew-theme-color, hsl(195 100% 42%));
  border-radius: 2px;
}

/* ===== 弹幕面板 ===== */
.bcd-danmaku-panel {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 8px;
  min-height: 320px;
  padding: 8px 12px 12px;
  overflow: hidden;
}

/*
 * 第 133 轮：slot 里放的是 **fixed 定位的覆盖层**（不占文档流），
 * 所以 slot 自己的高度不能靠内容撑 —— 必须显式给一个最小高度，
 * 否则 panel → slot 的 flex 链会算出 0，覆盖层也就被定位成 0 高（真机踩过）。
 */
.bcd-danmaku-slot {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 320px;
  overflow: hidden;
  border-radius: var(--bew-radius-sm, 8px);
  background: var(--bew-fill-1);
}

/* 搬进来的原生折叠容器：撑满 slot、内部自己滚 */
.bcd-danmaku-slot > [data-bewly-danmaku-moved] {
  display: flex !important;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  background: transparent !important;
}

/* ⚠️ 第 132 轮：弹幕列表用的是 **better-scroll 虚拟列表**。
   搬进我们的容器后它按「容器高 = ul 全高」重算，把 ul 的 top 推到了 1761px
   （视口外），用户于是只看到那块空态插画。
   这里把内层列表钉回容器顶部：wrap 自己滚、ul 不再被 bscroll 整体位移。 */
.bcd-danmaku-slot [data-bewly-danmaku-moved] .bui-long-list-wrap {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  height: auto !important;
  max-height: none !important;
  overflow-y: auto !important;
}

.bcd-danmaku-slot [data-bewly-danmaku-moved] .bui-long-list-list {
  position: static !important;
  top: auto !important;
  margin: 0 !important;
  transform: none !important;
}

/* 空态插画：数据已经加载时不该再占位（B 站只在 load 前后切换） */
.bcd-danmaku-slot [data-bewly-danmaku-moved] .bpx-player-dm-empty,
.bcd-danmaku-slot [data-bewly-danmaku-moved] [class*="dm-empty"],
.bcd-danmaku-slot [data-bewly-danmaku-moved] [class*="empty-holder"] {
  display: none !important;
}

.bcd-danmaku-slot [data-bewly-danmaku-moved] .bui-collapse-body,
.bcd-danmaku-slot [data-bewly-danmaku-moved] .bpx-player-wraplist {
  flex: 1 1 auto;
  min-height: 0;
  max-height: none !important;
  overflow-y: auto !important;
}

/* ⚠️ 第 128 轮：折叠条必须钉成固定高度的单行。
   搬进来后我们给 wrap 设了 height:100%，而原生的 .bui-collapse-header 是
   display:block 且内部 SVG 没有任何尺寸约束 —— 实测箭头图标被拉伸成 790×790，
   整条 header 撑到 814px 高，列表体被挤到视口外（用户看到的就是一个巨大的「>」）。 */
.bcd-danmaku-slot [data-bewly-danmaku-moved] .bui-collapse-header {
  display: flex !important;
  flex: 0 0 auto !important;
  align-items: center !important;
  box-sizing: border-box !important;
  height: 40px !important;
  min-height: 40px !important;
  max-height: 40px !important;
  padding: 0 12px !important;
  overflow: hidden !important;
}

.bcd-danmaku-slot [data-bewly-danmaku-moved] .bui-collapse-arrow,
.bcd-danmaku-slot [data-bewly-danmaku-moved] .arrow-icon,
.bcd-danmaku-slot [data-bewly-danmaku-moved] .bui-collapse-header svg {
  flex: 0 0 auto !important;
  width: 16px !important;
  height: 16px !important;
  min-width: 16px !important;
  min-height: 16px !important;
  max-width: 16px !important;
  max-height: 16px !important;
}

.bcd-danmaku-slot [data-bewly-danmaku-moved] .bui-collapse-arrow {
  margin: 0 8px 0 auto !important;
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
