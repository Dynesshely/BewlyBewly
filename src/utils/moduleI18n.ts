/**
 * 模块内 i18n 的共享语言解析。
 *
 * 第 1–11 轮各模块自己维护 `i18n.ts`（不进入 `src/_locales`），语言解析函数写法不一：
 * 有的只认 `en`、其余回落简中；有的自己判断 `cmn-TW` / `jyut`。
 * 第 12 轮起统一走这里，四种模块语言：
 *
 *   cmn-CN → 简体中文
 *   cmn-TW → 繁体中文
 *   jyut   → 繁体中文（个别粤语口语词）
 *   en     → 英文
 *
 * 其它（含未识别的语言代码）→ 英文；空值 / undefined 视为「尚未确定」，
 * 按简中处理，避免设置加载完成前短暂闪成英文（与各模块原先的缺省行为一致）。
 */
import { LanguageType } from '~/enums/appEnums'

export type ModuleLocale = 'cmn-CN' | 'cmn-TW' | 'jyut' | 'en'

/** 模块语言顺序：简中 → 繁体 → 粤语 → 英文 */
export const MODULE_LOCALES: ModuleLocale[] = ['cmn-CN', 'cmn-TW', 'jyut', 'en']

/** 未设置语言时按简中处理（设置加载完成前的空值） */
export const DEFAULT_MODULE_LOCALE: ModuleLocale = 'cmn-CN'

/** 语言代码 → 模块语言（其它一律英文） */
export function resolveModuleLocale(language?: string | null): ModuleLocale {
  if (language === undefined || language === null || language === '')
    return DEFAULT_MODULE_LOCALE

  switch (language) {
    case LanguageType.Mandarin_CN:
      return 'cmn-CN'
    case LanguageType.Mandarin_TW:
      return 'cmn-TW'
    case LanguageType.Cantonese:
      return 'jyut'
    case LanguageType.English:
      return 'en'
    default:
      return 'en'
  }
}

/**
 * 取某语言的词典，带缺省回退：
 * 精确匹配 → 简中 → 英文 → 调用方给的兜底词典。
 *
 * 注意：这只做「整份词典」级别的回退；键级别的缺失由各模块的类型约束 +
 * `docs/i18n-modules.md` 里的自检脚本保证（四种语言的键集合必须完全一致）。
 */
export function getModuleMessages<T>(
  messages: Partial<Record<ModuleLocale, T>>,
  locale: ModuleLocale,
  fallback?: T,
): T {
  return messages[locale]
    ?? messages['cmn-CN']
    ?? messages.en
    ?? (fallback as T)
}

/** 是否是不含回退的完整四语言词典 */
export function hasAllModuleLocales<T>(messages: Partial<Record<ModuleLocale, T>>): boolean {
  return MODULE_LOCALES.every(locale => messages[locale] !== undefined)
}
