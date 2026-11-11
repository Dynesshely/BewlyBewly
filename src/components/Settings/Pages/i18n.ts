import type { ModuleLocale } from '~/utils/moduleI18n'

import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

/**
 * 「页面增强」设置页的模块内文案。
 *
 * 按简报约定，本页文案不进入全局 src/_locales 目录，而是由设置模块自行维护。
 * 四种模块语言：cmn-CN 简中 / cmn-TW 繁体 / jyut 繁体（粤语词）/ en 英文，
 * 语言解析统一走 `~/utils/moduleI18n`（见 docs/i18n-modules.md）。
 */
export interface PagesSettingsMessages {
  menuTitle: string
  /** 顶部分组导航的无障碍标题 */
  nav: string
  searchPlaceholder: string
  searchClear: string
  searchEmpty: string
  searchEmptyDesc: string
  resetGroup: string
  resetGroupDone: string
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
  cardQuickActions: string
  cardQuickActionsDesc: string
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
  momentsOptimize: string
  momentsOptimizeDesc: string
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
  groupChannel: string
  groupChannelDesc: string
  channelDensity: string
  channelDensityDesc: string
}

const CMN_CN: PagesSettingsMessages = {
  menuTitle: '页面增强',
  nav: '分组导航',
  searchPlaceholder: '搜索设置项',
  searchClear: '清空',
  searchEmpty: '没有匹配的设置',
  searchEmptyDesc: '换个关键词试试，或清空搜索查看全部设置',
  resetGroup: '重置本组',
  resetGroupDone: '已重置',
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
  cardQuickActions: '悬停操作条',
  cardQuickActionsDesc: '悬停卡片时在右下角显示点赞 / 收藏 / 稍后再看；收藏可多选收藏夹，已收藏再点即取消。未登录时只提示不请求，失败会自动回滚',
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
  momentsOptimize: '离屏优化',
  momentsOptimizeDesc: '只渲染视口附近的卡片，滚动到附近时才渲染其余卡片；关闭后所有卡片全部渲染（长列表更吃性能）',
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
  groupChannel: '分区 / 排行页',
  groupChannelDesc: 'B 站原生分区页（bilibili.com/v/*、/channel/*）与排行榜页的增强浮层',
  channelDensity: '列表密度',
  channelDensityDesc: '紧凑档缩小卡片间距与标题字号，一屏能看到更多内容',
}

const EN: PagesSettingsMessages = {
  menuTitle: 'Page enhancements',
  nav: 'Section navigation',
  searchPlaceholder: 'Search settings',
  searchClear: 'Clear',
  searchEmpty: 'No matching settings',
  searchEmptyDesc: 'Try another keyword, or clear the search to see every setting',
  resetGroup: 'Reset group',
  resetGroupDone: 'Reset done',
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
  cardQuickActions: 'Hover action bar',
  cardQuickActionsDesc: 'Show like / favorite / watch-later buttons at the bottom-right of a hovered card. Favorites support multi-folder selection, and clicking again removes them. Not signed in? You get a hint instead of a request; failures roll back automatically.',
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
  momentsOptimize: 'Off-screen optimization',
  momentsOptimizeDesc: 'Only render cards near the viewport and render the rest as you scroll close. When off, every card renders — heavier on long feeds.',
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
  groupChannel: 'Channel / ranking pages',
  groupChannelDesc: 'Enhancement overlay on native Bilibili channel pages (bilibili.com/v/*, /channel/*) and ranking pages',
  channelDensity: 'List density',
  channelDensityDesc: 'Compact tightens card gaps and the title size so more content fits on one screen.',
}

