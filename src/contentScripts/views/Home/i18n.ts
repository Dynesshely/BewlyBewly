import type { ModuleLocale } from '~/utils/moduleI18n'

import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

/**
 * 首页模块内文案（卡片密度 / 回到顶部，不进入全局 _locales）。
 *
 * 四种模块语言：cmn-CN 简中 / cmn-TW 繁体 / jyut 繁体（粤语词）/ en 英文；
 * 语言解析统一走 `~/utils/moduleI18n`（见 docs/i18n-modules.md）。
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

const CMN_TW: HomeMessages = {
  densityGroup: '卡片密度',
  densityComfortable: '舒適',
  densityCompact: '緊湊',
  densityComfortableHint: '舒適密度：更大的封面、更寬的間距',
  densityCompactHint: '緊湊密度：每行多一張、間距更小、標題字號小一檔',
  backToTop: '回到頂部',
  backToTopHint: '滾過兩屏後出現，點擊平滑回到頂部',
}

const JYUT: HomeMessages = {
  ...CMN_TW,
  densityComfortableHint: '舒適密度：封面大啲、間距闊啲',
  densityCompactHint: '緊湊密度：每行多一張、間距細啲、標題字細一檔',
  backToTopHint: '滾過兩屏先會出現，撳一下平滑返到頂部',
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

/** 模块自建 i18n：四种语言键集合完全一致（缺键回退简中 / 英文，不会出现空串） */
export const MESSAGES: Record<ModuleLocale, HomeMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  jyut: JYUT,
  en: EN,
}

export function normalizeLanguage(language?: string): ModuleLocale {
  return resolveModuleLocale(language)
}

export function getHomeMessages(language?: string): HomeMessages {
  return getModuleMessages<HomeMessages>(MESSAGES, resolveModuleLocale(language ?? settings.value.language), CMN_CN)
}

/** 响应 settings.language 的文案 */
export function useHomeMessages() {
  return computed(() => getHomeMessages(settings.value.language))
}
