<script setup lang="ts">
import type { MomentsDensity } from '../composables/useMomentsDensity'
import type { MomentCard } from '../types'
import { useMomentsI18n } from '../i18n'

const props = withDefaults(defineProps<{
  card: MomentCard
  compact?: boolean
  /** 卡片密度：紧凑档缩小封面与九宫格尺寸 */
  density?: MomentsDensity
}>(), {
  compact: false,
  density: 'comfortable',
})

const emit = defineEmits<{
  (e: 'openLink'): void
  (e: 'openImages', index: number): void
}>()

const { t, count } = useMomentsI18n()

const isDense = computed(() => props.density === 'compact')

const imageCount = computed(() => props.card.images.length)

/** 九宫格布局：1 图大图、2–4 图两列、5–9 图三列 */
const imageGridClass = computed(() => {
  if (imageCount.value === 1)
    return 'is-single'
  if (imageCount.value <= 4)
    return 'is-two'
  return 'is-three'
})

/** 单图按原始比例展示，避免大图被裁成方块 */
const singleImageStyle = computed(() => {
  const image = props.card.images[0]
  if (!image || !image.width || !image.height)
    return undefined
  return { aspectRatio: `${image.width} / ${image.height}` }
})

function handleLinkKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emit('openLink')
  }
}
</script>

<template>
  <div v-if="card.type === 'video' || card.type === 'pgc'" class="moment-media" :class="{ 'is-density-compact': isDense }">
    <div
      v-if="card.video"
      class="moment-media__video"
      :class="{ 'is-compact': compact }"
      role="button"
      tabindex="0"
      :aria-label="t('media_open_hint')"
      @click="emit('openLink')"
      @keydown="handleLinkKeydown"
    >
      <div class="moment-media__video-cover">
        <img :src="card.video.cover" alt="" loading="lazy" decoding="async">
        <span v-if="card.video.duration" class="moment-media__duration">{{ card.video.duration }}</span>
        <span class="moment-media__play" aria-hidden="true">
          <span class="i-tabler:player-play-filled" />
        </span>
      </div>
      <div class="moment-media__video-body">
        <p class="moment-media__video-title">
          {{ card.video.title }}
        </p>
        <p class="moment-media__video-meta">
          <span v-if="card.video.badge || card.type === 'pgc'" class="moment-media__badge">{{ card.video.badge || t('type_pgc') }}</span>
          <span v-if="card.video.play">{{ t('play_count', { n: card.video.play }) }}</span>
          <span v-if="card.video.danmaku">{{ t('danmaku_count', { n: card.video.danmaku }) }}</span>
        </p>
      </div>
    </div>
  </div>

  <div v-else-if="card.type === 'article' && card.article" class="moment-media" :class="{ 'is-density-compact': isDense }">
    <div
      class="moment-media__article"
      :class="{ 'is-compact': compact }"
      role="button"
      tabindex="0"
      @click="emit('openLink')"
      @keydown="handleLinkKeydown"
    >
      <div class="moment-media__article-cover">
        <img v-if="card.article.cover" :src="card.article.cover" alt="" loading="lazy" decoding="async">
        <span v-else class="moment-media__article-placeholder" aria-hidden="true">
          <span class="i-tabler:file-text" />
        </span>
      </div>
      <div class="moment-media__article-body">
        <p class="moment-media__article-badge">
          {{ t('article_badge') }}
        </p>
        <p class="moment-media__article-title">
          {{ card.article.title }}
        </p>
        <p v-if="card.article.desc" class="moment-media__article-desc">
          {{ card.article.desc }}
        </p>
      </div>
    </div>
  </div>

  <div v-else-if="card.type === 'live' && card.live" class="moment-media" :class="{ 'is-density-compact': isDense }">
    <div
      class="moment-media__live"
      :class="{ 'is-compact': compact }"
      role="button"
      tabindex="0"
      @click="emit('openLink')"
      @keydown="handleLinkKeydown"
    >
      <div class="moment-media__live-cover">
        <img :src="card.live.cover" alt="" loading="lazy" decoding="async">
        <span class="moment-media__live-badge">
          <span class="i-fluent:live-24-filled" aria-hidden="true" />
          {{ card.live.liveStatus === 1
            ? t('live_badge')
            : t('live_offline') }}
        </span>
      </div>
      <div class="moment-media__live-body">
        <p class="moment-media__live-title">
          {{ card.live.title }}
        </p>
        <p class="moment-media__live-meta">
          <span v-if="card.live.area">{{ card.live.area }}</span>
          <span v-if="card.live.online">{{ t('live_online', { n: count(card.live.online) }) }}</span>
        </p>
      </div>
    </div>
  </div>

  <div v-else-if="card.images.length" class="moment-media" :class="{ 'is-density-compact': isDense }">
    <div class="moment-media__grid" :class="[imageGridClass, { 'is-compact': compact }]">
      <button
        v-for="(image, index) in card.images"
        :key="`${image.url}-${index}`"
        type="button"
        class="moment-media__cell"
        :style="index === 0 && imageCount === 1 ? singleImageStyle : undefined"
        :aria-label="t('image_alt', { n: index + 1 })"
        @click="emit('openImages', index)"
      >
        <img :src="image.url" alt="" loading="lazy" decoding="async">
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.moment-media {
  --moment-ease: cubic-bezier(0.22, 0.61, 0.36, 1);
  --moment-duration: 200ms;

  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

/* #region 视频 / 直播：横向缩略图 + 信息 */
.moment-media__video,
.moment-media__live {
  display: flex;
  gap: 12px;
  padding: 10px;
  border: 1px solid var(--bew-border-color);
  border-radius: 10px;
  background: var(--bew-fill-1);
  cursor: pointer;
  transition: background-color var(--moment-duration) var(--moment-ease);

  &:hover {
    background: var(--bew-fill-2);
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 2px;
  }
}

.moment-media__video-cover,
.moment-media__live-cover {
  position: relative;
  flex: none;
  width: 200px;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 8px;
  background: var(--bew-skeleton);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.moment-media__video.is-compact .moment-media__video-cover,
.moment-media__live.is-compact .moment-media__live-cover {
  width: 120px;
}

.moment-media__duration {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 0 4px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.62);
  color: #fff;
  font-size: 11px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
}

.moment-media__play {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 14px;
  transform: translate(-50%, -50%);
  transition: transform var(--moment-duration) var(--moment-ease);
}

.moment-media__video:hover .moment-media__play {
  transform: translate(-50%, -50%) scale(1.08);
}

.moment-media__video-body,
.moment-media__live-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.moment-media__video-title,
.moment-media__live-title {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--bew-text-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.moment-media__video-meta,
.moment-media__live-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  align-items: center;
  margin: 0;
  color: var(--bew-text-3);
  font-size: 12px;
  line-height: 1.5;
}

.moment-media__badge {
  padding: 0 6px;
  border-radius: 6px;
  background: var(--bew-theme-color-10);
  color: var(--bew-theme-color);
  font-size: 11px;
  line-height: 18px;
}

.moment-media__live-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 0 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 11px;
  line-height: 18px;
}
/* #endregion */

