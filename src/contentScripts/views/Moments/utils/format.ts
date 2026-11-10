import type { MomentsLocale, MomentsMessageKey } from '../i18n'
/**
 * 动态页模块内的格式化工具。
 *
 * 所有文案走模块内 i18n（`i18n.ts`），因此这里只接收 `t` 与 locale，
 * 不依赖全局 `src/_locales`。
 */
import type { MomentCardType } from '../types'

type Translate = (key: MomentsMessageKey, params?: Record<string, string | number>) => string

const ZH_UNITS = [
  { value: 1e8, symbol: '亿' },
  { value: 1e4, symbol: '万' },
]

const EN_UNITS = [
  { value: 1e9, symbol: 'B' },
  { value: 1e6, symbol: 'M' },
  { value: 1e3, symbol: 'K' },
]

function trimTrailingZero(text: string): string {
  return text.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
}

/** 播放量 / 互动数的紧凑写法：12345 → 1.2万（简中） / 12.3K（英文） */
export function formatCount(value: number | string | undefined, locale: MomentsLocale): string {
  const number = typeof value === 'number'
    ? value
    : Number.parseFloat(String(value ?? '').replace(/,/g, ''))
  if (!Number.isFinite(number) || number <= 0)
    return '0'

  const units = locale === 'en'
    ? EN_UNITS
    : ZH_UNITS
  for (const unit of units) {
    if (number >= unit.value)
      return `${trimTrailingZero((number / unit.value).toFixed(1))}${unit.symbol}`
  }
  return String(Math.round(number))
}

function pad2(value: number): string {
  return value < 10
    ? `0${value}`
    : String(value)
}

/** 绝对日期（超过 30 天时使用） */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime()))
    return ''
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** 相对时间：刚刚 / n 分钟前 / n 小时前 / n 天前 / 绝对日期 */
export function formatRelativeTime(timestamp: number, t: Translate): string {
  if (!timestamp || !Number.isFinite(timestamp))
    return ''

  const diff = Date.now() - timestamp
  if (diff < 0)
    return t('just_now')

  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute)
    return t('just_now')
  if (diff < hour) {
    return t('minutes_ago', {
      n: Math.floor(diff / minute),
    })
  }
  if (diff < day) {
    return t('hours_ago', {
      n: Math.floor(diff / hour),
    })
  }
  if (diff < 30 * day) {
    return t('days_ago', {
      n: Math.floor(diff / day),
    })
  }
  return t('date_at', {
    date: formatDate(timestamp),
  })
}

/** 卡片类型文案的 i18n key */
export function typeMessageKey(type: MomentCardType): MomentsMessageKey {
  return `type_${type}` as MomentsMessageKey
}
