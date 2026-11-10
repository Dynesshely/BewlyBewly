import { computed } from 'vue'

import { LanguageType } from '~/enums/appEnums'
import { settings } from '~/logic'

/** 快捷键说明（与 keyboard.ts 的行为一一对应） */
export interface ShortcutLabels {
  next: string
  prev: string
  open: string
  cancel: string
}

export interface ChannelPageMessages {
  controls: string
  openPanel: string
  panelTitle: string
  /** 热门页（/v/popular*）的面板标题 */
  panelTitlePopular: string
  /** 排行榜页（/v/popular/rank/*）的面板标题 */
  panelTitleRank: string
  close: string

  density: string
  densityComfortable: string
  densityCompact: string
  densityOn: string
  densityOff: string

  sortTitle: string
  sortDefault: string
  sortViews: string
  sortNewest: string
  /** 页面上找不到排序 tab 时的说明 */
  sortUnavailable: string
  sortFailed: string

  rankTitle: string
  rankDay: string
  rankWeek: string
  rankMonth: string
  /** 页面上找不到榜单 tab 时 */
  rankFailed: string

  status: string
  statusIdle: string
  /** 形如「第 {current} / {total} 条」 */
  statusActive: string
  /** 形如「共 {total} 条」 */
  statusCount: string
  /** 榜单快捷键说明（排行榜页才显示） */
  shortcutRank: string

  shortcutsTitle: string
  hint: string

  opened: string
  openFailed: string
  noUrl: string
  noCards: string

  shortcut: ShortcutLabels
}

const CMN_CN: ChannelPageMessages = {
  controls: '分区页增强',
  openPanel: '打开分区页增强面板',
  panelTitle: '分区页增强',
  panelTitlePopular: '热门页增强',
  panelTitleRank: '排行榜增强',
  close: '关闭',

  density: '密度',
  densityComfortable: '舒适',
  densityCompact: '紧凑',
  densityOn: '已切换为紧凑密度',
  densityOff: '已切换为舒适密度',

  sortTitle: '排序快捷',
  sortDefault: '综合',
  sortViews: '播放多',
  sortNewest: '最新',
  sortUnavailable: '当前页没有排序 tab',
  sortFailed: '找不到这个排序 tab',

  rankTitle: '榜单切换',
  rankDay: '日榜',
  rankWeek: '周榜',
  rankMonth: '月榜',
  rankFailed: '找不到这个榜单 tab',

  status: '浏览状态',
  statusIdle: '按 J / K 开始浏览视频',
  statusActive: '第 {current} / {total} 条',
  statusCount: '共 {total} 条',
  shortcutRank: '切换日榜 / 周榜 / 月榜',

  shortcutsTitle: '快捷键',
  hint: '面板与快捷键只作用于本页，状态在本标签页内保持',

  opened: '已在新标签页打开',
  openFailed: '无法打开该链接（可能被浏览器拦截）',
  noUrl: '这条视频没有可打开的链接',
  noCards: '页面上还没有可浏览的视频',

  shortcut: {
    next: '下一个视频',
    prev: '上一个视频',
    open: '在新标签页打开',
    cancel: '取消高亮 / 关闭面板',
  },
}

const EN: ChannelPageMessages = {
  controls: 'Channel enhancements',
  openPanel: 'Open channel enhancements',
  panelTitle: 'Channel enhancements',
  panelTitlePopular: 'Popular page enhancements',
  panelTitleRank: 'Ranking page enhancements',
  close: 'Close',

  density: 'Density',
  densityComfortable: 'Comfortable',
  densityCompact: 'Compact',
  densityOn: 'Switched to compact density',
  densityOff: 'Switched to comfortable density',

  sortTitle: 'Quick sort',
  sortDefault: 'Default',
  sortViews: 'Most views',
  sortNewest: 'Newest',
  sortUnavailable: 'No sort tabs on this page',
  sortFailed: 'This sort tab is not available',

  rankTitle: 'Ranking period',
  rankDay: 'Daily',
  rankWeek: 'Weekly',
  rankMonth: 'Monthly',
  rankFailed: 'This ranking tab is not available',

  status: 'Browsing',
  statusIdle: 'Press J / K to start browsing',
  statusActive: 'Item {current} / {total}',
  statusCount: '{total} items',
  shortcutRank: 'Switch daily / weekly / monthly ranking',

  shortcutsTitle: 'Shortcuts',
  hint: 'The panel and shortcuts only affect this page; state is kept for this tab',

  opened: 'Opened in a new tab',
  openFailed: 'Could not open this link (maybe blocked by the browser)',
  noUrl: 'This video has no link to open',
  noCards: 'No videos to browse on this page yet',

  shortcut: {
    next: 'Next video',
    prev: 'Previous video',
    open: 'Open in a new tab',
    cancel: 'Clear highlight / close panel',
  },
}

/** 模块自建 i18n：只覆盖简中与英文，其余语言回退简中 */
export const MESSAGES: Record<string, ChannelPageMessages> = {
  'cmn-CN': CMN_CN,
  'en': EN,
}

const FALLBACK_LANGUAGE = 'cmn-CN'

export function normalizeLanguage(language?: string): string {
  return language === LanguageType.English
    ? 'en'
    : FALLBACK_LANGUAGE
}

export function getMessages(language?: string): ChannelPageMessages {
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
