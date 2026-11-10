import { computed } from 'vue'

import { settings } from '~/logic'

/**
 * 悬停操作条（点赞 / 收藏 / 稍后再看）开关。
 *
 * 第 9 轮起正式开关是 `settings.enableVideoCardQuickActions`（设置页「页面增强 → 视频卡片 → 悬停操作条」）。
 * 第 8 轮写在 localStorage 的 `bewly-card-quick-actions` 只用于一次性迁移：
 * 仅旧值为 `'0'` 且设置仍为默认（开启）时写入关闭，随后删除旧 key。
 */
export const LEGACY_CARD_QUICK_ACTIONS_STORAGE_KEY = 'bewly-card-quick-actions'

let migrated = false

/**
 * 迁移旧的 localStorage 开关。
 *
 * 必须在 settings 已经从 storage 读回之后再调用（卡片的 setup / 设置页 setup 都满足），
 * 避免与 `useStorageAsync` 的异步读取竞态。
 */
export function migrateLegacyCardQuickActionsSetting(): void {
  if (migrated)
    return
  migrated = true

  try {
    const raw = window.localStorage.getItem(LEGACY_CARD_QUICK_ACTIONS_STORAGE_KEY)
    if (raw === null)
      return
    window.localStorage.removeItem(LEGACY_CARD_QUICK_ACTIONS_STORAGE_KEY)

    if (raw !== '0')
      return
    if (settings.value.enableVideoCardQuickActions === false)
      return
    settings.value.enableVideoCardQuickActions = false
  }
  catch {
    // 隐私模式 / 存储被禁用时忽略，沿用 settings 默认值（开启）
  }
}

/** 卡片渲染时用的只读状态（设置页改动会实时反映到卡片） */
export const cardQuickActionsEnabled = computed(() => settings.value.enableVideoCardQuickActions !== false)

export function isCardQuickActionsEnabled(): boolean {
  return cardQuickActionsEnabled.value
}

/** 程序化切换（与设置页共用同一个 settings 字段） */
export function setCardQuickActionsEnabled(value: boolean): void {
  migrateLegacyCardQuickActionsSetting()
  settings.value.enableVideoCardQuickActions = value
}

export function toggleCardQuickActions(): void {
  setCardQuickActionsEnabled(!isCardQuickActionsEnabled())
}
