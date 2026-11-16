<script setup lang="ts">
import type { PopularVideoItem, WeeklyIssue, WeeklyIssueConfig } from '../types'
import EmptyState from '~/components/Feedback/EmptyState.vue'
import ErrorState from '~/components/Feedback/ErrorState.vue'
import { useListPageActions } from '~/composables/useListPageActions'
import { NATIVE_POPULAR_URL } from '../constants'
import { getWeeklyIssue, getWeeklyIssues } from '../fetcher'
import { formatTemplate, usePopularI18n } from '../i18n'
import { getRcmdTag, toVideoCard } from '../utils'

const { t } = usePopularI18n()

const SKELETON_COUNT = 8

const issues = ref<WeeklyIssue[]>([])
const currentNumber = ref<number | null>(null)
const config = ref<WeeklyIssueConfig | null>(null)
const videos = ref<PopularVideoItem[]>([])
const isLoading = ref<boolean>(false)
const hasLoadedOnce = ref<boolean>(false)
const errorMessage = ref<string>('')

/** issues 按期号倒序（最新在前），index 越小越新 */
const currentIndex = computed(() =>
  issues.value.findIndex(issue => issue.number === currentNumber.value),
)
const canPrev = computed(() => currentIndex.value >= 0 && currentIndex.value < issues.value.length - 1)
const canNext = computed(() => currentIndex.value > 0)

async function loadIssue(number: number) {
  if (isLoading.value)
    return
  isLoading.value = true
  errorMessage.value = ''
  try {
    const data = await getWeeklyIssue(number)
    config.value = data.config
    videos.value = data.list
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

async function loadIssues() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const list = await getWeeklyIssues()
    issues.value = list
    if (!list.length)
      throw new Error('no weekly issues')
    const latest = list[0].number
    currentNumber.value = latest
    isLoading.value = false
    await loadIssue(latest)
  }
  catch (error) {
    isLoading.value = false
    errorMessage.value = error instanceof Error
      ? error.message
      : String(error)
  }
}

function changeIssue(number: number) {
  if (number === currentNumber.value)
    return
  currentNumber.value = number
  void loadIssue(number)
}

function stepIssue(delta: number) {
  const target = issues.value[currentIndex.value + delta]
  if (target)
    changeIssue(target.number)
}

function handleSelect(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value)
  if (Number.isFinite(value) && value > 0)
    changeIssue(value)
}

function refresh() {
  if (currentNumber.value)
    void loadIssue(currentNumber.value)
  else
    void loadIssues()
}

onMounted(() => {
  void loadIssues()
})

useListPageActions({
  isLoading,
  // 整页一次性取回，触底不需要加载更多（占位以满足公共 hook 的签名）
  reachBottom: () => {},
  refresh: () => refresh(),
})

defineExpose({ refresh })
</script>

<template>
  <section class="popular-section">
    <header class="popular-hero">
      <div class="popular-hero__main">
        <h1 class="popular-hero__title">
          {{ t.weeklyTitle }}
        </h1>
        <p class="popular-hero__subtitle">
          {{ config?.subject || t.weeklySubtitle }}
        </p>
      </div>
      <div class="popular-hero__actions">
        <span v-if="currentNumber" class="popular-hero__meta">
          {{ formatTemplate(t.weeklyIssue, { number: currentNumber }) }}
        </span>
        <select
          class="popular-weekly-bar__select"
          :aria-label="t.weeklyIssueSelect"
          :value="currentNumber ?? undefined"
          @change="handleSelect"
        >
          <option v-for="issue in issues" :key="issue.number" :value="issue.number">
            {{ issue.number }} · {{ issue.subject }}
          </option>
        </select>
        <button
          class="popular-text-button"
          type="button"
          :disabled="!canPrev"
          :title="t.weeklyPrev"
          @click="stepIssue(1)"
        >
          <span class="i-tabler:chevron-left" aria-hidden="true" />
          {{ t.weeklyPrev }}
        </button>
        <button
          class="popular-text-button"
          type="button"
          :disabled="!canNext"
          :title="t.weeklyNext"
          @click="stepIssue(-1)"
        >
          {{ t.weeklyNext }}
          <span class="i-tabler:chevron-right" aria-hidden="true" />
        </button>
      </div>
    </header>

    <p v-if="config?.name" class="popular-hero__meta">
      {{ config.name }}
    </p>

    <template v-if="videos.length">
      <div class="popular-grid popular-grid--weekly">
        <VideoCard
          v-for="(item, index) in videos"
          :key="item.aid"
          :video="toVideoCard(item, { rank: index + 1, tag: getRcmdTag(item) })"
          show-preview
        />
      </div>
    </template>

    <template v-else>
      <div v-if="isLoading" class="popular-grid popular-grid--weekly" aria-hidden="true">
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
        v-else-if="hasLoadedOnce && !isLoading"
        :title="t.emptyTitle"
        :description="t.emptyDescription"
      />
    </template>
  </section>
</template>
