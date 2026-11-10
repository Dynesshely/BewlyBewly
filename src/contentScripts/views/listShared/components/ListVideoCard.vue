<script setup lang="ts">
import type { ListCardItem, ListQuickActionId, ListViewMode } from '../types'
import VideoCard from '~/components/VideoCard/VideoCard.vue'

import { useListI18n } from '../i18n'

const props = defineProps<{
  item: ListCardItem
  viewMode: ListViewMode
}>()

const emit = defineEmits<{
  (e: 'action', payload: { id: ListQuickActionId, item: ListCardItem }): void
}>()

const { tl } = useListI18n()

const ACTION_META: Record<ListQuickActionId, { icon: string, key: string, danger?: boolean }> = {
  watchLater: { icon: 'i-mingcute:carplay-line', key: 'action.watchLater' },
  copy: { icon: 'i-solar:copy-bold-duotone', key: 'action.copy' },
  remove: { icon: 'i-tabler:trash', key: 'action.remove', danger: true },
  unfavorite: { icon: 'i-mingcute:delete-2-line', key: 'action.unfavorite', danger: true },
}

const progressText = computed(() => {
  const progress = props.item.progress
  if (!progress)
    return ''
  return progress.finished
    ? tl('progress.finished', { total: progress.total })
    : tl('progress.watched', { watched: progress.watched, total: progress.total })
})
</script>

<template>
  <article class="bewly-list-card" :class="{ 'bewly-list-card--list': viewMode === 'list' }">
    <div v-if="viewMode === 'list'" class="bewly-list-card__rail" aria-hidden="true">
      <span class="bewly-list-card__rail-time">{{ item.timeLabel ?? '' }}</span>
    </div>

    <div class="bewly-list-card__body">
      <VideoCard
        class="bewly-list-card__video"
        :video="item.video"
        :horizontal="viewMode === 'list'"
        :show-watcher-later="false"
        :more-btn="false"
      />

      <div class="bewly-list-card__actions" role="group" :aria-label="tl('a11y.quick_actions')">
        <button
          v-for="action in item.actions"
          :key="action"
          type="button"
          class="bewly-list-card__action"
          :class="{ 'is-danger': ACTION_META[action].danger }"
          :title="tl(ACTION_META[action].key)"
          :aria-label="tl(ACTION_META[action].key)"
          @click.stop.prevent="emit('action', { id: action, item })"
        >
          <span :class="ACTION_META[action].icon" aria-hidden="true" />
        </button>
      </div>

      <div v-if="item.progress" class="bewly-list-card__progress">
        <div class="bewly-list-card__progress-track">
          <div class="bewly-list-card__progress-fill" :style="{ width: `${item.progress.percent}%` }" />
        </div>
        <p class="bewly-list-card__progress-text">
          {{ progressText }}
        </p>
      </div>
    </div>
  </article>
</template>
