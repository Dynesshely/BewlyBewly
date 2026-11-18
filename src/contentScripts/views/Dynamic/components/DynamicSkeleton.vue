<script setup lang="ts">
/**
 * 首屏骨架：模拟动态卡的结构（头像 + 昵称行 + 两行正文 + 一块内容 + 操作栏）。
 *
 * 纯 CSS 渐变脉冲，不引入图片资源；`prefers-reduced-motion` 下不做动画。
 */
withDefaults(defineProps<{
  count?: number
}>(), {
  count: 4,
})
</script>

<template>
  <div class="dynamic-skeleton" aria-hidden="true">
    <div v-for="index in count" :key="index" class="dynamic-skeleton__card">
      <div class="dynamic-skeleton__header">
        <span class="dynamic-skeleton__avatar" />
        <span class="dynamic-skeleton__meta">
          <span class="dynamic-skeleton__line dynamic-skeleton__line--name" />
          <span class="dynamic-skeleton__line dynamic-skeleton__line--time" />
        </span>
      </div>
      <div class="dynamic-skeleton__line" />
      <div class="dynamic-skeleton__line dynamic-skeleton__line--short" />
      <div class="dynamic-skeleton__block" />
    </div>
  </div>
</template>
