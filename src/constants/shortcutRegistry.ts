/**
 * 全站快捷键注册表。
 *
 * 目的：把散落在各模块里的按键（全局卡片导航、视频页、列表页、动态页、消息页、
 * 搜索结果页、用户空间、文章页）汇总成一份「只读登记表」，供：
 *   - `KeyboardShortcutHelp`（? 帮助）按 scope 分组展示；
 *   - `CommandPalette`（Ctrl/Cmd + K）搜索这些动作名。
 *
 * 约定：
 * - **只登记与展示**，不执行按键逻辑，也不改各模块内部的 keydown 处理，避免双触发；
 * - 可自定义的动作（见 `constants/shortcuts.ts` 的 SHORTCUT_ACTIONS）用 `shortcutActionId`
 *   引用，展示时取用户改键后的真实组合键；
 * - `emitEvent` 表示该动作在 App 层已有对应的全局事件，可以从命令面板安全触发；
 *   没有 emitEvent 的条目在命令面板里只作参考（标灰 + 「当前页不可用」）。
 */

import type { ShortcutActionId } from './shortcuts'
import { DEFAULT_SHORTCUTS, resolveShortcut } from './shortcuts'

/** 注册表的分组维度：全局 + 各原生页 / 内嵌页 */
export type ShortcutScope
  = | 'global'
    | 'video'
    | 'list'
    | 'moments'
    | 'notification'
    | 'search'
    | 'space'
    | 'article'

/** 帮助面板里的固定分组顺序（global 永远在最前） */
export const SHORTCUT_SCOPES: ShortcutScope[] = [
  'global',
  'video',
  'list',
  'moments',
  'notification',
  'search',
  'space',
  'article',
]

/** `keys` 里的分隔符：展示时渲染成普通文字，不做成 kbd */
export const KEY_SEPARATOR = '–'

export interface ShortcutRegistryEntry {
  /** 稳定 id，跨版本不要改（命令面板的搜索与排重用得上） */
  id: string
  scope: ShortcutScope
  /**
   * 展示用的按键片段。
   * - `chord: true`：这些片段组成一个组合键，渲染为 A + B；
   * - 否则是「或」的关系（例如 J 或 ↓）。
   */
  keys: string[]
  /** 文案 key（`keyboard_help.*` 或 `keyboard_registry.*`） */
  i18nKey: string
  /** 是否组合键 */
  chord?: boolean
  /** 对应可自定义动作（会读取 settings.keyboardShortcuts 覆盖） */
  shortcutActionId?: ShortcutActionId
  /** App 层已有的全局事件名，有它才能在命令面板里安全触发 */
  emitEvent?: string
  /** 命令面板搜索用的额外关键词（英文别名等） */
  keywords?: string[]
}

/** 把规范组合键拆成展示用片段：Ctrl+k → ['Ctrl','K'] */
function comboToTokens(combo: string): string[] {
  if (!combo)
    return []
  return combo
    .split('+')
    .map((part) => {
      if (part === 'Meta')
        return 'Cmd'
      if (part.length === 1)
        return part.toUpperCase()
      return part
    })
}

function defaultKeys(actionId: ShortcutActionId): string[] {
  return comboToTokens(DEFAULT_SHORTCUTS[actionId] ?? '')
}

/**
 * 登记表本体。
 *
 * 排序即展示顺序；条目顺序与各模块内部的按键清单保持一致，
 * 新增/删除按键时请同步这里（模块逻辑本身不依赖注册表）。
 */
