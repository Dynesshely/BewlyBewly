<script setup lang="ts">
import type { ListViewMode } from '../types'

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
    <VideoCardSkeleton v-for="index in count" :key="index" :horizontal="viewMode === 'list'" />
  </div>
</template>
