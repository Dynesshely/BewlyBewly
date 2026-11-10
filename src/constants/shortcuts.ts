/**
 * 可自定义的键盘快捷键。
 *
 * 设计约定：
 * - 组合键的规范形式是 `Ctrl+k` / `Shift+q` / `Space` / `Enter` / `?` 这类字符串，
 *   字母一律小写，修饰键顺序固定为 Ctrl → Meta → Alt → Shift；
 * - 方向键、Home/End 属于导航语义（网格模式下还要按列数换算），不纳入自定义；
 * - 存储里只保存「与默认值不同」的项，缺省即用默认值，便于后续调整默认键位。
 */

export type ShortcutActionId
  = | 'openNewTab'
    | 'openInPage'
    | 'watchLater'
    | 'contextMenu'
    | 'cycleSort'
    | 'cycleFilter'
    | 'toggleInfo'
    | 'queueCard'
    | 'aiFilter'
    | 'focusSearch'
    | 'toggleHelp'
    | 'toggleFocusBrowse'
    | 'toggleZenMode'
    | 'commandPalette'

export interface ShortcutActionDef {
  id: ShortcutActionId
  /** 默认组合键（规范形式） */
  defaultKey: string
  /** i18n key，位于 settings.keyboard_action_ */
  labelKey: string
}

export const SHORTCUT_ACTIONS: ShortcutActionDef[] = [
  { id: 'openNewTab', defaultKey: 'Enter', labelKey: 'settings.keyboard_action_open_new_tab' },
  { id: 'openInPage', defaultKey: 'Space', labelKey: 'settings.keyboard_action_open_in_page' },
  { id: 'watchLater', defaultKey: 'w', labelKey: 'settings.keyboard_action_watch_later' },
  { id: 'contextMenu', defaultKey: 'd', labelKey: 'settings.keyboard_action_context_menu' },
  { id: 'cycleSort', defaultKey: 's', labelKey: 'settings.keyboard_action_cycle_sort' },
  { id: 'cycleFilter', defaultKey: 'f', labelKey: 'settings.keyboard_action_cycle_filter' },
  { id: 'toggleInfo', defaultKey: 'i', labelKey: 'settings.keyboard_action_toggle_info' },
  { id: 'queueCard', defaultKey: 'q', labelKey: 'settings.keyboard_action_queue_card' },
  { id: 'aiFilter', defaultKey: 'Shift+q', labelKey: 'settings.keyboard_action_ai_filter' },
  { id: 'focusSearch', defaultKey: '/', labelKey: 'settings.keyboard_action_focus_search' },
  { id: 'toggleHelp', defaultKey: '?', labelKey: 'settings.keyboard_action_toggle_help' },
  { id: 'toggleFocusBrowse', defaultKey: 'Shift+f', labelKey: 'settings.keyboard_action_toggle_focus_browse' },
  { id: 'toggleZenMode', defaultKey: 'Shift+z', labelKey: 'settings.keyboard_action_zen_mode' },
  { id: 'commandPalette', defaultKey: 'Ctrl+k', labelKey: 'settings.keyboard_action_command_palette' },
]

export const DEFAULT_SHORTCUTS: Record<ShortcutActionId, string> = Object.fromEntries(
  SHORTCUT_ACTIONS.map(action => [action.id, action.defaultKey]),
) as Record<ShortcutActionId, string>

/** 需要 Shift 才能打出的符号：它们的 shift 状态已隐含在 key 里，不再单独加 Shift */
const SHIFTED_SYMBOLS = new Set([
  '?',
  '!',
  '@',
  '#',
  '$',
  '%',
  '^',
  '&',
  '*',
  '(',
  ')',
  '_',
  '+',
  '{',
  '}',
  '|',
  ':',
  '"',
  '<',
  '>',
  '~',
])

/** 把 KeyboardEvent 归一化成规范组合键 */
export function eventToCombo(event: KeyboardEvent): string {
  const parts: string[] = []
  if (event.ctrlKey)
    parts.push('Ctrl')
  if (event.metaKey)
    parts.push('Meta')
  if (event.altKey)
    parts.push('Alt')

  let key = event.key
  if (key === ' ')
    key = 'Space'

  if (key.length === 1 && /[A-Z]/.test(key)) {
    parts.push('Shift')
    key = key.toLowerCase()
  }
  else if (key.length === 1 && /[a-z]/.test(key)) {
    if (event.shiftKey)
      parts.push('Shift')
    key = key.toLowerCase()
  }
  else if (event.shiftKey && !SHIFTED_SYMBOLS.has(key)) {
    parts.push('Shift')
  }

  return [...parts, key].join('+')
}

/** 展示用格式化：Ctrl+k → Ctrl + K，Space → Space */
export function formatCombo(combo: string): string {
  if (!combo)
    return ''
  return combo
    .split('+')
    .map((part) => {
      if (part === 'Meta')
        return 'Cmd'
      if (part.length === 1)
        return part.toUpperCase()
      return part
    })
    .join(' + ')
}

/** 读取用户配置（缺省回落默认值） */
export function resolveShortcut(action: ShortcutActionId, overrides?: Record<string, string | undefined> | null): string {
  const custom = overrides?.[action]
  return custom || DEFAULT_SHORTCUTS[action]
}

/** 组合键是否匹配当前事件 */
export function comboMatches(combo: string, event: KeyboardEvent): boolean {
  if (!combo)
    return false
  return eventToCombo(event) === combo
}
