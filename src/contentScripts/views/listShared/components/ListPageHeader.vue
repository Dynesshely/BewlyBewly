<script setup lang="ts">
import Picture from '~/components/Picture.vue'

withDefaults(defineProps<{
  title: string
  subtitle?: string
  cover?: string
}>(), {
  subtitle: '',
  cover: '',
})
</script>

<template>
  <header class="bewly-list-hero" :class="{ 'bewly-list-hero--with-cover': Boolean(cover) }">
    <div v-if="cover" class="bewly-list-hero__bg" aria-hidden="true">
      <Picture
        :src="cover" alt="" loading="lazy" decoding="async" fetchpriority="low"
        fallback-kind="image" class="block w-full h-full"
      />
    </div>
    <div class="bewly-list-hero__body">
      <div class="bewly-list-hero__text">
        <h1 class="bewly-list-hero__title">
          {{ title }}
        </h1>
        <p v-if="subtitle" class="bewly-list-hero__subtitle">
          {{ subtitle }}
        </p>
      </div>
      <div v-if="$slots.actions" class="bewly-list-hero__actions">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>
