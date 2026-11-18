<script setup lang="ts">
/**
 * 动态里的视频卡：封面 / 时长 / 标题 / 播放量。
 *
 * 结构沿用原生动态卡（封面左、信息右的横排），封面 16:9 固定比例，
 * 时长角标压在封面右下角 —— 与原生 `.bili-dyn-card-video` 的视觉一致。
 *
 * 真机字段（`major.archive`）：封面 `http://i2.hdslb.com/…`（不带 s）、
 * 时长 `duration_text` 是 `"02:21"` 文本、`stat.play / stat.danmaku` 是**字符串**。
 */
import type { DynamicVideo } from '../types'
import Picture from '~/components/Picture.vue'
import { useDynamicI18n } from '../i18n'

defineProps<{
  video: DynamicVideo
}>()

const { t } = useDynamicI18n()
</script>

<template>
  <a
    class="dynamic-video"
    :href="video.href"
    target="_blank"
    rel="noopener noreferrer"
    :title="t.openVideo"
    :aria-label="t.openVideo"
  >
    <span class="dynamic-video__cover">
      <Picture :src="video.cover" aspect="16 / 9" fallback-kind="video" />
      <span v-if="video.duration" class="dynamic-video__duration">{{ video.duration }}</span>
    </span>
    <span class="dynamic-video__body">
      <span v-if="video.badge" class="dynamic-video__badge">{{ video.badge }}</span>
      <span class="dynamic-video__title">{{ video.title }}</span>
      <span v-if="video.desc" class="dynamic-video__desc">{{ video.desc }}</span>
      <span v-if="video.stats.length" class="dynamic-video__stats">
        <span v-for="stat in video.stats" :key="stat">{{ stat }}</span>
      </span>
    </span>
  </a>
</template>
