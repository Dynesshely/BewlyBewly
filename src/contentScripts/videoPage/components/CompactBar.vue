<script setup lang="ts">
import { computed } from 'vue'

import { restorePlayer, toggleDanmaku, toggleShortcutsHelp } from '../actions'
import { useMessages } from '../i18n'
import { ui } from '../state'

const t = useMessages()

const progressPercent = computed(() => {
  if (!ui.duration || ui.duration <= 0)
    return 0
  return Math.min(100, Math.max(0, (ui.currentTime / ui.duration) * 100))
})
</script>

<template>
  <Transition name="bvp-slide">
    <div
      v-if="ui.compact"
      class="bvp-compact"
      role="region"
      :aria-label="t.controls"
    >
      <div class="bvp-compact__main">
        <span class="bvp-compact__title" :title="ui.title">{{ ui.title || t.controls }}</span>
        <span v-if="ui.upName" class="bvp-compact__up">{{ ui.upName }}</span>
      </div>

      <div class="bvp-compact__actions">
        <button
          v-if="ui.mini"
          class="bvp-icon-btn"
          type="button"
          data-bvp-action="restore"
          @click="restorePlayer()"
        >
          {{ t.compactBack }}
        </button>
        <button
          class="bvp-icon-btn"
          type="button"
          data-bvp-action="danmaku"
          :aria-pressed="ui.danmakuOn"
          :title="t.danmaku"
          :aria-label="t.danmaku"
          @click="toggleDanmaku()"
        >
          {{ t.danmaku }}
        </button>
        <button
          class="bvp-icon-btn"
          type="button"
          data-bvp-action="help"
          :aria-pressed="ui.helpOpen"
          :title="t.shortcutsTitle"
          :aria-label="t.shortcutsTitle"
          @click="toggleShortcutsHelp()"
        >
          ?
        </button>
      </div>

      <div class="bvp-compact__progress" aria-hidden="true">
        <div class="bvp-compact__progress-fill" :style="{ width: `${progressPercent}%` }" />
      </div>
    </div>
  </Transition>
</template>
