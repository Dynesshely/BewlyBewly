<script setup lang="ts">
import { computed } from 'vue'

import { settings } from '~/logic'

import { restorePlayer, toggleSelectionPanel, toggleShortcutsHelp } from '../actions'
import { useMessages } from '../i18n'
import { ui } from '../state'

const t = useMessages()

/** 面板名跟随页面能力：/list/* 是「播放列表」，普通多P 视频是「选集」，合集视频页是「合集」 */
const selectionLabel = computed(() => {
  if (ui.selectionKind === 'parts')
    return t.value.partsPanel
  if (ui.selectionKind === 'collection')
    return t.value.collectionPanel
  return t.value.playlistPanel
})
</script>

<template>
  <div
    v-if="ui.mini || settings.videoPageShortcuts || ui.selectionNav"
    class="bvp-fab-group"
    role="toolbar"
    :aria-label="t.controls"
  >
    <button
      v-if="ui.mini"
      class="bvp-fab"
      type="button"
      data-bvp-action="restore"
      :title="`${t.restorePlayer}（P）`"
      @click="restorePlayer()"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M3 9.5V13h3.5M13 6.5V3H9.5M13 3 9 7M3 13l4-4"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span class="bvp-fab__label">{{ t.restorePlayer }}</span>
    </button>

    <button
      v-if="ui.selectionNav"
      class="bvp-fab"
      type="button"
      data-bvp-action="selection"
      :aria-pressed="ui.selectionPanelOpen"
      :title="`${selectionLabel} · ${t.close}（Esc）`"
      @click="toggleSelectionPanel()"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
        />
      </svg>
      <span class="bvp-fab__label">{{ selectionLabel }}</span>
    </button>

    <button
      v-if="settings.videoPageShortcuts"
      class="bvp-fab"
      type="button"
      data-bvp-action="help"
      :aria-pressed="ui.helpOpen"
      :title="`${t.shortcuts}（?）`"
      @click="toggleShortcutsHelp()"
    >
      <span class="bvp-fab__label" aria-hidden="true">?</span>
      <span class="bvp-fab__label">{{ t.shortcuts }}</span>
    </button>
  </div>
</template>
