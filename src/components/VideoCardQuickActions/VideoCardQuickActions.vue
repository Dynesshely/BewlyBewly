<script setup lang="ts">
import type { Video } from '~/components/VideoCard/types'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import FavoriteFolderPanel from './FavoriteFolderPanel.vue'
import { cancelQueuedInteractionStatus, ensureInteractionStatus } from './interactionStatus'
import { useCardQuickActions } from './useCardQuickActions'

const props = withDefaults(defineProps<{
  video: Video
  showWatchLater?: boolean
  watchLaterActive?: boolean
}>(), {
  showWatchLater: true,
  watchLaterActive: false,
})

/**
 * 保留事件声明（不再触发）：`VideoCard` 仍传 `@toggle-watch-later`，
 * 声明后该监听不会再作为 fallthrough attr 落到根节点上。
 * 稍后再看的开关逻辑已完全在本组件内处理。
 */
defineEmits<{
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
  favoritePanelOpen,
  favoriteFolderOptions,
  favoriteFolderLoading,
  favoriteFolderFailed,
  selectedFolderIds,
  favoriteCreatePending,
  createdFolderId,
  isInWatchLater,
  watchLaterPending,
  toggleWatchLater,
  createFavoriteFolder,
  toggleLike,
  handleFavoriteButton,
  closeFavoritePanel,
  toggleFolderSelection,
  submitFavoriteSelection,
  reloadFavoriteFolders,
} = useCardQuickActions(() => props.video)

function handleLike() {
  closeFavoritePanel()
  void toggleLike()
}

/**
 * 稍后再看改为开关（第 19 轮）：已加入则移除，未加入则加入；状态与回滚都在组合式函数里。
 *
 * 状态优先级：本会话记录（含 5 分钟缓存）→ 父组件传入的初始值。
 * 父组件只在「快捷操作条关闭、回退渲染单独按钮」时才持有该状态，两边不会互相覆盖。
 */
const watchLaterActiveResolved = computed<boolean>(() => {
  const local = isInWatchLater.value
  return local ?? props.watchLaterActive
})

function handleWatchLater() {
  closeFavoritePanel()
  void toggleWatchLater()
}

const barRef = ref<HTMLElement | null>(null)
let cardElement: HTMLElement | null = null

/** 悬停 / 键盘聚焦卡片时懒查询真实互动状态（内部有缓存与并发限制） */
function handleCardInteraction() {
  ensureInteractionStatus(props.video)
}

onMounted(() => {
  cardElement = barRef.value?.closest('[data-video-card]') as HTMLElement | null
  cardElement?.addEventListener('mouseenter', handleCardInteraction)
  cardElement?.addEventListener('focusin', handleCardInteraction)
})

onBeforeUnmount(() => {
  cardElement?.removeEventListener('mouseenter', handleCardInteraction)
  cardElement?.removeEventListener('focusin', handleCardInteraction)
  cardElement = null
  // 卡片卸载 / 页面切换时取消尚未发出的排队查询
  cancelQueuedInteractionStatus(props.video)
})
</script>

<template>
  <div
    v-if="canLike || canFavorite || showWatchLater"
    ref="barRef"
    class="bewly-card-actions opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto"
    :class="{ 'is-open': favoritePanelOpen }"
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
      @click.stop.prevent="handleLike"
    >
      <span class="i-solar:like-bold-duotone" aria-hidden="true" />
    </button>

    <button
      v-if="canFavorite"
      type="button"
      class="bewly-card-actions__btn"
      :class="{ 'is-active': isFavorited, 'is-busy': favoritePending }"
      :aria-pressed="isFavorited"
      :aria-expanded="favoritePanelOpen"
      aria-haspopup="dialog"
      :aria-label="isFavorited ? messages.favorited : messages.favorite"
      :title="isFavorited ? messages.favorited : messages.favorite"
      :disabled="favoritePending"
      @click.stop.prevent="handleFavoriteButton"
    >
      <span :class="isFavorited ? 'i-mingcute:star-fill' : 'i-mingcute:star-line'" aria-hidden="true" />
    </button>

    <button
      v-if="showWatchLater"
      type="button"
      class="bewly-card-actions__btn"
      :class="{ 'is-active': watchLaterActiveResolved, 'is-busy': watchLaterPending }"
      :aria-pressed="watchLaterActiveResolved"
      :aria-label="$t('common.save_to_watch_later')"
      :title="watchLaterActiveResolved ? $t('common.added') : $t('common.save_to_watch_later')"
      :disabled="watchLaterPending"
      @click.stop.prevent="handleWatchLater"
    >
      <span :class="watchLaterActiveResolved ? 'i-mingcute:check-line' : 'i-mingcute:carplay-line'" aria-hidden="true" />
    </button>

    <FavoriteFolderPanel
      v-if="canFavorite"
      :open="favoritePanelOpen"
      :folders="favoriteFolderOptions"
      :selected-ids="selectedFolderIds"
      :loading="favoriteFolderLoading"
      :failed="favoriteFolderFailed"
      :pending="favoritePending"
      :create-pending="favoriteCreatePending"
      :created-folder-id="createdFolderId"
      @create="createFavoriteFolder"
      @toggle-folder="toggleFolderSelection"
      @submit="submitFavoriteSelection"
      @retry="reloadFavoriteFolders"
      @close="closeFavoritePanel"
    />
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

/* 收藏面板打开时，即使鼠标移出卡片也保持可见可点 */
.bewly-card-actions.is-open {
  pointer-events: auto;
  opacity: 1;
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

.bewly-card-actions__btn.is-busy {
  cursor: progress;
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
}

/* #region 暗色 / 高对比度（第 17 轮） */
.dark .bewly-card-actions__btn:disabled {
  /* 0.55 的禁用透明度在暗色下会让图标掉到约 2:1，抬到 0.72 保证仍能辨认「不可点」 */
  opacity: 0.72;
}

@media (prefers-contrast: more) {
  .bewly-card-actions__btn {
    border-color: var(--bew-text-3);
    opacity: 1;
  }

  .bewly-card-actions__btn:disabled {
    opacity: 0.8;
  }
}
/* #endregion */
</style>
