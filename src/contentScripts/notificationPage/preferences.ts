/**
 * 消息页增强的会话内偏好（sessionStorage）。
 *
 * 只影响当前标签页：刷新保留，关掉标签页即消失；不新增全局设置项，
 * 也不写 localStorage（避免和设置页的持久化配置混在一起）。
 * 所有 key 统一以 \`bewly-notif-\` 开头。
 */
import type { NotificationDensity } from './state'

const KEY_ONLY_UNREAD = 'bewly-notif-only-unread'
const KEY_DENSITY = 'bewly-notif-density'
const KEY_PANEL_OPEN = 'bewly-notif-panel-open'

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

export function readStoredUnreadOnly(): boolean {
  return read(KEY_ONLY_UNREAD) === '1'
}

export function storeUnreadOnly(value: boolean): void {
  write(KEY_ONLY_UNREAD, value ? '1' : '0')
}

export function readStoredDensity(): NotificationDensity {
  return read(KEY_DENSITY) === 'compact'
    ? 'compact'
    : 'comfortable'
}

export function storeDensity(value: NotificationDensity): void {
  write(KEY_DENSITY, value)
}

export function readStoredPanelOpen(): boolean {
  return read(KEY_PANEL_OPEN) === '1'
}

export function storePanelOpen(value: boolean): void {
  write(KEY_PANEL_OPEN, value ? '1' : '0')
}
