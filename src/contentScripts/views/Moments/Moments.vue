<script setup lang="ts">
import type { MomentCard as MomentCardModel, MomentImage } from './types'
import EmptyState from '~/components/Feedback/EmptyState.vue'
import ErrorState from '~/components/Feedback/ErrorState.vue'
import { useBewlyApp } from '~/composables/useAppProvider'
import { settings } from '~/logic'

import MomentCardView from './components/MomentCard.vue'
import MomentLightbox from './components/MomentLightbox.vue'
import MomentSkeleton from './components/MomentSkeleton.vue'
import { MOMENTS_DENSITIES, useMomentsDensity } from './composables/useMomentsDensity'
import { useMomentsFeed } from './composables/useMomentsFeed'
import { useMomentsOpen } from './composables/useMomentsOpen'
import { useMomentsShortcuts } from './composables/useMomentsShortcuts'
import { useVirtualList } from './composables/useVirtualList'
import { NATIVE_MOMENTS_URL, useMomentsI18n } from './i18n'

/**
 * 动态页：横向铺开的卡片流。
 *
 * 数据来自 `api.moment.getMoments`（关注 + 推荐的「全部」时间线），
 * 支持无限加载、九宫格图片、大图预览、正文折叠与 j/k 键盘浏览。
 */
const { t } = useMomentsI18n()

const { openVideo, openInNewTab } = useMomentsOpen()
const { handlePageRefresh, handleReachBottom, scrollbarRef } = useBewlyApp()

const {
  cards,
  status,
  loadingMore,
  hasMore,
  moreFailed,
  errorCode,
  errorMessage,
  loadFirst,
  loadMore,
  retryMore,
  refresh,
  LOGIN_REQUIRED_CODE,
} = useMomentsFeed()

const { density, setDensity } = useMomentsDensity()

// #region 离屏优化（虚拟列表）
/**
 * 离屏优化的真实来源是 settings.momentsOptimizeEnabled
 * （设置页「页面增强 → 动态页 → 离屏优化」）；页面顶部按钮切换会回写 settings。
 * 旧版本写在 localStorage 的「bewly-moments-optimize」会在首次使用时一次性迁移后删除。
 */
const OPTIMIZE_STORAGE_KEY = 'bewly-moments-optimize'
const DEFAULT_OPTIMIZE_ENABLED = true

let optimizeMigrated = false

function migrateLegacyOptimize(): void {
  if (optimizeMigrated)
    return
  optimizeMigrated = true

  try {
    const raw = window.localStorage.getItem(OPTIMIZE_STORAGE_KEY)
    if (raw === null)
      return
    window.localStorage.removeItem(OPTIMIZE_STORAGE_KEY)

    if (settings.value.momentsOptimizeEnabled !== DEFAULT_OPTIMIZE_ENABLED)
      return
    settings.value.momentsOptimizeEnabled = raw !== '0'
  }
  catch {
    // 隐私模式 / 存储被禁用时忽略，沿用 settings 默认值
  }
}

migrateLegacyOptimize()

/** 直接绑定 settings：页面内切换写回 settings，设置页改动即时改变渲染策略 */
const optimizeEnabled = computed<boolean>({
  get: () => settings.value.momentsOptimizeEnabled,
  set: (value) => {
    settings.value.momentsOptimizeEnabled = value
  },
})

function setOptimizeEnabled(value: boolean) {
  optimizeEnabled.value = value
}
// #endregion

const activeIndex = ref<number>(-1)
/** 高亮卡片的 id：筛选切换后用它把高亮停在原来那张卡上 */
const activeCardId = ref<string>('')
const videoOnly = ref(false)
const lightbox = ref<{ images: MomentImage[], index: number } | null>(null)
const feedEndRef = ref<HTMLElement | null>(null)
let loadMoreObserver: IntersectionObserver | null = null

function isVideoCard(card: MomentCardModel) {
  return card.type === 'video' || card.type === 'pgc'
}

