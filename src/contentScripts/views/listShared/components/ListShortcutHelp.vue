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
    await nextTick()
    panelRef.value?.focus()
    document.addEventListener('click', handleDocumentClick)
  }
  else {
    document.removeEventListener('click', handleDocumentClick)
  }
})

onMounted(() => window.addEventListener('keydown', handleKeydown))

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('click', handleDocumentClick)
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
