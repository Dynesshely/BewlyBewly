<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { isFocusBrowseActive } from '~/composables/useFocusBrowse'
import {
  getActiveShortcutScopes,
  getEntryKeyTokens,
  getPaletteExecutableEntries,
  getPaletteShortcutEntries,
  matchesShortcutQuery,
  scopeLabelKey,
} from '~/constants/shortcutRegistry'
import { settings } from '~/logic'
import emitter from '~/utils/mitt'

const emit = defineEmits<{ (e: 'close'): void }>()
const { t } = useI18n()

interface Command {
  id: string
  label: string
  hint?: string
  run?: () => void
  /** 只作参考的快捷键条目：不可执行，标灰并提示「当前页不可用」 */
  reference?: boolean
  /** 快捷键条目所属页面的中文名（参考条目用来区分同名动作） */
  scopeLabel?: string
  /** 该命令对应的 App 层全局事件名（注册表可执行条目与面板内置命令去重时用） */
  event?: string
}

/** 按键片段 → 单行提示（组合键用 +，或关系用空格） */
function formatKeyTokens(tokens: string[], chord: boolean): string {
  return chord
    ? tokens.join('+')
    : tokens.join(' ')
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
    id: 'focus-browse',
    label: isFocusBrowseActive()
      ? t('command_palette.focus_browse_off')
      : t('command_palette.focus_browse_on'),
    hint: 'F',
    event: 'command-toggle-focus-browse',
    run: () => emitter.emit('command-toggle-focus-browse'),
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
    event: 'command-cycle-sort',
    run: () => emitter.emit('command-cycle-sort'),
  },
  {
    id: 'filter',
    label: t('command_palette.cycle_filter'),
    hint: 'f',
    event: 'command-cycle-filter',
    run: () => emitter.emit('command-cycle-filter'),
  },
  {
    id: 'info',
    label: t('command_palette.toggle_info'),
    hint: 'i',
    event: 'toggle-card-info-detail',
    run: () => emitter.emit('toggle-card-info-detail'),
  },
  {
    id: 'search',
    label: t('command_palette.focus_search'),
    hint: '/',
    event: 'command-focus-search',
    run: () => emitter.emit('command-focus-search'),
  },
  {
    id: 'ai-filter',
    label: t('command_palette.ai_filter'),
    hint: 'Shift+Q',
    event: 'command-run-ai-filter',
    run: () => emitter.emit('command-run-ai-filter'),
  },
  {
    id: 'help',
    label: t('command_palette.show_help'),
    hint: '?',
    event: 'toggle-keyboard-help',
    run: () => emitter.emit('toggle-keyboard-help'),
  },
  {
    id: 'settings',
    label: t('command_palette.open_settings'),
    event: 'command-open-settings',
    run: () => emitter.emit('command-open-settings'),
  },
])

const activeScopes = getActiveShortcutScopes()

/**
 * 注册表里带 `emitEvent` 的动作：App 层已有全局事件，命令面板可直接执行。
 * 与面板内置命令按事件名去重，避免同一个动作出现两行（内置命令的文案会随状态变化）。
 */
const registryCommands = computed<Command[]>(() => {
  const coveredEvents = new Set(
    commands.value
      .map(cmd => cmd.event)
      .filter((event): event is string => Boolean(event)),
  )

  return getPaletteExecutableEntries()
    .filter(entry => Boolean(entry.emitEvent) && !coveredEvents.has(entry.emitEvent as string))
    .map((entry) => {
      const { tokens, chord } = getEntryKeyTokens(entry, settings.value.keyboardShortcuts)
      const eventName = entry.emitEvent as string
      return {
        id: `exec-${entry.id}`,
        label: t(entry.i18nKey),
        hint: formatKeyTokens(tokens, chord),
        event: eventName,
        run: () => emitter.emit(eventName),
      } satisfies Command
    })
})

/** 可执行命令 = 面板内置命令 + 注册表可执行动作（参考条目由 buildShortcutReferences 补在后面） */
const executableCommands = computed<Command[]>(() => [
  ...commands.value,
  ...registryCommands.value,
])

