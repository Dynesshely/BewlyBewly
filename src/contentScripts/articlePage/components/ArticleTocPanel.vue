<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import { jumpToHeading, setTocOpen } from '../actions'
import { prefersReducedMotion } from '../dom'
import { formatTemplate, useMessages } from '../i18n'
import { ui } from '../state'
import { getTocHeadings } from '../toc'

/**
 * 目录浮层：从正文 h1/h2/h3 自动生成，点击平滑滚动，当前章节高亮。
 *
 * 目录为空时面板不打开（Dock 里的目录按钮同时禁用），
 * 这样老文章即便没有语义化标题也不会出现一个空壳面板。
 */
const t = useMessages()
const listRef = ref<HTMLElement | null>(null)
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

watch(() => ui.tocOpen, async (open) => {
  if (!open) {
    unbindTabTrap()
    restoreFocusTo?.focus?.({ preventScroll: true })
    restoreFocusTo = null
    return
  }
  restoreFocusTo = activeElementDeep()
  await nextTick()
  bindTabTrap()
  // 打开后把焦点送进目录：优先当前章节，没有则第一个条目
  const activeItem = rootRef.value?.querySelector<HTMLElement>('[data-active="true"]')
  const first = panelFocusables()[0]
  const target = activeItem ?? first
  if (target)
    target.focus({ preventScroll: true })
  else
    rootRef.value?.focus({ preventScroll: true })
})

onBeforeUnmount(unbindTabTrap)
// #endregion

// 面板展开时跟随滚动：当前章节始终保持在目录可视范围内
watch(() => ui.activeTocIndex, (index) => {
  if (!ui.tocOpen || index < 0)
    return
  const node = listRef.value?.querySelector<HTMLElement>(`[data-index="${index}"]`)
  node?.scrollIntoView({
    block: 'nearest',
    behavior: prefersReducedMotion()
      ? 'auto'
      : 'smooth',
  })
})

function selectHeading(index: number) {
  jumpToHeading(index, getTocHeadings())
}
</script>

<template>
  <Transition name="bap-slide">
    <section
      v-if="ui.tocOpen"
      ref="rootRef"
      class="bap-toc"
      role="dialog"
      :aria-modal="false"
      :aria-label="t.tocTitle"

      tabindex="-1"
    >
      <header class="bap-toc__header">
        <div>
          <h2 class="bap-toc__title">
            {{ t.tocTitle }}
          </h2>
          <p class="bap-toc__meta">
            {{ formatTemplate(t.tocCount, { count: ui.tocItems.length }) }}
          </p>
        </div>
        <button
          type="button"
          class="bap-fab bap-fab--icon"
          :aria-label="t.close"
          :title="t.close"
          @click="setTocOpen(false)"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
          </svg>
        </button>
      </header>

      <ul v-if="ui.tocItems.length" ref="listRef" class="bap-toc__list">
        <li v-for="item in ui.tocItems" :key="`${item.index}-${item.text}`">
          <button
            type="button"
            class="bap-toc__item"
            :data-index="item.index"
            :data-level="item.level"
            :data-active="item.index === ui.activeTocIndex"
            :aria-current="item.index === ui.activeTocIndex ? 'true' : undefined"
            :title="item.text"
            @click="selectHeading(item.index)"
          >
            <span class="bap-toc__dot" aria-hidden="true" />
            <span class="bap-toc__text">{{ item.text }}</span>
          </button>
        </li>
      </ul>

      <p v-else class="bap-toc__empty">
        {{ t.tocEmpty }}
      </p>

      <p class="bap-toc__foot">
        {{ t.shortcutsHint }}
      </p>
    </section>
  </Transition>
</template>
