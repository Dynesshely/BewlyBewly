<script setup lang="ts">
/**
 * 直播卡（首页网格 / 侧栏推荐共用）。
 *
 * 结构对齐需求：封面 16:9 + 直播中徽标 + 人气值 + 主播头像 + 主播名 + 分区。
 * 颜色 / 圆角 / 阴影全部来自 `--bew-*` 变量，深浅主题自动跟随。
 */
import type { LiveRoomCard } from '../../types'
import { useLiveI18n } from '../../i18n'
import { areaLabel, coverImage, faceImage, formatCount, roomHref } from '../../utils'

const props = withDefaults(defineProps<{
  card: LiveRoomCard
  /** 侧栏推荐用的紧凑样式 */
  compact?: boolean
}>(), {
  compact: false,
})

const { t } = useLiveI18n()

const href = computed(() => roomHref(props.card.roomId))
const cover = computed(() => coverImage(props.card.cover))
const face = computed(() => faceImage(props.card.face, 48))
const area = computed(() => areaLabel(props.card.parentAreaName, props.card.areaName))
const online = computed(() => formatCount(props.card.online))
</script>

<template>
  <a
    class="bew-live-card"
    :class="{ 'is-compact': compact }"
    :href="href"
    target="_blank"
    rel="noopener"
    :title="card.title"
  >
    <div class="bew-live-card__cover">
      <img v-if="cover" :src="cover" :alt="card.title" loading="lazy" referrerpolicy="no-referrer">
      <div v-else class="bew-live-card__cover-fallback" />
      <span class="bew-live-card__badge">
        <span class="bew-live-card__badge-dot" />
        {{ t.liveBadge }}
      </span>
      <span v-if="card.online > 0" class="bew-live-card__online">
        {{ online }} {{ t.onlineLabel }}
      </span>
    </div>

    <div class="bew-live-card__meta">
      <img
        v-if="face" class="bew-live-card__face" :src="face" alt="" loading="lazy"
        referrerpolicy="no-referrer"
      >
      <div class="bew-live-card__text">
        <p class="bew-live-card__title">
          {{ card.title }}
        </p>
        <p class="bew-live-card__sub">
          <span class="bew-live-card__uname">{{ card.uname }}</span>
          <span v-if="area" class="bew-live-card__area">{{ area }}</span>
          <span v-if="card.watchedText && !compact" class="bew-live-card__watched">
            {{ card.watchedText }} {{ t.watchedLabel }}
          </span>
        </p>
      </div>
    </div>
  </a>
</template>
