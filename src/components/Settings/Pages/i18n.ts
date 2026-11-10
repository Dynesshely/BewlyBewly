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
  groupVideoCard: string
  groupVideoCardDesc: string
  cardPreview: string
  cardPreviewDesc: string
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

  groupMoments: string
  momentsDensity: string
  momentsDensityDesc: string
  groupNotification: string
  groupNotificationDesc: string
  notificationOnlyUnread: string
  notificationOnlyUnreadDesc: string
  notificationDensity: string
  groupSearchResult: string
  groupSearchResultDesc: string
  searchDensity: string
  groupSpace: string
  groupSpaceDesc: string
  spaceDensity: string
  groupArticle: string
  groupArticleDesc: string
  articleReadingMode: string
  articleReadingModeDesc: string
  articleFontSize: string
  densityComfortable: string
  densityCompact: string
  fontSizeS: string
  fontSizeM: string
  fontSizeL: string
  groupHome: string
  groupHomeDesc: string
  homeCardDensity: string
  homeCardDensityDesc: string
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
  groupVideoCard: '视频卡片',
  groupVideoCardDesc: '视频卡片本身的交互增强（首页、搜索、列表页等所有出现卡片的位置）',
  cardPreview: '悬停预览',
  cardPreviewDesc: '悬停卡片 0.9 秒后静音播放最多 6 秒的小片段；触屏、减少动态效果偏好，或卡片数据里没有 cid 时不生效',
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
  groupMoments: '动态页',
  momentsDensity: '卡片密度',
  momentsDensityDesc: '动态页卡片流的信息密度，页面顶部工具条也能直接切换',
  groupNotification: '消息页',
  groupNotificationDesc: 'B 站原生消息页（message.bilibili.com）的增强浮层',
  notificationOnlyUnread: '默认只看未读',
  notificationOnlyUnreadDesc: '进入消息页时自动隐藏已读条目；页面暂时识别不到未读状态时不会生效',
  notificationDensity: '列表密度',
  groupSearchResult: '搜索结果页',
  groupSearchResultDesc: 'B 站原生搜索结果页（search.bilibili.com）的增强浮层',
  searchDensity: '结果密度',
  groupSpace: '用户空间',
  groupSpaceDesc: 'B 站原生用户空间（space.bilibili.com）的增强浮层',
  spaceDensity: '内容密度',
  groupArticle: '文章页',
  groupArticleDesc: 'B 站专栏 / 动态文章页的沉浸阅读模式',
  articleReadingMode: '默认进入阅读模式',
  articleReadingModeDesc: '正文确认加载后自动进入沉浸阅读（隐藏侧栏 / 推荐 / 评论）',
  articleFontSize: '正文字号',
  densityComfortable: '舒适',
  densityCompact: '紧凑',
  fontSizeS: '小',
  fontSizeM: '中',
  fontSizeL: '大',
  groupHome: '首页',
  groupHomeDesc: '首页各子标签（推荐 / 关注 / 订阅剧集 / 热门 / 排行 / 直播）的卡片密度',
  homeCardDensity: '卡片密度',
  homeCardDensityDesc: '紧凑档每行多一张卡片、间距更小、标题字号小一档；首页顶部工具条也能直接切换',
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
  groupVideoCard: 'Video cards',
  groupVideoCardDesc: 'Interaction enhancements that apply to every video card (home, search, list pages and so on)',
  cardPreview: 'Hover preview',
  cardPreviewDesc: 'Hover a card for 0.9s to play a muted clip of up to 6 seconds. Disabled on touch devices, with reduced motion, or when the card data has no cid.',
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
  groupMoments: 'Moments page',
  momentsDensity: 'Card density',
  momentsDensityDesc: 'Information density of the moments feed. The toolbar on the page can switch it too.',
  groupNotification: 'Notifications page',
  groupNotificationDesc: 'Enhancement overlay on the native Bilibili notifications page (message.bilibili.com)',
  notificationOnlyUnread: 'Only show unread by default',
  notificationOnlyUnreadDesc: 'Hide read items when the page opens. Stays inactive while the page cannot detect read state.',
  notificationDensity: 'List density',
  groupSearchResult: 'Search results page',
  groupSearchResultDesc: 'Enhancement overlay on the native Bilibili search results page (search.bilibili.com)',
  searchDensity: 'Result density',
  groupSpace: 'User space',
  groupSpaceDesc: 'Enhancement overlay on the native Bilibili user space (space.bilibili.com)',
  spaceDensity: 'Content density',
  groupArticle: 'Article page',
  groupArticleDesc: 'Immersive reading mode for Bilibili articles and opus pages',
  articleReadingMode: 'Enter reading mode by default',
  articleReadingModeDesc: 'Once the article body is ready, hide the sidebar, recommendations and comments automatically.',
  articleFontSize: 'Body font size',
  densityComfortable: 'Comfortable',
  densityCompact: 'Compact',
  fontSizeS: 'Small',
  fontSizeM: 'Medium',
  fontSizeL: 'Large',
  groupHome: 'Home',
  groupHomeDesc: 'Card density for every home tab (For You / Following / Series / Trending / Ranking / Live)',
  homeCardDensity: 'Card density',
  homeCardDensityDesc: 'Compact shows one more card per row, with tighter gaps and a smaller title. The toolbar on the home page can switch it too.',
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
