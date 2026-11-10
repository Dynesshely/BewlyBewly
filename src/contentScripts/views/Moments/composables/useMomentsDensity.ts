/**
 * 动态页卡片密度偏好：舒适 / 紧凑。
 *
 * 只存 localStorage（key：`bewly-moments-density`），不新增 settings 字段，
 * 也不碰全局 `_locales`。模块级单例：切走再切回页面时保持上次选择。
 */
import { computed, ref, watch } from 'vue'

export type MomentsDensity = 'comfortable' | 'compact'

export const MOMENTS_DENSITIES: MomentsDensity[] = ['comfortable', 'compact']

export const DENSITY_STORAGE_KEY = 'bewly-moments-density'

const DEFAULT_DENSITY: MomentsDensity = 'comfortable'

function readDensity(): MomentsDensity {
  try {
    return window.localStorage.getItem(DENSITY_STORAGE_KEY) === 'compact'
      ? 'compact'
      : DEFAULT_DENSITY
  }
  catch {
    return DEFAULT_DENSITY
  }
}

function persistDensity(value: MomentsDensity) {
  try {
    window.localStorage.setItem(DENSITY_STORAGE_KEY, value)
  }
  catch {
    // 隐私模式 / 存储被禁用时忽略，本次会话内仍然生效
  }
}

const density = ref<MomentsDensity>(readDensity())

watch(density, value => persistDensity(value))

export function useMomentsDensity() {
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