export const SHORTCUT_REGISTRY: ShortcutRegistryEntry[] = [
  // #region 全局：卡片导航与通用动作
  {
    id: 'global-move',
    scope: 'global',
    keys: ['←', '↑', '→', '↓'],
    i18nKey: 'keyboard_help.move',
  },
  {
    id: 'global-jump',
    scope: 'global',
    keys: ['Home', 'End'],
    i18nKey: 'keyboard_help.jump',
  },
  {
    id: 'global-open-new-tab',
    scope: 'global',
    keys: defaultKeys('openNewTab'),
    i18nKey: 'keyboard_help.open_new',
    shortcutActionId: 'openNewTab',
  },
  {
    id: 'global-open-in-page',
    scope: 'global',
    keys: defaultKeys('openInPage'),
    i18nKey: 'keyboard_help.open_current',
    shortcutActionId: 'openInPage',
  },
  {
    id: 'global-watch-later',
    scope: 'global',
    keys: defaultKeys('watchLater'),
    i18nKey: 'keyboard_help.watch_later',
    shortcutActionId: 'watchLater',
  },
  {
    id: 'global-context-menu',
    scope: 'global',
    keys: defaultKeys('contextMenu'),
    i18nKey: 'keyboard_registry.actions.context_menu',
    shortcutActionId: 'contextMenu',
  },
  {
    id: 'global-cycle-sort',
    scope: 'global',
    keys: defaultKeys('cycleSort'),
    i18nKey: 'keyboard_registry.actions.sort_cards',
    shortcutActionId: 'cycleSort',
    emitEvent: 'command-cycle-sort',
  },
  {
    id: 'global-cycle-filter',
    scope: 'global',
    keys: defaultKeys('cycleFilter'),
    i18nKey: 'keyboard_registry.actions.filter_cards',
    shortcutActionId: 'cycleFilter',
    emitEvent: 'command-cycle-filter',
  },
  {
    id: 'global-toggle-info',
    scope: 'global',
    keys: defaultKeys('toggleInfo'),
    i18nKey: 'keyboard_help.info_detail',
    shortcutActionId: 'toggleInfo',
    emitEvent: 'toggle-card-info-detail',
  },
  {
    id: 'global-queue-card',
    scope: 'global',
    keys: defaultKeys('queueCard'),
    i18nKey: 'keyboard_help.queue',
    shortcutActionId: 'queueCard',
  },
  {
    id: 'global-ai-filter',
    scope: 'global',
    keys: defaultKeys('aiFilter'),
    i18nKey: 'keyboard_help.ai_filter',
    shortcutActionId: 'aiFilter',
    emitEvent: 'command-run-ai-filter',
  },
  {
    id: 'global-focus-browse',
    scope: 'global',
    keys: defaultKeys('toggleFocusBrowse'),
    i18nKey: 'keyboard_help.focus_browse',
    shortcutActionId: 'toggleFocusBrowse',
    emitEvent: 'command-toggle-focus-browse',
  },
  {
    id: 'global-focus-browse-exit',
    scope: 'global',
    keys: ['Esc'],
    i18nKey: 'keyboard_help.focus_browse_exit',
  },
  {
    id: 'global-focus-search',
    scope: 'global',
    keys: defaultKeys('focusSearch'),
    i18nKey: 'keyboard_help.search',
    shortcutActionId: 'focusSearch',
    emitEvent: 'command-focus-search',
  },
  {
    id: 'global-command-palette',
    scope: 'global',
    keys: defaultKeys('commandPalette'),
    i18nKey: 'keyboard_help.command_palette',
    shortcutActionId: 'commandPalette',
  },
  {
    id: 'global-help',
    scope: 'global',
    keys: defaultKeys('toggleHelp'),
    i18nKey: 'keyboard_help.help',
    shortcutActionId: 'toggleHelp',
    emitEvent: 'toggle-keyboard-help',
  },
  // #endregion

  // #region 视频播放页（src/contentScripts/videoPage/shortcuts.ts）
  {
    id: 'video-seek-back',
    scope: 'video',
    keys: ['J'],
    i18nKey: 'keyboard_registry.actions.video_seek_back',
  },
  {
    id: 'video-play-pause',
    scope: 'video',
    keys: ['K'],
    i18nKey: 'keyboard_registry.actions.video_play_pause',
  },
  {
    id: 'video-seek-forward',
    scope: 'video',
    keys: ['L'],
    i18nKey: 'keyboard_registry.actions.video_seek_forward',
  },
  {
    id: 'video-back5',
    scope: 'video',
    keys: ['←'],
    i18nKey: 'keyboard_registry.actions.video_back5',
  },
  {
    id: 'video-forward5',
    scope: 'video',
    keys: ['→'],
    i18nKey: 'keyboard_registry.actions.video_forward5',
  },
  {
    id: 'video-danmaku',
    scope: 'video',
    keys: ['C'],
    i18nKey: 'keyboard_registry.actions.video_danmaku',
  },
  {
    id: 'video-mute',
    scope: 'video',
    keys: ['M'],
    i18nKey: 'keyboard_registry.actions.video_mute',
  },
  {
    id: 'video-fullscreen',
    scope: 'video',
    keys: ['F'],
    i18nKey: 'keyboard_registry.actions.video_fullscreen',
  },
  {
    id: 'video-cinema',
    scope: 'video',
    keys: ['T'],
    i18nKey: 'keyboard_registry.actions.video_cinema',
  },
  {
    id: 'video-pip',
    scope: 'video',
    keys: ['Shift', 'P'],
    chord: true,
    i18nKey: 'keyboard_registry.actions.video_pip',
  },
  {
    id: 'video-restore',
    scope: 'video',
    keys: ['P'],
    i18nKey: 'keyboard_registry.actions.video_restore',
  },
  {
    id: 'video-percent',
    scope: 'video',
    keys: ['0', KEY_SEPARATOR, '9'],
    i18nKey: 'keyboard_registry.actions.video_percent',
  },
  {
    id: 'video-exit',
    scope: 'video',
    keys: ['Esc'],
    i18nKey: 'keyboard_registry.actions.video_exit',
  },
  // #endregion

  // #region 列表页（views/listShared/useListShortcuts.ts）
  {
    id: 'list-cycle-view',
    scope: 'list',
    keys: ['V'],
    i18nKey: 'keyboard_registry.actions.list_cycle_view',
  },
  {
    id: 'list-cycle-sort',
    scope: 'list',
    keys: ['Shift', 'V'],
    chord: true,
    i18nKey: 'keyboard_registry.actions.list_cycle_sort',
  },
  {
    id: 'list-focus-filter',
    scope: 'list',
    keys: ['/'],
    i18nKey: 'keyboard_registry.actions.list_focus_filter',
  },
  {
    id: 'list-toggle-help',
    scope: 'list',
    keys: ['H'],
    i18nKey: 'keyboard_registry.actions.list_toggle_help',
  },
  // #endregion

  // #region 动态页（views/Moments/composables/useMomentsShortcuts.ts）
  {
    id: 'moments-next',
    scope: 'moments',
    keys: ['J', '↓'],
    i18nKey: 'keyboard_registry.actions.next_card',
  },
  {
    id: 'moments-prev',
    scope: 'moments',
    keys: ['K', '↑'],
    i18nKey: 'keyboard_registry.actions.prev_card',
  },
  {
    id: 'moments-open',
    scope: 'moments',
    keys: ['O'],
    i18nKey: 'keyboard_registry.actions.open_card',
  },
  {
    id: 'moments-cancel',
    scope: 'moments',
    keys: ['Esc'],
    i18nKey: 'keyboard_registry.actions.cancel_active',
  },
  // #endregion

  // #region 消息页（contentScripts/notificationPage/shortcuts.ts）
  {
    id: 'notification-unread-only',
    scope: 'notification',
    keys: ['U'],
    i18nKey: 'keyboard_registry.actions.notify_unread_only',
  },
  {
    id: 'notification-density',
    scope: 'notification',
    keys: ['D'],
    i18nKey: 'keyboard_registry.actions.notify_density',
  },
  {
    id: 'notification-jump-category',
    scope: 'notification',
    keys: ['1', KEY_SEPARATOR, '4'],
    i18nKey: 'keyboard_registry.actions.notify_jump_category',
  },
  {
    id: 'notification-close',
    scope: 'notification',
    keys: ['Esc'],
    i18nKey: 'keyboard_registry.actions.close_panel',
  },
  // #endregion

  // #region 搜索结果页（contentScripts/searchPage/keyboard.ts）
  {
    id: 'search-next',
    scope: 'search',
    keys: ['J', '↓'],
    i18nKey: 'keyboard_registry.actions.next_card',
  },
  {
    id: 'search-prev',
    scope: 'search',
    keys: ['K', '↑'],
    i18nKey: 'keyboard_registry.actions.prev_card',
  },
  {
    id: 'search-open',
    scope: 'search',
    keys: ['Enter'],
    i18nKey: 'keyboard_registry.actions.open_card',
  },
  {
    id: 'search-close',
    scope: 'search',
    keys: ['Esc'],
    i18nKey: 'keyboard_registry.actions.close_panel',
  },
  // #endregion

  // #region 用户空间（contentScripts/spacePage/keyboard.ts）
  {
    id: 'space-next',
    scope: 'space',
    keys: ['J'],
    i18nKey: 'keyboard_registry.actions.next_card',
  },
  {
    id: 'space-prev',
    scope: 'space',
    keys: ['K'],
    i18nKey: 'keyboard_registry.actions.prev_card',
  },
  {
    id: 'space-open',
    scope: 'space',
    keys: ['Enter'],
    i18nKey: 'keyboard_registry.actions.open_card',
  },
  {
    id: 'space-cancel',
    scope: 'space',
    keys: ['Esc'],
    i18nKey: 'keyboard_registry.actions.cancel_active',
  },
  // #endregion

  // #region 文章页（contentScripts/articlePage/shortcuts.ts）
  {
    id: 'article-reading',
    scope: 'article',
    keys: ['R'],
    i18nKey: 'keyboard_registry.actions.article_reading',
  },
  {
    id: 'article-font-smaller',
    scope: 'article',
    keys: ['['],
    i18nKey: 'keyboard_registry.actions.article_font_smaller',
  },
  {
    id: 'article-font-larger',
    scope: 'article',
    keys: [']'],
    i18nKey: 'keyboard_registry.actions.article_font_larger',
  },
  {
    id: 'article-back-to-top',
    scope: 'article',
    keys: ['T'],
    i18nKey: 'keyboard_registry.actions.article_back_to_top',
  },
  {
    id: 'article-exit',
    scope: 'article',
    keys: ['Esc'],
    i18nKey: 'keyboard_registry.actions.article_exit',
  },
  // #endregion
]

