<script setup lang="ts">
import type { ChannelSortId } from '../state'
import { computed } from 'vue'

import { applySort, clearActive, setDensity, sortLabel, togglePanel } from '../actions'
import { formatStatus, useMessages } from '../i18n'
import { ui } from '../state'

const t = useMessages()

/** 面板里的快捷键说明（行为见 keyboard.ts） */
const shortcutRows = computed(() => [
  { keys: 'J', label: t.value.shortcut.next },
  { keys: 'K', label: t.value.shortcut.prev },
  { keys: 'Enter', label: t.value.shortcut.open },
  { keys: 'Esc', label: t.value.shortcut.cancel },
])

const statusText = computed(() => {
  if (ui.activeIndex < 0 || ui.activeTotal === 0)
    return t.value.statusIdle
  return formatStatus(t.value.statusActive, ui.activeIndex + 1, ui.activeTotal)
})

/** 没有高亮时显示卡片总数，面板里始终有信息可看 */
const countText = computed(() => ui.cardCount > 0
  ? t.value.statusCount.replace('{total}', String(ui.cardCount))
  : '')

/** 页面上找不到的排序 tab 直接不渲染 */
const visibleSortTabs = computed(() => ui.sortTabs.filter(item => item.available))

function onSort(id: ChannelSortId): void {
  applySort(id)
  clearActive()
}
</script>

<template>
  <div class="bcp-root" :data-panel="ui.panelOpen">
    <div class="bcp-live" role="status" aria-live="polite">
      <span v-if="ui.toast" class="bcp-toast">{{ ui.toast }}</span>
    </div>

    <div class="bcp-fab-group" role="toolbar" :aria-label="t.controls">
      <button
        class="bcp-fab"
        type="button"
        data-bcp-action="toggle-panel"
        :aria-expanded="ui.panelOpen"
        :title="ui.panelOpen ? t.close : t.openPanel"
        @click="togglePanel()"
      >
        <svg
          class="bcp-fab__icon" width="15" height="15" viewBox="0 0 16 16" fill="none"
          aria-hidden="true"
        >
          <path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
          <circle
            cx="10.5" cy="4" r="1.6" fill="var(--bew-elevated-solid)" stroke="currentColor"
            stroke-width="1.2"
          />
        </svg>
        <span class="bcp-fab__label">{{ t.controls }}</span>
        <span v-if="ui.cardCount" class="bcp-fab__count">{{ ui.cardCount }}</span>
      </button>
    </div>

    <Transition name="bcp-panel">
      <section
        v-if="ui.panelOpen"
        class="bcp-panel"
        role="dialog"
        :aria-label="t.panelTitle"
      >
        <header class="bcp-panel__header">
          <h2 class="bcp-panel__title">
            {{ t.panelTitle }}
          </h2>
          <button
            class="bcp-icon-btn"
            type="button"
            data-bcp-action="close"
            :aria-label="t.close"
            :title="t.close"
            @click="togglePanel(false)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            </svg>
          </button>
        </header>

        <div class="bcp-group">
          <span class="bcp-group__label">{{ t.density }}</span>
          <div class="bcp-seg" role="group" :aria-label="t.density">
            <button
              class="bcp-seg__btn"
              type="button"
              data-bcp-action="density-comfortable"
              :aria-pressed="ui.density === 'comfortable'"
              @click="setDensity('comfortable')"
            >
              {{ t.densityComfortable }}
            </button>
            <button
              class="bcp-seg__btn"
              type="button"
              data-bcp-action="density-compact"
              :aria-pressed="ui.density === 'compact'"
              @click="setDensity('compact')"
            >
              {{ t.densityCompact }}
            </button>
          </div>
        </div>

        <div v-if="visibleSortTabs.length" class="bcp-group">
          <span class="bcp-group__label">{{ t.sortTitle }}</span>
          <div class="bcp-chip-row" role="group" :aria-label="t.sortTitle">
            <button
              v-for="item in visibleSortTabs"
              :key="item.id"
              class="bcp-chip"
              type="button"
              :data-bcp-action="`sort-${item.id}`"
              @click="onSort(item.id)"
            >
              {{ sortLabel(item.id) }}
            </button>
          </div>
        </div>

        <div class="bcp-status">
          <span class="bcp-status__count">{{ statusText }}</span>
          <span v-if="ui.activeTitle" class="bcp-status__title" :title="ui.activeTitle">{{ ui.activeTitle }}</span>
          <span v-else-if="countText" class="bcp-status__meta">{{ countText }}</span>
        </div>

        <div class="bcp-shortcuts">
          <span class="bcp-group__label">{{ t.shortcutsTitle }}</span>
          <ul class="bcp-shortcuts__list">
            <li v-for="row in shortcutRows" :key="row.keys" class="bcp-shortcuts__row">
              <kbd class="bcp-kbd">{{ row.keys }}</kbd>
              <span class="bcp-shortcuts__label">{{ row.label }}</span>
            </li>
          </ul>
        </div>

        <p class="bcp-foot">
          {{ t.hint }}
        </p>
      </section>
    </Transition>
  </div>
</template>
