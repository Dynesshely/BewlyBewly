import type { ReadListMessages } from './i18n'

import { numFormatter } from '~/utils/dataFormatter'

/** 阅读量 / 点赞数：与全站其它页面一致，跟随界面语言用 万 / 萬 / K / M / B 缩写 */
export function formatCount(value: number | undefined): string {
  if (!value || value < 0)
    return '0'
  return numFormatter(value).trim()
}

/** 秒级时间戳 → 相对时间（1 小时内按分钟、1 天内按小时、7 天内按天），跨年用完整日期 */
export function formatPublishTime(timestamp: number, messages: ReadListMessages, now = Date.now()): string {
  if (!timestamp)
    return ''
  const date = new Date(timestamp * 1000)
  if (Number.isNaN(date.getTime()))
    return ''

  const diff = now - date.getTime()
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff >= 0 && diff < hour) {
    const count = Math.max(1, Math.floor(diff / minute))
    return messages.minutesAgo.replace('{count}', String(count))
  }
  if (diff >= 0 && diff < day) {
    const count = Math.max(1, Math.floor(diff / hour))
    return messages.hoursAgo.replace('{count}', String(count))
  }
  if (diff >= 0 && diff < 7 * day) {
    const count = Math.max(1, Math.floor(diff / day))
    return messages.daysAgo.replace('{count}', String(count))
  }

  const nowDate = new Date(now)
  const month = date.getMonth() + 1
  const dateOfMonth = date.getDate()
  return date.getFullYear() === nowDate.getFullYear()
    ? messages.dateSameYear.replace('{month}', String(month)).replace('{day}', String(dateOfMonth))
    : messages.dateOtherYear
        .replace('{year}', String(date.getFullYear()))
        .replace('{month}', String(month))
        .replace('{day}', String(dateOfMonth))
}
