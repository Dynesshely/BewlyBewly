/**
 * 阅读模块的会话内偏好（sessionStorage）。
 *
 * 只影响当前标签页：刷新保留，关掉标签页即消失。不改 storage.ts、不新增全局设置项。
 * 所有 key 统一以 `bewly-article-` 开头。
 */
import type { ArticleFontStep } from './state'

import { STORAGE_FONT_STEP, STORAGE_READING, STORAGE_TOC_OPEN } from './constants'
import { FONT_STEPS } from './state'

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  }
  catch {
    // 隐私模式 / 存储被禁用：按未设置处理
    return null
  }
}

function write(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value)
  }
  catch {
    // 写不进去不影响本次会话内的交互
  }
}

export function readStoredReading(): boolean {
  return read(STORAGE_READING) === '1'
}

export function storeReading(value: boolean): void {
  write(STORAGE_READING, value ? '1' : '0')
}

export function readStoredFontStep(): ArticleFontStep {
  const value = read(STORAGE_FONT_STEP)
  return FONT_STEPS.includes(value as ArticleFontStep)
    ? value as ArticleFontStep
    : 'm'
}

export function storeFontStep(value: ArticleFontStep): void {
  write(STORAGE_FONT_STEP, value)
}

export function readStoredTocOpen(): boolean {
  return read(STORAGE_TOC_OPEN) === '1'
}

export function storeTocOpen(value: boolean): void {
  write(STORAGE_TOC_OPEN, value ? '1' : '0')
}
