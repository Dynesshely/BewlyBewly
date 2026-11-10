import { computed } from 'vue'

import { LanguageType } from '~/enums/appEnums'
import { settings } from '~/logic'

/**
 * 「页面增强」设置页的模块内文案。
 *
 * 按简报约定，本页文案不进入全局 src/_locales 目录，而是由设置模块自行维护：
 * settings.value.language === 'en' 时使用英文，其余语言（含空值）一律回落简体中文。
 */
export interface PagesSettingsMessages {
  menuTitle: string
  groupVideoPage: string
  groupVideoPageDesc: string
  videoPageCinemaMode: string
  videoPageCinemaModeDesc: string
  videoPageMiniPlayer: string
  videoPageMiniPlayerDesc: string
  videoPageShortcuts: string
  videoPageShortcutsDesc: string
  groupListPage: string
  groupListPageDesc: string
  historyViewMode: string
  watchLaterViewMode: string
  favoritesViewMode: string
  defaultSort: string
  defaultSortDesc: string
  viewModeComfortable: string
  viewModeCompact: string
  viewModeList: string
  sortTime: string
  sortDuration: string
  sortTitle: string
  groupSearchPage: string
  groupSearchPageDesc: string
  directPaste: string
  directPasteDesc: string
}

const CMN_CN: PagesSettingsMessages = {
  menuTitle: '页面增强',
  groupVideoPage: '视频播放页',
  groupVideoPageDesc: '针对 B 站原生播放页的增强功能，关闭后对应功能不再接管页面',
  videoPageCinemaMode: '影院模式',
  videoPageCinemaModeDesc: '播放器铺满视口、隐藏右栏与推荐。按 T 或点击播放器右下角的浮动按钮切换',
  videoPageMiniPlayer: '滚动迷你播放器',
  videoPageMiniPlayerDesc: '播放器滚出视口后收缩到右下角浮窗，按 P 或点击按钮还原',
  videoPageShortcuts: '增强快捷键',
  videoPageShortcutsDesc: 'J/K/L、←/→、C/M/F/T 等快捷键；关闭后按键完全交还给 B 站原生快捷键',
  groupListPage: '列表页',
  groupListPageDesc: '观看历史 / 稍后再看 / 收藏页的默认视图与排序',
  historyViewMode: '观看历史视图',
  watchLaterViewMode: '稍后再看视图',
  favoritesViewMode: '收藏夹视图',
  defaultSort: '默认排序',
  defaultSortDesc: '三个列表页共用的初始排序；在页面内切换排序会同步更新这里',
  viewModeComfortable: '舒适网格',
  viewModeCompact: '紧凑网格',
  viewModeList: '列表',
  sortTime: '时间',
  sortDuration: '时长',
  sortTitle: '标题',
  groupSearchPage: '搜索页',
  groupSearchPageDesc: 'BewlyBewly 的搜索起始页（B 站搜索框获得焦点时出现的页面）',
  directPaste: '粘贴直达',
  directPasteDesc: '在搜索页粘贴 BV 号或 B 站链接时直接打开目标，而不是填入搜索框',
}

const EN: PagesSettingsMessages = {
  menuTitle: 'Page enhancements',
  groupVideoPage: 'Video page',
  groupVideoPageDesc: 'Enhancements on top of the native Bilibili video page. Turn one off and it stops taking over the page.',
  videoPageCinemaMode: 'Cinema mode',
  videoPageCinemaModeDesc: 'Stretch the player to the viewport, hide the right column and recommendations. Toggle with T or the floating button.',
  videoPageMiniPlayer: 'Scrolling mini player',
  videoPageMiniPlayerDesc: 'Shrink the player into a floating window once it scrolls out of view. Restore with P or the button.',
  videoPageShortcuts: 'Enhanced shortcuts',
  videoPageShortcutsDesc: 'J/K/L, ←/→, C/M/F/T and more. When off, every key is handed back to the native Bilibili shortcuts.',
  groupListPage: 'List pages',
  groupListPageDesc: 'Default view mode and sorting for history, watch later and favorites',
  historyViewMode: 'History view',
  watchLaterViewMode: 'Watch later view',
  favoritesViewMode: 'Favorites view',
  defaultSort: 'Default sorting',
  defaultSortDesc: 'Shared by all three list pages. Switching the sorting inside a page updates this value.',
  viewModeComfortable: 'Comfortable',
  viewModeCompact: 'Compact',
  viewModeList: 'List',
  sortTime: 'Time',
  sortDuration: 'Duration',
  sortTitle: 'Title',
  groupSearchPage: 'Search page',
  groupSearchPageDesc: 'The BewlyBewly search start page (shown when the Bilibili search box gets focus)',
  directPaste: 'Paste to open',
  directPasteDesc: 'Paste a BV id or Bilibili link on the search page to open it directly instead of filling the search box',
}

/** 模块自建 i18n：只覆盖简中与英文，其余语言回退简中 */
export const MESSAGES: Record<string, PagesSettingsMessages> = {
  'cmn-CN': CMN_CN,
  'en': EN,
}

const FALLBACK_LANGUAGE = 'cmn-CN'

export function normalizeLanguage(language?: string): string {
  return language === LanguageType.English
    ? 'en'
    : FALLBACK_LANGUAGE
}

export function getPagesSettingsMessages(language?: string): PagesSettingsMessages {
  const key = normalizeLanguage(language ?? settings.value.language)
  return MESSAGES[key] ?? CMN_CN
}

/** 响应 settings.language 的文案（切换语言后立即生效） */
export function usePagesSettingsMessages() {
  return computed(() => getPagesSettingsMessages(settings.value.language))
}
