<script setup lang="ts">
import type { MomentCard as MomentCardModel, MomentImage } from './types'
import Empty from '~/components/Empty.vue'
import { useBewlyApp } from '~/composables/useAppProvider'

import MomentCardView from './components/MomentCard.vue'
import MomentLightbox from './components/MomentLightbox.vue'
import MomentSkeleton from './components/MomentSkeleton.vue'
import { useMomentsFeed } from './composables/useMomentsFeed'
import { useMomentsOpen } from './composables/useMomentsOpen'
import { useMomentsShortcuts } from './composables/useMomentsShortcuts'
import { NATIVE_MOMENTS_URL, useMomentsI18n } from './i18n'

/**
 * 动态页：横向铺开的卡片流。
 *
 * 数据来自 `api.moment.getMoments`（关注 + 推荐的「全部」时间线），
 * 支持无限加载、九宫格图片、大图预览、正文折叠与 j/k 键盘浏览。
 */
const { t } = useMomentsI18n()
const { openVideo, openInNewTab } = useMomentsOpen()
const { handlePageRefresh, handleReachBottom } = useBewlyApp()

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

const activeIndex = ref<number>(-1)
const lightbox = ref<{ images: MomentImage[], index: number } | null>(null)
const feedEndRef = ref<HTMLElement | null>(null)
let loadMoreObserver: IntersectionObserver | null = null

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
    if (entries.some(entry => entry.isIntersecting))
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
  cards,
  activeIndex,
  isOverlayOpen: () => lightbox.value !== null,
  onOpen: openCard,
})

watch(() => cards.value.length, (length) => {
  if (activeIndex.value >= length)
    activeIndex.value = length - 1
  // 列表变长后重新 observe：observe 会立即回报当前相交状态，
  // 首屏撑不满视口时能继续把下一屏拉进来
  nextTick(setupLoadMoreObserver)
})

// 键盘浏览接近末尾时预取下一页
watch(activeIndex, (index) => {
  if (index >= 0 && index >= cards.value.length - 2)
    void loadMore()
})

watch(feedEndRef, () => nextTick(setupLoadMoreObserver))

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

    <div class="moments-keys" role="note" :aria-label="t('keyboard_title')">
      <span class="i-tabler:keyboard" aria-hidden="true" />
      <span>{{ t('keyboard_hint_bar') }}</span>
    </div>

    <div v-if="showSkeleton" class="moments-feed">
      <MomentSkeleton v-for="index in 3" :key="index" />
    </div>

    <div v-else-if="status === 'error'" class="moments-state">
      <span class="i-tabler:cloud-off moments-state__icon" aria-hidden="true" />
      <h3 class="moments-state__title">
        {{ errorTitle }}
      </h3>
      <p v-if="errorMessage" class="moments-state__desc">
        {{ errorMessage }}
      </p>
      <button type="button" class="moments-button" @click="loadFirst">
        <span class="i-tabler:refresh" aria-hidden="true" />
        <span>{{ t('retry') }}</span>
      </button>
    </div>

    <div v-else-if="!cards.length" class="moments-state">
      <h3 class="moments-state__title">
        {{ t('empty_title') }}
      </h3>
      <Empty :description="t('empty_desc')" />
      <button type="button" class="moments-button" @click="loadFirst">
        <span class="i-tabler:refresh" aria-hidden="true" />
        <span>{{ t('retry') }}</span>
      </button>
    </div>

    <div v-else class="moments-feed" role="feed" :aria-busy="loadingMore">
      <MomentCardView
        v-for="(card, index) in cards"
        :key="card.id"
        :card="card"
        :active="index === activeIndex"
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

.moments-state {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  justify-content: center;
  padding: 64px 20px;
  border: 1px dashed var(--bew-border-color);
  border-radius: var(--bew-radius);
  background: var(--bew-elevated-alt);
  text-align: center;
}

.moments-state__icon {
  color: var(--bew-text-3);
  font-size: 36px;
}

.moments-state__title {
  margin: 0;
  color: var(--bew-text-1);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
}

.moments-state__desc {
  margin: 0;
  max-width: 480px;
  color: var(--bew-text-3);
  font-size: 12px;
  line-height: 1.6;
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
  .moments-button {
    transition: none;
  }

  .moments-more__spinner,
  .is-spinning {
    animation: none;
  }
}
</style>
