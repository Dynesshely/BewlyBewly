<script setup lang="ts">
import type { ListCategoryChip } from '../types'
import { useListI18n } from '../i18n'

defineProps<{
  categories: ListCategoryChip[]
  selectedId?: number
}>()

const emit = defineEmits<{
  (e: 'select', id: number): void
}>()

const { tl } = useListI18n()
</script>

<template>
  <nav v-if="categories.length" class="bewly-list-chips" :aria-label="tl('favorites.categories')">
    <button
      v-for="category in categories"
      :key="category.id"
      type="button"
      class="bewly-list-chip"
      :class="{ 'is-active': category.id === selectedId }"
      :aria-pressed="category.id === selectedId"
      :title="category.title"
      @click="emit('select', category.id)"
    >
      <span class="bewly-list-chip__title">{{ category.title }}</span>
      <span v-if="typeof category.count === 'number'" class="bewly-list-chip__count">{{ category.count }}</span>
    </button>
  </nav>
</template>
