<script setup lang="ts">
import type { ShortcutRegistryEntry, ShortcutScope } from '~/constants/shortcutRegistry'
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  getActiveShortcutScopes,
  getEntryKeyTokens,
  groupShortcutsByScope,
  KEY_SEPARATOR,
  scopeLabelKey,
} from '~/constants/shortcutRegistry'
import { settings } from '~/logic'

const emit = defineEmits<{ (e: 'close'): void }>()

/**
 * 全局快捷键帮助（? 打开）。
 *
 * 数据源是 `constants/shortcutRegistry.ts` 的统一登记表：按 scope 分组展示，
 * 可自定义动作显示用户改键后的真实组合键；当前页面涉及的 scope 会带「当前页」标记，
 * 但所有分组始终完整展示 —— 一处就能查全站快捷键。
 */
const { t } = useI18n()

const closeButton = ref<HTMLButtonElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)
/** 打开帮助前的焦点，关闭时还回去 */
let restoreFocusTo: HTMLElement | null = null
let trappedRoot: ShadowRoot | Document | null = null

/** 穿透 shadow root 找真正获得焦点的元素（document.activeElement 只会返回 host） */
function activeElementDeep(): HTMLElement | null {
  let el = document.activeElement as HTMLElement | null
  while (el?.shadowRoot?.activeElement)
    el = el.shadowRoot.activeElement as HTMLElement
  return el
}
const activeScopes = getActiveShortcutScopes()
const groups = groupShortcutsByScope()

/** 面板内真实可聚焦元素（排除隐藏 / 禁用 / tabindex=-1） */
function panelFocusables(): HTMLElement[] {
  const root = rootRef.value
  if (!root)
    return []
  return Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter(el => el.getClientRects().length > 0)
}

/** 焦点在面板内循环；没有可聚焦元素时聚焦面板容器本身（tabindex=-1） */
function moveFocusInPanel(backward: boolean): void {
  const items = panelFocusables()
  if (!items.length) {
    rootRef.value?.focus({ preventScroll: true })
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

/** 帮助面板在 shadow root 里：监听挂到面板所在的 ShadowRoot（没有则 Document） */
function bindTabTrap(): void {
  unbindTabTrap()
  const node = rootRef.value?.getRootNode()
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

onMounted(async () => {
  restoreFocusTo = activeElementDeep()
  await nextTick()
  bindTabTrap()
  const items = panelFocusables()
  if (items.length)
    items[0]?.focus({ preventScroll: true })
  else
    rootRef.value?.focus({ preventScroll: true })
})

onBeforeUnmount(() => {
  unbindTabTrap()
  restoreFocusTo?.focus?.({ preventScroll: true })
  restoreFocusTo = null
})

interface RenderedKey {
  kind: 'kbd' | 'sep'
  text: string
}

/** 把一条登记的按键片段渲染成 kbd / 分隔符序列（应用用户改键） */
function renderKeys(entry: ShortcutRegistryEntry): RenderedKey[] {
  const { tokens, chord } = getEntryKeyTokens(entry, settings.value.keyboardShortcuts)
  const rendered: RenderedKey[] = []
  tokens.forEach((token, index) => {
    if (token === KEY_SEPARATOR) {
      rendered.push({ kind: 'sep', text: KEY_SEPARATOR })
      return
    }
    if (index > 0) {
      rendered.push({
        kind: 'sep',
        text: chord ? '+' : '/',
      })
    }
    rendered.push({ kind: 'kbd', text: token })
  })
  return rendered
}

function isCurrentScope(scope: ShortcutScope): boolean {
  return activeScopes.has(scope)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape')
    return
  event.preventDefault()
  event.stopPropagation()
  emit('close')
}
</script>

<template>
  <div
    ref="rootRef"
    class="keyboard-help-mask"
    role="dialog"
    aria-modal="true"
    :aria-label="t('keyboard_help.title')"
    tabindex="-1"
    @click.self="$emit('close')"
    @keydown="handleKeydown"
  >
    <div class="keyboard-help-panel">
      <header class="keyboard-help-header">
        <div class="keyboard-help-heading">
          <h2 class="keyboard-help-title">
            {{ t('keyboard_help.title') }}
          </h2>
          <p class="keyboard-help-hint">
            {{ t('keyboard_help.hint') }}
          </p>
        </div>
        <button
          ref="closeButton"
          type="button"
          class="keyboard-help-close"
          :aria-label="t('keyboard_registry.close')"
          :title="t('keyboard_registry.close')"
          @click="$emit('close')"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </header>

      <div class="keyboard-help-body">
        <section
          v-for="group in groups"
          :key="group.scope"
          class="keyboard-help-group"
          :aria-labelledby="`keyboard-help-group-${group.scope}`"
        >
          <h3 :id="`keyboard-help-group-${group.scope}`" class="keyboard-help-group-title">
            <span>{{ t(scopeLabelKey(group.scope)) }}</span>
            <span v-if="isCurrentScope(group.scope)" class="keyboard-help-badge">
              {{ t('keyboard_registry.current_scope') }}
            </span>
          </h3>

          <dl class="keyboard-help-list">
            <div v-for="entry in group.entries" :key="entry.id" class="keyboard-help-row">
              <dt class="keyboard-help-keys">
                <template v-for="(token, index) in renderKeys(entry)" :key="`${entry.id}-${index}`">
                  <span v-if="token.kind === 'sep'" class="keyboard-help-separator">{{ token.text }}</span>
                  <kbd v-else class="keyboard-help-key">{{ token.text }}</kbd>
                </template>
              </dt>
              <dd class="keyboard-help-desc">
                {{ t(entry.i18nKey) }}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.keyboard-help-mask {
  position: fixed;
  inset: 0;
  z-index: 10010;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: color-mix(in oklab, var(--bew-bg), transparent 60%);
  backdrop-filter: blur(6px);
}

.keyboard-help-panel {
  display: flex;
  flex-direction: column;
  width: min(620px, 92vw);
  max-height: min(80vh, 760px);
  overflow: hidden;
  border-radius: var(--bew-radius);
  background: var(--bew-elevated-solid);
  border: 1px solid var(--bew-border-color);
  box-shadow: var(--bew-shadow-4);
}

.keyboard-help-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px 12px;
  border-bottom: 1px solid var(--bew-border-color);
}

.keyboard-help-heading {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.keyboard-help-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--bew-text-1);
  text-wrap: balance;
}

.keyboard-help-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--bew-text-3);
}

