import { computed, ref } from 'vue'

/**
 * 是否渲染悬停操作条（点赞 / 收藏 / 稍后再看）。
 *
 * 本轮的设置页开关由 Lead 要求共用 `localStorage`（不新增 storage 字段）：
 * key `bewly-card-quick-actions`，`'1'` 开 / `'0'` 关，缺省视为开启。
 * 设置页「页面增强 → 视频卡片 → 悬停操作条」与卡片渲染共用同一个响应式状态。
 */
export const CARD_QUICK_ACTIONS_STORAGE_KEY = 'bewly-card-quick-actions'

const DEFAULT_ENABLED = true

function readStored(): boolean {
  try {
    const raw = window.localStorage.getItem(CARD_QUICK_ACTIONS_STORAGE_KEY)
    return raw === null
      ? DEFAULT_ENABLED
      : raw !== '0'
  }
  catch {
    return DEFAULT_ENABLED
  }
}

const enabled = ref<boolean>(readStored())

function writeStored(value: boolean) {
  try {
    window.localStorage.setItem(CARD_QUICK_ACTIONS_STORAGE_KEY, value ? '1' : '0')
  }
  catch {
    // 隐私模式 / 存储被禁用时忽略，本次会话内仍然按内存值生效
  }
}

// 其他标签页改了这个开关时同步（同标签页的写入由 setCardQuickActionsEnabled 负责）
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === CARD_QUICK_ACTIONS_STORAGE_KEY) {
      enabled.value = event.newValue === null
        ? DEFAULT_ENABLED
        : event.newValue !== '0'
    }
  })
}

/** 卡片渲染时用的只读状态 */
export const cardQuickActionsEnabled = computed(() => enabled.value)

export function isCardQuickActionsEnabled(): boolean {
  return enabled.value
}

export function setCardQuickActionsEnabled(value: boolean): void {
  enabled.value = value
  writeStored(value)
}

export function toggleCardQuickActions(): void {
  setCardQuickActionsEnabled(!enabled.value)
}
