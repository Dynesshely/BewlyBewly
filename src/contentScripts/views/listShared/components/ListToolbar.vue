<script setup lang="ts">
import type { ListSortMode, ListViewMode } from '../types'
import { useListI18n } from '../i18n'
import { LIST_SORT_MODES, LIST_VIEW_MODES } from '../preferences'
import ListShortcutHelp from './ListShortcutHelp.vue'

const props = withDefaults(defineProps<{
  viewMode: ListViewMode
  sortMode: ListSortMode
  filterKeyword: string
  title?: string
  count?: number
  placeholder?: string
  showHelpButton?: boolean
}>(), {
  title: '',
  count: undefined,
  placeholder: '',
  showHelpButton: true,
})

const emit = defineEmits<{
  (e: 'update:viewMode', value: ListViewMode): void
  (e: 'update:sortMode', value: ListSortMode): void
  (e: 'update:filterKeyword', value: string): void
  (e: 'search'): void
}>()

const { tl } = useListI18n()

const VIEW_ICONS: Record<ListViewMode, string> = {
  comfortable: 'i-mingcute:layout-grid-line',
  compact: 'i-mingcute:table-2-line',
  list: 'i-mingcute:list-check-3-line',
}

const toolbarRef = ref<HTMLElement | null>(null)
const filterRef = ref<HTMLInputElement | null>(null)
const isStuck = ref<boolean>(false)
const helpOpen = ref<boolean>(false)

const viewOptions = computed(() => LIST_VIEW_MODES.map(value => ({
  value,
  label: tl(`view.${value}`),
  icon: VIEW_ICONS[value],
})))

const sortOptions = computed(() => LIST_SORT_MODES.map(value => ({
  value,
  label: tl(`sort.${value}`),
})))

const countText = computed(() => (typeof props.count === 'number'
  ? tl('count.loaded', { count: props.count })
  : ''))

let scroller: HTMLElement | null = null
let resizeObserver: ResizeObserver | null = null

/** 吸顶判定：工具条实际位置到达它自己的 sticky 偏移量时视为吸顶 */
function updateStuckState() {
  const element = toolbarRef.value
  if (!element || !scroller) {
    isStuck.value = false
    return
  }
  const stickyOffset = Number.parseFloat(getComputedStyle(element).top) || 0
  const scrollerTop = scroller.getBoundingClientRect().top
  isStuck.value = element.getBoundingClientRect().top <= scrollerTop + stickyOffset + 1
}

/** 把工具条实际高度同步给分组头，保证分组头贴在工具条下方 */
function syncToolbarHeight() {
  const element = toolbarRef.value
  const page = element?.closest('.bewly-list-page')
  if (!element || !(page instanceof HTMLElement))
    return
  page.style.setProperty('--bew-list-toolbar-height', `${element.offsetHeight}px`)
}

function handleWindowResize() {
  syncToolbarHeight()
  updateStuckState()
}

function focusFilter() {
  const input = filterRef.value
  if (!input)
    return
  input.focus()
  if (input.value)
    input.select()
}

function toggleHelp() {
  helpOpen.value = !helpOpen.value
}

function handleSortChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value as ListSortMode
  emit('update:sortMode', value)
}

function handleFilterInput(event: Event) {
  emit('update:filterKeyword', (event.target as HTMLInputElement).value)
}

function clearFilter() {
  emit('update:filterKeyword', '')
  filterRef.value?.focus()
}

onMounted(() => {
  scroller = toolbarRef.value?.closest('.bewly-scroll-container') as HTMLElement | null
  if (scroller)
    scroller.addEventListener('scroll', updateStuckState, { passive: true })
  window.addEventListener('resize', handleWindowResize)
  if (toolbarRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      syncToolbarHeight()
      updateStuckState()
    })
    resizeObserver.observe(toolbarRef.value)
  }
  syncToolbarHeight()
  updateStuckState()
})

onBeforeUnmount(() => {
  if (scroller)
    scroller.removeEventListener('scroll', updateStuckState)
  window.removeEventListener('resize', handleWindowResize)
  resizeObserver?.disconnect()
  resizeObserver = null
  scroller = null
})

defineExpose({ focusFilter, toggleHelp })
</script>

<template>
  <div ref="toolbarRef" class="bewly-list-toolbar" :class="{ 'is-stuck': isStuck }">
    <div class="bewly-list-toolbar__meta">
      <span v-if="title" class="bewly-list-toolbar__title">{{ title }}</span>
      <span v-if="countText" class="bewly-list-toolbar__count">{{ countText }}</span>
    </div>

    <div class="bewly-list-toolbar__spacer" />

    <div class="bewly-list-segmented" role="group" :aria-label="tl('view.group_label')">
      <button
        v-for="option in viewOptions"
        :key="option.value"
        type="button"
        class="bewly-list-segmented__btn"
        :class="{ 'is-active': option.value === viewMode }"
        :aria-pressed="option.value === viewMode"
        :title="option.label"
        @click="emit('update:viewMode', option.value)"
      >
        <span class="bewly-list-segmented__icon" :class="option.icon" aria-hidden="true" />
        <span class="bewly-list-segmented__label">{{ option.label }}</span>
      </button>
    </div>

    <label class="bewly-list-select">
      <span class="bewly-list-visually-hidden">{{ tl('sort.label') }}</span>
      <select :value="sortMode" @change="handleSortChange">
        <option v-for="option in sortOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>

    <div class="bewly-list-filter">
      <span class="bewly-list-filter__icon i-mingcute:search-2-line" aria-hidden="true" />
      <input
        ref="filterRef"
        type="text"
        autocomplete="off"
        :value="filterKeyword"
        :placeholder="placeholder || tl('filter.placeholder')"
        :aria-label="placeholder || tl('filter.placeholder')"
        @input="handleFilterInput"
        @keydown.enter="emit('search')"
        @keydown.esc="clearFilter"
      >
      <button
        v-if="filterKeyword"
        type="button"
        class="bewly-list-filter__clear"
        :aria-label="tl('filter.clear')"
        :title="tl('filter.clear')"
        @click="clearFilter"
      >
        <span class="i-mingcute:close-line" aria-hidden="true" />
      </button>
    </div>

    <div v-if="$slots.actions" class="bewly-list-toolbar__actions">
      <slot name="actions" />
    </div>

    <div v-if="showHelpButton" class="bewly-list-toolbar__help">
      <button
        type="button"
        class="bewly-list-toolbar__icon-btn"
        :aria-expanded="helpOpen"
        :aria-label="tl('shortcut.button')"
        :title="tl('shortcut.button')"
        @click="toggleHelp"
      >
        <span class="i-tabler:keyboard" aria-hidden="true" />
      </button>
      <ListShortcutHelp :open="helpOpen" @close="helpOpen = false" />
    </div>
  </div>
</template>
