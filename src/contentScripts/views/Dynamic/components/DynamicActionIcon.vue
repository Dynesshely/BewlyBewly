<script setup lang="ts">
/**
 * 操作栏图标：内联 SVG。
 *
 * 不用 UnoCSS 图标：内容脚本在页面 light DOM 里运行，图标运行时（iconify）
 * 在主页面的 CSS 里不一定就绪；内联 SVG 零依赖、随主题 `currentColor` 变色。
 */
defineProps<{
  name: 'forward' | 'comment' | 'like'
}>()
</script>

<template>
  <svg
    v-if="name === 'forward'"
    class="dynamic-action__icon"
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </svg>
  <svg
    v-else-if="name === 'comment'"
    class="dynamic-action__icon"
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.7 9.7 0 0 1-3.2-.7L3 21l1.7-4.6A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" />
  </svg>
  <svg
    v-else
    class="dynamic-action__icon"
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M19.5 12.57 12 20 4.5 12.57a5 5 0 1 1 7.5-6.57 5 5 0 1 1 7.5 6.57z" />
  </svg>
</template>

<style scoped>
.dynamic-action__icon {
  display: block;
  flex: none;
  width: 17px;
  height: 17px;
}
</style>
