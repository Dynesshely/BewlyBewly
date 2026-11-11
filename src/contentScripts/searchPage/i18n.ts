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

const CMN_TW: SearchPageMessages = {
  controls: '搜尋結果增強',
  openPanel: '開啟搜尋增強面板',
  panelTitle: '搜尋結果增強',
  close: '關閉',
  density: '密度',
  densityComfortable: '舒適',
  densityCompact: '緊湊',
  filter: '快速篩選',
  filterAll: '全部',
  filterVideo: '僅影片',
  filterUser: '僅使用者',
  filterUnavailable: '目前頁面沒有這類結果',
  filterNoMatch: '目前頁面沒有這類結果，已切回「全部」',
  status: '瀏覽狀態',
  statusIdle: '按 J / K 開始瀏覽結果',
  statusActive: '第 {current} / {total} 條',
  shortcutsTitle: '快速鍵',
  hint: '面板與快速鍵只作用於本頁，狀態在本分頁內保持',
  opened: '已在新分頁開啟',
  openFailed: '無法開啟該連結（可能被瀏覽器攔截）',
  noUrl: '這條結果沒有可開啟的連結',
  noCards: '頁面上還沒有搜尋結果',
  densityOn: '已切換為緊湊密度',
  densityOff: '已切換為舒適密度',
  shortcut: {
    next: '下一張卡片',
    prev: '上一張卡片',
    open: '在新分頁開啟',
    cancel: '取消高亮 / 關閉面板',
    panel: '開啟 / 關閉面板',
  },
}

const JYUT: SearchPageMessages = {
  ...CMN_TW,
  controls: '搜尋結果增強',
  openPanel: '打開搜尋增強面板',
  panelTitle: '搜尋結果增強',
  filterUnavailable: '呢頁冇呢類結果',
  filterNoMatch: '呢頁冇呢類結果，轉返「全部」喇',
  statusIdle: '撳 J / K 開始睇結果',
  hint: '面板同快速鍵淨係影響呢一頁，狀態喺呢個分頁入面保持',
  opened: '喺新分頁開咗',
  openFailed: '開唔到條連結（可能畀瀏覽器攔咗）',
  noUrl: '呢條結果冇連結可以開',
  noCards: '頁面仲未有搜尋結果',
  densityOn: '轉咗做緊湊密度',
  densityOff: '轉咗做舒適密度',
  shortcut: {
    next: '下一張卡片',
    prev: '上一張卡片',
    open: '喺新分頁開',
    cancel: '取消高亮 / 關閉面板',
    panel: '打開 / 關閉面板',
  },
}

/** 模块自建 i18n：四种语言键集合完全一致（缺键回退简中 / 英文，不会出现空串） */
export const MESSAGES: Record<ModuleLocale, SearchPageMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  jyut: JYUT,
  en: EN,
}

export function normalizeLanguage(language?: string): ModuleLocale {
  return resolveModuleLocale(language)
}

export function getMessages(language?: string): SearchPageMessages {
  return getModuleMessages<SearchPageMessages>(MESSAGES, resolveModuleLocale(language ?? settings.value.language), CMN_CN)
}

/** 响应 settings.language 的文案（切换语言后立即生效，不需要重建 UI） */
export function useMessages() {
  return computed(() => getMessages(settings.value.language))
}

export function formatStatus(template: string, current: number, total: number): string {
  return template.replace('{current}', String(current)).replace('{total}', String(total))
}
