import { computed } from 'vue'

import { LanguageType } from '~/enums/appEnums'
import { settings } from '~/logic'

/**
 * 视频卡快捷操作（点赞 / 收藏）的模块内文案。
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
  favoriteFail: string
  needLogin: string
  folderMissing: string
  pending: string
}

const CMN_CN: QuickActionsMessages = {
  groupLabel: '视频卡快捷操作',
  like: '点赞',
  unlike: '取消点赞',
  likeOk: '已点赞',
  unlikeOk: '已取消点赞',
  likeFail: '点赞失败，请稍后重试',
  favorite: '收藏到默认收藏夹',
  favorited: '已收藏在默认收藏夹',
  favoriteOk: '已收藏到默认收藏夹',
  favoriteFail: '收藏失败，请稍后重试',
  needLogin: '需要先登录 B 站账号',
  folderMissing: '找不到默认收藏夹，请先在 B 站检查收藏夹设置',
  pending: '处理中…',
}

const EN: QuickActionsMessages = {
  groupLabel: 'Video card quick actions',
  like: 'Like',
  unlike: 'Unlike',
  likeOk: 'Liked',
  unlikeOk: 'Like removed',
  likeFail: 'Failed to like, please try again',
  favorite: 'Add to default favorites',
  favorited: 'Already in default favorites',
  favoriteOk: 'Added to default favorites',
  favoriteFail: 'Failed to favorite, please try again',
  needLogin: 'Please sign in to Bilibili first',
  folderMissing: 'No default favorite folder found',
  pending: 'Working…',
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
