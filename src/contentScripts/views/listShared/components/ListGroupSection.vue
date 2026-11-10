<script setup lang="ts">
import type { ListCardItem, ListQuickActionId, ListViewMode } from '../types'

import ListVideoCard from './ListVideoCard.vue'

const props = withDefaults(defineProps<{
  items: ListCardItem[]
  viewMode: ListViewMode
  label?: string
  count?: number
}>(), {
  label: '',
  count: 0,
})

const emit = defineEmits<{
  (e: 'action', payload: { id: ListQuickActionId, item: ListCardItem }): void
}>()

const gridClass = computed(() => `bewly-list-grid bewly-list-grid--${props.viewMode}`)
</script>

<template>
  <section class="bewly-list-group">
    <h2 v-if="label" class="bewly-list-group__header">
      <span>{{ label }}</span>
      <span v-if="count > 0" class="bewly-list-group__count">{{ count }}</span>
    </h2>
    <div :class="gridClass">
      <ListVideoCard
        v-for="item in items"
        :key="item.key"
        :item="item"
        :view-mode="viewMode"
        @action="emit('action', $event)"
      />
    </div>
  </section>
</template>
