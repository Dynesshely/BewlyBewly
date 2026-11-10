import { computed } from 'vue'

import { settings } from '~/logic'

/** 第 1 轮用的模块内 localStorage key，只用于一次性迁移 */
const LEGACY_STORAGE_KEY = 'bewly-search-direct-paste'

let migrated = false

/**
 * 把旧的 localStorage 开关迁移到 settings.searchPageDirectPasteEnabled。
 *
 * 只在存在旧值时覆盖一次，随后删除旧 key；用户之后在设置页的修改以 settings 为准。
 */
function migrateLegacySetting() {
  if (migrated)
    return
  migrated = true

  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (raw === null)
      return
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)

    if (raw === 'true' || raw === '1')
      settings.value.searchPageDirectPasteEnabled = true
    else if (raw === 'false' || raw === '0')
      settings.value.searchPageDirectPasteEnabled = false
  }
  catch {
    // 隐私模式或存储被禁用时忽略，沿用 settings 默认值
  }
}

/**
 * 「页面内粘贴直达」开关。
 *
 * 真实来源是 settings.searchPageDirectPasteEnabled（设置页「页面增强 → 搜索页」），
 * 返回可写 computed，页面内的开关与设置页共享同一个状态。
 */
export function useDirectPasteSetting() {
  migrateLegacySetting()

  return computed<boolean>({
    get: () => settings.value.searchPageDirectPasteEnabled,
    set: (value) => {
      settings.value.searchPageDirectPasteEnabled = value
    },
  })
}