/** 分组标题的 i18n key */
export function scopeLabelKey(scope: ShortcutScope): string {
  return `keyboard_registry.scopes.${scope}`
}

export interface EntryKeyTokens {
  tokens: string[]
  chord: boolean
}

/**
 * 展示用的按键片段（会应用用户的改键）。
 *
 * 可自定义动作：取 settings.keyboardShortcuts 解析后的真实组合键；
 * 其它动作：用登记表里的静态 keys。
 */
export function getEntryKeyTokens(
  entry: ShortcutRegistryEntry,
  overrides?: Partial<Record<ShortcutActionId, string>> | null,
): EntryKeyTokens {
  if (entry.shortcutActionId) {
    const tokens = comboToTokens(resolveShortcut(entry.shortcutActionId, overrides))
    return { tokens, chord: tokens.length > 1 }
  }
  return {
    tokens: entry.keys,
    chord: Boolean(entry.chord),
  }
}

export interface ShortcutGroup {
  scope: ShortcutScope
  entries: ShortcutRegistryEntry[]
}

/** 按 scope 分组（保持 SHORTCUT_SCOPES 的固定顺序，空分组不返回） */
export function groupShortcutsByScope(): ShortcutGroup[] {
  return SHORTCUT_SCOPES
    .map(scope => ({
      scope,
      entries: SHORTCUT_REGISTRY.filter(entry => entry.scope === scope),
    }))
    .filter(group => group.entries.length > 0)
}

