<script setup lang="ts">
import type { SpaceContentKind, SpaceFilterMode, SpaceQuickJumpId } from '../state'
import { computed } from 'vue'

import { jumpTo, setDensity, setFilter, togglePanel } from '../actions'
import { formatStatus, useMessages } from '../i18n'
import { ui } from '../state'

const t = useMessages()

// #region 键盘可达性（第 19 轮）：打开聚焦 / shadowRoot capture 焦点陷阱 / 关闭恢复
const rootRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
let restoreFocusTo: HTMLElement | null = null
let trappedRoot: ShadowRoot | Document | null = null

/** 穿透 shadow root 找真正获得焦点的元素（document.activeElement 只会返回 host） */
function activeElementDeep(): HTMLElement | null {
  let el = document.activeElement as HTMLElement | null
  while (el?.shadowRoot?.activeElement)
    el = el.shadowRoot.activeElement as HTMLElement
  return el
}

/** 面板内真实可聚焦元素（排除隐藏 / 禁用 / tabindex=-1） */
function panelFocusables(): HTMLElement[] {
  const root = panelRef.value
  if (!root)
    return []
  return Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter(el => el.getClientRects().length > 0)
}

/** 焦点在面板内循环；没有可聚焦元素时聚焦面板容器本身（tabindex=-1） */
function moveFocusInPanel(backward: boolean): void {
  const items = panelFocusables()
  if (!items.length) {
    panelRef.value?.focus({ preventScroll: true })
    return
  }
  const active = activeElementDeep()
  const current = active
    ? items.indexOf(active)
    : -1
  const next = current < 0
    ? (backward
        ? items.length - 1
        : 0)
    : (current + (backward
        ? -1
        : 1) + items.length) % items.length
  items[next]?.focus({ preventScroll: true })
}

/** 捕获阶段拦下 Tab：必须 preventDefault，否则浏览器默认行为会把焦点移出面板 */
function onTabCapture(event: Event): void {
  if (!(event instanceof KeyboardEvent) || event.key !== 'Tab')
    return
  event.preventDefault()
  event.stopPropagation()
  moveFocusInPanel(event.shiftKey)
}

/** 事件发生在 shadow root 内：监听挂到面板所在的 root（ShadowRoot / Document） */
function bindTabTrap(): void {
  unbindTabTrap()
  const node = panelRef.value?.getRootNode()
  if (node instanceof ShadowRoot || node instanceof Document) {
    trappedRoot = node
    node.addEventListener('keydown', onTabCapture, true)
  }
}

function unbindTabTrap(): void {
  if (trappedRoot) {
    trappedRoot.removeEventListener('keydown', onTabCapture, true)
    trappedRoot = null
  }
}

watch(() => ui.panelOpen, async (open) => {
  if (!open) {
    unbindTabTrap()
    restoreFocusTo?.focus?.({ preventScroll: true })
    restoreFocusTo = null
    return
  }
  restoreFocusTo = activeElementDeep()
  await nextTick()
  bindTabTrap()
  const items = panelFocusables()
  if (items.length)
    items[0]?.focus({ preventScroll: true })
  else
    panelRef.value?.focus({ preventScroll: true })
})

onBeforeUnmount(unbindTabTrap)
// #endregion

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
  <div ref="rootRef" class="bsp-root" :data-panel="ui.panelOpen">
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
        ref="panelRef"
        class="bsp-panel"
        tabindex="-1"
        role="dialog"
        aria-modal="false"
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
