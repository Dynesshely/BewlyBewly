/**
 * 三个列表页（稍后再看 / 历史 / 收藏）的模块内文案。
 *
 * 与 `views/listShared/i18n` 的分工：
 * - listShared 负责「工具条 / 视图模式 / 排序 / 过滤 / 快捷操作」这些多页共用的词；
 * - 本文件负责这三个页面**新增**的词（批量选择、日期分组、收藏夹侧栏、错误态…）。
 *
 * 四种模块语言（简中 / 繁中 / 粤语 / 英文），语言解析统一走 `~/utils/moduleI18n`；
 * 类型约束保证四种语言的键集合完全一致（缺键会直接 typecheck 报错）。
 */
import type { ModuleLocale } from '~/utils/moduleI18n'
import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

export interface ListsMessages {
  /* 通用 */
  retry: string
  loading: string
  loadMore: string
  loadingMore: string
  noMore: string
  errorTitle: string
  errorDesc: string
  reload: string
  cancel: string
  confirm: string
  copied: string
  copyFailed: string
  copy: string
  remove: string
  removed: string
  removeFailed: string
  /** 批量选择 */
  selectMode: string
  exitSelect: string
  selectAll: string
  deselectAll: string
  selectedCount: string
  batchRemove: string
  batchRemoveConfirm: string
  /** 顶部「已加载 N 条」 */
  loadedCount: string
  totalCount: string
  /** 过滤无结果 */
  noMatchTitle: string
  noMatchDesc: string
  /** 错误态里的兜底入口：在原版页面打开 */
  openNative: string
  /** 历史页「加入稍后再看」结果提示 */
  watchLaterAdded: string
  watchLaterAddFailed: string

  /* 稍后再看 */
  watchLaterTitle: string
  watchLaterSubtitle: string
  watchLaterEmptyTitle: string
  watchLaterEmptyDesc: string
  watchLaterClearAll: string
  watchLaterClearAllConfirm: string
  watchLaterCleared: string
  watchLaterClearFailed: string
  watchLaterRemoveWatched: string
  watchLaterRemoveWatchedConfirm: string
  watchLaterRemoveWatchedOk: string
  watchLaterBatchHint: string

  /* 历史 */
  historyTitle: string
  historySubtitle: string
  historyPausedSubtitle: string
  historyEmptyTitle: string
  historyEmptyDesc: string
  historyClearAll: string
  historyClearAllConfirm: string
  historyCleared: string
  historyClearFailed: string
  historyPause: string
  historyPauseConfirm: string
  historyResume: string
  historyResumeConfirm: string
  historyDelete: string
  historyDeleted: string
  historyDeleteFailed: string
  historySearchPlaceholder: string
  groupToday: string
  groupYesterday: string
  groupEarlier: string

  /* 收藏 */
  favoritesTitle: string
  favoritesSubtitle: string
  favoritesEmptyTitle: string
  favoritesEmptyDesc: string
  favoritesFolders: string
  favoritesNewFolder: string
  favoritesFolderName: string
  favoritesCreateOk: string
  favoritesCreateFailed: string
  favoritesRename: string
  favoritesRenamedOk: string
  favoritesRenameFailed: string
  favoritesDelete: string
  favoritesDeleteConfirmTitle: string
  favoritesDeleteConfirmDesc: string
  favoritesDeletedOk: string
  favoritesDeleteFailed: string
  favoritesNoFolder: string
  favoritesNoFolderDesc: string
  favoritesSearchPlaceholder: string
  favoritesInvalid: string
  favoritesUnfavorite: string
  favoritesUnfavoriteConfirm: string
  favoritesUnfavorited: string
  favoritesUnfavoriteFailed: string
  favoritesPlayAll: string
  favoritesNeedLogin: string
  favoritesNameExists: string
  favoritesWorking: string
}

