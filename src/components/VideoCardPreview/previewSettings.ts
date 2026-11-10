import { settings } from '~/logic'

/**
 * 第 6 轮的 localStorage 开关 key（`'1'` 开 / `'0'` 关）。
 * 第 7 轮起正式开关是 `settings.enableVideoCardPreview`，这个 key 只在首次调用时迁移一次后删除。
 */
export const LEGACY_CARD_PREVIEW_STORAGE_KEY = 'bewly-card-preview'

/** 悬停多久后开始请求预览（毫秒）；用户开启「延迟」时放慢到 1200ms */
export const CARD_PREVIEW_DELAY = 900
export const CARD_PREVIEW_DELAY_DELAYED = 1200

/** 预览最长播放时长（毫秒） */
export const CARD_PREVIEW_MAX_DURATION = 6000

const HOVER_NONE_QUERY = '(hover: none)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

let migrated = false

/**
 * 把第 6 轮写在 localStorage 的 `bewly-card-preview` 一次性迁移到
 * `settings.enableVideoCardPreview`。
 *
 * 仅在旧值为 `'0'`（当时关掉过）且当前 settings 仍为默认（开启）时写入关闭，
 * 用户已经在设置里改过就以设置为准；无论是否覆盖，读完立即删掉旧 key。
 */
export function migrateLegacyCardPreviewSetting(): void {
  if (migrated)
    return
  migrated = true

  try {
    const raw = window.localStorage.getItem(LEGACY_CARD_PREVIEW_STORAGE_KEY)
    if (raw === null)
      return
    window.localStorage.removeItem(LEGACY_CARD_PREVIEW_STORAGE_KEY)

    if (raw !== '0')
      return
    if (settings.value.enableVideoCardPreview === false)
      return
    settings.value.enableVideoCardPreview = false
  }
  catch {
    // 隐私模式 / 存储被禁用时忽略，沿用 settings 默认值（开启）
  }
}

/**
 * 卡片悬停预览开关。
 *
 * 第 7 轮起由 `settings.enableVideoCardPreview`（设置页「页面增强 → 视频卡片」）控制，
 * 同时保留旧「视频预览」总闸：关闭 `settings.enableVideoPreview` 依旧会一并关掉预览，
 * 避免旧开关变成一个不起作用的死开关。
 */
export function isCardPreviewEnabled(): boolean {
  migrateLegacyCardPreviewSetting()

  if (settings.value.enableVideoCardPreview === false)
    return false
  return settings.value.enableVideoPreview !== false
}

/** 设备/偏好是否支持预览：触屏（hover: none）与减少动效时不启用 */
export function isCardPreviewSupported(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return false
  try {
    if (window.matchMedia(HOVER_NONE_QUERY).matches)
      return false
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches)
      return false
  }
  catch {
    return false
  }
  return true
}

/** 当前一次预览的悬停延迟（毫秒） */
export function getCardPreviewDelay(): number {
  return settings.value.hoverVideoCardDelayed ? CARD_PREVIEW_DELAY_DELAYED : CARD_PREVIEW_DELAY
}

/** 是否显示播放控件（沿用既有的 `enableVideoCtrlBarOnVideoCard` 设置，默认关闭） */
export function isCardPreviewCtrlBarEnabled(): boolean {
  return settings.value.enableVideoCtrlBarOnVideoCard === true
}
