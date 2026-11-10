<script setup lang="ts">
import type { SpaceContentKind, SpaceFilterMode, SpaceQuickJumpId } from '../state'
import { computed } from 'vue'

import { jumpTo, setDensity, setFilter, togglePanel } from '../actions'
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

/** 没有高亮时显示可浏览条数，有内容但一轮都没按过 j/k 时也有信息可看 */
const countText = computed(() => ui.visibleCount > 0
  ? t.value.statusCount.replace('{total}', String(ui.visibleCount))
  : '')

const filterOptions = computed<{ mode: SpaceFilterMode, label: string, kind: SpaceContentKind | null }[]>(() => [
  { mode: 'all', label: t.value.filterAll, kind: null },
  { mode: 'video', label: t.value.filterVideo, kind: 'video' },
  { mode: 'article', label: t.value.filterArticle, kind: 'article' },
  { mode: 'dynamic', label: t.value.filterDynamic, kind: 'dynamic' },
  { mode: 'collection', label: t.value.filterCollection, kind: 'collection' },
])

function filterDisabled(kind: SpaceContentKind | null): boolean {
  if (!kind)
    return false
  // 首屏还没扫到卡片时不禁用，避免面板看起来像坏了
  if (ui.cardCount === 0)
    return false
  return !ui.availableKinds[kind]
}

const jumpLabels = computed<Record<SpaceQuickJumpId, string>>(() => ({
  home: t.value.jumpHome,
  video: t.value.jumpVideo,
  collection: t.value.jumpCollection,
  favorites: t.value.jumpFavorites,
}))

/** 只显示页面上确实找得到的跳转入口 */
const visibleQuickJumps = computed(() => ui.quickJumps.filter(item => item.available))

const filterHint = computed(() => {
  if (ui.cardCount === 0)
    return ''
  const missing = filterOptions.value
    .filter(option => option.kind && !ui.availableKinds[option.kind])
    .map(option => option.label)
  return missing.length
    ? `${t.value.filterUnavailable}：${missing.join(' / ')}`
    : ''
})
</script>

<template>
  <div class="bsp-root" :data-panel="ui.panelOpen">
    <div class="bsp-live" role="status" aria-live="polite">
      <span v-if="ui.toast" class="bsp-toast">{{ ui.toast }}</span>
    </div>

    <div class="bsp-fab-group" role="toolbar" :aria-label="t.controls">
      <button
        class="bsp-fab"
        type="button"
        data-bsp-action="toggle-panel"
        :aria-expanded="ui.panelOpen"
        :title="ui.panelOpen ? t.close : t.openPanel"
        @click="togglePanel()"
      >
        <svg
          class="bsp-fab__icon" width="15" height="15" viewBox="0 0 16 16" fill="none"
          aria-hidden="true"
        >
          <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
          <path d="M13.5 10v3M12 11.5h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        </svg>
        <span class="bsp-fab__label">{{ t.controls }}</span>
        <span v-if="ui.visibleCount" class="bsp-fab__count">{{ ui.visibleCount }}</span>
      </button>
    </div>

    <Transition name="bsp-panel">
      <section
        v-if="ui.panelOpen"
        class="bsp-panel"
        role="dialog"
        :aria-label="t.panelTitle"
      >
        <header class="bsp-panel__header">
          <h2 class="bsp-panel__title">
            {{ t.panelTitle }}
          </h2>
          <button
            class="bsp-icon-btn"
            type="button"
            data-bsp-action="close"
            :aria-label="t.close"
            :title="t.close"
            @click="togglePanel(false)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            </svg>
          </button>
        </header>

        <div class="bsp-group">
          <span class="bsp-group__label">{{ t.filter }}</span>
          <div class="bsp-chip-row" role="group" :aria-label="t.filter">
            <button
              v-for="option in filterOptions"
              :key="option.mode"
              class="bsp-chip"
              type="button"
              :data-bsp-action="`filter-${option.mode}`"
              :aria-pressed="ui.filter === option.mode"
              :disabled="filterDisabled(option.kind)"
              :title="filterDisabled(option.kind) ? t.filterUnavailable : option.label"
              @click="setFilter(option.mode)"
            >
              {{ option.label }}
            </button>
          </div>
          <p v-if="filterHint" class="bsp-hint">
            {{ filterHint }}
          </p>
        </div>

        <div class="bsp-group">
          <span class="bsp-group__label">{{ t.density }}</span>
          <div class="bsp-seg" role="group" :aria-label="t.density">
            <button
              class="bsp-seg__btn"
              type="button"
              data-bsp-action="density-comfortable"
              :aria-pressed="ui.density === 'comfortable'"
              @click="setDensity('comfortable')"
            >
              {{ t.densityComfortable }}
            </button>
            <button
              class="bsp-seg__btn"
              type="button"
              data-bsp-action="density-compact"
              :aria-pressed="ui.density === 'compact'"
              @click="setDensity('compact')"
            >
              {{ t.densityCompact }}
            </button>
          </div>
        </div>

        <div v-if="visibleQuickJumps.length" class="bsp-group">
          <span class="bsp-group__label">{{ t.jumpTitle }}</span>
          <div class="bsp-jump-row" role="group" :aria-label="t.jumpTitle">
            <button
              v-for="item in visibleQuickJumps"
              :key="item.id"
              class="bsp-jump"
              type="button"
              :data-bsp-action="`jump-${item.id}`"
              @click="jumpTo(item.id)"
            >
              {{ jumpLabels[item.id] }}
            </button>
          </div>
        </div>

        <div class="bsp-status">
          <span class="bsp-status__count">{{ statusText }}</span>
          <span v-if="ui.activeTitle" class="bsp-status__title" :title="ui.activeTitle">{{ ui.activeTitle }}</span>
          <span v-else-if="countText" class="bsp-status__meta">
            {{ countText }}
          </span>
        </div>

        <div class="bsp-shortcuts">
          <span class="bsp-group__label">{{ t.shortcutsTitle }}</span>
          <ul class="bsp-shortcuts__list">
            <li v-for="row in shortcutRows" :key="row.keys" class="bsp-shortcuts__row">
              <kbd class="bsp-kbd">{{ row.keys }}</kbd>
              <span class="bsp-shortcuts__label">{{ row.label }}</span>
            </li>
          </ul>
        </div>

        <p class="bsp-foot">
          {{ t.hint }}
        </p>
      </section>
    </Transition>
  </div>
</template>
