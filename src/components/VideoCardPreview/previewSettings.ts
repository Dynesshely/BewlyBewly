import { settings } from '~/logic'

/** localStorage 开关 key：'1' 开启 / '0' 关闭，缺省视为开启 */
export const CARD_PREVIEW_STORAGE_KEY = 'bewly-card-preview'

/** 悬停多久后开始请求预览（毫秒）；用户开启「延迟」时放慢到 1200ms */
export const CARD_PREVIEW_DELAY = 900
export const CARD_PREVIEW_DELAY_DELAYED = 1200

/** 预览最长播放时长（毫秒） */
export const CARD_PREVIEW_MAX_DURATION = 6000

const HOVER_NONE_QUERY = '(hover: none)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function readStoredFlag(): boolean | null {
  try {
    const raw = window.localStorage.getItem(CARD_PREVIEW_STORAGE_KEY)
    if (raw === null)
      return null
    return raw !== '0'
  }
  catch {
    return null
  }
}

/**
 * 卡片预览开关：localStorage 的 `bewly-card-preview`（默认开启）与既有设置
 * `settings.enableVideoPreview` 同时为真时才启用。
 */
export function isCardPreviewEnabled(): boolean {
  if (readStoredFlag() === false)
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
