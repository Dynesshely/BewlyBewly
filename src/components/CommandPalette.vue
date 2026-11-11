<script setup lang="ts">
import type { ShortcutScope } from '~/constants/shortcutRegistry'
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
import { isHomePage } from '~/utils/main'
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
  /** 注册表条目的页面 scope（按当前页过滤其他页面动作时用） */
  scope?: ShortcutScope
  /** 分组标题行：不可执行、不可选中，只用于分隔「当前页 / 其他页面」 */
  header?: boolean
  /** 「其他页面」折叠行：可执行，但执行后保持面板打开 */
  toggle?: boolean
  /** 执行后不关闭面板（折叠行用） */
  keepOpen?: boolean
  /** 是否显示「当前页不可用」提示（仅无法判断页面时的旧行为使用） */
  note?: boolean
  /** 分组标题高亮（「当前页」分组用主题色） */
  accent?: boolean
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
const rootRef = ref<HTMLElement | null>(null)
/** 打开命令面板前的焦点，关闭时还回去（在 setup 阶段捕获，此时还没抢焦点） */
const restoreFocusTo = activeElementDeep()
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

/**
 * 焦点在面板内循环。
 * 命令面板的条目不参与 Tab（键盘导航走输入框上的 ↑/↓/Enter），
 * 所以正常只有输入框一个可聚焦元素；仍然按通用规则首尾循环。
 */
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

/** 命令面板在 shadow root 里：监听挂到面板所在的 ShadowRoot（没有则 Document） */
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
})

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

const activeScopes = computed(() => getActiveShortcutScopes())

/**
 * 是否处于「能判断当前页面」的上下文。
 *
 * getActiveShortcutScopes() 至少会返回 global：只剩 global 说明 URL 不在注册表能
 * 识别的页面里；首页本身也没有独立 scope，用 isHomePage() 兜底。
 * 两者都判断不出时退回第 9 轮的旧行为（可执行 + 灰显混排），
 * 避免在未知页面把命令全藏进折叠区。
 */
const pageContextKnown = computed(() => activeScopes.value.size > 1 || isHomePage())

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
        scope: entry.scope,
        run: () => emitter.emit(eventName),
      } satisfies Command
    })
})

/** 当前页可执行的注册表动作 */
const currentRegistryCommands = computed<Command[]>(() =>
  registryCommands.value.filter(cmd => !cmd.scope || activeScopes.value.has(cmd.scope)),
)

/** 其他页面的注册表动作：收进折叠区，灰显且不可执行 */
const otherRegistryCommands = computed<Command[]>(() =>
  registryCommands.value
    .filter(cmd => Boolean(cmd.scope) && !activeScopes.value.has(cmd.scope as ShortcutScope))
    .map(cmd => ({
      ...cmd,
      id: `other-${cmd.id}`,
      run: undefined,
      reference: true,
    }) satisfies Command),
)

/** 「其他页面」折叠区是否展开 */
const showOtherPages = ref(false)

/**
 * 注册表里「不能安全触发」的快捷键条目：只展示，标灰。
 *
 * @param mode current=当前页 other=其他页面 all=不做页面过滤（旧行为）
 * @param q 搜索关键词；空串表示不过滤
 */
function buildReferenceCommands(mode: 'current' | 'other' | 'all', q = ''): Command[] {
  const entries = getPaletteShortcutEntries(
    settings.value.keyboardShortcuts,
    mode === 'all'
      ? {}
      : { scopes: activeScopes.value, excludeScopes: mode === 'other' },
  )

  return entries
    .filter((entry) => {
      if (!q)
        return true
      return matchesShortcutQuery(
        entry,
        q,
        [
          t(entry.i18nKey),
          t(scopeLabelKey(entry.scope)),
        ],
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
        // 只有「页面不确定」的回退模式需要逐条提示，分组 / 折叠标题已经说明了原因
        note: mode === 'all',
        scopeLabel: t(scopeLabelKey(entry.scope)),
      } satisfies Command
    })
}

function buildSectionHeader(id: string, label: string, accent = false): Command {
  return {
    id: `header-${id}`,
    label,
    header: true,
    accent,
  }
}

/** 命令名 / 按键提示 / id 任一命中即算匹配 */
function matchesCommand(cmd: Command, q: string): boolean {
  return cmd.label.toLowerCase().includes(q)
    || (cmd.hint ?? '').toLowerCase().includes(q)
    || cmd.id.toLowerCase().includes(q)
}

/** 「其他页面（N）」折叠行 */
function buildToggleRow(count: number): Command {
  return {
    id: 'toggle-other-pages',
    label: `${t('command_palette.shortcut_unavailable')} · ${count}`,
    toggle: true,
    keepOpen: true,
    run: () => {
      showOtherPages.value = !showOtherPages.value
    },
  }
}

