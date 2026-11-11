<script setup lang="ts">
import type { ShortcutDefinition } from '../shortcuts'

import { nextTick, ref, watch } from 'vue'

import { toggleShortcutsHelp } from '../actions'
import { useMessages } from '../i18n'
import { getShortcutDefinitions } from '../shortcuts'
import { ui } from '../state'

const t = useMessages()
const closeButton = ref<HTMLButtonElement | null>(null)

/** 设置开关 + 页面能力（番剧切集）共同决定帮助里列哪些快捷键 */
const shortcuts = computed(() => getShortcutDefinitions())

/** 快捷键文案按页面能力微调：合集页把「播放项」说成「视频」 */
function labelOf(item: ShortcutDefinition): string {
  if (ui.selectionKind === 'collection') {
    if (item.labelKey === 'prevItem')
      return t.value.shortcut.prevVideo
    if (item.labelKey === 'nextItem')
      return t.value.shortcut.nextVideo
  }
  return t.value.shortcut[item.labelKey]
}

function isSeparator(key: string): boolean {
  return key === '–'
}

/** 组合键之间插入「+」，范围键（0 – 9）之间不插 */
function needsPlus(item: ShortcutDefinition, index: number): boolean {
  if (index === 0)
    return false
  const current = item.keys[index]
  const previous = item.keys[index - 1]
  if (!current || !previous)
    return false
  return !isSeparator(current) && !isSeparator(previous)
}

// #region 键盘可达性（第 19 轮）：打开聚焦 / shadowRoot capture 焦点陷阱 / 关闭恢复
const rootRef = ref<HTMLElement | null>(null)
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

/** 事件发生在 shadow root 内：监听挂到面板所在的 root（ShadowRoot / Document） */
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

watch(() => ui.helpOpen, async (open) => {
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
    rootRef.value?.focus({ preventScroll: true })
})

onBeforeUnmount(unbindTabTrap)
// #endregion
</script>

<template>
  <Transition name="bvp-fade">
    <div
      v-if="ui.helpOpen"
      ref="rootRef"
      class="bvp-help"
      role="dialog"
      aria-modal="true"
      :aria-label="t.shortcutsTitle"

      tabindex="-1"
    >
      <div class="bvp-help__backdrop" aria-hidden="true" @click="toggleShortcutsHelp(false)" />
      <div class="bvp-help__dialog">
        <div class="bvp-help__header">
          <h2 class="bvp-help__title">
            {{ t.shortcutsTitle }}
          </h2>
          <button
            ref="closeButton"
            class="bvp-icon-btn"
            type="button"
            data-bvp-action="close-help"
            :aria-label="t.close"
            :title="t.close"
            @click="toggleShortcutsHelp(false)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
        <p class="bvp-help__hint">
          {{ t.shortcutsHint }}
        </p>
        <ul class="bvp-help__list">
          <li v-for="item in shortcuts" :key="item.labelKey" class="bvp-help__row">
            <span class="bvp-help__label">{{ labelOf(item) }}</span>
            <span class="bvp-help__keys">
              <template v-for="(key, index) in item.keys" :key="`${item.labelKey}-${index}`">
                <span v-if="isSeparator(key)" class="bvp-help__separator">{{ key }}</span>
                <template v-else>
                  <span v-if="needsPlus(item, index)" class="bvp-help__separator">+</span>
                  <kbd class="bvp-kbd">{{ key }}</kbd>
                </template>
              </template>
            </span>
          </li>
        </ul>
      </div>
    </div>
  </Transition>
</template>
