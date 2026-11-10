<script setup lang="ts">
import type { MomentCard, MomentImage } from '../types'
import { useMomentsOpen } from '../composables/useMomentsOpen'
import { useMomentsI18n } from '../i18n'

import MomentMedia from './MomentMedia.vue'

const props = withDefaults(defineProps<{
  card: MomentCard
  active?: boolean
  /** 转发卡片里嵌套的原动态，缩小一档展示 */
  compact?: boolean
}>(), {
  active: false,
  compact: false,
})

const emit = defineEmits<{
  (e: 'activate'): void
  (e: 'open', card: MomentCard): void
  (e: 'openImages', images: MomentImage[], index: number): void
}>()

const { t, count, time, typeLabel } = useMomentsI18n()
const { openInNewTab } = useMomentsOpen()

const TEXT_LINES = 4
const COMPACT_TEXT_LINES = 3

const expanded = ref(false)
const overflowing = ref(false)
const textRef = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null

/** 折叠时比较 scrollHeight / clientHeight 判断正文是否超过行数上限 */
function measureOverflow() {
  const element = textRef.value
  if (!element || props.compact || expanded.value)
    return
  overflowing.value = element.scrollHeight - element.clientHeight > 2
}

function toggleExpanded() {
  expanded.value = !expanded.value
  if (!expanded.value)
    nextTick(measureOverflow)
}

function handleAuthorClick() {
  openInNewTab(props.card.author.jumpUrl)
}

function forwardImages(index: number) {
  emit('openImages', props.card.images, index)
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

watch(() => props.card.text, async () => {
  expanded.value = false
  await nextTick()
  measureOverflow()
})
</script>

<template>
  <article
    class="moment-card"
    :class="{ 'is-active': active && !compact, 'is-compact': compact }"
    :data-moment-id="compact ? undefined : card.id"
    :tabindex="compact ? undefined : -1"
    @click="emit('activate')"
  >
    <div class="moment-card__rail">
      <button type="button" class="moment-card__avatar" @click.stop="handleAuthorClick">
        <img v-if="card.author.face" :src="card.author.face" :alt="t('avatar_alt', { name: card.author.name })" loading="lazy">
        <span v-else class="moment-card__avatar-fallback">{{ card.author.name.slice(0, 1) }}</span>
      </button>
    </div>

    <div class="moment-card__main">
      <header class="moment-card__head">
        <div class="moment-card__author">
          <button type="button" class="moment-card__name" @click.stop="handleAuthorClick">
            {{ card.author.name }}
          </button>
          <span v-if="card.author.label" class="moment-card__label">{{ card.author.label }}</span>
          <span v-if="card.author.pubAction" class="moment-card__action">{{ card.author.pubAction }}</span>
        </div>
        <div class="moment-card__meta">
          <span class="moment-card__type" :class="`is-${card.type}`">
            {{ typeLabel(card.type) }}
          </span>
          <time v-if="card.pubTs" class="moment-card__time">{{ time(card.pubTs) }}</time>
        </div>
      </header>

      <p
        v-if="card.text"
        ref="textRef"
        class="moment-card__text"
        :class="{ 'is-expanded': expanded, 'is-compact': compact }"
        :style="{
          '--moment-text-lines': compact ? COMPACT_TEXT_LINES : TEXT_LINES,
        }"
      >
        {{ card.text }}
      </p>
      <button
        v-if="!compact && overflowing"
        type="button"
        class="moment-card__expand"
        @click.stop="toggleExpanded"
      >
        {{ expanded ? t('collapse') : t('expand') }}
      </button>

      <MomentMedia
        :card="card"
        :compact="compact"
        @open-link="emit('open', card)"
        @open-images="forwardImages"
      />

      <div v-if="card.type === 'forward' && !card.origin && !compact" class="moment-card__deleted">
        {{ t('origin_deleted') }}
      </div>

      <MomentCard
        v-if="card.origin"
        :card="card.origin"
        compact
        @activate="emit('activate')"
        @open="emit('open', $event)"
        @open-images="(images, index) => emit('openImages', images, index)"
      />

      <footer v-if="!compact" class="moment-card__stats">
        <span class="moment-card__stat" :title="t('stat_forward')">
          <span class="i-tabler:repeat" aria-hidden="true" />
          {{ count(card.stats.forward) }}
        </span>
        <span class="moment-card__stat" :title="t('stat_comment')">
          <span class="i-tabler:message-circle" aria-hidden="true" />
          {{ count(card.stats.comment) }}
        </span>
        <span class="moment-card__stat" :title="t('stat_like')">
          <span class="i-tabler:heart" aria-hidden="true" />
          {{ count(card.stats.like) }}
        </span>
        <button type="button" class="moment-card__open" @click.stop="emit('open', card)">
          {{ t('open_original') }}
          <span class="i-tabler:arrow-up-right" aria-hidden="true" />
        </button>
      </footer>
    </div>
  </article>
