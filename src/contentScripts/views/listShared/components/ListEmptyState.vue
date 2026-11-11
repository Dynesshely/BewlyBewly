<script setup lang="ts">
/**
 * 列表页空态（历史 / 稍后再看 / 收藏共用）。
 *
 * 第 16 轮起只是统一 Feedback/EmptyState 的薄封装：
 * 参数（title / description / icon）与默认插槽保持原样，页面调用方无需改动。
 */
import EmptyState from '~/components/Feedback/EmptyState.vue'

withDefaults(defineProps<{
  title: string
  description?: string
  icon?: string
}>(), {
  description: '',
  icon: 'i-mingcute:search-2-line',
})
</script>

<template>
  <EmptyState :title="title" :description="description" :icon="icon">
    <template v-if="$slots.default" #default>
      <slot />
    </template>
  </EmptyState>
</template>
