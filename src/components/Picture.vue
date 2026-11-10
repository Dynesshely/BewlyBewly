<script setup lang="ts">
withDefaults(defineProps<{
  src: string
  loading?: 'lazy' | 'eager'
  alt?: string
  /** 解码策略：异步解码，避免图片解码阻塞主线程 */
  decoding?: 'async' | 'sync' | 'auto'
  /** 加载优先级：首屏图用 high，其余 low，交给浏览器调度 */
  fetchpriority?: 'high' | 'low' | 'auto'
}>(), {
  loading: 'lazy',
  alt: '',
  decoding: 'async',
  fetchpriority: 'low',
})
</script>

<template>
  <picture>
    <source :srcset="`${src}.avif`" type="image/avif">
    <source :srcset="`${src}.webp`" type="image/webp">
    <img
      :src="src"
      :loading="loading"
      :decoding="decoding"
      :fetchpriority="fetchpriority"
      :alt="alt"
      block w-full h-full object="[inherit]" aspect-inherit
      rounded-inherit
    >
  </picture>
</template>