</template>

<style scoped lang="scss">
.moment-card {
  --moment-ease: cubic-bezier(0.22, 0.61, 0.36, 1);
  --moment-duration: 200ms;

  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border: 1px solid var(--bew-border-color);
  border-radius: var(--bew-radius);
  background: var(--bew-elevated);
  scroll-margin-block: calc(var(--bew-top-bar-height) + 16px) 24px;
  transition:
    border-color var(--moment-duration) var(--moment-ease),
    box-shadow var(--moment-duration) var(--moment-ease),
    transform var(--moment-duration) var(--moment-ease);

  &:hover {
    border-color: var(--bew-theme-color-30);
  }

  &.is-active {
    border-color: var(--bew-theme-color);
    box-shadow:
      0 0 0 1px var(--bew-theme-color),
      var(--bew-shadow-1);
    transform: translateY(-1px);
  }

  &.is-compact {
    gap: 10px;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
    transform: none;
  }
}

.moment-card__rail {
  flex: none;
}

.moment-card__avatar {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 50%;
  background: var(--bew-skeleton);
  cursor: pointer;
  transition: transform var(--moment-duration) var(--moment-ease);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &:hover {
    transform: scale(1.06);
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 2px;
  }

  .is-compact & {
    width: 28px;
    height: 28px;
  }
}

.moment-card__avatar-fallback {
  color: var(--bew-theme-color);
  font-size: 16px;
  font-weight: 600;
}

.moment-card__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.moment-card__head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.moment-card.is-compact .moment-card__head {
  align-items: center;
}

.moment-card__author {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.moment-card__name {
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  border: 0;
  background: none;
  color: var(--bew-text-1);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition: color var(--moment-duration) var(--moment-ease);

  &:hover {
    color: var(--bew-theme-color);
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 2px;
    border-radius: 4px;
  }
}

.moment-card__label {
  padding: 0 6px;
  border-radius: 6px;
  background: var(--bew-theme-color-10);
  color: var(--bew-theme-color);
  font-size: 11px;
  line-height: 18px;
}

.moment-card__action {
  color: var(--bew-text-3);
  font-size: 12px;
  line-height: 1.5;
}

.moment-card__meta {
  display: flex;
  flex: none;
  gap: 8px;
  align-items: center;
}

.moment-card__type {
  padding: 0 8px;
  border-radius: 6px;
  background: var(--bew-fill-1);
  color: var(--bew-text-3);
  font-size: 12px;
  line-height: 20px;
  white-space: nowrap;

  &.is-video,
  &.is-pgc,
  &.is-live {
    background: var(--bew-theme-color-10);
    color: var(--bew-theme-color);
  }
}

.moment-card__time {
  color: var(--bew-text-3);
  font-size: 12px;
  line-height: 1.5;
  white-space: nowrap;
}

.moment-card__text {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--bew-text-1);
  font-size: 14px;
  line-height: 1.7;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: var(--moment-text-lines, 4);

  &.is-expanded {
    display: block;
    overflow: visible;
    -webkit-line-clamp: unset;
  }

  &.is-compact {
    color: var(--bew-text-2);
    font-size: 13px;
    line-height: 1.6;
  }
}

.moment-card__expand {
  align-self: flex-start;
  padding: 0;
  border: 0;
  background: none;
  color: var(--bew-theme-color);
  font-size: 12px;
  line-height: 1.5;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 2px;
    border-radius: 4px;
  }
}

.moment-card__deleted {
  padding: 12px 14px;
  border: 1px dashed var(--bew-border-color);
  border-radius: 10px;
  color: var(--bew-text-3);
  font-size: 12px;
  line-height: 1.5;
}

.moment-card__stats {
  display: flex;
  gap: 18px;
  align-items: center;
  margin-top: 2px;
  padding-top: 10px;
  border-top: 1px solid var(--bew-border-color);
}

.moment-card__stat {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  color: var(--bew-text-3);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
}

.moment-card__open {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  margin-left: auto;
  padding: 4px 10px;
  border: 1px solid var(--bew-border-color);
  border-radius: 8px;
  background: transparent;
  color: var(--bew-text-2);
  font-size: 12px;
  line-height: 1.5;
  cursor: pointer;
  transition:
    color var(--moment-duration) var(--moment-ease),
    background-color var(--moment-duration) var(--moment-ease),
    border-color var(--moment-duration) var(--moment-ease);

  &:hover {
    border-color: var(--bew-theme-color-40);
    background: var(--bew-fill-1);
    color: var(--bew-text-1);
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .moment-card,
  .moment-card__avatar,
  .moment-card__name,
  .moment-card__open {
    transition: none;
  }

  .moment-card.is-active,
  .moment-card__avatar:hover {
    transform: none;
  }
}
</style>
