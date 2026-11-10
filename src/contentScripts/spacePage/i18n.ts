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

export interface SpacePageMessages {
  /** 浮动按钮 / 工具栏的无障碍名称 */
  controls: string
  openPanel: string
  panelTitle: string
  close: string

  filter: string
  filterAll: string
  filterVideo: string
  filterArticle: string
  filterDynamic: string
  filterCollection: string
  /** 当前页没有该类内容时按钮的说明 */
  filterUnavailable: string
  /** 筛选与页面内容不匹配、自动回到「全部」时的提示 */
  filterNoMatch: string

  density: string
  densityComfortable: string
  densityCompact: string
  densityOn: string
  densityOff: string

  jumpTitle: string
  jumpHome: string
  jumpVideo: string
  jumpCollection: string
  jumpFavorites: string
  jumpFailed: string

  status: string
  statusIdle: string
  /** 形如「第 {current} / {total} 条」 */
  statusActive: string
  /** 形如「共 {total} 条」 */
  statusCount: string

  shortcutsTitle: string
  hint: string

  opened: string
  openFailed: string
  noUrl: string
  /** 页面上还没有内容卡 */
  noCards: string

  shortcut: ShortcutLabels
}

const CMN_CN: SpacePageMessages = {
  controls: '用户空间增强',
  openPanel: '打开用户空间增强面板',
  panelTitle: '用户空间增强',
  close: '关闭',

  filter: '内容筛选',
  filterAll: '全部',
  filterVideo: '视频',
  filterArticle: '专栏',
  filterDynamic: '动态',
  filterCollection: '合集',
  filterUnavailable: '当前页没有这类内容',
  filterNoMatch: '当前页没有这类内容，已切回「全部」',

  density: '密度',
  densityComfortable: '舒适',
  densityCompact: '紧凑',
  densityOn: '已切换为紧凑密度',
  densityOff: '已切换为舒适密度',

  jumpTitle: '快速跳转',
  jumpHome: '主页',
  jumpVideo: '投稿',
  jumpCollection: '合集',
  jumpFavorites: '收藏夹',
  jumpFailed: '页面上找不到这个入口',

  status: '浏览状态',
  statusIdle: '按 J / K 开始浏览内容',
  statusActive: '第 {current} / {total} 条',
  statusCount: '共 {total} 条可浏览',

  shortcutsTitle: '快捷键',
  hint: '面板与快捷键只作用于本页，状态在本标签页内保持',

  opened: '已在新标签页打开',
  openFailed: '无法打开该链接（可能被浏览器拦截）',
  noUrl: '这条内容没有可打开的链接',
  noCards: '页面上还没有可浏览的内容',

  shortcut: {
    next: '下一条内容',
    prev: '上一条内容',
    open: '在新标签页打开',
    cancel: '取消高亮 / 关闭面板',
  },
}

const EN: SpacePageMessages = {
  controls: 'User space enhancements',
  openPanel: 'Open user space enhancements',
  panelTitle: 'User space enhancements',
  close: 'Close',

  filter: 'Content filter',
  filterAll: 'All',
  filterVideo: 'Videos',
  filterArticle: 'Articles',
  filterDynamic: 'Dynamics',
  filterCollection: 'Collections',
  filterUnavailable: 'No such content on this page',
  filterNoMatch: 'No such content on this page — switched back to All',

  density: 'Density',
  densityComfortable: 'Comfortable',
  densityCompact: 'Compact',
  densityOn: 'Switched to compact density',
  densityOff: 'Switched to comfortable density',

  jumpTitle: 'Quick jump',
  jumpHome: 'Home',
  jumpVideo: 'Uploads',
  jumpCollection: 'Collections',
  jumpFavorites: 'Favorites',
  jumpFailed: 'This tab is not available on the page',

  status: 'Browsing',
  statusIdle: 'Press J / K to start browsing',
  statusActive: 'Item {current} / {total}',
  statusCount: '{total} items to browse',

  shortcutsTitle: 'Shortcuts',
  hint: 'The panel and shortcuts only affect this page; state is kept for this tab',

  opened: 'Opened in a new tab',
  openFailed: 'Could not open this link (maybe blocked by the browser)',
  noUrl: 'This item has no link to open',
  noCards: 'No content to browse on this page yet',

  shortcut: {
    next: 'Next item',
    prev: 'Previous item',
    open: 'Open in a new tab',
    cancel: 'Clear highlight / close panel',
  },
}

/** 模块自建 i18n：只覆盖简中与英文，其余语言回退简中 */
export const MESSAGES: Record<string, SpacePageMessages> = {
  'cmn-CN': CMN_CN,
  'en': EN,
}

const FALLBACK_LANGUAGE = 'cmn-CN'

export function normalizeLanguage(language?: string): string {
  return language === LanguageType.English
    ? 'en'
    : FALLBACK_LANGUAGE
}

export function getMessages(language?: string): SpacePageMessages {
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
