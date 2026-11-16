<script setup lang="ts">
import type { RankRegionDef, RankRegionId } from '../constants'
import type { RankPgcRankItem, RankVideoRankItem } from '../types'
import EmptyState from '~/components/Feedback/EmptyState.vue'
import ErrorState from '~/components/Feedback/ErrorState.vue'
import { useListPageActions } from '~/composables/useListPageActions'
import { NATIVE_RANK_URL } from '../constants'
import { getRankPgc, getRankVideos } from '../fetcher'
import { usePopularI18n } from '../i18n'
import RankPgcRow from './RankPgcRow.vue'
import RankRegionTabs from './RankRegionTabs.vue'
import RankVideoRow from './RankVideoRow.vue'

const props = defineProps<{ region: RankRegionDef }>()
const emit = defineEmits<{ (e: 'selectRegion', id: RankRegionId): void }>()

const { t } = usePopularI18n()

const SKELETON_COUNT = 8

const videoItems = ref<RankVideoRankItem[]>([])
const pgcItems = ref<RankPgcRankItem[]>([])
const isLoading = ref<boolean>(false)
const hasLoadedOnce = ref<boolean>(false)
const errorMessage = ref<string>('')
const isPgc = computed(() => Boolean(props.region.seasonType))
const hasItems = computed(() => isPgc.value
  ? pgcItems.value.length > 0
  : videoItems.value.length > 0)

async function load() {
  if (isLoading.value)
    return

  isLoading.value = true
  errorMessage.value = ''
  videoItems.value = []
  pgcItems.value = []
  try {
    if (props.region.seasonType !== undefined) {
      pgcItems.value = await getRankPgc(props.region.seasonType) as RankPgcRankItem[]
    }
    else {
      videoItems.value = await getRankVideos(props.region.rid ?? 0)
    }
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
}

watch(() => props.region.id, () => {
  void load()
}, { immediate: true })

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
          {{ t.rankTitle }}
        </h1>
        <p class="popular-hero__subtitle">
          {{ t.rankSubtitle }}
        </p>
      </div>
    </header>

    <RankRegionTabs :active="region.id" @select="emit('selectRegion', $event)" />

    <template v-if="hasItems">
      <ul class="popular-rank-list">
        <template v-if="isPgc">
          <RankPgcRow
            v-for="(item, index) in pgcItems"
            :key="item.url || item.season_id"
            :item="item"
            :rank="item.rank ?? index + 1"
          />
        </template>
        <template v-else>
          <RankVideoRow
            v-for="(item, index) in videoItems"
            :key="item.bvid || item.aid"
            :item="item"
            :rank="index + 1"
          />
        </template>
      </ul>
    </template>

    <template v-else>
      <div v-if="isLoading" class="popular-skeleton-list" aria-hidden="true">
        <div v-for="item in SKELETON_COUNT" :key="item" class="popular-skeleton-row">
          <span class="popular-skeleton-row__cover" />
          <div class="popular-skeleton-row__lines">
            <div class="popular-skeleton-row__line" />
            <div class="popular-skeleton-row__line popular-skeleton-row__line--short" />
          </div>
        </div>
      </div>

      <ErrorState
        v-else-if="errorMessage"
        :title="t.errorTitle"
        :message="errorMessage"
        :retry-label="t.retry"
        @retry="load"
      >
        <a class="popular-text-button" :href="NATIVE_RANK_URL" target="_blank" rel="noopener">
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
