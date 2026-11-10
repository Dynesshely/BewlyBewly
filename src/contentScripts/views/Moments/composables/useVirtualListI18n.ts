/**
 * 动态页「离屏优化」开关的模块内文案。
 *
 * 单独一个文件而不是塞进 `Moments/i18n.ts`：本轮同一目录下还有「动态页点赞」
 * 工作流在改 `i18n.ts`，为把并发写入冲突降到最低，这里自成一个只含 3 个 key 的小字典。
 * 语言规则与模块内 i18n 一致：`settings.language === 'en'` 用英文，其余回退简中。
 */
import { computed } from 'vue'

import { LanguageType } from '~/enums/appEnums'
import { settings } from '~/logic'

export interface VirtualListMessages {
  optimize: string
  optimizeHintOn: string
  optimizeHintOff: string
}

const CMN_CN: VirtualListMessages = {
  optimize: '离屏优化',
  optimizeHintOn: '已开启：只渲染视口附近的卡片，滚动到附近时其余卡片才渲染（可在本按钮关闭）',
  optimizeHintOff: '已关闭：所有卡片全部渲染（长列表更吃性能）',
}

const EN: VirtualListMessages = {
  optimize: 'Off-screen',
  optimizeHintOn: 'On: only cards near the viewport are rendered; others render when you scroll close',
  optimizeHintOff: 'Off: every card is rendered — heavier on long feeds',
}

const MESSAGES: Record<string, VirtualListMessages> = {
  'cmn-CN': CMN_CN,
  'en': EN,
}

const FALLBACK_LANGUAGE = 'cmn-CN'

export function normalizeLanguage(language?: string): string {
  return language === LanguageType.English
    ? 'en'
    : FALLBACK_LANGUAGE
}

export function getVirtualListMessages(language?: string): VirtualListMessages {
  const key = normalizeLanguage(language ?? settings.value.language)
  return MESSAGES[key] ?? CMN_CN
}

export function useVirtualListI18n() {
  const locale = computed(() => normalizeLanguage(settings.value.language))

  function t(key: keyof VirtualListMessages): string {
    const dict = MESSAGES[locale.value] ?? CMN_CN
    return dict[key] ?? CMN_CN[key] ?? key
  }

  return { t, locale }
}
