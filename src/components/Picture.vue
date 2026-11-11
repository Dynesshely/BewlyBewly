<script setup lang="ts">
import { ref, watch } from 'vue'

import FallbackImage from './Feedback/FallbackImage.vue'

/**
 * 图片组件：`<picture>`（AVIF / WebP 候选）+ 统一失败兜底。
 *
 * 失败策略（第 19 轮）：
 * - `<img>` 触发一次 error 后把该 src 标记为失败，**不再重试、不发任何新请求**；
 * - 失败时替换成 `FallbackImage`（虚线边框 + 按类型区分的图标 + 可选文字），
 *   占位填满原图片位置，保持父容器尺寸不变、不引起布局跳动；
 * - `src` 变化（组件被复用到另一条数据）时重置失败态，允许新的 src 重新尝试；
 * - 懒加载图片在进入视口前不会发请求，也就不会出现失败态。
 */
const props = withDefaults(defineProps<{
  src: string
  loading?: 'lazy' | 'eager'
  alt?: string
  /** 解码策略：异步解码，避免图片解码阻塞主线程 */
  decoding?: 'async' | 'sync' | 'auto'
  /** 加载优先级：首屏图用 high，其余 low，交给浏览器调度 */
  fetchpriority?: 'high' | 'low' | 'auto'
  /** 失败占位的媒体类型（图标与默认无障碍文案） */
  fallbackKind?: 'image' | 'video' | 'avatar'
  /** 失败占位上的可选文字（小尺寸场景建议留空，只显示图标） */
  fallbackText?: string
  /** 自定义失败占位的无障碍名称 */
  fallbackAriaLabel?: string
  /** 可选宽高比（如 "16 / 9"）：用于父容器本身没有比例、靠图片撑高的场景 */
  aspect?: string
}>(), {
  loading: 'lazy',
  alt: '',
  decoding: 'async',
  fetchpriority: 'low',
  fallbackKind: 'image',
  fallbackText: '',
  fallbackAriaLabel: '',
  aspect: '',
})

/** 已失败的 src；与当前 src 不同即视为可以重新尝试 */
const failedSrc = ref('')

watch(() => props.src, () => {
  failedSrc.value = ''
})

function handleError(): void {
  // 同一张图只记录一次失败：置空 src 后浏览器不会再请求，也不会反复触发 error
  if (failedSrc.value === props.src)
    return
  failedSrc.value = props.src
}

const isFailed = computed(() => Boolean(props.src) && failedSrc.value === props.src)
</script>

<template>
  <picture
    class="bewly-picture"
    :class="{ 'is-failed': isFailed }"
    :style="aspect ? { aspectRatio: aspect } : undefined"
  >
    <FallbackImage
      v-if="isFailed"
      :kind="fallbackKind"
      :text="fallbackText"
      :aria-label="fallbackAriaLabel || alt || undefined"
    />
    <template v-else>
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
        @error="handleError"
      >
    </template>
  </picture>
</template>

<style scoped lang="scss">
/* 让 <picture> 成为可被父级布局的块盒：尺寸仍由调用方的 class 决定，
   与之前直接用 <img> 时的占位一致；失败态下 FallbackImage 直接撑满同一盒子 */
.bewly-picture {
  display: block;
  max-width: 100%;
}
</style>
