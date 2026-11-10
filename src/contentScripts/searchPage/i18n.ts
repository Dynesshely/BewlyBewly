import { computed } from 'vue'

import { LanguageType } from '~/enums/appEnums'
import { settings } from '~/logic'

/** 快捷键说明（与 keyboard.ts 的行为一一对应） */
export interface ShortcutLabels {
  next: string
  prev: string
  open: string
  cancel: string
  panel: string
}

export interface SearchPageMessages {
  /** 浮动按钮 / 工具栏的无障碍名称 */
  controls: string
  openPanel: string
  panelTitle: string
  close: string
  density: string
  densityComfortable: string
  densityCompact: string
  filter: string
  filterAll: string
  filterVideo: string
  filterUser: string
  /** 当前页没有对应类型的结果时，选项下方的提示 */
  filterUnavailable: string
  /** 当前筛选与页面结果不匹配，自动回到「全部」时的提示 */
  filterNoMatch: string
  status: string
  statusIdle: string
  /** 形如「第 {current} / {total} 条」 */
  statusActive: string
  shortcutsTitle: string
  hint: string
  opened: string
  openFailed: string
  noUrl: string
  /** 页面上还没有结果卡 */
  noCards: string
  densityOn: string
  densityOff: string
  shortcut: ShortcutLabels
}

const CMN_CN: SearchPageMessages = {
  controls: '搜索结果增强',
  openPanel: '打开搜索增强面板',
  panelTitle: '搜索结果增强',
  close: '关闭',
  density: '密度',
  densityComfortable: '舒适',
  densityCompact: '紧凑',
  filter: '快速筛选',
  filterAll: '全部',
  filterVideo: '仅视频',
  filterUser: '仅用户',
  filterUnavailable: '当前页没有这类结果',
  filterNoMatch: '当前页没有这类结果，已切回「全部」',
  status: '浏览状态',
  statusIdle: '按 J / K 开始浏览结果',
  statusActive: '第 {current} / {total} 条',
  shortcutsTitle: '快捷键',
  hint: '面板与快捷键只作用于本页，状态在本标签页内保持',
  opened: '已在新标签页打开',
  openFailed: '无法打开该链接（可能被浏览器拦截）',
  noUrl: '这条结果没有可打开的链接',
  noCards: '页面上还没有搜索结果',
  densityOn: '已切换为紧凑密度',
  densityOff: '已切换为舒适密度',
  shortcut: {
    next: '下一张卡片',
    prev: '上一张卡片',
    open: '在新标签页打开',
    cancel: '取消高亮 / 关闭面板',
    panel: '打开 / 关闭面板',
  },
}

const EN: SearchPageMessages = {
  controls: 'Search result enhancements',
  openPanel: 'Open search enhancements',
  panelTitle: 'Search result enhancements',
  close: 'Close',
  density: 'Density',
  densityComfortable: 'Comfortable',
  densityCompact: 'Compact',
  filter: 'Quick filter',
  filterAll: 'All',
  filterVideo: 'Videos only',
  filterUser: 'Users only',
  filterUnavailable: 'No such results on this page',
  filterNoMatch: 'No such results on this page — switched back to All',
  status: 'Browsing',
  statusIdle: 'Press J / K to start browsing',
  statusActive: 'Result {current} / {total}',
  shortcutsTitle: 'Shortcuts',
  hint: 'The panel and shortcuts only affect this page; state is kept for this tab',
  opened: 'Opened in a new tab',
  openFailed: 'Could not open this link (maybe blocked by the browser)',
  noUrl: 'This result has no link to open',
  noCards: 'No search results on this page yet',
  densityOn: 'Switched to compact density',
  densityOff: 'Switched to comfortable density',
  shortcut: {
    next: 'Next card',
    prev: 'Previous card',
    open: 'Open in a new tab',
    cancel: 'Clear highlight / close panel',
    panel: 'Toggle the panel',
  },
}

/** 模块自建 i18n：只覆盖简中与英文，其余语言回退简中 */
export const MESSAGES: Record<string, SearchPageMessages> = {
  'cmn-CN': CMN_CN,
  'en': EN,
}

const FALLBACK_LANGUAGE = 'cmn-CN'

export function normalizeLanguage(language?: string): string {
  return language === LanguageType.English
    ? 'en'
    : FALLBACK_LANGUAGE
}

export function getMessages(language?: string): SearchPageMessages {
  const key = normalizeLanguage(language ?? settings.value.language)
  return MESSAGES[key] ?? CMN_CN
}

/** 响应 settings.language 的文案（切换语言后立即生效，不需要重建 UI） */
export function useMessages() {
  return computed(() => getMessages(settings.value.language))
}

export function formatStatus(template: string, current: number, total: number): string {
  return template.replace('{current}', String(current)).replace('{total}', String(total))
}