/** 「只看视频」筛选后的列表：键盘高亮与渲染都以它为准 */
const visibleCards = computed(() => videoOnly.value
  ? cards.value.filter(isVideoCard)
  : cards.value)

/** 有动态但当前筛选下一条视频都没有 */
const videoFilterEmpty = computed(() => videoOnly.value && !visibleCards.value.length && cards.value.length > 0)

/** 「只看视频」时自动补页的次数上限（见 setupLoadMoreObserver） */
let denseAutoLoadBudget = 3

/**
 * 离屏优化：只给卡片根节点写 content-visibility / contain-intrinsic-size，
 * 不卸载节点、不接管渲染顺序，所以 j/k、筛选、无限加载、lightbox、密度都不受影响。
 */
const virtualList = useVirtualList({
  enabled: () => optimizeEnabled.value && visibleCards.value.length > 0,
  count: () => visibleCards.value.length,
  activeIndex: () => activeIndex.value,
  getScrollRoot: () => (scrollbarRef.value as HTMLElement | null) ?? null,
})

/** 密度切换会整体改变卡片高度：清掉旧测量值，滚回附近时重量 */
watch(density, () => virtualList.resetMeasurements())

const densityOptions = computed(() => MOMENTS_DENSITIES.map(value => ({
  value,
  label: value === 'compact'
    ? t('density_compact')
    : t('density_comfortable'),
  icon: value === 'compact'
    ? 'i-tabler:list-details'
    : 'i-tabler:layout-grid',
})))

// 首屏（含下拉刷新导致的空列表）才铺骨架；已有内容时刷新保留旧列表
const showSkeleton = computed(() => status.value === 'idle' || (status.value === 'loading' && !cards.value.length))
const errorTitle = computed(() => errorCode.value === LOGIN_REQUIRED_CODE
  ? t('login_required')
  : t('load_failed'))

function openCard(card: MomentCardModel) {
  if (card.type === 'video' || card.type === 'pgc') {
    openVideo(card.video?.jumpUrl || card.jumpUrl)
    return
  }
  openInNewTab(card.jumpUrl)
}

function openImages(images: MomentImage[], index: number) {
  if (!images.length)
    return
  lightbox.value = { images, index }
}

function closeLightbox() {
  lightbox.value = null
}

function setLightboxIndex(index: number) {
  if (!lightbox.value)
    return
  lightbox.value = { ...lightbox.value, index }
}

function handleRefresh() {
  activeIndex.value = -1
  refresh()
}

/**
 * 兜底触底加载：App.vue 的哨兵只在滚动容器内生效，
 * 这里再挂一个列表末尾的观察器，键盘浏览到末尾时也能继续加载。
 */
function setupLoadMoreObserver() {
  loadMoreObserver?.disconnect()
  loadMoreObserver = null
  const target = feedEndRef.value
  if (!target || typeof IntersectionObserver === 'undefined')
    return

  const root = target.closest('.bewly-scroll-container') as HTMLElement | null
  loadMoreObserver = new IntersectionObserver((entries) => {
    const intersecting = entries.some(entry => entry.isIntersecting)
    // 哨兵离开视口后恢复补页预算，方便下次滚动到末尾时再自动加载
    if (!intersecting) {
      denseAutoLoadBudget = 3
      return
    }

    // 只看视频时，若整页都没有视频卡，列表不会变长、哨兵会一直可见；
    // 限制自动补页次数，避免连续请求几十页。剩下的交给「加载更多」按钮与滚动。
    if (videoOnly.value) {
      if (denseAutoLoadBudget <= 0 || visibleCards.value.length >= 6)
        return
      denseAutoLoadBudget--
    }

    void loadMore()
  }, {
    root: root ?? null,
    rootMargin: '0px 0px 320px 0px',
    threshold: 0,
  })
  loadMoreObserver.observe(target)
}

