<script setup lang="ts">
import type { DrawnContent } from '../types'

import Picture from '~/components/Picture.vue'
import { useDrawnMomentsI18n } from '../i18n'
import DrawnMomentPics from './DrawnMomentPics.vue'
import DrawnMomentText from './DrawnMomentText.vue'

/**
 * 一条动态的「内容块」：视频卡 / 图文（正文 + 九宫格）/ 直播预约卡。
 *
 * 同一个组件既用于原创动态的内容，也用于转发引用块里的原动态内容，
 * 只是外层把宽度收窄（见 nativeMoments.scss 的 `.bewly-moment-quote` 规则）。
 */
defineProps<{
  content: DrawnContent
}>()

const { t } = useDrawnMomentsI18n()
</script>

<template>
  <div v-if="content.kind === 'video' && content.video" class="bewly-moment-video">
    <a
      class="bewly-moment-video__cover"
      :href="content.video.href"
      target="_blank"
      rel="noopener noreferrer"
      :title="t.openVideo"
      :aria-label="t.openVideo"
    >
      <Picture :src="content.video.cover" aspect="16 / 9" fallback-kind="video" />
      <span v-if="content.video.duration" class="bewly-moment-video__duration">{{ content.video.duration }}</span>
    </a>
    <div class="bewly-moment-video__body">
      <span v-if="content.video.badge" class="bewly-moment-video__badge">{{ content.video.badge }}</span>
      <a
        class="bewly-moment-video__title"
        :href="content.video.href"
        target="_blank"
        rel="noopener noreferrer"
      >{{ content.video.title }}</a>
      <p v-if="content.video.desc" class="bewly-moment-video__desc">
        {{ content.video.desc }}
      </p>
      <div v-if="content.video.stats.length" class="bewly-moment-video__stats">
        <span v-for="stat in content.video.stats" :key="stat">{{ stat }}</span>
      </div>
    </div>
  </div>

  <div v-else-if="content.kind === 'reserve' && content.reserve" class="bewly-moment-reserve">
    <span class="bewly-moment-reserve__label">{{ t.reserve }}</span>
    <span class="bewly-moment-reserve__title">{{ content.reserve.title }}</span>
    <span class="bewly-moment-reserve__meta">
      <span v-if="content.reserve.when">{{ content.reserve.when }}</span>
      <span v-if="content.reserve.count">{{ content.reserve.count }}</span>
    </span>
  </div>

  <div v-else class="bewly-moment-opus">
    <h3 v-if="content.title" class="bewly-moment-opus__title">
      {{ content.title }}
    </h3>
    <DrawnMomentText v-if="content.text" :text="content.text" :lines="6" />
    <DrawnMomentPics v-if="content.pics.length" :pictures="content.pics" />
  </div>
</template>
