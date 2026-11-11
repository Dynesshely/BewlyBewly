<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useListI18n } from '../i18n'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { tl } = useListI18n()
const panelRef = ref<HTMLElement | null>(null)

/** 打开面板前的焦点，关闭时还回去（列表工具条上的「快捷键」按钮） */
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
  return Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter(el => el.getClientRects().length > 0)
}

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

const shortcuts = computed(() => [
  {
    keys: ['V'],
    label: tl('shortcut.cycle_view'),
  },
  {
    keys: ['Shift', 'V'],
    label: tl('shortcut.cycle_sort'),
  },
  {
    keys: ['/'],
    label: tl('shortcut.focus_filter'),
  },
  {
    keys: ['H'],
    label: tl('shortcut.toggle_help'),
  },
  {
    keys: ['?'],
    label: tl('shortcut.global_help'),
  },
])

function close() {
  emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open) {
    event.preventDefault()
    event.stopPropagation()
    close()
  }
}

function handleDocumentClick(event: MouseEvent) {
  const target = event.target as Node | null
  // 点击触发按钮本身交给工具条自己切换，这里只处理「点击说明面板以外」的情况
  if (target && (target as Element).closest?.('.bewly-list-toolbar__help'))
    return
  close()
}

watch(() => props.open, async (open) => {
  if (open) {
    restoreFocusTo = activeElementDeep()
    await nextTick()
    bindTabTrap()
    const items = panelFocusables()
    if (items.length)
      items[0]?.focus({ preventScroll: true })
    else
      panelRef.value?.focus({ preventScroll: true })
    document.addEventListener('click', handleDocumentClick)
  }
  else {
    unbindTabTrap()
    restoreFocusTo?.focus?.({ preventScroll: true })
    restoreFocusTo = null
    document.removeEventListener('click', handleDocumentClick)
  }
})

onMounted(() => window.addEventListener('keydown', handleKeydown))

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('click', handleDocumentClick)
  unbindTabTrap()
  restoreFocusTo?.focus?.({ preventScroll: true })
  restoreFocusTo = null
})
</script>

<template>
  <Transition name="fade">
    <div
      v-if="open"
      ref="panelRef"
      class="bewly-list-help"
      role="dialog"
      aria-modal="false"
      :aria-label="tl('shortcut.title')"
      tabindex="-1"
      @click.stop
    >
      <header class="bewly-list-help__header">
        <h2 class="bewly-list-help__title">
          {{ tl('shortcut.title') }}
        </h2>
        <button
          type="button"
          class="bewly-list-help__close"
          :aria-label="tl('shortcut.close')"
          :title="tl('shortcut.close')"
          @click="close"
        >
          <span class="i-mingcute:close-line" aria-hidden="true" />
        </button>
      </header>
      <dl class="bewly-list-help__list">
        <div v-for="item in shortcuts" :key="item.label" class="bewly-list-help__row">
          <dt class="bewly-list-help__keys">
            <kbd v-for="key in item.keys" :key="key">{{ key }}</kbd>
          </dt>
          <dd class="bewly-list-help__label">
            {{ item.label }}
          </dd>
        </div>
      </dl>
      <p class="bewly-list-help__note">
        {{ tl('shortcut.note') }}
      </p>
    </div>
  </Transition>
</template>
