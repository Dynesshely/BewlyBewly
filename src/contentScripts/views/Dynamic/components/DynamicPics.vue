<script setup lang="ts">
/**
 * 图片网格：1 张按原比例大图、2–4 张 2 列、5–9 张 3 列。
 *
 * 布局规则与原生动态页一致（也是需求里指定的密度）：
 *   - 1 张：单张大图，按接口给的 `width / height` 出比例，极端长图/宽图夹到可读范围；
 *   - 2–4 张：2 列方格；
 *   - 5–9 张：3 列方格。
 *
 * 每张图都是指向**原图**的新标签页链接（`Picture` 拿的是缩略图，
 * 点击看原图是动态页长期以来的习惯操作）。
 */
import type { DynamicPicture } from '../types'
import { computed } from 'vue'
import Picture from '~/components/Picture.vue'
import { useDynamicI18n } from '../i18n'

const props = defineProps<{
  pictures: DynamicPicture[]
}>()

const { t } = useDynamicI18n()

const count = computed(() => props.pictures.length)

const gridClass = computed(() => {
  if (count.value <= 1)
    return 'is-single'
  if (count.value <= 4)
    return 'is-two'
  return 'is-three'
})

/** 单图按原图比例展示，极端比例夹到可读范围（与卡片宽度联动） */
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
  <div v-if="pictures.length" class="dynamic-pics" :class="gridClass">
    <a
      v-for="(picture, index) in pictures"
      :key="`${picture.src}-${index}`"
      class="dynamic-pics__cell"
      :style="index === 0 ? singleStyle : undefined"
      :href="picture.href"
      target="_blank"
      rel="noopener noreferrer"
      :title="t.viewImage"
      :aria-label="`${t.viewImage} ${index + 1}`"
    >
      <Picture :src="picture.src" :alt="`${index + 1} / ${count}`" />
    </a>
  </div>
</template>