const CMN_CN: ListsMessages = {
  retry: '重试',
  loading: '载入中…',
  loadMore: '加载更多',
  loadingMore: '正在加载…',
  noMore: '没有更多了',
  errorTitle: '内容加载失败',
  errorDesc: '接口暂时不可用，请重试。你的账号数据没有受到任何影响。',
  reload: '重新加载',
  cancel: '取消',
  confirm: '确定',
  copied: '链接已复制',
  copyFailed: '复制失败，请手动复制',
  copy: '复制链接',
  remove: '移除',
  removed: '已移除',
  removeFailed: '移除失败',
  selectMode: '批量选择',
  exitSelect: '退出选择',
  selectAll: '全选',
  deselectAll: '取消全选',
  selectedCount: '已选 {count} 项',
  batchRemove: '删除所选',
  batchRemoveConfirm: '确定从稍后再看移除所选的 {count} 个视频吗？',
  loadedCount: '已加载 {count} 条',
  totalCount: '共 {count} 条',
  noMatchTitle: '没有匹配的内容',
  noMatchDesc: '过滤词「{word}」没有匹配到任何条目，换个关键词试试。',
  openNative: '在原版页面打开',
  watchLaterAdded: '已加入稍后再看',
  watchLaterAddFailed: '加入稍后再看失败',

  watchLaterTitle: '稍后再看',
  watchLaterSubtitle: '共 {count} 个视频，随时接着看',
  watchLaterEmptyTitle: '稍后再看是空的',
  watchLaterEmptyDesc: '在视频页点「稍后再看」，视频就会出现在这里。',
  watchLaterClearAll: '全部清空',
  watchLaterClearAllConfirm: '确定清空稍后再看里的全部 {count} 个视频吗？此操作不可撤销。',
  watchLaterCleared: '已清空稍后再看',
  watchLaterClearFailed: '清空失败，请稍后重试',
  watchLaterRemoveWatched: '移除看过的',
  watchLaterRemoveWatchedConfirm: '接口会移除所有「有观看进度」的视频（含看了一部分的），不只是已看完的。确定继续吗？',
  watchLaterRemoveWatchedOk: '已移除看过的视频',
  watchLaterBatchHint: '点卡片右上角的方框选择，或用「全选」一次选完当前列表。',

  historyTitle: '历史记录',
  historySubtitle: '按时间倒序记录你最近看过的视频',
  historyPausedSubtitle: '观看历史记录已暂停',
  historyEmptyTitle: '还没有观看记录',
  historyEmptyDesc: '看过的视频会自动出现在这里，方便随时接着看。',
  historyClearAll: '清空历史',
  historyClearAllConfirm: '确定清空全部观看历史吗？此操作不可撤销。',
  historyCleared: '已清空观看历史',
  historyClearFailed: '清空失败，请稍后重试',
  historyPause: '暂停记录',
  historyPauseConfirm: '暂停后新的观看记录将不再保存，确定暂停吗？',
  historyResume: '恢复记录',
  historyResumeConfirm: '确定恢复观看历史记录吗？',
  historyDelete: '删除这条记录',
  historyDeleted: '已删除该记录',
  historyDeleteFailed: '删除失败，请稍后重试',
  historySearchPlaceholder: '按关键词过滤历史',
  groupToday: '今天',
  groupYesterday: '昨天',
  groupEarlier: '更早',

  favoritesTitle: '收藏夹',
  favoritesSubtitle: '「{name}」共 {count} 条收藏',
  favoritesEmptyTitle: '这个收藏夹还是空的',
  favoritesEmptyDesc: '换个收藏夹看看，或者先去 B 站收藏一些视频。',
  favoritesFolders: '收藏夹',
  favoritesNewFolder: '新建收藏夹',
  favoritesFolderName: '收藏夹名称',
  favoritesCreateOk: '收藏夹已创建',
  favoritesCreateFailed: '创建收藏夹失败，请稍后重试',
  favoritesRename: '重命名',
  favoritesRenamedOk: '收藏夹已重命名',
  favoritesRenameFailed: '重命名失败，请稍后重试',
  favoritesDelete: '删除收藏夹',
  favoritesDeleteConfirmTitle: '删除收藏夹「{name}」？',
  favoritesDeleteConfirmDesc: '收藏夹里的视频不会被删除，只会从该收藏夹移除。',
  favoritesDeletedOk: '收藏夹已删除',
  favoritesDeleteFailed: '删除收藏夹失败，请稍后重试',
  favoritesNoFolder: '还没有收藏夹',
  favoritesNoFolderDesc: '先新建一个收藏夹，再去 B 站收藏视频。',
  favoritesSearchPlaceholder: '搜索已加载的收藏',
  favoritesInvalid: '已失效',
  favoritesUnfavorite: '取消收藏',
  favoritesUnfavoriteConfirm: '确定把「{title}」移出这个收藏夹吗？',
  favoritesUnfavorited: '已取消收藏',
  favoritesUnfavoriteFailed: '取消收藏失败，请稍后重试',
  favoritesPlayAll: '播放全部',
  favoritesNeedLogin: '需要先登录 B 站账号',
  favoritesNameExists: '已有同名收藏夹，换个名字试试',
  favoritesWorking: '处理中…',
}

