<script setup lang="ts">
import type { DrawnPicture } from '../types'

import { computed } from 'vue'

import Picture from '~/components/Picture.vue'
import { useDrawnMomentsI18n } from '../i18n'

/**
 * 图片网格：1 张按原比例大图，2–4 张两列，5–9 张三列（与动态页信息密度一致）。
 */
const props = defineProps<{
  pictures: DrawnPicture[]
}>()

const { t } = useDrawnMomentsI18n()

const count = computed(() => props.pictures.length)

const gridClass = computed(() => {
  if (count.value <= 1)
    return 'is-single'
  if (count.value <= 4)
    return 'is-two'
  return 'is-three'
})

/** 单图按原图比例展示，极端长图/宽图夹到可读范围 */
const singleStyle = computed(() => {
  if (count.value !== 1)
    return undefined
  const ratio = props.pictures[0]?.ratio ?? 1
  const clamped = Math.min(1.8, Math.max(0.62, ratio))
  return {
    aspectRatio: String(clamped),
  }
})
</script>

<template>
  <div v-if="pictures.length" class="bewly-moment-pics" :class="gridClass">
    <a
      v-for="(picture, index) in pictures"
      :key="`${picture.src}-${index}`"
      class="bewly-moment-pics__cell"
      :style="index === 0 ? singleStyle : undefined"
      :href="picture.href"
      target="_blank"
      rel="noopener noreferrer"
      :title="t.viewImage"
      :aria-label="t.viewImage"
    >
      <Picture :src="picture.src" :alt="`${index + 1} / ${count}`" />
    </a>
  </div>
</template>
