import { computed } from 'vue'

import { LanguageType } from '~/enums/appEnums'
import { settings } from '~/logic'

/**
 * 视频卡快捷操作（点赞 / 收藏 / 收藏夹面板）的模块内文案。
 *
 * 按项目约定不进 `src/_locales`：`settings.value.language === 'en'` 时用英文，
 * 其余语言（含空值）一律回落简体中文。
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

export const QUICK_ACTIONS_MESSAGES: Record<string, QuickActionsMessages> = {
  'cmn-CN': CMN_CN,
  'en': EN,
}

const FALLBACK_LANGUAGE = 'cmn-CN'

export function normalizeQuickActionsLanguage(language?: string): string {
  return language === LanguageType.English
    ? 'en'
    : FALLBACK_LANGUAGE
}

export function getQuickActionsMessages(language?: string): QuickActionsMessages {
  const key = normalizeQuickActionsLanguage(language ?? settings.value.language)
  return QUICK_ACTIONS_MESSAGES[key] ?? CMN_CN
}

/** 响应 settings.language 的文案（切换语言后立即生效） */
export function useQuickActionsMessages() {
  return computed(() => getQuickActionsMessages(settings.value.language))
}
