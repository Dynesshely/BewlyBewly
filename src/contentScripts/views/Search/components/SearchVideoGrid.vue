<script setup lang="ts">
/**
 * 结果网格（自绘）。
 *
 * 数据由父组件（SearchPage）按页码整体替换，这里只负责呈现 + 四种状态：
 *   有数据 → VideoCard 网格；加载中且无数据 → 骨架；有错误且无数据 → 错误态（带原生页回退入口）；
 *   都不是 → 空态。
 *
 * 「有数据 + 有错误」是翻页失败的情形：父组件会保留已有卡片，这里不再重复报错
 * （错误提示由父组件的行内提示承担）。
 */
import type { SearchApiItem } from '../types'
import EmptyState from '~/components/Feedback/EmptyState.vue'
import ErrorState from '~/components/Feedback/ErrorState.vue'
import VideoCard from '~/components/VideoCard/VideoCard.vue'
import VideoCardSkeleton from '~/components/VideoCard/VideoCardSkeleton.vue'
import { SEARCH_SKELETON_COUNT } from '../constants'
import { useSearchDrawnI18n } from '../searchDrawnI18n'
import { toVideoCard, videoKey } from '../utils'

const props = defineProps<{
  items: SearchApiItem[]
  isLoading: boolean
  errorMessage: string
  /** 原生页地址：错误态里「在原版页面打开」用它 */
  nativeUrl: string
}>()

defineEmits<{
  (e: 'retry'): void
  /** 空态里「清空筛选条件」：由父组件把排序 / 时长 / 分区恢复默认并重拉 */
  (e: 'clearFilters'): void
}>()

const { t } = useSearchDrawnI18n()

/** 接口条目 → VideoCard 结构（标题的 `<em>` 在这里被清理掉，见 utils.stripHtml） */
const cards = computed(() => props.items.map(item => ({
  key: videoKey(item),
  video: toVideoCard(item),
})))
</script>

<template>
  <section class="search-grid">
    <div v-if="cards.length" class="search-grid__cards">
      <VideoCard
        v-for="card in cards"
        :key="card.key"
        :video="card.video"
        show-preview
      />
    </div>

    <div v-else-if="isLoading" class="search-grid__cards" aria-hidden="true">
      <VideoCardSkeleton v-for="index in SEARCH_SKELETON_COUNT" :key="index" />
    </div>

    <ErrorState
      v-else-if="errorMessage"
      :title="t.errorTitle"
      :message="errorMessage"
      :retry-label="t.retry"
      :fallback-hint="t.errorFallbackHint"
      @retry="$emit('retry')"
    >
      <a class="search-grid__native" :href="nativeUrl">
        {{ t.errorNative }}
      </a>
    </ErrorState>

    <!-- 空态：「换关键词」要回到顶部输入框，「清空筛选」一点就好 — 直接给按钮 -->
    <EmptyState
      v-else
      :title="t.emptyTitle"
      :description="t.emptyDescription"
      icon="i-mingcute:search-line"
    >
      <button class="search-grid__clear" type="button" @click="$emit('clearFilters')">
        {{ t.emptyClearFilters }}
      </button>
      <a class="search-grid__native" :href="nativeUrl">
        {{ t.emptyNative }}
      </a>
    </EmptyState>
  </section>
</template>