const CMN_TW: ListsMessages = {
  retry: '重試',
  loading: '載入中…',
  loadMore: '載入更多',
  loadingMore: '正在載入…',
  noMore: '沒有更多了',
  errorTitle: '內容載入失敗',
  errorDesc: '介面暫時不可用，請重試。你的帳號資料沒有受到任何影響。',
  reload: '重新載入',
  cancel: '取消',
  confirm: '確定',
  copied: '連結已複製',
  copyFailed: '複製失敗，請手動複製',
  copy: '複製連結',
  remove: '移除',
  removed: '已移除',
  removeFailed: '移除失敗',
  selectMode: '批次選取',
  exitSelect: '退出選取',
  selectAll: '全選',
  deselectAll: '取消全選',
  selectedCount: '已選 {count} 項',
  batchRemove: '刪除所選',
  batchRemoveConfirm: '確定從稍後再看移除所選的 {count} 支影片嗎？',
  loadedCount: '已載入 {count} 筆',
  totalCount: '共 {count} 筆',
  noMatchTitle: '沒有符合的內容',
  noMatchDesc: '過濾詞「{word}」沒有符合任何項目，換個關鍵字試試。',
  openNative: '在原版頁面開啟',
  watchLaterAdded: '已加入稍後再看',
  watchLaterAddFailed: '加入稍後再看失敗',

  watchLaterTitle: '稍後再看',
  watchLaterSubtitle: '共 {count} 支影片，隨時接著看',
  watchLaterEmptyTitle: '稍後再看是空的',
  watchLaterEmptyDesc: '在影片頁按「稍後再看」，影片就會出現在這裡。',
  watchLaterClearAll: '全部清空',
  watchLaterClearAllConfirm: '確定清空稍後再看裡的全部 {count} 支影片嗎？此操作無法復原。',
  watchLaterCleared: '已清空稍後再看',
  watchLaterClearFailed: '清空失敗，請稍後重試',
  watchLaterRemoveWatched: '移除看过的',
  watchLaterRemoveWatchedConfirm: '確定移除所有已看完的影片嗎？',
  watchLaterRemoveWatchedOk: '已移除看過的影片',
  watchLaterBatchHint: '按卡片右上角的方框選取，或用「全選」一次選完目前清單。',

  historyTitle: '觀看歷史',
  historySubtitle: '按時間倒序記錄你最近看過的影片',
  historyPausedSubtitle: '觀看歷史已暫停',
  historyEmptyTitle: '還沒有觀看記錄',
  historyEmptyDesc: '看過的影片會自動出現在這裡，方便隨時接著看。',
  historyClearAll: '清空歷史',
  historyClearAllConfirm: '確定清空全部觀看歷史嗎？此操作無法復原。',
  historyCleared: '已清空觀看歷史',
  historyClearFailed: '清空失敗，請稍後重試',
  historyPause: '暫停記錄',
  historyPauseConfirm: '暫停後新的觀看記錄將不再保存，確定暫停嗎？',
  historyResume: '恢復記錄',
  historyResumeConfirm: '確定恢復觀看歷史嗎？',
  historyDelete: '刪除這筆記錄',
  historyDeleted: '已刪除該記錄',
  historyDeleteFailed: '刪除失敗，請稍後重試',
  historySearchPlaceholder: '按關鍵字過濾歷史',
  groupToday: '今天',
  groupYesterday: '昨天',
  groupEarlier: '更早',

  favoritesTitle: '收藏夾',
  favoritesSubtitle: '「{name}」共 {count} 筆收藏',
  favoritesEmptyTitle: '這個收藏夾還是空的',
  favoritesEmptyDesc: '換個收藏夾看看，或者先去 B 站收藏一些影片。',
  favoritesFolders: '收藏夾',
  favoritesNewFolder: '新增收藏夾',
  favoritesFolderName: '收藏夾名稱',
  favoritesCreateOk: '收藏夾已新增',
  favoritesCreateFailed: '新增收藏夾失敗，請稍後重試',
  favoritesRename: '重新命名',
  favoritesRenamedOk: '收藏夾已重新命名',
  favoritesRenameFailed: '重新命名失敗，請稍後重試',
  favoritesDelete: '刪除收藏夾',
  favoritesDeleteConfirmTitle: '刪除收藏夾「{name}」？',
  favoritesDeleteConfirmDesc: '收藏夾裡的影片不會被刪除，只會從這個收藏夾移除。',
  favoritesDeletedOk: '收藏夾已刪除',
  favoritesDeleteFailed: '刪除收藏夾失敗，請稍後重試',
  favoritesNoFolder: '還沒有收藏夾',
  favoritesNoFolderDesc: '先新增一個收藏夾，再去 B 站收藏影片。',
  favoritesSearchPlaceholder: '搜尋已載入的收藏',
  favoritesInvalid: '已失效',
  favoritesUnfavorite: '取消收藏',
  favoritesUnfavoriteConfirm: '確定把「{title}」移出這個收藏夾嗎？',
  favoritesUnfavorited: '已取消收藏',
  favoritesUnfavoriteFailed: '取消收藏失敗，請稍後重試',
  favoritesPlayAll: '播放全部',
  favoritesNeedLogin: '需要先登入 B 站帳號',
  favoritesNameExists: '已有同名收藏夾，換個名字試試',
  favoritesWorking: '處理中…',
}

