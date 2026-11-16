<script setup lang="ts">
import type { PopularVideoItem } from '../types'
import EmptyState from '~/components/Feedback/EmptyState.vue'
import ErrorState from '~/components/Feedback/ErrorState.vue'
import { useListPageActions } from '~/composables/useListPageActions'
import { NATIVE_POPULAR_URL } from '../constants'
import { getPrecious } from '../fetcher'
import { formatTemplate, usePopularI18n } from '../i18n'
import { getAchievementTag, toVideoCard } from '../utils'

const { t } = usePopularI18n()

const SKELETON_COUNT = 10

const videos = ref<PopularVideoItem[]>([])
const explain = ref<string>('')
const isLoading = ref<boolean>(false)
const hasLoadedOnce = ref<boolean>(false)
const errorMessage = ref<string>('')

async function load() {
  if (isLoading.value)
    return
  isLoading.value = true
  errorMessage.value = ''
  try {
    const data = await getPrecious()
    videos.value = data.list
    explain.value = data.explain
    hasLoadedOnce.value = true
  }
  catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : String(error)
    videos.value = []
  }
  finally {
    isLoading.value = false
  }
}

onMounted(() => {
  void load()
})

useListPageActions({
  isLoading,
  // 整页一次性取回，触底不需要加载更多（占位以满足公共 hook 的签名）
  reachBottom: () => {},
  refresh: () => load(),
})

defineExpose({
  refresh: () => load(),
})
</script>

<template>
  <section class="popular-section">
    <header class="popular-hero">
      <div class="popular-hero__main">
        <h1 class="popular-hero__title">
          {{ t.preciousTitle }}
        </h1>
        <p class="popular-hero__subtitle">
          {{ explain || t.preciousSubtitle }}
        </p>
      </div>
      <div class="popular-hero__actions">
        <span v-if="videos.length" class="popular-hero__meta">
          {{ formatTemplate(t.preciousCount, { count: videos.length }) }}
        </span>
      </div>
    </header>

    <template v-if="videos.length">
      <div class="popular-grid">
        <VideoCard
          v-for="item in videos"
          :key="item.aid"
          :video="toVideoCard(item, { tag: getAchievementTag(item) })"
          show-preview
        />
      </div>
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
        @retry="load"
      >
        <a class="popular-text-button" :href="NATIVE_POPULAR_URL" target="_blank" rel="noopener">
          {{ t.errorNative }}
        </a>
      </ErrorState>

      <EmptyState
        v-else-if="hasLoadedOnce && !isLoading"
        :title="t.emptyTitle"
        :description="t.emptyDescription"
      />
    </template>
  </section>
</template>