/* #region 专栏 */
.moment-media__article {
  display: flex;
  gap: 12px;
  padding: 10px;
  border: 1px solid var(--bew-border-color);
  border-radius: 10px;
  background: var(--bew-fill-1);
  cursor: pointer;
  transition: background-color var(--moment-duration) var(--moment-ease);

  &:hover {
    background: var(--bew-fill-2);
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 2px;
  }
}

.moment-media__article-cover {
  display: grid;
  flex: none;
  place-items: center;
  width: 96px;
  height: 96px;
  overflow: hidden;
  border-radius: 8px;
  background: var(--bew-skeleton);
  color: var(--bew-text-3);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.moment-media__article.is-compact .moment-media__article-cover {
  width: 64px;
  height: 64px;
}

.moment-media__article-placeholder {
  font-size: 28px;
}

.moment-media__article-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.moment-media__article-badge {
  margin: 0;
  color: var(--bew-theme-color);
  font-size: 11px;
  line-height: 18px;
}

.moment-media__article-title {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--bew-text-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.moment-media__article-desc {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--bew-text-3);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
/* #endregion */

/* #region 九宫格 */
.moment-media__grid {
  display: grid;
  gap: 4px;
  overflow: hidden;
  border-radius: 10px;

  &.is-single {
    grid-template-columns: minmax(0, 1fr);
    width: min(100%, 420px);
  }

  &.is-two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    max-width: 480px;
  }

  &.is-three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    max-width: 520px;
  }

  &.is-compact.is-single {
    width: min(100%, 220px);
  }

  &.is-compact.is-two,
  &.is-compact.is-three {
    max-width: 300px;
  }
}

.moment-media__cell {
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: var(--bew-skeleton);
  cursor: zoom-in;
  aspect-ratio: 1;

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 240ms var(--moment-ease);
  }

  &:hover img {
    transform: scale(1.04);
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 2px;
    z-index: 1;
  }
}

.moment-media__grid.is-single .moment-media__cell {
  max-height: 420px;
}

.moment-media__grid.is-compact.is-single .moment-media__cell {
  max-height: 200px;
}
/* #endregion */

/* #region 紧凑密度 */
.moment-media.is-density-compact {
  gap: 6px;

  .moment-media__video,
  .moment-media__live,
  .moment-media__article {
    gap: 10px;
    padding: 8px;
  }

  .moment-media__video-cover,
  .moment-media__live-cover {
    width: 150px;
  }

  .moment-media__article-cover {
    width: 72px;
    height: 72px;
  }

  .moment-media__video-title,
  .moment-media__article-title {
    font-size: 13px;
  }

  .moment-media__grid.is-single {
    width: min(100%, 320px);
  }

  .moment-media__grid.is-two,
  .moment-media__grid.is-three {
    max-width: 400px;
  }

  .moment-media__grid.is-single .moment-media__cell {
    max-height: 300px;
  }
}
/* #endregion */

@media (max-width: 720px) {
  .moment-media__video-cover,
  .moment-media__live-cover {
    width: 132px;
  }

  .moment-media__grid.is-single {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .moment-media__video,
  .moment-media__live,
  .moment-media__article,
  .moment-media__play,
  .moment-media__cell img {
    transition: none;
  }

  .moment-media__video:hover .moment-media__play,
  .moment-media__cell:hover img {
    transform: none;
  }
}
</style>
