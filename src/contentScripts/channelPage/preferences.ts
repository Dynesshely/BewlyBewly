/**
 * 分区页增强的会话内偏好（sessionStorage）。
 *
 * 只影响当前标签页：刷新保留，关掉标签页即消失。
 * 本轮不新增全局 settings 字段（按第 5 轮简报 C 节）。
 * 所有 key 统一以 `bewly-channel-` 开头。
 */
import type { ChannelDensity } from './state'

import { STORAGE_KEY_DENSITY, STORAGE_KEY_PANEL } from './constants'

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

export function readStoredDensity(): ChannelDensity {
  return read(STORAGE_KEY_DENSITY) === 'compact'
    ? 'compact'
    : 'comfortable'
}

export function storeDensity(value: ChannelDensity): void {
  write(STORAGE_KEY_DENSITY, value)
}

export function readStoredPanelOpen(): boolean {
  return read(STORAGE_KEY_PANEL) === '1'
}

export function storePanelOpen(value: boolean): void {
  write(STORAGE_KEY_PANEL, value ? '1' : '0')
}
