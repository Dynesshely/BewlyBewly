/**
 * 用户空间增强的会话内偏好（sessionStorage）。
 *
 * 只影响当前标签页：刷新保留，关掉标签页即消失；不新增全局设置项，
 * 也不写 localStorage（避免和设置页的持久化配置混在一起）。
 * 所有 key 统一以 `bewly-space-` 开头。
 */
import type { SpaceDensity, SpaceFilterMode } from './state'

import { STORAGE_KEY_DENSITY, STORAGE_KEY_FILTER, STORAGE_KEY_PANEL } from './constants'

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  }
  catch {
    // 隐私模式 / 被禁用的存储：按未设置处理
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

function isFilterMode(value: string | null): value is SpaceFilterMode {
  return value === 'all' || value === 'video' || value === 'article' || value === 'dynamic' || value === 'collection'
}

export function readStoredFilter(): SpaceFilterMode {
  const stored = read(STORAGE_KEY_FILTER)
  return isFilterMode(stored)
    ? stored
    : 'all'
}

export function storeFilter(value: SpaceFilterMode): void {
  write(STORAGE_KEY_FILTER, value)
}

export function readStoredDensity(): SpaceDensity {
  return read(STORAGE_KEY_DENSITY) === 'compact'
    ? 'compact'
    : 'comfortable'
}

export function storeDensity(value: SpaceDensity): void {
  write(STORAGE_KEY_DENSITY, value)
}

export function readStoredPanelOpen(): boolean {
  return read(STORAGE_KEY_PANEL) === '1'
}

export function storePanelOpen(value: boolean): void {
  write(STORAGE_KEY_PANEL, value ? '1' : '0')
}
