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
  { keys: 'T', label: t.value.shortcut.cinema },
  { keys: 'H', label: t.value.shortcut.aside },
  { keys: 'C', label: t.value.shortcut.danmaku },
  { keys: 'F', label: t.value.shortcut.fullscreen },
  { keys: '?', label: t.value.shortcut.help },
  { keys: 'Esc', label: t.value.shortcut.exitCinema },
])

const cinemaTitle = computed(() => ui.playerReady ? t.value.cinema : t.value.cinemaUnavailable)
// 第 23 轮：「隐藏侧栏」→「隐藏下方推荐 / 榜单」；开关文案与禁用说明都走新语义
const asideTitle = computed(() => ui.asideAvailable ? t.value.hideAside : t.value.asideUnavailable)
const danmakuTitle = computed(() => ui.danmakuAvailable ? t.value.danmaku : t.value.danmakuUnavailable)
const fullscreenTitle = computed(() => ui.fullscreenAvailable ? t.value.fullscreen : t.value.fullscreenUnavailable)
</script>

<template>
  <div ref="rootRef" class="blp-root" :data-panel="ui.panelOpen">
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
        ref="panelRef"
        class="blp-panel"
        tabindex="-1"
        role="dialog"
        aria-modal="false"
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