const CMN_TW: PagesSettingsMessages = {
  menuTitle: '頁面增強',
  nav: '分組導覽',
  searchPlaceholder: '搜尋設定項',
  searchClear: '清除',
  searchEmpty: '沒有符合的設定',
  searchEmptyDesc: '換個關鍵字試下，或者清除搜尋睇全部設定',
  resetGroup: '重設本組',
  resetGroupDone: '已重設',
  groupVideoPage: '影片播放頁',
  groupVideoPageDesc: '針對 B 站原生播放頁的增強功能，關閉後對應功能不再接管頁面',
  videoPageCinemaMode: '影院模式',
  videoPageCinemaModeDesc: '播放器鋪滿視口、隱藏右欄與推薦。按 T 或點擊播放器右下角的浮動按鈕切換',
  videoPageMiniPlayer: '捲動迷你播放器',
  videoPageMiniPlayerDesc: '播放器滾出視口後收縮到右下角浮窗，按 P 或點擊按鈕還原',
  videoPageShortcuts: '增強快速鍵',
  videoPageShortcutsDesc: 'J/K/L、←/→、C/M/F/T 等快速鍵；關閉後按鍵完全交還給 B 站原生快速鍵',
  groupVideoCard: '影片卡片',
  groupVideoCardDesc: '影片卡片本身的互動增強（首頁、搜尋、清單頁等所有出現卡片的位置）',
  cardPreview: '懸停預覽',
  cardPreviewDesc: '懸停卡片 0.9 秒後靜音播放最多 6 秒的小片段；觸控、減少動態效果偏好，或卡片資料裡沒有 cid 時不生效',
  cardQuickActions: '懸停操作列',
  cardQuickActionsDesc: '懸停卡片時在右下角顯示按讚 / 收藏 / 稍後再看；收藏可多選收藏夾，已收藏再點即取消。未登入時只提示不請求，失敗會自動回滾',
  groupListPage: '清單頁',
  groupListPageDesc: '觀看歷史 / 稍後再看 / 收藏頁的預設檢視與排序',
  historyViewMode: '觀看歷史檢視',
  watchLaterViewMode: '稍後再看檢視',
  favoritesViewMode: '收藏夾檢視',
  defaultSort: '預設排序',
  defaultSortDesc: '三個清單頁共用的初始排序；在頁面內切換排序會同步更新這裡',
  viewModeComfortable: '舒適網格',
  viewModeCompact: '緊湊網格',
  viewModeList: '清單',
  sortTime: '時間',
  sortDuration: '時長',
  sortTitle: '標題',
  groupSearchPage: '搜尋頁',
  groupSearchPageDesc: 'BewlyBewly 的搜尋起始頁（B 站搜尋框獲得焦點時出現的頁面）',
  directPaste: '貼上直達',
  directPasteDesc: '在搜尋頁貼上 BV 號或 B 站連結時直接開啟目標，而不是填入搜尋框',
  groupMoments: '動態頁',
  momentsDensity: '卡片密度',
  momentsDensityDesc: '動態頁卡片流的資訊密度，頁面頂部工具列也能直接切換',
  momentsOptimize: '離屏最佳化',
  momentsOptimizeDesc: '只渲染視口附近的卡片，捲動到附近時才渲染其餘卡片；關閉後所有卡片全部渲染（長清單更吃效能）',
  groupNotification: '訊息頁',
  groupNotificationDesc: 'B 站原生訊息頁（message.bilibili.com）的增強浮層',
  notificationOnlyUnread: '預設只看未讀',
  notificationOnlyUnreadDesc: '進入訊息頁時自動隱藏已讀項目；頁面暫時辨識不到未讀狀態時不會生效',
  notificationDensity: '清單密度',
  groupSearchResult: '搜尋結果頁',
  groupSearchResultDesc: 'B 站原生搜尋結果頁（search.bilibili.com）的增強浮層',
  searchDensity: '結果密度',
  groupSpace: '使用者空間',
  groupSpaceDesc: 'B 站原生使用者空間（space.bilibili.com）的增強浮層',
  spaceDensity: '內容密度',
  groupArticle: '文章頁',
  groupArticleDesc: 'B 站專欄 / 動態文章頁的沉浸閱讀模式',
  articleReadingMode: '預設進入閱讀模式',
  articleReadingModeDesc: '正文確認載入後自動進入沉浸閱讀（隱藏側欄 / 推薦 / 留言）',
  articleFontSize: '正文字級',
  densityComfortable: '舒適',
  densityCompact: '緊湊',
  fontSizeS: '小',
  fontSizeM: '中',
  fontSizeL: '大',
  groupHome: '首頁',
  groupHomeDesc: '首頁各子頁籤（推薦 / 關注 / 訂閱劇集 / 熱門 / 排行 / 直播）的卡片密度',
  homeCardDensity: '卡片密度',
  homeCardDensityDesc: '緊湊檔每行多一張卡片、間距更小、標題字級小一檔；首頁頂部工具列也能直接切換',
  groupChannel: '分區 / 排行頁',
  groupChannelDesc: 'B 站原生分區頁（bilibili.com/v/*、/channel/*）與排行榜頁的增強浮層',
  channelDensity: '清單密度',
  channelDensityDesc: '緊湊檔縮小卡片間距與標題字級，一屏能看到更多內容',
}

