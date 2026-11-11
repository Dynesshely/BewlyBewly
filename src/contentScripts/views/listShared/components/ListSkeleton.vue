<script setup lang="ts">
/**
 * 列表页骨架屏：用统一 Feedback/SkeletonBlock 拼出与三种视图对应的占位卡。
 *
 * 只负责骨架结构与网格布局，颜色 / 圆角 / 脉冲动画都来自 SkeletonBlock，
 * 因此暗色与 reduced-motion 的行为与其它页面一致。
 */
import type { ListViewMode } from '../types'
import SkeletonBlock from '~/components/Feedback/SkeletonBlock.vue'

const props = withDefaults(defineProps<{
  viewMode: ListViewMode
  count?: number
}>(), {
  count: 8,
})

const gridClass = computed(() => `bewly-list-grid bewly-list-grid--${props.viewMode}`)
</script>

<template>
  <div class="bewly-list-skeleton" :class="gridClass" aria-hidden="true">
    <div
      v-for="index in count"
      :key="index"
      class="bewly-list-skeleton-card"
      :class="{ 'is-list': viewMode === 'list' }"
    >
      <SkeletonBlock
        class="bewly-list-skeleton-card__cover"
        :height="viewMode === 'list' ? 76 : 124"
        :radius="12"
      />
      <div class="bewly-list-skeleton-card__body">
        <SkeletonBlock :height="12" :radius="6" />
        <SkeletonBlock :height="12" :radius="6" width="72%" />
        <SkeletonBlock :height="9" :radius="5" width="46%" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.bewly-list-skeleton {
  pointer-events: none;
  user-select: none;
}

.bewly-list-skeleton-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--bew-border-color);
  border-radius: var(--bew-radius);
  background: var(--bew-elevated);
}

.bewly-list-skeleton-card.is-list {
  flex-direction: row;
  align-items: stretch;
  gap: 12px;
}

.bewly-list-skeleton-card__cover {
  flex: none;
}

.bewly-list-skeleton-card.is-list .bewly-list-skeleton-card__cover {
  width: 136px;
}

.bewly-list-skeleton-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding-top: 2px;
}

@media (max-width: 640px) {
  .bewly-list-skeleton-card.is-list {
    flex-direction: column;
  }

  .bewly-list-skeleton-card.is-list .bewly-list-skeleton-card__cover {
    width: 100%;
  }
}
</style>
