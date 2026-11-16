<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import { useDrawnMomentsI18n } from '../i18n'

/**
 * 正文段落：默认折叠 N 行，超出时给「展开 / 收起」。
 *
 * 折叠用 `-webkit-line-clamp` 实现（视觉上带省略号），是否超出用
 * `scrollHeight - clientHeight` 实测判断，不按字数猜。
 */
const props = withDefaults(defineProps<{
  text: string
  lines?: number
}>(), {
  lines: 6,
})

const { t } = useDrawnMomentsI18n()

const textRef = ref<HTMLElement | null>(null)
const expanded = ref(false)
const overflowing = ref(false)
let resizeObserver: ResizeObserver | null = null

function measureOverflow() {
  const element = textRef.value
  if (!element || expanded.value)
    return
  overflowing.value = element.scrollHeight - element.clientHeight > 2
}

onMounted(() => {
  nextTick(measureOverflow)
  if (textRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => measureOverflow())
    resizeObserver.observe(textRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

watch(() => props.text, async () => {
  expanded.value = false
  await nextTick()
  measureOverflow()
})
</script>

<template>
  <div class="bewly-moment-text-wrap">
    <p
      ref="textRef"
      class="bewly-moment-text"
      :class="{ 'is-expanded': expanded }"
      :style="{ '--bew-moment-text-lines': lines }"
    >
      {{ text }}
    </p>
    <button
      v-if="overflowing"
      type="button"
      class="bewly-moment-text__toggle"
      @click="expanded = !expanded"
    >
      {{ expanded ? t.collapse : t.expand }}
    </button>
  </div>
</template>
