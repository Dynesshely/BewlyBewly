import type { ModuleLocale } from '~/utils/moduleI18n'

import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

/**
 * 视频卡快捷操作（点赞 / 收藏 / 收藏夹面板）的模块内文案。
 *
 * 按项目约定不进 `src/_locales`。四种模块语言：cmn-CN 简中 / cmn-TW 繁体 /
 * jyut 繁体（粤语词）/ en 英文，语言解析统一走 `~/utils/moduleI18n`。
 */
export interface QuickActionsMessages {
  groupLabel: string
  like: string
  unlike: string
  likeOk: string
  unlikeOk: string
  likeFail: string
  favorite: string
  favorited: string
  favoriteOk: string
  favoriteUpdated: string
  favoriteRemoved: string
  favoriteFail: string
  favoriteNoChange: string
  needLogin: string
  folderMissing: string
  pending: string
  panelTitle: string
  panelHint: string
  folderDefault: string
  folderPrivate: string
  folderCount: string
  folderLoading: string
  folderEmpty: string
  folderLoadFailed: string
  folderRetry: string
  folderSelectRequired: string
  selectedCount: string
  submitFavorite: string
  dismiss: string
  closePanel: string
}

const CMN_CN: QuickActionsMessages = {
  groupLabel: '视频卡快捷操作',
  like: '点赞',
  unlike: '取消点赞',
  likeOk: '已点赞',
  unlikeOk: '已取消点赞',
  likeFail: '点赞失败，请稍后重试',
  favorite: '收藏…',
  favorited: '已收藏，点击取消',
  favoriteOk: '已收藏',
  favoriteUpdated: '收藏夹已更新',
  favoriteRemoved: '已取消收藏',
  favoriteFail: '收藏失败，请稍后重试',
  favoriteNoChange: '收藏夹没有变化',
  needLogin: '需要先登录 B 站账号',
  folderMissing: '找不到默认收藏夹，请先在 B 站检查收藏夹设置',
  pending: '处理中…',
  panelTitle: '收藏到收藏夹',
  panelHint: '可多选，提交后同步到 B 站',
  folderDefault: '默认',
  folderPrivate: '私密',
  folderCount: '{count} 个内容',
  folderLoading: '收藏夹加载中…',
  folderEmpty: '没有可用的收藏夹',
  folderLoadFailed: '收藏夹加载失败，请稍后重试',
  folderRetry: '重试',
  folderSelectRequired: '请至少选择一个收藏夹',
  selectedCount: '已选 {count} 个',
  submitFavorite: '收藏',
  dismiss: '取消',
  closePanel: '关闭',
}

const EN: QuickActionsMessages = {
  groupLabel: 'Video card quick actions',
  like: 'Like',
  unlike: 'Unlike',
  likeOk: 'Liked',
  unlikeOk: 'Like removed',
  likeFail: 'Failed to like, please try again',
  favorite: 'Favorite…',
  favorited: 'Favorited, click to remove',
  favoriteOk: 'Favorited',
  favoriteUpdated: 'Favorites updated',
  favoriteRemoved: 'Removed from favorites',
  favoriteFail: 'Failed to favorite, please try again',
  favoriteNoChange: 'No change in favorites',
  needLogin: 'Please sign in to Bilibili first',
  folderMissing: 'No default favorite folder found',
  pending: 'Working…',
  panelTitle: 'Add to favorites',
  panelHint: 'Multiple folders allowed, synced to Bilibili',
  folderDefault: 'Default',
  folderPrivate: 'Private',
  folderCount: '{count} items',
  folderLoading: 'Loading folders…',
  folderEmpty: 'No folders available',
  folderLoadFailed: 'Failed to load folders, please try again',
  folderRetry: 'Retry',
  folderSelectRequired: 'Select at least one folder',
  selectedCount: '{count} selected',
  submitFavorite: 'Save',
  dismiss: 'Cancel',
  closePanel: 'Close',
}

const CMN_TW: QuickActionsMessages = {
  groupLabel: '影片卡片快捷操作',
  like: '按讚',
  unlike: '取消按讚',
  likeOk: '已按讚',
  unlikeOk: '已取消按讚',
  likeFail: '按讚失敗，請稍後重試',
  favorite: '收藏…',
  favorited: '已收藏，點擊取消',
  favoriteOk: '已收藏',
  favoriteUpdated: '收藏夾已更新',
  favoriteRemoved: '已取消收藏',
  favoriteFail: '收藏失敗，請稍後重試',
  favoriteNoChange: '收藏夾沒有變化',
  needLogin: '需要先登入 B 站帳號',
  folderMissing: '找不到預設收藏夾，請先在 B 站檢查收藏夾設定',
  pending: '處理中…',
  panelTitle: '收藏到收藏夾',
  panelHint: '可多選，提交後同步到 B 站',
  folderDefault: '預設',
  folderPrivate: '私密',
  folderCount: '{count} 個內容',
  folderLoading: '收藏夾載入中…',
  folderEmpty: '沒有可用的收藏夾',
  folderLoadFailed: '收藏夾載入失敗，請稍後重試',
  folderRetry: '重試',
  folderSelectRequired: '請至少選擇一個收藏夾',
  selectedCount: '已選 {count} 個',
  submitFavorite: '收藏',
  dismiss: '取消',
  closePanel: '關閉',
}

const JYUT: QuickActionsMessages = {
  ...CMN_TW,
  like: '讚好',
  unlike: '取消讚好',
  likeOk: '讚好咗',
  unlikeOk: '取消讚好咗',
  likeFail: '讚好失敗，轉頭再試',
  favorited: '收藏咗，撳一下取消',
  favoriteOk: '收藏咗',
  favoriteUpdated: '收藏夾更新咗',
  favoriteRemoved: '取消收藏咗',
  favoriteFail: '收藏失敗，轉頭再試',
  favoriteNoChange: '收藏夾冇變',
  needLogin: '要登入 B 站帳號先得',
  folderMissing: '搵唔到預設收藏夾，去 B 站檢查下收藏夾設定',
  pending: '處理緊…',
  panelHint: '可以揀多個，提交之後同步去 B 站',
  folderEmpty: '冇可用嘅收藏夾',
  folderLoadFailed: '收藏夾載入失敗，轉頭再試',
  folderSelectRequired: '最少揀一個收藏夾',
  submitFavorite: '收藏',
  dismiss: '取消',
  closePanel: '收埋',
}

/** 模块自建 i18n：四种语言键集合完全一致（缺键回退简中 / 英文，不会出现空串） */
export const QUICK_ACTIONS_MESSAGES: Record<ModuleLocale, QuickActionsMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  jyut: JYUT,
  en: EN,
}

export function normalizeQuickActionsLanguage(language?: string): ModuleLocale {
  return resolveModuleLocale(language)
}

export function getQuickActionsMessages(language?: string): QuickActionsMessages {
  return getModuleMessages<QuickActionsMessages>(QUICK_ACTIONS_MESSAGES, resolveModuleLocale(language ?? settings.value.language), CMN_CN)
}

/** 响应 settings.language 的文案（切换语言后立即生效） */
export function useQuickActionsMessages() {
  return computed(() => getQuickActionsMessages(settings.value.language))
}
