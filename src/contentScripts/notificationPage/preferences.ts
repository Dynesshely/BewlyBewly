/**
 * 消息页增强的偏好。
 *
 * 「默认只看未读」与「列表密度」持久化在 settings
 * （notificationOnlyUnread / notificationDensity，设置页「页面增强 → 消息页」），
 * 页面内的切换会回写 settings，设置页改动通过 watch 实时生效。
 * 只有面板展开状态仍留在 sessionStorage（纯会话内 UI 状态，不需要全局设置）。
 * 所有旧 key 统一以「bewly-notif-」开头，迁移后删除。
 */
import type { NotificationDensity } from './state'

import { settings } from '~/logic'

const KEY_ONLY_UNREAD = 'bewly-notif-only-unread'
const KEY_DENSITY = 'bewly-notif-density'
const KEY_PANEL_OPEN = 'bewly-notif-panel-open'

const DEFAULT_DENSITY: NotificationDensity = 'comfortable'

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
 * 把旧的 sessionStorage 偏好一次性迁移到 settings。
 *
 * 只在 settings 仍是默认值时才覆盖（用户已经在设置页改过则以设置为准），
 * 无论是否覆盖，读完都删掉旧 key。
 */
export function migrateLegacyPreferences(): void {
  if (migrated)
    return
  migrated = true

  const legacyUnread = readSession(KEY_ONLY_UNREAD)
  const legacyDensity = readSession(KEY_DENSITY)
  removeSession(KEY_ONLY_UNREAD)
  removeSession(KEY_DENSITY)

  if (legacyUnread !== null && settings.value.notificationOnlyUnread === false)
    settings.value.notificationOnlyUnread = legacyUnread === '1'

  if (legacyDensity !== null && settings.value.notificationDensity === DEFAULT_DENSITY) {
    settings.value.notificationDensity = legacyDensity === 'compact'
      ? 'compact'
      : 'comfortable'
  }
}

/** 默认只看未读（settings） */
export function readPreferenceUnreadOnly(): boolean {
  return settings.value.notificationOnlyUnread
}

export function storePreferenceUnreadOnly(value: boolean): void {
  settings.value.notificationOnlyUnread = value
}

/** 列表密度（settings） */
export function readPreferenceDensity(): NotificationDensity {
  return settings.value.notificationDensity
}

export function storePreferenceDensity(value: NotificationDensity): void {
  settings.value.notificationDensity = value
}

/** 面板展开状态（仅当前标签页） */
export function readStoredPanelOpen(): boolean {
  return readSession(KEY_PANEL_OPEN) === '1'
}

export function storePanelOpen(value: boolean): void {
  writeSession(KEY_PANEL_OPEN, value ? '1' : '0')
}