/** 注册表里「不能安全触发」的快捷键条目：只展示，标灰 */
function buildShortcutReferences(onlyCurrentScope: boolean): Command[] {
  const entries = getPaletteShortcutEntries(
    settings.value.keyboardShortcuts,
    onlyCurrentScope
      ? { scopes: activeScopes }
      : {},
  )

  return entries.map((entry) => {
    const scopeLabel = t(scopeLabelKey(entry.scope))
    const { tokens, chord } = getEntryKeyTokens(entry, settings.value.keyboardShortcuts)
    return {
      id: `shortcut-${entry.id}`,
      label: t(entry.i18nKey),
      hint: formatKeyTokens(tokens, chord),
      reference: true,
      scopeLabel,
    }
  })
}

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) {
    // 未输入时不把整张注册表铺开，避免把命令挤下去；只补当前页相关的快捷键
    return [
      ...executableCommands.value,
      ...buildShortcutReferences(true),
    ]
  }

  // 命令名 / 按键提示 / id 都参与匹配：可执行动作也能用快捷键片段搜到（例如输入 shift+z）
  const commandHits = executableCommands.value.filter(cmd =>
    cmd.label.toLowerCase().includes(q)
    || (cmd.hint ?? '').toLowerCase().includes(q)
    || cmd.id.toLowerCase().includes(q))
  const referenceHits = getPaletteShortcutEntries(settings.value.keyboardShortcuts, {})
    .filter((entry) => {
      const scopeLabel = t(scopeLabelKey(entry.scope))
      const label = t(entry.i18nKey)
      return matchesShortcutQuery(
        entry,
        q,
        [label, scopeLabel],
        settings.value.keyboardShortcuts,
      )
    })
    .map((entry) => {
      const { tokens, chord } = getEntryKeyTokens(entry, settings.value.keyboardShortcuts)
      return {
        id: `shortcut-${entry.id}`,
        label: t(entry.i18nKey),
        hint: formatKeyTokens(tokens, chord),
        reference: true,
        scopeLabel: t(scopeLabelKey(entry.scope)),
      } satisfies Command
    })

  return [
    ...commandHits,
    ...referenceHits,
  ]
})

watch(filtered, () => {
  selected.value = firstRunnableIndex()
})

onMounted(() => {
  inputRef.value?.focus()
  selected.value = firstRunnableIndex()
})

/** 第一个可执行命令的下标（参考条目不可执行，默认选中要跳过它们） */
function firstRunnableIndex(): number {
  const index = filtered.value.findIndex(cmd => isRunnable(cmd))
  return index >= 0
    ? index
    : 0
}

/** 上下移动时跳过参考条目；找不到时停在原地 */
function moveSelection(delta: number) {
  const list = filtered.value
  if (!list.length)
    return
  let next = selected.value
  for (let step = 0; step < list.length; step++) {
    next += delta
    if (next < 0 || next >= list.length)
      return
    if (isRunnable(list[next])) {
      selected.value = next
      return
    }
  }
}

function runCommand(command?: Command) {
  const target = command ?? filtered.value[selected.value]
  if (!target)
    return
  // 参考条目只是告诉用户「这个页面上有这些键」，不能执行
  if (target.reference || !target.run)
    return
  target.run()
  emit('close')
}

/** 选中项跳过参考条目：上下移动时直接落到可执行命令上 */
function isRunnable(cmd: Command | undefined): boolean {
  return Boolean(cmd && cmd.run && !cmd.reference)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveSelection(1)
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveSelection(-1)
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
          :class="{ active: index === selected, reference: cmd.reference }"
          :aria-disabled="cmd.reference ? 'true' : undefined"
          @mouseenter="!cmd.reference && (selected = index)"
          @click="runCommand(cmd)"
        >
          <span class="command-palette-label">
            <span class="command-palette-name">{{ cmd.label }}</span>
            <span v-if="cmd.scopeLabel" class="command-palette-scope">{{ cmd.scopeLabel }}</span>
            <span v-if="cmd.reference" class="command-palette-note">
              {{ t('command_palette.shortcut_unavailable') }}
            </span>
          </span>
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
.command-palette-item.reference {
  color: var(--bew-text-3);
  cursor: default;
}
.command-palette-item.reference:hover {
  background: transparent;
}
.command-palette-label {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.command-palette-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.command-palette-scope {
  flex: none;
  padding: 0 6px;
  font-size: 11px;
  line-height: 18px;
  color: var(--bew-text-3);
  background: var(--bew-fill-1);
  border-radius: 6px;
}
.command-palette-note {
  flex: none;
  padding: 0 6px;
  font-size: 11px;
  line-height: 18px;
  color: var(--bew-text-4);
  background: var(--bew-fill-1);
  border-radius: 6px;
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
