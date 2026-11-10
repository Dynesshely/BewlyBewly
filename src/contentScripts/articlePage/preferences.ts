/**
 * 文章页阅读模块的偏好。
 *
 * 「默认进入阅读模式」与「正文字号」持久化在 settings
 * （articleReadingMode / articleFontSize，设置页「页面增强 → 文章页」）；
 * 页面内的开关与字号按键会回写 settings，设置页改动通过 watch 实时生效。
 * 目录展开状态仍留在 sessionStorage（纯会话内 UI 状态）。
 * 旧 key 统一以「bewly-article-」开头，迁移后删除。
 */
import type { ArticleFontStep } from './state'

import { settings } from '~/logic'

import { STORAGE_FONT_STEP, STORAGE_READING, STORAGE_TOC_OPEN } from './constants'
import { FONT_STEPS } from './state'

const DEFAULT_FONT_STEP: ArticleFontStep = 'm'

let migrated = false

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  }
  catch {
    // 隐私模式 / 存储被禁用：按未设置处理
    return null
  }
}

function removeSession(key: string): void {
  try {
    sessionStorage.removeItem(key)
  }
  catch {
    // 删不掉也不影响功能
  }
}

function writeSession(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value)
  }
  catch {
    // 写不进去不影响本次会话内的交互
  }
}

/**
 * 把旧的 sessionStorage 偏好一次性迁移到 settings。
 *
 * 只在 settings 仍是默认值时才覆盖（用户已经在设置页改过则以设置为准）；
 * 无论是否覆盖，读完都删掉旧 key。目录展开状态不属于 settings，不迁移。
 */
export function migrateLegacyPreferences(): void {
  if (migrated)
    return
  migrated = true

  const legacyReading = readSession(STORAGE_READING)
  const legacyFont = readSession(STORAGE_FONT_STEP)
  removeSession(STORAGE_READING)
  removeSession(STORAGE_FONT_STEP)

  if (legacyReading !== null && settings.value.articleReadingMode === false)
    settings.value.articleReadingMode = legacyReading === '1'

  if (legacyFont !== null && settings.value.articleFontSize === DEFAULT_FONT_STEP && FONT_STEPS.includes(legacyFont as ArticleFontStep))
    settings.value.articleFontSize = legacyFont as ArticleFontStep
}

/** 默认进入阅读模式（settings） */
export function readStoredReading(): boolean {
  return settings.value.articleReadingMode
}

export function storeReading(value: boolean): void {
  settings.value.articleReadingMode = value
}

/** 正文字号（settings） */
export function readStoredFontStep(): ArticleFontStep {
  const value = settings.value.articleFontSize
  return FONT_STEPS.includes(value)
    ? value
    : DEFAULT_FONT_STEP
}

export function storeFontStep(value: ArticleFontStep): void {
  settings.value.articleFontSize = value
}

/** 目录展开状态（仅当前标签页） */
export function readStoredTocOpen(): boolean {
  return readSession(STORAGE_TOC_OPEN) === '1'
}

export function storeTocOpen(value: boolean): void {
  writeSession(STORAGE_TOC_OPEN, value ? '1' : '0')
}
