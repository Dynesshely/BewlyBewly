/**
 * 分区 / 排行页增强的偏好。
 *
 * 「列表密度」持久化在 settings.channelDensity（设置页「页面增强 → 分区 / 排行页」），
 * 页面内切换会回写 settings，设置页改动通过入口的 watch 实时生效。
 * 面板展开状态仍留在 sessionStorage（纯会话内 UI 状态）。
 * 所有旧 key 统一以「bewly-channel-」开头，密度旧 key 迁移后删除。
 */
import type { ChannelDensity } from './state'

import { settings } from '~/logic'

import { STORAGE_KEY_DENSITY, STORAGE_KEY_PANEL } from './constants'

const DEFAULT_DENSITY: ChannelDensity = 'comfortable'

let migrated = false

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  }
  catch {
    // 隐私模式 / 被禁用的存储：按未设置处理
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
 * 把旧的 sessionStorage 密度偏好一次性迁移到 settings.channelDensity。
 *
 * 只在 settings 仍是默认值时才覆盖（用户已经在设置页改过则以设置为准），
 * 无论是否覆盖，读完都删掉旧 key。
 */
export function migrateLegacyPreferences(): void {
  if (migrated)
    return
  migrated = true

  const legacyDensity = readSession(STORAGE_KEY_DENSITY)
  removeSession(STORAGE_KEY_DENSITY)

  if (legacyDensity !== null && settings.value.channelDensity === DEFAULT_DENSITY) {
    settings.value.channelDensity = legacyDensity === 'compact'
      ? 'compact'
      : 'comfortable'
  }
}

/** 列表密度（settings） */
export function readPreferenceDensity(): ChannelDensity {
  return settings.value.channelDensity
}

export function storePreferenceDensity(value: ChannelDensity): void {
  settings.value.channelDensity = value
}

/** 面板展开状态（仅当前标签页） */
export function readStoredPanelOpen(): boolean {
  return readSession(STORAGE_KEY_PANEL) === '1'
}

export function storePanelOpen(value: boolean): void {
  writeSession(STORAGE_KEY_PANEL, value ? '1' : '0')
}
