<script setup lang="ts">
import type { Video } from '~/components/VideoCard/types'
import { useCardQuickActions } from './useCardQuickActions'

const props = withDefaults(defineProps<{
  video: Video
  showWatchLater?: boolean
  watchLaterActive?: boolean
}>(), {
  showWatchLater: true,
  watchLaterActive: false,
})

const emit = defineEmits<{
  (e: 'toggleWatchLater'): void
}>()

const {
  messages,
  canLike,
  canFavorite,
  isLiked,
  isFavorited,
  likePending,
  favoritePending,
  toggleLike,
  addToFavorites,
} = useCardQuickActions(() => props.video)
</script>

<template>
  <div
    v-if="canLike || canFavorite || showWatchLater"
    class="bewly-card-actions opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto"
    role="group"
    :aria-label="messages.groupLabel"
  >
    <button
      v-if="canLike"
      type="button"
      class="bewly-card-actions__btn"
      :class="{ 'is-active': isLiked }"
      :aria-pressed="isLiked"
      :aria-label="isLiked ? messages.unlike : messages.like"
      :title="isLiked ? messages.unlike : messages.like"
      :disabled="likePending"
      @click.stop.prevent="toggleLike"
    >
      <span class="i-solar:like-bold-duotone" aria-hidden="true" />
    </button>

    <button
      v-if="canFavorite"
      type="button"
      class="bewly-card-actions__btn"
      :class="{ 'is-active': isFavorited }"
      :aria-pressed="isFavorited"
      :aria-label="isFavorited ? messages.favorited : messages.favorite"
      :title="isFavorited ? messages.favorited : messages.favorite"
      :disabled="favoritePending"
      @click.stop.prevent="addToFavorites"
    >
      <span :class="isFavorited ? 'i-mingcute:star-fill' : 'i-mingcute:star-line'" aria-hidden="true" />
    </button>

    <button
      v-if="showWatchLater"
      type="button"
      class="bewly-card-actions__btn"
      :class="{ 'is-active': watchLaterActive }"
      :aria-pressed="watchLaterActive"
      :aria-label="$t('common.save_to_watch_later')"
      :title="watchLaterActive ? $t('common.added') : $t('common.save_to_watch_later')"
      @click.stop.prevent="emit('toggleWatchLater')"
    >
      <span :class="watchLaterActive ? 'i-mingcute:check-line' : 'i-mingcute:carplay-line'" aria-hidden="true" />
    </button>
  </div>
</template>

<style lang="scss" scoped>
.bewly-card-actions {
  position: absolute;
  right: 0;
  bottom: 0;
  z-index: 2;
  display: flex;
  gap: 4px;
  margin: 4px;
  transition: opacity 180ms cubic-bezier(0.22, 0.61, 0.36, 1);
}

.bewly-card-actions__btn {
  display: grid;
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 16px;
  line-height: 1;
  color: var(--bew-text-1);
  cursor: pointer;
  background: var(--bew-elevated-solid);
  border: 1px solid var(--bew-border-color);
  border-radius: 8px;
  box-shadow: var(--bew-shadow-1);
  opacity: 0.92;
  transition:
    color 180ms cubic-bezier(0.22, 0.61, 0.36, 1),
    background-color 180ms cubic-bezier(0.22, 0.61, 0.36, 1),
    opacity 180ms cubic-bezier(0.22, 0.61, 0.36, 1);
  place-items: center;
}

.bewly-card-actions__btn:hover {
  color: var(--bew-theme-color);
  background: var(--bew-elevated-solid-hover);
  opacity: 1;
}

.bewly-card-actions__btn.is-active {
  color: var(--bew-theme-color);
  background: var(--bew-theme-color-20);
  border-color: var(--bew-theme-color-40);
}

.bewly-card-actions__btn:disabled {
  cursor: progress;
  opacity: 0.55;
}

.bewly-card-actions__btn:focus-visible {
  outline: 2px solid var(--bew-theme-color);
  outline-offset: 2px;
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .bewly-card-actions,
  .bewly-card-actions__btn {
    transition: none;
  }

  .bewly-card-actions {
    transform: none;
  }
}
</style>