const JYUT: PagesSettingsMessages = {
  ...CMN_TW,
  groupVideoPageDesc: '針對 B 站原生播放頁嘅增強功能，閂咗之後對應功能唔會再接管頁面',
  videoPageCinemaModeDesc: '播放器鋪滿成個視口、收埋右欄同推薦。撳 T 或者播放器右下角嘅浮動掣切換',
  videoPageMiniPlayerDesc: '播放器滾出視口之後縮到右下角浮窗，撳 P 或者撳掣還原',
  cardPreviewDesc: '懸停卡片 0.9 秒後靜音播最多 6 秒嘅小片段；觸控、減少動態效果，或者卡片資料冇 cid 就唔會生效',
  cardQuickActionsDesc: '懸停卡片嗰陣喺右下角顯示讚好 / 收藏 / 稍後再看；收藏可以揀多個收藏夾，已收藏再撳就取消。未登入淨係提示唔發請求，失敗會自動回滾',
  groupListPageDesc: '觀看歷史 / 稍後再看 / 收藏頁嘅預設檢視同排序',
  defaultSortDesc: '三個清單頁共用嘅初始排序；喺頁面入面切換排序會同步更新呢度',
  groupSearchPageDesc: 'BewlyBewly 嘅搜尋起始頁（B 站搜尋框聚焦嗰陣出現嘅頁面）',
  directPasteDesc: '喺搜尋頁貼上 BV 號或者 B 站連結就直接開目標，唔會填入搜尋框',
  momentsDensityDesc: '動態頁卡片流嘅資訊密度，頁面頂部工具列都可以直接切換',
  momentsOptimizeDesc: '淨係渲染視口附近嘅卡片，捲到附近先渲染其餘卡片；閂咗之後所有卡片全部渲染（長清單食效能啲）',
  groupNotificationDesc: 'B 站原生訊息頁（message.bilibili.com）嘅增強浮層',
  notificationOnlyUnreadDesc: '入訊息頁嗰陣自動收埋已讀項目；頁面暫時認唔到未讀狀態就唔會生效',
  groupSearchResultDesc: 'B 站原生搜尋結果頁（search.bilibili.com）嘅增強浮層',
  groupSpaceDesc: 'B 站原生用戶空間（space.bilibili.com）嘅增強浮層',
  groupArticleDesc: 'B 站專欄 / 動態文章頁嘅沉浸閱讀模式',
  articleReadingModeDesc: '正文確認載入之後自動入沉浸閱讀（收埋側欄 / 推薦 / 留言）',
  groupHomeDesc: '主頁各子頁籤（推薦 / 關注 / 訂閱劇集 / 熱門 / 排行 / 直播）嘅卡片密度',
  homeCardDensityDesc: '緊湊檔每行多一張卡片、間距細啲、標題字細一檔；主頁頂部工具列都可以直接切換',
  groupChannelDesc: 'B 站原生分區頁（bilibili.com/v/*、/channel/*）同排行榜頁嘅增強浮層',
  channelDensityDesc: '緊湊檔縮細卡片間距同標題字級，一屏睇到多啲內容',
}

/** 模块自建 i18n：四种语言键集合完全一致（缺键回退简中 / 英文，不会出现空串） */
export const MESSAGES: Record<ModuleLocale, PagesSettingsMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  jyut: JYUT,
  en: EN,
}

export function normalizeLanguage(language?: string): ModuleLocale {
  return resolveModuleLocale(language)
}

export function getPagesSettingsMessages(language?: string): PagesSettingsMessages {
  return getModuleMessages<PagesSettingsMessages>(MESSAGES, resolveModuleLocale(language ?? settings.value.language), CMN_CN)
}

/** 响应 settings.language 的文案（切换语言后立即生效） */
export function usePagesSettingsMessages() {
  return computed(() => getPagesSettingsMessages(settings.value.language))
}
