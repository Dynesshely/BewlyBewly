/**
 * 动态页卡片密度偏好：舒适 / 紧凑。
 *
 * 真实来源是 settings.momentsDensity（设置页「页面增强 → 动态页」）：
 * 页面工具栏切换会回写 settings，设置页改动通过响应式依赖立即生效。
 * 旧版本写在 localStorage 的「bewly-moments-density」会在首次使用时一次性迁移后删除。
 */
import type { PageDensity } from '~/logic'

import { computed } from 'vue'

import { settings } from '~/logic'

export type MomentsDensity = PageDensity

export const MOMENTS_DENSITIES: MomentsDensity[] = ['comfortable', 'compact']

/** 旧版本 localStorage key（只用于一次性迁移） */
export const DENSITY_STORAGE_KEY = 'bewly-moments-density'

const DEFAULT_DENSITY: MomentsDensity = 'comfortable'

let migrated = false

/**
 * 一次性迁移旧的 localStorage 偏好。
 *
 * 只在 settings 仍是默认值时才覆盖，避免用户已经在设置页改过之后又被旧值冲掉；
 * 无论是否覆盖，读完都删掉旧 key。
 */
function migrateLegacyDensity(): void {
  if (migrated)
    return
  migrated = true

  try {
    const raw = window.localStorage.getItem(DENSITY_STORAGE_KEY)
    if (raw === null)
      return
    window.localStorage.removeItem(DENSITY_STORAGE_KEY)

    if (settings.value.momentsDensity !== DEFAULT_DENSITY)
      return
    if (raw === 'compact' || raw === 'comfortable')
      settings.value.momentsDensity = raw
  }
  catch {
    // 隐私模式 / 存储被禁用时忽略，沿用 settings 默认值
  }
}

export function useMomentsDensity() {
  migrateLegacyDensity()

  /** 直接绑定 settings：页面内切换写回 settings，设置页改动实时反映到卡片 */
  const density = computed<MomentsDensity>({
    get: () => settings.value.momentsDensity,
    set: (value) => {
      settings.value.momentsDensity = value
    },
  })

  const isCompact = computed(() => density.value === 'compact')

  function setDensity(value: MomentsDensity) {
    density.value = value
  }

  function toggleDensity() {
    density.value = density.value === 'compact'
      ? 'comfortable'
      : 'compact'
  }

  return {
    density,
    isCompact,
    setDensity,
    toggleDensity,
  }
}
