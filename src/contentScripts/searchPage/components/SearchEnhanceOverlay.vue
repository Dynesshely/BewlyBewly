<script setup lang="ts">
import { computed } from 'vue'

import { setDensity, setFilter, togglePanel } from '../actions'
import { formatStatus, useMessages } from '../i18n'
import { ui } from '../state'

const t = useMessages()

/** 面板里的快捷键说明（行为见 keyboard.ts） */
const shortcutRows = computed(() => [
  { keys: 'J', label: t.value.shortcut.next },
  { keys: 'K', label: t.value.shortcut.prev },
  { keys: '↑ / ↓', label: `${t.value.shortcut.next} / ${t.value.shortcut.prev}` },
  { keys: 'Enter', label: t.value.shortcut.open },
  { keys: 'Esc', label: t.value.shortcut.cancel },
])

const statusText = computed(() => {
  if (ui.activeIndex < 0 || ui.activeTotal === 0)
    return t.value.statusIdle
  return formatStatus(t.value.statusActive, ui.activeIndex + 1, ui.activeTotal)
})

/** 结果类型在当前页缺失时，对应筛选按钮禁用并说明原因 */
const filterHint = computed(() => {
  if (ui.cardCount > 0 && !ui.hasVideoCards)
    return t.value.filterUnavailable
  if (ui.cardCount > 0 && !ui.hasUserCards)
    return t.value.filterUnavailable
  return ''
})
</script>

<template>
  <div class="bse-root" :data-panel="ui.panelOpen">
    <div class="bse-live" role="status" aria-live="polite">
      <span v-if="ui.toast" class="bse-toast">{{ ui.toast }}</span>
    </div>

    <div class="bse-fab-group" role="toolbar" :aria-label="t.controls">
      <button
        class="bse-fab"
        type="button"
        data-bse-action="toggle-panel"
        :aria-expanded="ui.panelOpen"
        :title="ui.panelOpen ? t.close : t.openPanel"
        @click="togglePanel()"
      >
        <svg
          class="bse-fab__icon" width="15" height="15" viewBox="0 0 16 16" fill="none"
          aria-hidden="true"
        >
          <path
            d="M2 4.5h12M2 8h12M2 11.5h7"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
          />
          <circle cx="12" cy="11.5" r="2.1" stroke="currentColor" stroke-width="1.4" />
        </svg>
        <span class="bse-fab__label">{{ t.controls }}</span>
        <span v-if="ui.cardCount" class="bse-fab__count">{{ ui.cardCount }}</span>
      </button>
    </div>

    <Transition name="bse-panel">
      <section
        v-if="ui.panelOpen"
        class="bse-panel"
        role="dialog"
        :aria-label="t.panelTitle"
      >
        <header class="bse-panel__header">
          <h2 class="bse-panel__title">
            {{ t.panelTitle }}
          </h2>
          <button
            class="bse-icon-btn"
            type="button"
            data-bse-action="close"
            :aria-label="t.close"
            :title="t.close"
            @click="togglePanel(false)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            </svg>
          </button>
        </header>

        <div class="bse-row">
          <span class="bse-row__label">{{ t.density }}</span>
          <div class="bse-seg" role="group" :aria-label="t.density">
            <button
              class="bse-seg__btn"
              type="button"
              data-bse-action="density-comfortable"
              :aria-pressed="ui.density === 'comfortable'"
              @click="setDensity('comfortable')"
            >
              {{ t.densityComfortable }}
            </button>
            <button
              class="bse-seg__btn"
              type="button"
              data-bse-action="density-compact"
              :aria-pressed="ui.density === 'compact'"
              @click="setDensity('compact')"
            >
              {{ t.densityCompact }}
            </button>
          </div>
        </div>

        <div class="bse-row">
          <span class="bse-row__label">{{ t.filter }}</span>
          <div class="bse-seg" role="group" :aria-label="t.filter">
            <button
              class="bse-seg__btn"
              type="button"
              data-bse-action="filter-all"
              :aria-pressed="ui.filter === 'all'"
              @click="setFilter('all')"
            >
              {{ t.filterAll }}
            </button>
            <button
              class="bse-seg__btn"
              type="button"
              data-bse-action="filter-video"
              :aria-pressed="ui.filter === 'video'"
              :disabled="!ui.hasVideoCards"
              :title="ui.hasVideoCards ? t.filterVideo : t.filterUnavailable"
              @click="setFilter('video')"
            >
              {{ t.filterVideo }}
            </button>
            <button
              class="bse-seg__btn"
              type="button"
              data-bse-action="filter-user"
              :aria-pressed="ui.filter === 'user'"
              :disabled="!ui.hasUserCards"
              :title="ui.hasUserCards ? t.filterUser : t.filterUnavailable"
              @click="setFilter('user')"
            >
              {{ t.filterUser }}
            </button>
          </div>
        </div>
        <p v-if="filterHint" class="bse-hint">
          {{ filterHint }}
        </p>

        <div class="bse-status">
          <span class="bse-status__count">{{ statusText }}</span>
          <span v-if="ui.activeTitle" class="bse-status__title" :title="ui.activeTitle">{{ ui.activeTitle }}</span>
        </div>

        <div class="bse-shortcuts">
          <span class="bse-row__label">{{ t.shortcutsTitle }}</span>
          <ul class="bse-shortcuts__list">
            <li v-for="row in shortcutRows" :key="row.keys" class="bse-shortcuts__row">
              <kbd class="bse-kbd">{{ row.keys }}</kbd>
              <span class="bse-shortcuts__label">{{ row.label }}</span>
            </li>
          </ul>
        </div>

        <p class="bse-foot">
          {{ t.hint }}
        </p>
      </section>
    </Transition>
  </div>
</template>
