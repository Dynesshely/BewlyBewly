import type { ArticleFontStep } from './state'

import { computed } from 'vue'
import { LanguageType } from '~/enums/appEnums'

import { settings } from '~/logic'

export type { ArticleFontStep }

export interface ArticlePageMessages {
  dock: string
  reading: string
  exitReading: string
  readingOn: string
  readingOff: string
  readingHint: string
  fontSmaller: string
  fontLarger: string
  fontLabel: string
  fontStepS: string
  fontStepM: string
  fontStepL: string
  fontChanged: string
  toc: string
  tocTitle: string
  tocEmpty: string
  tocCount: string
  tocHint: string
  backToTop: string
  backToTopDone: string
  progress: string
  shortcutsHint: string
  close: string
  noContent: string
  /** 形如「阅读进度 {percent}%」 */
  progressLabel: string
}

const CMN_CN: ArticlePageMessages = {
  dock: '阅读辅助',
  reading: '沉浸阅读',
  exitReading: '退出阅读',
  readingOn: '已进入沉浸阅读，Esc 退出',
  readingOff: '已退出沉浸阅读',
  readingHint: '正文 720px、隐藏侧栏与推荐',
  fontSmaller: '字号减小',
  fontLarger: '字号增大',
  fontLabel: '字号',
  fontStepS: '小',
  fontStepM: '标准',
  fontStepL: '大',
  fontChanged: '字号：{step}',
  toc: '目录',
  tocTitle: '文章目录',
  tocEmpty: '正文里没有找到可跳转的标题',
  tocCount: '共 {count} 条',
  tocHint: '点击标题平滑跳转，当前章节会高亮',
  backToTop: '回到顶部',
  backToTopDone: '已回到顶部',
  progress: '阅读进度',
  shortcutsHint: 'R 阅读 · [ ] 字号 · T 顶部 · Esc 退出',
  close: '关闭',
  noContent: '暂时没有找到正文容器，阅读增强已降级',
  progressLabel: '阅读进度 {percent}%',
}

const EN: ArticlePageMessages = {
  dock: 'Reading tools',
  reading: 'Focus reading',
  exitReading: 'Exit reading',
  readingOn: 'Focus reading on — press Esc to exit',
  readingOff: 'Focus reading off',
  readingHint: '720px column, sidebar and recommendations hidden',
  fontSmaller: 'Smaller text',
  fontLarger: 'Larger text',
  fontLabel: 'Text size',
  fontStepS: 'Small',
  fontStepM: 'Default',
  fontStepL: 'Large',
  fontChanged: 'Text size: {step}',
  toc: 'Contents',
  tocTitle: 'Article contents',
  tocEmpty: 'No headings found in the article body',
  tocCount: '{count} sections',
  tocHint: 'Click a heading to scroll smoothly; the current section stays highlighted',
  backToTop: 'Back to top',
  backToTopDone: 'Back to top',
  progress: 'Reading progress',
  shortcutsHint: 'R reading · [ ] text size · T top · Esc exit',
  close: 'Close',
  noContent: 'Article body not found yet — reading enhancements are degraded',
  progressLabel: 'Reading progress {percent}%',
}

/** 模块自建 i18n：只覆盖简中与英文，其余语言回退简中 */
export const MESSAGES: Record<string, ArticlePageMessages> = {
  'cmn-CN': CMN_CN,
  'en': EN,
}

const FALLBACK_LANGUAGE = 'cmn-CN'

export function normalizeLanguage(language?: string): string {
  return language === LanguageType.English
    ? 'en'
    : FALLBACK_LANGUAGE
}

export function getMessages(language?: string): ArticlePageMessages {
  const key = normalizeLanguage(language ?? settings.value.language)
  return MESSAGES[key] ?? CMN_CN
}

/** 响应 settings.language 的文案（切语言后无需重建 UI） */
export function useMessages() {
  return computed(() => getMessages(settings.value.language))
}

export function formatTemplate(template: string, params: Record<string, string | number>): string {
  let text = template
  for (const [name, value] of Object.entries(params))
    text = text.replaceAll(`{${name}}`, String(value))
  return text
}

export function fontStepLabel(messages: ArticlePageMessages, step: ArticleFontStep): string {
  if (step === 's')
    return messages.fontStepS
  if (step === 'l')
    return messages.fontStepL
  return messages.fontStepM
}