function initPageAction() {
  handleReachBottom.value = () => {
    void loadMore()
  }
  handlePageRefresh.value = () => {
    activeIndex.value = -1
    void refresh()
  }
}

useMomentsShortcuts({
  cards: visibleCards,
  activeIndex,
  isOverlayOpen: () => lightbox.value !== null,
  onOpen: openCard,
})

// 选中 / 移动高亮时记住卡片 id，供筛选切换后恢复定位
watch(activeIndex, (index) => {
  activeCardId.value = visibleCards.value[index]?.id ?? ''

  // 键盘浏览接近末尾时预取下一页
  if (index >= 0 && index >= visibleCards.value.length - 2)
    void loadMore()
})

// 列表或筛选变化后：把高亮重新定位到原来那张卡（找不到就清空），并重新挂观察器
watch(visibleCards, (list) => {
  if (activeCardId.value) {
    const nextIndex = list.findIndex(card => card.id === activeCardId.value)
    activeIndex.value = nextIndex
    if (nextIndex < 0)
      activeCardId.value = ''
  }
  else if (activeIndex.value >= list.length) {
    activeIndex.value = list.length - 1
  }

  // 列表变长后重新 observe：observe 会立即回报当前相交状态，
  // 首屏撑不满视口时能继续把下一屏拉进来
  nextTick(setupLoadMoreObserver)
})

watch(feedEndRef, () => nextTick(setupLoadMoreObserver))

// 切换筛选时重置「自动补页」预算
watch(videoOnly, () => {
  denseAutoLoadBudget = 3
})

onMounted(() => {
  initPageAction()
  void loadFirst()
})

onUnmounted(() => {
  handleReachBottom.value = undefined
  handlePageRefresh.value = undefined
  loadMoreObserver?.disconnect()
  loadMoreObserver = null
})
</script>