const JYUT: ListsMessages = {
  ...CMN_TW,
  retry: '再試一次',
  loading: '載入緊…',
  loadMore: '載入多啲',
  loadingMore: '載入緊…',
  noMore: '冇更多喇',
  errorTitle: '載入唔到內容',
  errorDesc: '個介面暫時用唔到，再試一次。你嘅帳號資料冇受影響。',
  reload: '重新載入',
  copied: '複製咗連結',
  copyFailed: '複製唔到，自己手動複製',
  copy: '複製連結',
  removed: '移除咗',
  removeFailed: '移除唔到',
  selectMode: '批量揀',
  exitSelect: '退出揀',
  selectAll: '全選',
  deselectAll: '取消全選',
  selectedCount: '揀咗 {count} 項',
  batchRemove: '刪除揀咗嘅',
  batchRemoveConfirm: '確定喺稍後再看移除揀咗嘅 {count} 支影片？',
  loadedCount: '載入咗 {count} 筆',
  totalCount: '總共 {count} 筆',
  noMatchTitle: '冇符合嘅內容',
  noMatchDesc: '而家嘅過濾詞「{word}」搵唔到任何項目，換個關鍵字試下。',
  openNative: '喺原版頁面開啟',
  watchLaterAdded: '加咗入稍後再看',
  watchLaterAddFailed: '加唔到入稍後再看',

  watchLaterTitle: '稍後再看',
  watchLaterSubtitle: '總共 {count} 支影片，隨時接住睇',
  watchLaterEmptyTitle: '稍後再看係空嘅',
  watchLaterEmptyDesc: '喺影片頁撳「稍後再看」，影片就會出現喺呢度。',
  watchLaterClearAll: '全部清空',
  watchLaterClearAllConfirm: '確定清空稍後再看全部 {count} 支影片？做咗就復原唔到。',
  watchLaterCleared: '清空咗稍後再看',
  watchLaterClearFailed: '清空唔到，轉頭再試',
  watchLaterRemoveWatched: '移除睇晒嘅',
  watchLaterRemoveWatchedConfirm: '確定移除所有睇晒嘅影片？',
  watchLaterRemoveWatchedOk: '移除咗睇過嘅影片',
  watchLaterBatchHint: '撳卡片右上角個格仔揀，或者用「全選」一次揀晒。',

  historyTitle: '觀看歷史',
  historySubtitle: '按時間倒序記低你最近睇過嘅影片',
  historyPausedSubtitle: '觀看歷史暫停咗',
  historyEmptyTitle: '仲未有觀看歷史',
  historyEmptyDesc: '睇過嘅影片會自動出現喺呢度，隨時可以接住睇。',
  historyClearAll: '清空歷史',
  historyClearAllConfirm: '確定清空全部觀看歷史？做咗就復原唔到。',
  historyCleared: '清空咗觀看歷史',
  historyClearFailed: '清空唔到，轉頭再試',
  historyPause: '暫停記錄',
  historyPauseConfirm: '暫停之後新嘅觀看記錄唔會再存，確定暫停？',
  historyResume: '恢復記錄',
  historyResumeConfirm: '確定恢復觀看歷史？',
  historyDelete: '刪除呢筆記錄',
  historyDeleted: '刪除咗呢筆記錄',
  historyDeleteFailed: '刪除唔到，轉頭再試',
  historySearchPlaceholder: '用關鍵字過濾歷史',
  groupToday: '今日',
  groupYesterday: '尋日',
  groupEarlier: '更早',

  favoritesTitle: '收藏夾',
  favoritesSubtitle: '「{name}」總共 {count} 筆收藏',
  favoritesEmptyTitle: '呢個收藏夾仲係空嘅',
  favoritesEmptyDesc: '換個收藏夾睇下，或者去 B 站收藏啲影片先。',
  favoritesFolders: '收藏夾',
  favoritesNewFolder: '開新收藏夾',
  favoritesFolderName: '收藏夾名',
  favoritesCreateOk: '收藏夾開好咗',
  favoritesCreateFailed: '開收藏夾失敗，轉頭再試',
  favoritesRename: '改名',
  favoritesRenamedOk: '收藏夾改好名',
  favoritesRenameFailed: '改名失敗，轉頭再試',
  favoritesDelete: '刪除收藏夾',
  favoritesDeleteConfirmTitle: '刪除收藏夾「{name}」？',
  favoritesDeleteConfirmDesc: '收藏夾入面嘅影片唔會刪，只會喺呢個收藏夾移除。',
  favoritesDeletedOk: '收藏夾刪咗',
  favoritesDeleteFailed: '刪收藏夾失敗，轉頭再試',
  favoritesNoFolder: '仲未有收藏夾',
  favoritesNoFolderDesc: '開返個收藏夾先，再去 B 站收藏影片。',
  favoritesSearchPlaceholder: '搜尋已載入嘅收藏',
  favoritesInvalid: '已失效',
  favoritesUnfavorite: '取消收藏',
  favoritesUnfavoriteConfirm: '確定將「{title}」移出呢個收藏夾？',
  favoritesUnfavorited: '取消咗收藏',
  favoritesUnfavoriteFailed: '取消收藏唔到，轉頭再試',
  favoritesPlayAll: '播晒佢',
  favoritesNeedLogin: '要登入咗 B 站帳號先得',
  favoritesNameExists: '已經有同名收藏夾，換個名試下',
  favoritesWorking: '處理緊…',
}

