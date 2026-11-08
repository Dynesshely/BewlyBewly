<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { settings } from '~/logic'
import emitter from '~/utils/mitt'

const emit = defineEmits<{ (e: 'close'): void }>()
const { t } = useI18n()

interface Command {
  id: string
  label: string
  hint?: string
  run: () => void
}

const query = ref('')
const selected = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

const commands = computed<Command[]>(() => [
  {
    id: 'tab-1',
    label: t('command_palette.tab_for_you'),
    hint: '1',
    run: () => emitter.emit('switch-home-tab', 0),
  },
  {
    id: 'tab-2',
    label: t('command_palette.tab_following'),
    hint: '2',
    run: () => emitter.emit('switch-home-tab', 1),
  },
  {
    id: 'tab-3',
    label: t('command_palette.tab_series'),
    hint: '3',
    run: () => emitter.emit('switch-home-tab', 2),
  },
  {
    id: 'tab-4',
    label: t('command_palette.tab_trending'),
    hint: '4',
    run: () => emitter.emit('switch-home-tab', 3),
  },
  {
    id: 'tab-5',
    label: t('command_palette.tab_ranking'),
    hint: '5',
    run: () => emitter.emit('switch-home-tab', 4),
  },
  {
    id: 'tab-6',
    label: t('command_palette.tab_live'),
    hint: '6',
    run: () => emitter.emit('switch-home-tab', 5),
  },
  {
    id: 'keyboard-mode',
    label: settings.value.keyboardNavEnabled
      ? t('command_palette.keyboard_mode_off')
      : t('command_palette.keyboard_mode_on'),
    hint: settings.value.keyboardNavEnabled ? 'ON' : 'OFF',
    run: () => emitter.emit('command-toggle-keyboard-mode'),
  },
  {
    id: 'sort',
    label: t('command_palette.cycle_sort'),
    hint: 's',
    run: () => emitter.emit('command-cycle-sort'),
  },
  {
    id: 'filter',
    label: t('command_palette.cycle_filter'),
    hint: 'f',
    run: () => emitter.emit('command-cycle-filter'),
  },
  {
    id: 'info',
    label: t('command_palette.toggle_info'),
    hint: 'i',
    run: () => emitter.emit('toggle-card-info-detail'),
  },
  {
    id: 'search',
    label: t('command_palette.focus_search'),
    hint: '/',
    run: () => emitter.emit('command-focus-search'),
  },
  {
    id: 'ai-filter',
    label: t('command_palette.ai_filter'),
    hint: 'Shift+Q',
    run: () => emitter.emit('command-run-ai-filter'),
  },
  {
    id: 'help',
    label: t('command_palette.show_help'),
    hint: '?',
    run: () => emitter.emit('toggle-keyboard-help'),
  },
  {
    id: 'settings',
    label: t('command_palette.open_settings'),
    run: () => emitter.emit('command-open-settings'),
  },
])

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q)
    return commands.value
  return commands.value.filter(cmd => cmd.label.toLowerCase().includes(q))
})

watch(filtered, () => {
  selected.value = 0
})

onMounted(() => {
  inputRef.value?.focus()
})

function runCommand(command?: Command) {
  const target = command ?? filtered.value[selected.value]
  if (!target)
    return
  target.run()
  emit('close')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    selected.value = Math.min(filtered.value.length - 1, selected.value + 1)
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    selected.value = Math.max(0, selected.value - 1)
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    runCommand()
  }
}
</script>

<template>
  <div class="command-palette-mask" @click.self="$emit('close')">
    <div class="command-palette" @keydown="onKeydown">
      <input
        ref="inputRef"
        v-model="query"
        class="command-palette-input"
        :placeholder="t('command_palette.placeholder')"
      >
      <div class="command-palette-list">
        <div
          v-for="(cmd, index) in filtered"
          :key="cmd.id"
          class="command-palette-item"
          :class="{ active: index === selected }"
          @mouseenter="selected = index"
          @click="runCommand(cmd)"
        >
          <span>{{ cmd.label }}</span>
          <kbd v-if="cmd.hint">{{ cmd.hint }}</kbd>
        </div>
        <div v-if="!filtered.length" class="command-palette-empty">
          {{ t('command_palette.empty') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.command-palette-mask {
  position: fixed;
  inset: 0;
  z-index: 10020;
  display: flex;
  justify-content: center;
  padding-top: 18vh;
  background: rgb(0 0 0 / 30%);
  backdrop-filter: blur(4px);
}
.command-palette {
  width: min(560px, 88vw);
  max-height: 60vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-radius: var(--bew-radius);
  background: var(--bew-elevated);
  border: 1px solid var(--bew-border-color);
  box-shadow: var(--bew-shadow-2);
}
.command-palette-input {
  width: 100%;
  padding: 14px 18px;
  border: none;
  border-bottom: 1px solid var(--bew-border-color);
  background: transparent;
  color: var(--bew-text-1);
  font-size: 15px;
  outline: none;
}
.command-palette-list {
  overflow-y: auto;
  padding: 6px;
}
.command-palette-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--bew-text-2);
  cursor: pointer;
}
.command-palette-item.active {
  background: var(--bew-fill-2);
  color: var(--bew-text-1);
}
.command-palette-item kbd {
  padding: 1px 6px;
  border: 1px solid var(--bew-border-color);
  border-radius: 5px;
  font-size: 11px;
  color: var(--bew-text-3);
}
.command-palette-empty {
  padding: 12px;
  text-align: center;
  color: var(--bew-text-3);
  font-size: 13px;
}
</style>
