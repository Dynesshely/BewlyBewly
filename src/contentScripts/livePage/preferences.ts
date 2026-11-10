/**
 * 直播页增强的会话内偏好（sessionStorage）。
 *
 * 只影响当前标签页：刷新保留，关掉标签页即消失。
 * 本轮不新增全局 settings 字段（按第 6 轮简报 A 节）。
 * 所有 key 统一以 `bewly-live-` 开头。
 */
import {
  STORAGE_KEY_CINEMA,
  STORAGE_KEY_HIDE_ASIDE,
  STORAGE_KEY_PANEL,
} from './constants'

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

export function readStoredCinema(): boolean {
  return read(STORAGE_KEY_CINEMA) === '1'
}

export function storeCinema(value: boolean): void {
  write(STORAGE_KEY_CINEMA, value ? '1' : '0')
}

export function readStoredHideAside(): boolean {
  return read(STORAGE_KEY_HIDE_ASIDE) === '1'
}

export function storeHideAside(value: boolean): void {
  write(STORAGE_KEY_HIDE_ASIDE, value ? '1' : '0')
}

export function readStoredPanelOpen(): boolean {
  return read(STORAGE_KEY_PANEL) === '1'
}

export function storePanelOpen(value: boolean): void {
  write(STORAGE_KEY_PANEL, value ? '1' : '0')
}
