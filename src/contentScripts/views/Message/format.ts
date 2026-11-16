/**
 * 会话时间格式化：今天 → HH:mm；昨天 → 昨天；今年 → MM-DD；更早 → YYYY-MM-DD。
 */
function pad(value: number): string {
  return value < 10
    ? `0${String(value)}`
    : String(value)
}

export function formatSessionTime(seconds: number | null, labels: { yesterday: string }): string {
  if (!seconds)
    return ''
  const date = new Date(seconds * 1000)
  if (Number.isNaN(date.getTime()))
    return ''

  const now = new Date()
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
  if (sameDay)
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const isYesterday = date.getFullYear() === yesterday.getFullYear()
    && date.getMonth() === yesterday.getMonth()
    && date.getDate() === yesterday.getDate()
  if (isYesterday)
    return labels.yesterday

  const monthDay = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return date.getFullYear() === now.getFullYear()
    ? monthDay
    : `${String(date.getFullYear())}-${monthDay}`
}
