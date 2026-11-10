import { computed } from 'vue'

import { LanguageType } from '~/enums/appEnums'
import { settings } from '~/logic'

/**
 * 首页模块内文案（卡片密度 / 回到顶部，不进入全局 _locales）。
 *
 * 与其它模块一致：`settings.language === 'en'` 用英文，其余语言（含空值）回退简中。
 */
export interface HomeMessages {
  densityGroup: string
  densityComfortable: string
  densityCompact: string
  densityComfortableHint: string
  densityCompactHint: string
  backToTop: string
  backToTopHint: string
}

const CMN_CN: HomeMessages = {
  densityGroup: '卡片密度',
  densityComfortable: '舒适',
  densityCompact: '紧凑',
  densityComfortableHint: '舒适密度：更大的封面、更宽的间距',
  densityCompactHint: '紧凑密度：每行多一张、间距更小、标题字号小一档',
  backToTop: '回到顶部',
  backToTopHint: '滚过两屏后出现，点击平滑回到顶部',
}

const EN: HomeMessages = {
  densityGroup: 'Card density',
  densityComfortable: 'Comfortable',
  densityCompact: 'Compact',
  densityComfortableHint: 'Comfortable: larger covers and wider gaps',
  densityCompactHint: 'Compact: one more card per row, smaller gaps and a smaller title',
  backToTop: 'Back to top',
  backToTopHint: 'Appears after scrolling two screens; click to glide back to the top',
}

/** 模块自建 i18n：只覆盖简中与英文，其余语言回退简中 */
export const MESSAGES: Record<string, HomeMessages> = {
  'cmn-CN': CMN_CN,
  'en': EN,
}

const FALLBACK_LANGUAGE = 'cmn-CN'

export function normalizeLanguage(language?: string): string {
  return language === LanguageType.English
    ? 'en'
    : FALLBACK_LANGUAGE
}

export function getHomeMessages(language?: string): HomeMessages {
  const key = normalizeLanguage(language ?? settings.value.language)
  return MESSAGES[key] ?? CMN_CN
}

/** 响应 settings.language 的文案 */
export function useHomeMessages() {
  return computed(() => getHomeMessages(settings.value.language))
}
