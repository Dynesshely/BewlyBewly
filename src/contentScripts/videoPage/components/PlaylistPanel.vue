<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { closeSelectionPanel, selectSelectionItem, togglePlaylistAutoplay } from '../actions'
import { formatPlaylistPosition, useMessages } from '../i18n'
import { ui } from '../state'

const t = useMessages()
const listEl = ref<HTMLElement | null>(null)

/** 面板名跟随选集来源：播放列表 / 分P 选集 */
const panelTitle = computed(() => {
  if (ui.selectionKind === 'parts')
    return t.value.partsPanel
  if (ui.selectionKind === 'collection')
    return t.value.collectionPanel
  return t.value.playlistPanel
})
const panelHint = computed(() => {
  if (ui.selectionKind === 'parts')
    return t.value.partsHint
  if (ui.selectionKind === 'collection')
    return t.value.collectionHint
  return t.value.playlistHint
})

const positionText = computed(() => {
  const total = ui.selectionItems.length
  const current = ui.selectionCurrentIndex >= 0
    ? ui.selectionCurrentIndex + 1
    : 0
  return formatPlaylistPosition(t.value.playlistPosition, current, total)
})

/** 打开面板时把当前项滚到可视区中间（只滚面板自身，不动页面） */
watch(() => ui.selectionPanelOpen, async (open) => {
  if (!open)
    return
  await nextTick()
  const list = listEl.value
  const active = list?.querySelector<HTMLElement>('[aria-current="true"]')
  if (!list || !active)
    return
  // offsetTop 是相对同一个 offsetParent（面板本身）的，减去列表自身偏移才是列表内位置
  const itemTop = active.offsetTop - list.offsetTop
  list.scrollTop = Math.max(0, itemTop - list.clientHeight / 2 + active.offsetHeight / 2)
})
</script>

<template>
  <Transition name="bvp-fade">
    <section
      v-if="ui.selectionNav && ui.selectionPanelOpen"
      class="bvp-playlist"
      :data-kind="ui.selectionKind"
      :aria-label="panelTitle"
    >
      <header class="bvp-playlist__header">
        <h2 class="bvp-playlist__title">
          {{ panelTitle }}
        </h2>
        <span class="bvp-playlist__position">{{ positionText }}</span>
        <button
          v-if="ui.selectionKind === 'playlist'"
          class="bvp-playlist__btn bvp-playlist__autoplay"
          type="button"
          data-bvp-action="autoplay"
          :aria-pressed="ui.playlistAutoplay"
          :title="t.autoplay"
          :aria-label="t.autoplay"
          @click="togglePlaylistAutoplay()"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M6 4.2v7.6L12 8 6 4.2Z"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linejoin="round"
            />
            <path d="M2.5 4.5v7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
          </svg>
          <span>{{ t.autoplay }}</span>
        </button>
        <button
          class="bvp-playlist__btn"
          type="button"
          data-bvp-action="close-selection"
          :aria-label="t.close"
          :title="t.close"
          @click="closeSelectionPanel()"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
          </svg>
        </button>
      </header>

      <ol ref="listEl" class="bvp-playlist__list">
        <li v-for="item in ui.selectionItems" :key="item.index">
          <button
            class="bvp-playlist__item"
            :class="{ 'is-active': item.active }"
            type="button"
            :aria-current="item.active ? 'true' : undefined"
            :title="item.title"
            @click="selectSelectionItem(item.index)"
          >
            <span class="bvp-playlist__index">{{ item.index + 1 }}</span>
            <span class="bvp-playlist__label">{{ item.title }}</span>
          </button>
        </li>
      </ol>

      <p class="bvp-playlist__hint">
        {{ panelHint }}
      </p>
    </section>
  </Transition>
</template>