<template>
  <div class="moments-page">
    <header class="moments-hero">
      <div class="moments-hero__text">
        <span class="moments-hero__badge">{{ t('page_badge') }}</span>
        <h2 class="moments-hero__title">
          {{ t('page_title') }}
        </h2>
        <p class="moments-hero__subtitle">
          {{ t('page_subtitle') }}
        </p>
      </div>
      <div class="moments-hero__actions">
        <span v-if="cards.length" class="moments-hero__count">
          {{ t('count_loaded', { n: cards.length }) }}
        </span>
        <button
          type="button"
          class="moments-button"
          :disabled="status === 'loading'"
          :title="t('refresh_hint')"
          @click="handleRefresh"
        >
          <span class="i-tabler:refresh" :class="{ 'is-spinning': status === 'loading' }" aria-hidden="true" />
          <span>{{ t('refresh') }}</span>
        </button>
        <a
          class="moments-button is-ghost"
          :href="NATIVE_MOMENTS_URL"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="i-tabler:external-link" aria-hidden="true" />
          <span>{{ t('open_native') }}</span>
        </a>
      </div>
    </header>

    <div class="moments-toolbar">
      <div class="moments-toolbar__group" role="group" :aria-label="t('density_title')">
        <span class="moments-toolbar__label">{{ t('density_title') }}</span>
        <div class="moments-segmented">
          <button
            v-for="option in densityOptions"
            :key="option.value"
            type="button"
            class="moments-segmented__btn"
            :class="{ 'is-active': density === option.value }"
            :aria-pressed="density === option.value"
            @click="setDensity(option.value)"
          >
            <span :class="option.icon" aria-hidden="true" />
            <span>{{ option.label }}</span>
          </button>
        </div>
      </div>

      <div class="moments-toolbar__group">
        <button
          type="button"
          class="moments-chip"
          :class="{ 'is-active': videoOnly }"
          :aria-pressed="videoOnly"
          :title="t('filter_video_hint')"
          @click="videoOnly = !videoOnly"
        >
          <span class="i-tabler:movie" aria-hidden="true" />
          <span>{{ t('filter_video_only') }}</span>
          <span v-if="videoOnly" class="moments-chip__count">{{ visibleCards.length }}</span>
        </button>

        <button
          type="button"
          class="moments-chip"
          :class="{ 'is-active': optimizeEnabled }"
          :aria-pressed="optimizeEnabled"
          :title="optimizeEnabled ? t('optimize_on') : t('optimize_off')"
          @click="setOptimizeEnabled(!optimizeEnabled)"
        >
          <span class="i-tabler:bolt" aria-hidden="true" />
          <span>{{ t('optimize') }}</span>
        </button>
      </div>
    </div>

    <div class="moments-keys" role="note" :aria-label="t('keyboard_title')">
      <span class="i-tabler:keyboard" aria-hidden="true" />
      <span>{{ t('keyboard_hint_bar') }}</span>
    </div>

    <div v-if="showSkeleton" class="moments-feed">
      <MomentSkeleton v-for="index in 3" :key="index" :density="density" />
    </div>

    <ErrorState
      v-else-if="status === 'error'"
      :title="errorTitle"
      :message="errorMessage"
      icon="i-tabler:cloud-off"
      :retry-label="t('retry')"
      @retry="loadFirst"
    />

    <EmptyState
      v-else-if="!cards.length"
      :title="t('empty_title')"
      :description="t('empty_desc')"
      icon="i-mingcute:inbox-line"
    >
      <button type="button" class="moments-button" @click="loadFirst">
        <span class="i-tabler:refresh" aria-hidden="true" />
        <span>{{ t('retry') }}</span>
      </button>
    </EmptyState>

    <div v-else class="moments-feed" role="feed" :aria-busy="loadingMore">
      <EmptyState
        v-if="videoFilterEmpty"
        :title="t('filter_empty_title')"
        :description="t('filter_empty_desc')"
        icon="i-tabler:movie"
      >
        <button type="button" class="moments-button is-ghost" @click="videoOnly = false">
          {{ t('filter_clear') }}
        </button>
      </EmptyState>

      <MomentCardView
        v-for="(card, index) in visibleCards"
        :key="card.id"
        :ref="el => virtualList.setItemRef(el, index)"
        :card="card"
        :active="index === activeIndex"
        :density="density"
        @activate="activeIndex = index"
        @open="openCard"
        @open-images="openImages"
      />

      <div class="moments-more">
        <template v-if="moreFailed">
          <span class="moments-more__hint">{{ t('load_more_failed') }}</span>
          <button type="button" class="moments-button" @click="retryMore">
            <span class="i-tabler:refresh" aria-hidden="true" />
            <span>{{ t('retry') }}</span>
          </button>
        </template>
        <template v-else-if="loadingMore">
          <span class="moments-more__spinner" aria-hidden="true" />
          <span class="moments-more__hint">{{ t('loading_more') }}</span>
        </template>
        <template v-else-if="hasMore">
          <button type="button" class="moments-button is-ghost" @click="loadMore">
            <span>{{ t('load_more') }}</span>
          </button>
        </template>
        <template v-else>
          <span class="moments-more__hint">{{ t('no_more') }}</span>
        </template>
      </div>

      <div ref="feedEndRef" class="moments-feed-end" aria-hidden="true" />
    </div>

    <MomentLightbox
      v-if="lightbox"
      :images="lightbox.images"
      :index="lightbox.index"
      @close="closeLightbox"
      @update:index="setLightboxIndex"
    />
  </div>
</template>

<style scoped lang="scss">
.moments-page {
  --moment-ease: cubic-bezier(0.22, 0.61, 0.36, 1);

  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 48px;
}

.moments-hero {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-end;
  justify-content: space-between;
  padding: 20px;
  border-radius: var(--bew-radius);
  background: linear-gradient(120deg, var(--bew-fill-1), transparent 72%);
}

.moments-hero__text {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 720px;
}

