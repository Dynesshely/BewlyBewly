import type { ModuleLocale } from '~/utils/moduleI18n'

import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

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

const CMN_TW: ChannelPageMessages = {
  controls: '分區頁增強',
  openPanel: '開啟分區頁增強面板',
  panelTitle: '分區頁增強',
  panelTitlePopular: '熱門頁增強',
  panelTitleRank: '排行榜增強',
  close: '關閉',

  density: '密度',
  densityComfortable: '舒適',
  densityCompact: '緊湊',
  densityOn: '已切換為緊湊密度',
  densityOff: '已切換為舒適密度',

  sortTitle: '排序快捷',
  sortDefault: '綜合',
  sortViews: '播放多',
  sortNewest: '最新',
  sortUnavailable: '目前頁面沒有排序頁籤',
  sortFailed: '找不到這個排序頁籤',

  rankTitle: '榜單切換',
  rankDay: '日榜',
  rankWeek: '週榜',
  rankMonth: '月榜',
  rankFailed: '找不到這個榜單頁籤',

  status: '瀏覽狀態',
  statusIdle: '按 J / K 開始瀏覽影片',
  statusActive: '第 {current} / {total} 條',
  statusCount: '共 {total} 條',
  shortcutRank: '切換日榜 / 週榜 / 月榜',

  shortcutsTitle: '快速鍵',
  hint: '面板與快速鍵只作用於本頁，狀態在本分頁內保持',

  opened: '已在新分頁開啟',
  openFailed: '無法開啟該連結（可能被瀏覽器攔截）',
  noUrl: '這支影片沒有可開啟的連結',
  noCards: '頁面上還沒有可瀏覽的影片',

  shortcut: {
    next: '下一支影片',
    prev: '上一支影片',
    open: '在新分頁開啟',
    cancel: '取消高亮 / 關閉面板',
  },
}

const JYUT: ChannelPageMessages = {
  ...CMN_TW,
  panelTitlePopular: '熱門頁增強',
  sortUnavailable: '呢頁冇排序頁籤',
  sortFailed: '搵唔到呢個排序頁籤',
  rankFailed: '搵唔到呢個榜單頁籤',
  statusIdle: '撳 J / K 開始睇影片',
  hint: '面板同快速鍵淨係影響呢一頁，狀態喺呢個分頁入面保持',
  opened: '喺新分頁開咗',
  openFailed: '開唔到條連結（可能畀瀏覽器攔咗）',
  noUrl: '呢支影片冇連結可以開',
  noCards: '頁面仲未有影片可以睇',
  shortcut: {
    next: '下一支影片',
    prev: '上一支影片',
    open: '喺新分頁開',
    cancel: '取消高亮 / 關閉面板',
  },
}

/** 模块自建 i18n：四种语言键集合完全一致（缺键回退简中 / 英文，不会出现空串） */
export const MESSAGES: Record<ModuleLocale, ChannelPageMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  jyut: JYUT,
  en: EN,
}

export function normalizeLanguage(language?: string): ModuleLocale {
  return resolveModuleLocale(language)
}

export function getMessages(language?: string): ChannelPageMessages {
  return getModuleMessages<ChannelPageMessages>(MESSAGES, resolveModuleLocale(language ?? settings.value.language), CMN_CN)
}

/** 响应 settings.language 的文案（切换语言后立即生效，不需要重建 UI） */
export function useMessages() {
  return computed(() => getMessages(settings.value.language))
}

export function formatStatus(template: string, current: number, total: number): string {
  return template.replace('{current}', String(current)).replace('{total}', String(total))
}
