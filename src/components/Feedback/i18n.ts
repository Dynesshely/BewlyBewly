import type { ModuleLocale } from '~/utils/moduleI18n'
import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

/**
 * 反馈态通用组件（图片兜底 / 空态 / 错误态 / 骨架）的模块内文案。
 *
 * 只服务 `components/Feedback/**`，不进入 `src/_locales`。
 * 四种模块语言：cmn-CN 简中 / cmn-TW 繁体 / jyut 繁体（粤语词）/ en 英文。
 */
export interface FeedbackMessages {
  /** 图片加载失败（默认无障碍名称） */
  imageFallback: string
  /** 视频封面加载失败 */
  videoFallback: string
  /** 头像加载失败 */
  avatarFallback: string
}

const CMN_CN: FeedbackMessages = {
  imageFallback: '图片加载失败',
  videoFallback: '视频封面加载失败',
  avatarFallback: '头像加载失败',
}

const CMN_TW: FeedbackMessages = {
  imageFallback: '圖片載入失敗',
  videoFallback: '影片封面載入失敗',
  avatarFallback: '頭像載入失敗',
}

const JYUT: FeedbackMessages = {
  ...CMN_TW,
  imageFallback: '圖片載入唔到',
  videoFallback: '影片封面載入唔到',
  avatarFallback: '頭像載入唔到',
}

const EN: FeedbackMessages = {
  imageFallback: 'Failed to load image',
  videoFallback: 'Failed to load video cover',
  avatarFallback: 'Failed to load avatar',
}

/** 四种语言键集合完全一致（缺键回退简中 / 英文，不会出现空串） */
export const MESSAGES: Record<ModuleLocale, FeedbackMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  jyut: JYUT,
  en: EN,
}

export function getFeedbackMessages(language?: string): FeedbackMessages {
  return getModuleMessages<FeedbackMessages>(MESSAGES, resolveModuleLocale(language ?? settings.value.language), CMN_CN)
}

/** 响应 settings.language 的文案 */
export function useFeedbackMessages() {
  return computed(() => getFeedbackMessages(settings.value.language))
}