const EN: ListsMessages = {
  retry: 'Retry',
  loading: 'Loading…',
  loadMore: 'Load more',
  loadingMore: 'Loading…',
  noMore: 'No more items',
  errorTitle: 'Failed to load content',
  errorDesc: 'The API is temporarily unavailable. Your account data is untouched.',
  reload: 'Reload',
  cancel: 'Cancel',
  confirm: 'Confirm',
  copied: 'Link copied',
  copyFailed: 'Copy failed, please copy it manually',
  copy: 'Copy link',
  remove: 'Remove',
  removed: 'Removed',
  removeFailed: 'Failed to remove',
  selectMode: 'Select',
  exitSelect: 'Exit selection',
  selectAll: 'Select all',
  deselectAll: 'Deselect all',
  selectedCount: '{count} selected',
  batchRemove: 'Remove selected',
  batchRemoveConfirm: 'Remove the {count} selected videos from Watch Later?',
  loadedCount: '{count} loaded',
  totalCount: '{count} items',
  noMatchTitle: 'No matching items',
  noMatchDesc: 'Nothing matches "{word}". Try another keyword.',
  openNative: 'Open the original page',
  watchLaterAdded: 'Added to Watch Later',
  watchLaterAddFailed: 'Failed to add to Watch Later',

  watchLaterTitle: 'Watch Later',
  watchLaterSubtitle: '{count} videos waiting for you',
  watchLaterEmptyTitle: 'Watch Later is empty',
  watchLaterEmptyDesc: 'Use the Watch Later button on a video page and it will show up here.',
  watchLaterClearAll: 'Clear all',
  watchLaterClearAllConfirm: 'Clear all {count} videos from Watch Later? This cannot be undone.',
  watchLaterCleared: 'Watch Later cleared',
  watchLaterClearFailed: 'Failed to clear, please try again',
  watchLaterRemoveWatched: 'Remove watched',
  watchLaterRemoveWatchedConfirm: 'Remove every watched video from the list?',
  watchLaterRemoveWatchedOk: 'Watched videos removed',
  watchLaterBatchHint: 'Use the checkbox on a card, or "Select all" to pick everything currently loaded.',

  historyTitle: 'History',
  historySubtitle: 'Your recently watched videos, newest first',
  historyPausedSubtitle: 'Watch history recording is paused',
  historyEmptyTitle: 'No watch history yet',
  historyEmptyDesc: 'Videos you watch will show up here so you can pick up where you left off.',
  historyClearAll: 'Clear history',
  historyClearAllConfirm: 'Clear your entire watch history? This cannot be undone.',
  historyCleared: 'History cleared',
  historyClearFailed: 'Failed to clear, please try again',
  historyPause: 'Pause recording',
  historyPauseConfirm: 'New watch records will not be saved while paused. Continue?',
  historyResume: 'Resume recording',
  historyResumeConfirm: 'Resume recording your watch history?',
  historyDelete: 'Delete this record',
  historyDeleted: 'Record deleted',
  historyDeleteFailed: 'Failed to delete, please try again',
  historySearchPlaceholder: 'Filter history by keyword',
  groupToday: 'Today',
  groupYesterday: 'Yesterday',
  groupEarlier: 'Earlier',

  favoritesTitle: 'Favorites',
  favoritesSubtitle: '"{name}" · {count} items',
  favoritesEmptyTitle: 'This folder is empty',
  favoritesEmptyDesc: 'Try another folder, or favorite some videos on Bilibili first.',
  favoritesFolders: 'Folders',
  favoritesNewFolder: 'New folder',
  favoritesFolderName: 'Folder name',
  favoritesCreateOk: 'Folder created',
  favoritesCreateFailed: 'Failed to create folder, please try again',
  favoritesRename: 'Rename',
  favoritesRenamedOk: 'Folder renamed',
  favoritesRenameFailed: 'Failed to rename, please try again',
  favoritesDelete: 'Delete folder',
  favoritesDeleteConfirmTitle: 'Delete folder "{name}"?',
  favoritesDeleteConfirmDesc: 'The videos inside are not deleted, they are only removed from this folder.',
  favoritesDeletedOk: 'Folder deleted',
  favoritesDeleteFailed: 'Failed to delete folder, please try again',
  favoritesNoFolder: 'No folders yet',
  favoritesNoFolderDesc: 'Create a folder first, then favorite some videos on Bilibili.',
  favoritesSearchPlaceholder: 'Search loaded favorites',
  favoritesInvalid: 'Unavailable',
  favoritesUnfavorite: 'Remove from favorites',
  favoritesUnfavoriteConfirm: 'Remove "{title}" from this folder?',
  favoritesUnfavorited: 'Removed from favorites',
  favoritesUnfavoriteFailed: 'Failed to remove, please try again',
  favoritesPlayAll: 'Play all',
  favoritesNeedLogin: 'Please sign in to Bilibili first',
  favoritesNameExists: 'A folder with this name already exists',
  favoritesWorking: 'Working…',
}

const MESSAGES: Record<ModuleLocale, ListsMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  jyut: JYUT,
  en: EN,
}

/** 当前界面语言下的三页文案（跟随设置实时变化），支持 {name} 占位符 */
export function useListsI18n() {
  const t = computed<ListsMessages>(() =>
    getModuleMessages(MESSAGES, resolveModuleLocale(settings.value.language)),
  )

  function tl(key: keyof ListsMessages, params?: Record<string, string | number>): string {
    let text: string = t.value[key] ?? CMN_CN[key] ?? String(key)
    if (params) {
      for (const [name, value] of Object.entries(params))
        text = text.replaceAll(`{${name}}`, String(value))
    }
    return text
  }

  return { t, tl }
}
