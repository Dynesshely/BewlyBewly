<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  src: string
  controls?: boolean
}>()

const emit = defineEmits<{
  (e: 'ready', videoElement: HTMLVideoElement): void
  (e: 'playing'): void
  (e: 'ended'): void
  (e: 'failed'): void
}>()

const videoElement = ref<HTMLVideoElement | null>(null)
/** 组件卸载动画期间仍保留最后一个地址，避免中途把 src 置空导致播放中断 */
const currentSrc = ref<string>(props.src)

watch(() => props.src, (value) => {
  if (value)
    currentSrc.value = value
})

function handleLoaded() {
  const element = videoElement.value
  if (!element)
    return

  // 静音必须显式写在元素上，否则部分浏览器会拦截自动播放
  element.muted = true
  element.play?.().catch(() => emit('failed'))
  emit('ready', element)
}
</script>

<template>
  <video
    ref="videoElement"
    class="bewly-card-preview"
    :src="currentSrc"
    autoplay
    muted
    playsinline
    preload="auto"
    tabindex="-1"
    :aria-hidden="controls ? undefined : 'true'"
    :controls="Boolean(controls)"
    :style="{ pointerEvents: controls ? 'auto' : 'none' }"
    @loadeddata="handleLoaded"
    @playing="emit('playing')"
    @ended="emit('ended')"
    @error="emit('failed')"
  />
</template>

<style lang="scss" scoped>
.bewly-card-preview {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 0;
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  background: var(--bew-content-solid);
  border-radius: var(--bew-radius);
  outline: none;
}
</style>