const filtered = computed<Command[]>(() => {
  const q = query.value.trim().toLowerCase()

  // 页面不确定：退回第 9 轮行为（可执行 + 灰显混排，不做分组 / 折叠）
  if (!pageContextKnown.value) {
    const executable = [
      ...commands.value,
      ...registryCommands.value,
    ]
    if (!q) {
      return [
        ...executable,
        ...buildReferenceCommands('all'),
      ]
    }
    return [
      ...executable.filter(cmd => matchesCommand(cmd, q)),
      ...buildReferenceCommands('all', q),
    ]
  }

  // 页面确定且没有输入：内置命令 → 当前页可执行动作 / 当前页快捷键 → 折叠的其他页面
  if (!q) {
    const currentItems = [
      ...currentRegistryCommands.value,
      ...buildReferenceCommands('current'),
    ]
    const otherItems = [
      ...otherRegistryCommands.value,
      ...buildReferenceCommands('other'),
    ]
    const list: Command[] = [...commands.value]

    if (currentItems.length)
      list.push(buildSectionHeader('current', t('keyboard_registry.current_scope'), true), ...currentItems)

    if (otherItems.length) {
      list.push(buildToggleRow(otherItems.length))
      if (showOtherPages.value)
        list.push(...otherItems)
    }

    return list
  }

  // 有关键词：可执行的排前面并分组，其他页面 / 不可执行的排后面
  const currentItems = [
    ...currentRegistryCommands.value.filter(cmd => matchesCommand(cmd, q)),
    ...buildReferenceCommands('current', q),
  ]
  const otherItems = [
    ...otherRegistryCommands.value.filter(cmd => matchesCommand(cmd, q)),
    ...buildReferenceCommands('other', q),
  ]

  const list: Command[] = commands.value.filter(cmd => matchesCommand(cmd, q))
  if (currentItems.length)
    list.push(buildSectionHeader('current', t('keyboard_registry.current_scope'), true), ...currentItems)
  if (otherItems.length)
    list.push(buildSectionHeader('other', `${t('command_palette.shortcut_unavailable')} · ${otherItems.length}`), ...otherItems)
  return list
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
  // 分组标题没有动作；参考条目只是告诉用户「这个页面上有这些键」，都不能执行
  if (target.header || target.reference || !target.run)
    return
  target.run()
  // 折叠行只展开 / 收起「其他页面」，执行后保持面板打开并停在原处
  if (target.keepOpen) {
    nextTick(() => {
      const index = filtered.value.findIndex(item => item.id === target.id)
      if (index >= 0)
        selected.value = index
    })
    return
  }
  emit('close')
}

/** 选中项跳过参考条目：上下移动时直接落到可执行命令上 */
function isRunnable(cmd: Command | undefined): boolean {
  return Boolean(cmd && cmd.run && !cmd.reference)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    // 第 19 轮：Esc 关闭命令面板时不把事件继续传给页面级快捷键
    event.stopPropagation()
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
    <div
      ref="rootRef"
      class="command-palette"
      role="dialog"
      aria-modal="true"
      :aria-label="t('command_palette.placeholder')"
      tabindex="-1"
      @keydown="onKeydown"
    >
      <input
        ref="inputRef"
        v-model="query"
        class="command-palette-input"
        :placeholder="t('command_palette.placeholder')"
      >
      <div class="command-palette-list">
        <template v-for="(cmd, index) in filtered" :key="cmd.id">
          <div
            v-if="cmd.header"
            class="command-palette-section"
            :class="{ 'is-current': cmd.accent }"
          >
            {{ cmd.label }}
          </div>
          <div
            v-else
            class="command-palette-item"
            :class="{ 'active': index === selected, 'reference': cmd.reference, 'is-toggle': cmd.toggle }"
            :aria-disabled="cmd.reference ? 'true' : undefined"
            :aria-expanded="cmd.toggle ? showOtherPages : undefined"
            @mouseenter="isRunnable(cmd) && (selected = index)"
            @click="runCommand(cmd)"
          >
            <span class="command-palette-label">
              <span class="command-palette-name">{{ cmd.label }}</span>
              <span v-if="cmd.scopeLabel" class="command-palette-scope">{{ cmd.scopeLabel }}</span>
              <span v-if="cmd.reference && cmd.note" class="command-palette-note">
                {{ t('command_palette.shortcut_unavailable') }}
              </span>
            </span>
            <template v-if="cmd.toggle">
              <span class="command-palette-chevron" aria-hidden="true">
                {{ showOtherPages ? '▴' : '▾' }}
              </span>
            </template>
            <kbd v-else-if="cmd.hint">{{ cmd.hint }}</kbd>
          </div>
        </template>
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
.command-palette-item.is-toggle {
  margin-top: 4px;
  color: var(--bew-text-3);
  border-top: 1px solid var(--bew-border-color);
  border-radius: 0 0 8px 8px;
}
.command-palette-section {
  padding: 10px 12px 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--bew-text-3);
}
.command-palette-section.is-current {
  color: var(--bew-theme-color);
}
.command-palette-chevron {
  flex: none;
  padding: 0 4px;
  font-size: 10px;
  color: var(--bew-text-3);
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