.moments-hero__badge {
  align-self: flex-start;
  padding: 0 8px;
  border-radius: 8px;
  background: var(--bew-theme-color-10);
  color: var(--bew-theme-color);
  font-size: 12px;
  line-height: 22px;
}

.moments-hero__title {
  margin: 0;
  color: var(--bew-text-1);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.5;
  text-wrap: balance;
}

.moments-hero__subtitle {
  margin: 0;
  color: var(--bew-text-3);
  font-size: 12px;
  line-height: 1.5;
}

.moments-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.moments-hero__count {
  color: var(--bew-text-3);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
}

.moments-button {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--bew-theme-color);
  color: #fff;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition:
    opacity 180ms var(--moment-ease),
    background-color 180ms var(--moment-ease),
    border-color 180ms var(--moment-ease),
    color 180ms var(--moment-ease);

  &:hover {
    opacity: 0.88;
  }

  &:disabled {
    cursor: default;
    opacity: 0.55;
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 2px;
  }

  &.is-ghost {
    border-color: var(--bew-border-color);
    background: transparent;
    color: var(--bew-text-2);

    &:hover {
      border-color: var(--bew-theme-color-40);
      background: var(--bew-fill-1);
      color: var(--bew-text-1);
      opacity: 1;
    }
  }
}

/* #region 工具条（密度 / 只看视频） */
.moments-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.moments-toolbar__group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.moments-toolbar__label {
  color: var(--bew-text-3);
  font-size: 12px;
  line-height: 1.5;
}

.moments-segmented {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--bew-border-color);
  border-radius: 999px;
  background: var(--bew-fill-1);
}

.moments-segmented__btn {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 3px 10px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--bew-text-2);
  font-size: 12px;
  line-height: 1.5;
  cursor: pointer;
  transition:
    background-color 180ms var(--moment-ease),
    color 180ms var(--moment-ease);

  &:hover {
    background: var(--bew-fill-2);
    color: var(--bew-text-1);
  }

  &.is-active {
    background: var(--bew-elevated-solid);
    color: var(--bew-text-1);
    box-shadow: var(--bew-shadow-1);
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 2px;
  }
}

.moments-chip {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 4px 12px;
  border: 1px solid var(--bew-border-color);
  border-radius: 999px;
  background: transparent;
  color: var(--bew-text-2);
  font-size: 12px;
  line-height: 1.5;
  cursor: pointer;
  transition:
    background-color 180ms var(--moment-ease),
    border-color 180ms var(--moment-ease),
    color 180ms var(--moment-ease);

  &:hover {
    border-color: var(--bew-theme-color-40);
    background: var(--bew-fill-1);
    color: var(--bew-text-1);
  }

  &.is-active {
    border-color: var(--bew-theme-color-40);
    background: var(--bew-theme-color-10);
    color: var(--bew-theme-color);
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 2px;
  }
}

.moments-chip__count {
  padding: 0 6px;
  border-radius: 6px;
  background: var(--bew-theme-color);
  color: #fff;
  font-size: 11px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
}
/* #endregion */

.moments-keys {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 14px;
  border: 1px dashed var(--bew-border-color);
  border-radius: 10px;
  color: var(--bew-text-3);
  font-size: 12px;
  line-height: 1.5;
}

.moments-feed {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.moments-more {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: center;
  min-height: 48px;
}

.moments-feed-end {
  height: 1px;
}

.moments-more__hint {
  color: var(--bew-text-3);
  font-size: 12px;
  line-height: 1.5;
}

.moments-more__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--bew-border-color);
  border-top-color: var(--bew-theme-color);
  border-radius: 50%;
  animation: moments-spin 720ms linear infinite;
}

.is-spinning {
  animation: moments-spin 720ms linear infinite;
}

@keyframes moments-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .moments-button,
  .moments-segmented__btn,
  .moments-chip {
    transition: none;
  }

  .moments-more__spinner,
  .is-spinning {
    animation: none;
  }
}
</style>
