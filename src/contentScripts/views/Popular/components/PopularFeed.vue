<script setup lang="ts">
import type { PopularVideoItem } from '../types'
import EmptyState from '~/components/Feedback/EmptyState.vue'
import ErrorState from '~/components/Feedback/ErrorState.vue'
import { useBewlyApp } from '~/composables/useAppProvider'
import { useListPageActions } from '~/composables/useListPageActions'
import { NATIVE_POPULAR_URL } from '../constants'
import { getPopularFeed } from '../fetcher'
import { usePopularI18n } from '../i18n'
import { getRcmdTag, toVideoCard } from '../utils'

const { t } = usePopularI18n()
const { haveScrollbar } = useBewlyApp()

const PAGE_SIZE = 30
const SKELETON_COUNT = 10

const videos = ref<PopularVideoItem[]>([])
const isLoading = ref<boolean>(false)
const hasLoadedOnce = ref<boolean>(false)
const noMore = ref<boolean>(false)
const errorMessage = ref<string>('')
const rulesOpen = ref<boolean>(false)
const pageNum = ref<number>(1)

function reset() {
  videos.value = []
  pageNum.value = 1
  noMore.value = false
  errorMessage.value = ''
}

async function loadMore() {
  if (isLoading.value || noMore.value)
    return

  isLoading.value = true
  try {
    const page = await getPopularFeed(pageNum.value, PAGE_SIZE)
    if (!page.list.length) {
      noMore.value = true
      return
    }
    videos.value = [
      ...videos.value,
      ...page.list,
    ]
    pageNum.value += 1
    noMore.value = page.noMore
    errorMessage.value = ''
    hasLoadedOnce.value = true
  }
  catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : String(error)
  }
  finally {
    isLoading.value = false
  }

  // 首屏没填满一屏时补一页，避免「看起来没有内容」
  if (!noMore.value && !errorMessage.value) {
    const scrollable = await haveScrollbar()
    if (!scrollable)
      void loadMore()
  }
}

function refresh() {
  reset()
  hasLoadedOnce.value = false
  void loadMore()
}

onMounted(() => {
  void loadMore()
})

useListPageActions({
  isLoading,
  noMoreContent: noMore,
  reachBottom: () => loadMore(),
  refresh: () => refresh(),
})

defineExpose({ loadMore, refresh })
</script>

<template>
  <section class="popular-section">
    <header class="popular-hero">
      <div class="popular-hero__main">
        <h1 class="popular-hero__title">
          {{ t.popularTitle }}
        </h1>
        <p class="popular-hero__subtitle">
          {{ t.popularSubtitle }}
        </p>
      </div>
      <div class="popular-hero__actions">
        <button
          class="popular-text-button"
          type="button"
          :aria-expanded="rulesOpen"
          @click="rulesOpen = !rulesOpen"
        >
          <span class="i-tabler:info-circle" aria-hidden="true" />
          {{ t.popularRules }}
        </button>
      </div>
    </header>

    <p v-if="rulesOpen" class="popular-rules">
      {{ t.popularRulesBody }}
    </p>

    <template v-if="videos.length">
      <div class="popular-grid">
        <VideoCard
          v-for="(item, index) in videos"
          :key="item.aid"
          :video="toVideoCard(item, { rank: index + 1, tag: getRcmdTag(item) })"
          show-preview
        />
      </div>

      <p v-if="errorMessage" class="popular-loading">
        {{ errorMessage }}
      </p>

      <button
        v-if="!noMore"
        class="popular-load-more"
        type="button"
        :disabled="isLoading"
        @click="loadMore"
      >
        {{ isLoading ? t.loading : t.loadMore }}
      </button>
    </template>

    <template v-else>
      <div v-if="isLoading" class="popular-grid" aria-hidden="true">
        <VideoCardSkeleton v-for="item in SKELETON_COUNT" :key="item" />
      </div>

      <ErrorState
        v-else-if="errorMessage"
        :title="t.errorTitle"
        :message="errorMessage"
        :retry-label="t.retry"
        @retry="refresh"
      >
        <a class="popular-text-button" :href="NATIVE_POPULAR_URL" target="_blank" rel="noopener">
          {{ t.errorNative }}
        </a>
      </ErrorState>

      <EmptyState
        v-else-if="hasLoadedOnce"
        :title="t.emptyTitle"
        :description="t.emptyDescription"
      />
    </template>
  </section>
</template>
