<script setup lang="ts">
import type { ChannelRankPeriod, ChannelSortId } from '../state'
import { computed } from 'vue'

import {
  applyRank,
  applySort,
  clearActive,
  rankLabel,
  setDensity,
  sortLabel,
  togglePanel,
} from '../actions'
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

/** 面板标题按页面种类区分：分区页 / 热门页 / 排行榜 */
const panelTitle = computed(() => {
  if (ui.pageKind === 'rank')
    return t.value.panelTitleRank
  if (ui.pageKind === 'popular')
    return t.value.panelTitlePopular
  return t.value.panelTitle
})

const rankTabsAvailable = computed(() => ui.rankTabs.filter(item => item.available))

/** 面板里的快捷键说明（行为见 keyboard.ts） */
const shortcutRows = computed(() => {
  const rows = [
    { keys: 'J', label: t.value.shortcut.next },
    { keys: 'K', label: t.value.shortcut.prev },
    { keys: 'Enter', label: t.value.shortcut.open },
    { keys: 'Esc', label: t.value.shortcut.cancel },
  ]
  if (rankTabsAvailable.value.length)
    rows.push({ keys: '1 / 2 / 3', label: t.value.shortcutRank })
  return rows
})

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

function onRank(period: ChannelRankPeriod): void {
  applyRank(period)
  clearActive()
}

/** 榜单按钮上顺带标出快捷键序号（1 / 2 / 3） */
function rankKey(period: ChannelRankPeriod): string {
  return String(ui.rankTabs.findIndex(item => item.period === period) + 1)
}
</script>

<template>
  <div ref="rootRef" class="bcp-root" :data-panel="ui.panelOpen">
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
        ref="panelRef"
        class="bcp-panel"
        tabindex="-1"
        role="dialog"
        aria-modal="false"
        :aria-label="panelTitle"
      >
        <header class="bcp-panel__header">
          <h2 class="bcp-panel__title">
            {{ panelTitle }}
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

        <div v-if="rankTabsAvailable.length" class="bcp-group">
          <span class="bcp-group__label">{{ t.rankTitle }}</span>
          <div class="bcp-chip-row" role="group" :aria-label="t.rankTitle">
            <button
              v-for="item in rankTabsAvailable"
              :key="item.period"
              class="bcp-chip"
              type="button"
              :data-bcp-action="`rank-${item.period}`"
              @click="onRank(item.period)"
            >
              <kbd class="bcp-chip__key">{{ rankKey(item.period) }}</kbd>
              {{ rankLabel(item.period) }}
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
