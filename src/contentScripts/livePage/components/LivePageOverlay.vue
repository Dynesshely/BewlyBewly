<script setup lang="ts">
import { computed } from 'vue'

import {
  toggleCinema,
  toggleDanmaku,
  toggleFullscreen,
  toggleHideAside,
  togglePanel,
} from '../actions'
import { useMessages } from '../i18n'
import { ui } from '../state'

const t = useMessages()

/** 面板里的快捷键说明（行为见 keyboard.ts） */
const shortcutRows = computed(() => [
  { keys: 'T', label: t.value.shortcut.cinema },
  { keys: 'H', label: t.value.shortcut.aside },
  { keys: 'C', label: t.value.shortcut.danmaku },
  { keys: 'F', label: t.value.shortcut.fullscreen },
  { keys: '?', label: t.value.shortcut.help },
  { keys: 'Esc', label: t.value.shortcut.exitCinema },
])

const cinemaTitle = computed(() => ui.playerReady ? t.value.cinema : t.value.cinemaUnavailable)
const asideTitle = computed(() => ui.asideAvailable ? t.value.hideAside : t.value.asideUnavailable)
const danmakuTitle = computed(() => ui.danmakuAvailable ? t.value.danmaku : t.value.danmakuUnavailable)
const fullscreenTitle = computed(() => ui.fullscreenAvailable ? t.value.fullscreen : t.value.fullscreenUnavailable)
</script>

<template>
  <div class="blp-root" :data-panel="ui.panelOpen">
    <div class="blp-live" role="status" aria-live="polite">
      <span v-if="ui.toast" class="blp-toast">{{ ui.toast }}</span>
    </div>

    <div class="blp-fab-group" role="toolbar" :aria-label="t.controls">
      <button
        class="blp-fab"
        type="button"
        data-blp-action="toggle-panel"
        :aria-expanded="ui.panelOpen"
        :title="ui.panelOpen ? t.close : t.openPanel"
        @click="togglePanel()"
      >
        <svg
          class="blp-fab__icon" width="15" height="15" viewBox="0 0 16 16" fill="none"
          aria-hidden="true"
        >
          <rect
            x="1.6" y="3.2" width="12.8" height="9.6" rx="1.6"
            stroke="currentColor" stroke-width="1.3"
          />
          <path d="M6.4 6.4l3.2 1.6-3.2 1.6z" fill="currentColor" />
        </svg>
        <span class="blp-fab__label">{{ t.controls }}</span>
        <span v-if="ui.cinema" class="blp-fab__dot" aria-hidden="true" />
      </button>
    </div>

    <Transition name="blp-panel">
      <section
        v-if="ui.panelOpen"
        class="blp-panel"
        role="dialog"
        :aria-label="t.panelTitle"
      >
        <header class="blp-panel__header">
          <h2 class="blp-panel__title">
            {{ t.panelTitle }}
          </h2>
          <button
            class="blp-icon-btn"
            type="button"
            data-blp-action="close"
            :aria-label="t.close"
            :title="t.close"
            @click="togglePanel(false)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            </svg>
          </button>
        </header>

        <div class="blp-group">
          <span class="blp-group__label">{{ t.panelTitle }}</span>
          <div class="blp-toggle-list">
            <button
              class="blp-toggle"
              type="button"
              data-blp-action="toggle-cinema"
              :aria-pressed="ui.cinema"
              :disabled="!ui.playerReady"
              :title="cinemaTitle"
              @click="toggleCinema()"
            >
              <span class="blp-toggle__label">{{ t.cinema }}</span>
              <span class="blp-toggle__state">{{ ui.cinema ? 'ON' : 'OFF' }}</span>
            </button>
            <button
              class="blp-toggle"
              type="button"
              data-blp-action="toggle-aside"
              :aria-pressed="ui.hideAside"
              :disabled="!ui.asideAvailable"
              :title="asideTitle"
              @click="toggleHideAside()"
            >
              <span class="blp-toggle__label">{{ t.hideAside }}</span>
              <span class="blp-toggle__state">{{ ui.hideAside ? 'ON' : 'OFF' }}</span>
            </button>
            <button
              class="blp-toggle"
              type="button"
              data-blp-action="toggle-danmaku"
              :aria-pressed="ui.danmakuOn"
              :disabled="!ui.danmakuAvailable"
              :title="danmakuTitle"
              @click="toggleDanmaku()"
            >
              <span class="blp-toggle__label">{{ t.danmaku }}</span>
              <span class="blp-toggle__state">{{ ui.danmakuOn ? 'ON' : 'OFF' }}</span>
            </button>
            <button
              class="blp-toggle"
              type="button"
              data-blp-action="fullscreen"
              :disabled="!ui.fullscreenAvailable"
              :title="fullscreenTitle"
              @click="toggleFullscreen()"
            >
              <span class="blp-toggle__label">{{ t.fullscreen }}</span>
              <span class="blp-toggle__state" aria-hidden="true">⤢</span>
            </button>
          </div>
        </div>

        <div class="blp-shortcuts">
          <span class="blp-group__label">{{ t.shortcutsTitle }}</span>
          <ul class="blp-shortcuts__list">
            <li v-for="row in shortcutRows" :key="row.keys" class="blp-shortcuts__row">
              <kbd class="blp-kbd">{{ row.keys }}</kbd>
              <span class="blp-shortcuts__label">{{ row.label }}</span>
            </li>
          </ul>
        </div>

        <p v-if="!ui.playerReady" class="blp-hint">
          {{ t.playerNotFound }}
        </p>
        <p v-else-if="!ui.asideAvailable" class="blp-hint">
          {{ t.asideUnavailable }}
        </p>
        <p class="blp-foot">
          {{ t.hint }}
        </p>
      </section>
    </Transition>
  </div>
</template>