/** 命令面板搜索用：只取「没有全局事件、不能安全触发」的参考条目 */
export function getPaletteShortcutEntries(
  overrides?: Partial<Record<ShortcutActionId, string>> | null,
  options: { scopes?: Set<ShortcutScope> | null } = {},
): ShortcutRegistryEntry[] {
  const scopes = options.scopes ?? null
  return SHORTCUT_REGISTRY.filter(entry =>
    !entry.emitEvent && (!scopes || scopes.has(entry.scope)),
  )
}

/**
 * 命令面板搜索匹配：动作名 / 分组名 / id / 别名 / 按键组合任一命中即算匹配。
 */
export function matchesShortcutQuery(
  entry: ShortcutRegistryEntry,
  query: string,
  labels: string[],
  overrides?: Partial<Record<ShortcutActionId, string>> | null,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q)
    return true
  const haystack = [
    ...labels,
    entry.id,
    ...(entry.keywords ?? []),
  ].join(' ').toLowerCase()
  if (haystack.includes(q))
    return true
  return getEntryKeyTokens(entry, overrides).tokens.join(' ').toLowerCase().includes(q)
}

/**
 * 当前页面涉及的 scope（用于帮助面板「当前页」标记 / 命令面板默认展示范围）。
 *
 * 只看 URL，不碰 DOM；Bewly 内嵌页通过 `?page=xxx` 识别。
 */
export function getActiveShortcutScopes(url: string = location.href): Set<ShortcutScope> {
  const scopes = new Set<ShortcutScope>(['global'])
  let page = ''
  try {
    const parsed = new URL(url)
    const search = parsed.search || ''
    page = new URLSearchParams(search).get('page') ?? ''
    // hash 路由里的 ?page= 也认
    if (!page && parsed.hash.includes('?'))
      page = new URLSearchParams(parsed.hash.slice(parsed.hash.indexOf('?'))).get('page') ?? ''
  }
  catch {
    // 非法 URL：只给 global
    return scopes
  }

  const href = url.split('#')[0]

  if (/\/read\/|\/opus\//.test(href))
    scopes.add('article')

  if (/\/video\/|\/list\/|\/bangumi\/play\//.test(href))
    scopes.add('video')

  if (/search\.bilibili\.com/.test(href) || page === 'Search')
    scopes.add('search')

  if (/space\.bilibili\.com/.test(href))
    scopes.add('space')

  if (/message\.bilibili\.com/.test(href))
    scopes.add('notification')

  if (/t\.bilibili\.com/.test(href) || page === 'Moments')
    scopes.add('moments')

  if (/\/history|\/watchlater|\/medialist/.test(href) || ['History', 'WatchLater', 'Favorites'].includes(page))
    scopes.add('list')

  return scopes
}
