<script setup lang="ts">
import type { NotificationCategoryId } from '../state'

import { computed } from 'vue'
import { applyDensity, jumpToCategory, markAllRead, togglePanel, toggleUnreadOnly } from '../actions'
import { useMessages } from '../i18n'
import { state } from '../state'

/** 分类顺序与快捷键 1–4 一一对应 */
const CATEGORY_ORDER: NotificationCategoryId[] = ['reply', 'at', 'love', 'system']

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

watch(() => state.panelOpen, async (open) => {
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

const fabLabel = computed(() => {
  if (state.unreadCount === null)
    return t.value.unreadBadgeLabel
  return t.value.fabWithUnread.replace('{count}', String(state.unreadCount))
})

const unreadSummary = computed(() => {
  if (state.unreadCount === null)
    return t.value.unreadUnknown
  return `${String(state.unreadCount)} ${t.value.unreadLabel}`
})

const shortcuts = computed(() => [
  {
    keys: ['U'],
    label: t.value.shortcutUnread,
  },
  {
    keys: ['1', '–', '4'],
    label: t.value.shortcutCategories,
  },
  {
    keys: ['D'],
    label: t.value.shortcutDensity,
  },
  {
    keys: ['Esc'],
    label: t.value.shortcutClose,
  },
])

function categoryShortcut(id: NotificationCategoryId): string {
  const index = CATEGORY_ORDER.indexOf(id)
  return index >= 0
    ? String(index + 1)
    : ''
}

function categoryHint(id: NotificationCategoryId): string {
  const key = categoryShortcut(id)
  return t.value.category[id] + (key
    ? ` (${key})`
    : '')
}
</script>

<template>
  <div ref="rootRef" class="bnp-root" :data-panel-open="state.panelOpen">
    <button
      class="bnp-fab"
      type="button"
      data-bnp-action="toggle-panel"
      :aria-label="fabLabel"
      :aria-expanded="state.panelOpen"
      aria-controls="bewly-notif-panel"
      :title="fabLabel"
      @click="togglePanel()"
    >
      <svg
        class="bnp-fab__icon" width="18" height="18" viewBox="0 0 24 24" fill="none"
        aria-hidden="true"
      >
        <path
          d="M18 8a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6M10.3 19a2 2 0 0 0 3.4 0"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span v-if="state.unreadCount !== null" class="bnp-fab__count">{{ state.unreadCount }}</span>
      <span class="bnp-fab__label">{{ t.unreadBadgeLabel }}</span>
    </button>

    <Transition name="bnp-slide">
      <section
        v-if="state.panelOpen"
        id="bewly-notif-panel"
        ref="panelRef"
        class="bnp-panel"
        tabindex="-1"
        role="dialog"
        :aria-label="t.panel"
        aria-modal="false"
      >
        <header class="bnp-panel__header">
          <div class="bnp-panel__heading">
            <h2 class="bnp-panel__title">
              {{ t.panel }}
            </h2>
            <p class="bnp-panel__summary" data-bnp-unread-summary>
              {{ unreadSummary }}
            </p>
          </div>
          <button
            class="bnp-icon-btn"
            type="button"
            data-bnp-action="close-panel"
            :aria-label="t.close"
            :title="t.close"
            @click="togglePanel(false)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
        </header>

        <div class="bnp-group">
          <div class="bnp-group__head">
            <span class="bnp-group__title">{{ t.unreadOnly }}</span>
            <span class="bnp-group__hint">{{ t.unreadOnlyHint }}</span>
          </div>
          <button
            class="bnp-switch"
            type="button"
            data-bnp-action="toggle-unread-only"
            role="switch"
            :aria-checked="state.unreadOnly"
            :aria-label="t.unreadOnly"
            :disabled="!state.canFilterUnread"
            :title="state.canFilterUnread ? t.unreadOnlyHint : t.unreadFilterUnavailable"
            @click="toggleUnreadOnly()"
          >
            <span class="bnp-switch__track" aria-hidden="true">
              <span class="bnp-switch__thumb" />
            </span>
            <span class="bnp-switch__text" aria-hidden="true">
              {{ state.unreadOnly ? t.switchOn : t.switchOff }}
            </span>
          </button>
          <p v-if="!state.canFilterUnread" class="bnp-note">
            {{ t.unreadFilterUnavailable }}
          </p>
          <p v-else-if="state.unreadOnly && state.unreadItemCount === 0" class="bnp-note">
            {{ t.noUnreadItems }}
          </p>
        </div>

        <div class="bnp-group">
          <span class="bnp-group__title">{{ t.categories }}</span>
          <div class="bnp-categories" role="group" :aria-label="t.categories">
            <button
              v-for="category in state.categories"
              :key="category.id"
              class="bnp-chip"
              type="button"
              :data-bnp-action="`jump-${category.id}`"
              :disabled="!category.available"
              :aria-label="categoryHint(category.id)"
              :title="category.available ? categoryHint(category.id) : t.categoryUnavailable"
              @click="jumpToCategory(category.id)"
            >
              <span class="bnp-chip__label">{{ t.category[category.id] }}</span>
              <kbd class="bnp-kbd">{{ categoryShortcut(category.id) }}</kbd>
            </button>
          </div>
        </div>

        <div class="bnp-group bnp-group--inline">
          <span class="bnp-group__title">{{ t.density }}</span>
          <div class="bnp-segmented" role="radiogroup" :aria-label="t.density">
            <button
              class="bnp-segmented__item"
              type="button"
              role="radio"
              data-bnp-action="density-comfortable"
              :aria-checked="state.density === 'comfortable'"
              @click="applyDensity('comfortable')"
            >
              {{ t.densityComfortable }}
            </button>
            <button
              class="bnp-segmented__item"
              type="button"
              role="radio"
              data-bnp-action="density-compact"
              :aria-checked="state.density === 'compact'"
              @click="applyDensity('compact')"
            >
              {{ t.densityCompact }}
            </button>
          </div>
        </div>

        <div v-if="state.canMarkAllRead" class="bnp-group bnp-group--inline">
          <span class="bnp-group__title">{{ t.markAllRead }}</span>
          <button class="bnp-action" type="button" data-bnp-action="mark-all-read" @click="markAllRead()">
            {{ t.markAllRead }}
          </button>
        </div>

        <div class="bnp-shortcuts">
          <span class="bnp-group__title">{{ t.shortcuts }}</span>
          <ul class="bnp-shortcuts__list">
            <li v-for="shortcut in shortcuts" :key="shortcut.label" class="bnp-shortcuts__row">
              <span class="bnp-shortcuts__label">{{ shortcut.label }}</span>
              <span class="bnp-shortcuts__keys">
                <kbd v-for="key in shortcut.keys" :key="key" class="bnp-kbd">{{ key }}</kbd>
              </span>
            </li>
          </ul>
        </div>
      </section>
    </Transition>

    <Transition name="bnp-fade">
      <div v-if="state.toast" class="bnp-toast" role="status" aria-live="polite">
        {{ state.toast }}
      </div>
    </Transition>
  </div>
</template>