.keyboard-help-close {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-size: 13px;
  color: var(--bew-text-2);
  background: var(--bew-fill-1);
  border: 1px solid var(--bew-border-color);
  border-radius: 8px;
  cursor: pointer;
  transition:
    color 180ms cubic-bezier(0.22, 0.61, 0.36, 1),
    background-color 180ms cubic-bezier(0.22, 0.61, 0.36, 1);
}

.keyboard-help-close:hover {
  color: var(--bew-text-1);
  background: var(--bew-fill-2);
}

.keyboard-help-close:focus-visible {
  outline: 2px solid var(--bew-theme-color);
  outline-offset: 2px;
}

.keyboard-help-body {
  flex: 1;
  padding: 8px 20px 18px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.keyboard-help-group {
  padding: 8px 0 4px;
}

.keyboard-help-group-title {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 8px 0 4px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--bew-text-3);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.keyboard-help-badge {
  padding: 0 6px;
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  color: var(--bew-theme-color);
  text-transform: none;
  background: color-mix(in oklab, var(--bew-theme-color), transparent 90%);
  border-radius: 6px;
}

.keyboard-help-list {
  margin: 0;
}

.keyboard-help-row {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 7px 0;
  border-bottom: 1px solid var(--bew-border-color);
}

.keyboard-help-row:last-child {
  border-bottom: 0;
}

.keyboard-help-keys {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  min-width: 104px;
}

.keyboard-help-key {
  min-width: 24px;
  padding: 1px 7px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--bew-text-1);
  text-align: center;
  background: var(--bew-fill-1);
  border: 1px solid var(--bew-border-color);
  border-radius: 6px;
}

.keyboard-help-separator {
  font-size: 11px;
  color: var(--bew-text-4);
}

.keyboard-help-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--bew-text-2);
  text-align: right;
}

@media (max-width: 520px) {
  .keyboard-help-mask {
    padding: 12px;
  }

  .keyboard-help-row {
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
  }

  .keyboard-help-desc {
    text-align: left;
  }
}

@media (prefers-reduced-motion: reduce) {
  .keyboard-help-close {
    transition: none;
  }
}
</style>
