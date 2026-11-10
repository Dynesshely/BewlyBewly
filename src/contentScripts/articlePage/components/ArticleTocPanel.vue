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

watch(() => ui.tocOpen, async (open) => {
  if (!open)
    return
  await nextTick()
  // 打开后把焦点送进目录：优先当前章节，没有则第一个条目
  const active = listRef.value?.querySelector<HTMLElement>('[data-active="true"]')
  const first = listRef.value?.querySelector<HTMLElement>('button')
  const target = active ?? first
  target?.focus()
})

function selectHeading(index: number) {
  jumpToHeading(index, getTocHeadings())
}
</script>

<template>
  <Transition name="bap-slide">
    <section
      v-if="ui.tocOpen"
      class="bap-toc"
      :aria-label="t.tocTitle"
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
            {{ item.text }}
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
