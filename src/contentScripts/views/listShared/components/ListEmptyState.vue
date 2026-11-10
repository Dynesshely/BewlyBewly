<script setup lang="ts">
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
  <div class="bewly-list-empty">
    <div class="bewly-list-empty__art" aria-hidden="true">
      <span class="bewly-list-empty__ring" />
      <span class="bewly-list-empty__ring bewly-list-empty__ring--inner" />
      <span class="bewly-list-empty__icon" :class="icon" />
    </div>
    <p class="bewly-list-empty__title">
      {{ title }}
    </p>
    <p v-if="description" class="bewly-list-empty__desc">
      {{ description }}
    </p>
    <div v-if="$slots.default" class="bewly-list-empty__actions">
      <slot />
    </div>
  </div>
</template>
