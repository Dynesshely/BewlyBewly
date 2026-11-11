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
  /** 第 28 轮：固定单页布局（替代已删除的影院模式） */
  videoPageFixedLayout: string
  videoPageFixedLayoutDesc: string
  videoPageMiniPlayer: string
  videoPageMiniPlayerDesc: string
  videoPageShortcuts: string
  videoPageShortcutsDesc: string
  /** 第 24 轮：视频页评论区增强 */
  videoPageComments: string
  videoPageCommentsDesc: string
  /** 第 27 轮：评论区分栏 / 推荐视频轨道 */
  videoPageCommentColumn: string
  videoPageCommentColumnDesc: string
  videoPageRecommendRail: string
  videoPageRecommendRailDesc: string
  groupVideoCard: string
  groupVideoCardDesc: string
  cardPreview: string
  cardPreviewDesc: string
  cardQuickActions: string
  cardQuickActionsDesc: string
  groupListPage: string
  groupListPageDesc: string
  /** 第 24 轮：列表页返回恢复滚动位置 */
  listScrollMemory: string
  listScrollMemoryDesc: string
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

  // 第 22 轮：数据导入 / 导出
  groupData: string
  groupDataDesc: string
  exportSettings: string
  exportSettingsHint: string
  exportSuccess: string
  exportError: string
  importSettings: string
  importSettingsHint: string
  importConfirmTitle: string
  importConfirmDesc: string
  importConfirm: string
  importCancel: string
  importSuccess: string
  importErrorJson: string
  importErrorShape: string
  importErrorVersion: string
  importErrorField: string
  importErrorEmpty: string

  // 第 24 轮：页面自检
  groupDiagnostics: string
  groupDiagnosticsDesc: string
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
  videoPageFixedLayout: '固定单页布局',
  videoPageFixedLayoutDesc: '页面不再垂直滚动：信息栏压缩成一行，播放器、评论区、推荐视频轨道同屏常显。视口过窄或过矮时自动回退到可滚动的原生布局',
  videoPageMiniPlayer: '滚动迷你播放器',
  videoPageMiniPlayerDesc: '播放器滚出视口后收缩到右下角浮窗，按 P 或点击按钮还原',
  videoPageShortcuts: '增强快捷键',
  videoPageShortcutsDesc: 'J/K/L、←/→、C/M/F 等快捷键；关闭后按键完全交还给 B 站原生快捷键',
  videoPageComments: '评论区增强',
  videoPageCommentsDesc: '评论排序快捷（最热 / 最新）、只看 UP 主、长评论折叠；关闭后评论区保持 B 站原生样式',
  videoPageCommentColumn: '评论区移到播放器右侧',
  videoPageCommentColumnDesc: '把评论区移到播放器右侧、与播放器同高，评论列表在右侧内部滚动；关闭后保持 B 站原生布局（评论区仍在左栏下方）',
  videoPageRecommendRail: '推荐视频改为下部横向轨道',
  videoPageRecommendRailDesc: '把右栏推荐视频改成页面下部的横向聚焦轨道，同时可见 4–7 张，交互与首页聚焦浏览一致；关闭后保持 B 站原生布局（推荐列表留在右栏）',
  groupVideoCard: '视频卡片',
  groupVideoCardDesc: '视频卡片本身的交互增强（首页、搜索、列表页等所有出现卡片的位置）',
  cardPreview: '悬停预览',
  cardPreviewDesc: '悬停卡片 0.9 秒后静音播放最多 6 秒的小片段；触屏、减少动态效果偏好，或卡片数据里没有 cid 时不生效',
  cardQuickActions: '悬停操作条',
  cardQuickActionsDesc: '悬停卡片时在右下角显示点赞 / 收藏 / 稍后再看；收藏可多选收藏夹，已收藏再点即取消。未登录时只提示不请求，失败会自动回滚',
  groupListPage: '列表页',
  groupListPageDesc: '观看历史 / 稍后再看 / 收藏页的默认视图与排序',
  listScrollMemory: '返回恢复滚动位置',
  listScrollMemoryDesc: '从视频页返回历史 / 稍后再看 / 收藏时，恢复离开前的浏览位置并高亮原来那张卡',
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
  groupData: '数据',
  groupDataDesc: '备份 / 恢复「页面增强」相关设置；只包含本页的 settings 字段，不含其它存储',
  exportSettings: '导出设置',
  exportSettingsHint: '下载当前设置的 JSON 文件，可在其它设备导入',
  exportSuccess: '已导出设置文件',
  exportError: '导出失败，请重试',
  importSettings: '导入设置',
  importSettingsHint: '选择 JSON 文件，校验通过后覆盖当前设置',
  importConfirmTitle: '确认导入？',
  importConfirmDesc: '将用文件中的 {count} 项设置覆盖当前设置，此操作无法撤销',
  importConfirm: '确认导入',
  importCancel: '取消',
  importSuccess: '已导入 {count} 项设置',
  importErrorJson: '文件不是有效的 JSON',
  importErrorShape: '文件格式不正确：需要包含 settings 对象',
  importErrorVersion: '不支持的设置版本：{version}',
  importErrorField: '字段 {field} 的类型与默认值不一致',
  importErrorEmpty: '文件里没有可导入的设置项',
  groupDiagnostics: '诊断',
  groupDiagnosticsDesc: '检查当前页面各增强模块是否挂载、关键选择器是否命中，并给出降级原因；纯本地运行，不上报任何数据',
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
  videoPageFixedLayout: 'Fixed single-page layout',
  videoPageFixedLayoutDesc: 'The page no longer scrolls vertically: the info bar collapses to one line, and the player, comment column and recommendation rail stay on screen together. Falls back to the scrollable native layout on narrow or short viewports.',
  videoPageMiniPlayer: 'Scrolling mini player',
  videoPageMiniPlayerDesc: 'Shrink the player into a floating window once it scrolls out of view. Restore with P or the button.',
  videoPageShortcuts: 'Enhanced shortcuts',
  videoPageShortcutsDesc: 'J/K/L, ←/→, C/M/F and more. When off, every key is handed back to the native Bilibili shortcuts.',
  videoPageComments: 'Comment enhancements',
  videoPageCommentsDesc: 'Quick sort (hot / latest), only-uploader filter and long-comment collapsing. When off, the comment area keeps its native Bilibili style.',
  videoPageCommentColumn: 'Move comments beside the player',
  videoPageCommentColumnDesc: 'Move the comment area to the right of the player at the same height, with the comment list scrolling inside that column. When off, keep the native Bilibili layout (comments stay below the left column).',
  videoPageRecommendRail: 'Recommendations as a bottom rail',
  videoPageRecommendRailDesc: 'Turn the right-column recommendations into a horizontal focus rail at the bottom of the page showing 4–7 cards, with the same interactions as the home focus browse. When off, keep the native layout (recommendations stay in the right column).',
  groupVideoCard: 'Video cards',
  groupVideoCardDesc: 'Interaction enhancements that apply to every video card (home, search, list pages and so on)',
  cardPreview: 'Hover preview',
  cardPreviewDesc: 'Hover a card for 0.9s to play a muted clip of up to 6 seconds. Disabled on touch devices, with reduced motion, or when the card data has no cid.',
  cardQuickActions: 'Hover action bar',
  cardQuickActionsDesc: 'Show like / favorite / watch-later buttons at the bottom-right of a hovered card. Favorites support multi-folder selection, and clicking again removes them. Not signed in? You get a hint instead of a request; failures roll back automatically.',
  groupListPage: 'List pages',
  groupListPageDesc: 'Default view mode and sorting for history, watch later and favorites',
  listScrollMemory: 'Restore scroll position on return',
  listScrollMemoryDesc: 'When coming back from a video to history / watch later / favorites, restore the previous position and highlight the card you left on.',
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
  groupData: 'Data',
  groupDataDesc: 'Back up or restore the page enhancement settings. Only the settings fields on this page are included — no other storage.',
  exportSettings: 'Export settings',
  exportSettingsHint: 'Download the current settings as JSON and import them on another device',
  exportSuccess: 'Settings file exported',
  exportError: 'Export failed, please try again',
  importSettings: 'Import settings',
  importSettingsHint: 'Pick a JSON file; once validated it overwrites the current settings',
  importConfirmTitle: 'Import these settings?',
  importConfirmDesc: 'This overwrites the current settings with the {count} entries from the file and cannot be undone',
  importConfirm: 'Import',
  importCancel: 'Cancel',
  importSuccess: 'Imported {count} settings',
  importErrorJson: 'The file is not valid JSON',
  importErrorShape: 'Invalid file structure: a settings object is required',
  importErrorVersion: 'Unsupported settings version: {version}',
  importErrorField: 'Field {field} has a different type than the default value',
  importErrorEmpty: 'The file contains no importable settings',
  groupDiagnostics: 'Diagnostics',
  groupDiagnosticsDesc: 'Check whether page enhancements are mounted and key selectors match, with degradation reasons. Runs locally — no data is reported.',
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
  videoPageFixedLayout: '固定單頁版面',
  videoPageFixedLayoutDesc: '頁面不再垂直捲動：資訊列壓成一行，播放器、留言區、推薦影片軌道同框常顯。視口太窄或太矮時自動退回可捲動的原生版面',
  videoPageMiniPlayer: '捲動迷你播放器',
  videoPageMiniPlayerDesc: '播放器滾出視口後收縮到右下角浮窗，按 P 或點擊按鈕還原',
  videoPageShortcuts: '增強快速鍵',
  videoPageShortcutsDesc: 'J/K/L、←/→、C/M/F 等快速鍵；關閉後按鍵完全交還給 B 站原生快速鍵',
  videoPageComments: '留言區增強',
  videoPageCommentsDesc: '留言排序快捷（最熱 / 最新）、只看 UP 主、長留言摺疊；關閉後留言區保持 B 站原生樣式',
  videoPageCommentColumn: '留言區移到播放器右側',
  videoPageCommentColumnDesc: '把留言區移到播放器右側、與播放器同高，留言列表在右側內部捲動；關閉後保持 B 站原生版面（留言區仍在左欄下方）',
  videoPageRecommendRail: '推薦影片改為下方橫向軌道',
  videoPageRecommendRailDesc: '把右欄推薦影片改成頁面下方的橫向聚焦軌道，同時可見 4–7 張，互動與首頁聚焦瀏覽一致；關閉後保持 B 站原生版面（推薦列表留在右欄）',
  groupVideoCard: '影片卡片',
  groupVideoCardDesc: '影片卡片本身的互動增強（首頁、搜尋、清單頁等所有出現卡片的位置）',
  cardPreview: '懸停預覽',
  cardPreviewDesc: '懸停卡片 0.9 秒後靜音播放最多 6 秒的小片段；觸控、減少動態效果偏好，或卡片資料裡沒有 cid 時不生效',
  cardQuickActions: '懸停操作列',
  cardQuickActionsDesc: '懸停卡片時在右下角顯示按讚 / 收藏 / 稍後再看；收藏可多選收藏夾，已收藏再點即取消。未登入時只提示不請求，失敗會自動回滾',
  groupListPage: '清單頁',
  groupListPageDesc: '觀看歷史 / 稍後再看 / 收藏頁的預設檢視與排序',
  listScrollMemory: '返回時恢復捲動位置',
  listScrollMemoryDesc: '由影片頁返回歷史 / 稍後再看 / 收藏時，恢復離開前的瀏覽位置並高亮原本那張卡',
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
  groupData: '資料',
  groupDataDesc: '備份 / 還原「頁面增強」相關設定；只包含本頁的 settings 欄位，不含其它儲存',
  exportSettings: '匯出設定',
  exportSettingsHint: '下載目前設定的 JSON 檔案，可在其它裝置匯入',
  exportSuccess: '已匯出設定檔案',
  exportError: '匯出失敗，請重試',
  importSettings: '匯入設定',
  importSettingsHint: '選擇 JSON 檔案，驗證通過後覆蓋目前設定',
  importConfirmTitle: '確認匯入？',
  importConfirmDesc: '將用檔案中的 {count} 項設定覆蓋目前設定，此操作無法復原',
  importConfirm: '確認匯入',
  importCancel: '取消',
  importSuccess: '已匯入 {count} 項設定',
  importErrorJson: '檔案不是有效的 JSON',
  importErrorShape: '檔案格式不正確：需要包含 settings 物件',
  importErrorVersion: '不支援的設定版本：{version}',
  importErrorField: '欄位 {field} 的型態與預設值不一致',
  importErrorEmpty: '檔案裡沒有可匯入的設定項',
  groupDiagnostics: '診斷',
  groupDiagnosticsDesc: '檢查目前頁面各增強模組是否掛載、關鍵選擇器是否命中，並給出降級原因；純本機執行，不上報任何資料',
}

const JYUT: PagesSettingsMessages = {
  ...CMN_TW,
  groupVideoPageDesc: '針對 B 站原生播放頁嘅增強功能，閂咗之後對應功能唔會再接管頁面',
  videoPageFixedLayoutDesc: '頁面唔再垂直捲：資訊列壓成一行，播放器、留言區、推薦影片軌道同框常顯。視口太窄或者太矮就會退回可捲動嘅原生版面',
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
