import type { ListCardItem, ListCardProgress, ListSortMode, ListTimeGroupKey } from './types'

import { calcCurrentTime } from '~/utils/dataFormatter'

const DAY_MS = 24 * 60 * 60 * 1000

/** 时间分组在界面上的顺序 */
export const TIME_GROUP_ORDER: ListTimeGroupKey[] = [
  'today',
  'yesterday',
  'thisWeek',
  'earlier',
]

export interface TimeGroup<T> {
  key: ListTimeGroupKey
  items: T[]
}

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** 以周一为一周起点，与「本周」的日常理解一致 */
function startOfWeek(timestamp: number): number {
  const dayStart = startOfDay(timestamp)
  const weekday = (new Date(dayStart).getDay() + 6) % 7
  return dayStart - weekday * DAY_MS
}

/** 把时间戳（毫秒）归入 今天 / 昨天 / 本周 / 更早 */
export function resolveTimeGroup(timestamp: number, now = Date.now()): ListTimeGroupKey {
  const todayStart = startOfDay(now)
  if (timestamp >= todayStart)
    return 'today'
  if (timestamp >= todayStart - DAY_MS)
    return 'yesterday'
  if (timestamp >= startOfWeek(now))
    return 'thisWeek'
  return 'earlier'
}

/** 按时间分组，空分组不返回 */
export function groupItemsByTime<T>(items: T[], getTimestamp: (item: T) => number | undefined): TimeGroup<T>[] {
  const buckets: Record<ListTimeGroupKey, T[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  }

  for (const item of items) {
    const raw = getTimestamp(item)
    const key = typeof raw === 'number' && raw > 0
      ? resolveTimeGroup(raw)
      : 'earlier'
    buckets[key].push(item)
  }

  const groups: TimeGroup<T>[] = []
  for (const key of TIME_GROUP_ORDER) {
    if (buckets[key].length > 0)
      groups.push({ key, items: buckets[key] })
  }
  return groups
}

function pad(value: number): string {
  return value < 10
    ? `0${value}`
    : String(value)
}

/** 时间轴文案：今天 / 昨天只显示时:分，更早的补上日期 */
export function formatTimeLabel(timestamp: number, now = Date.now()): string {
  const date = new Date(timestamp)
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  const group = resolveTimeGroup(timestamp, now)
  if (group === 'today' || group === 'yesterday')
    return clock
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${clock}`
}

/** 生成进度信息：progress 为 -1 表示已看完 */
export function buildProgress(progress: number, duration: number): ListCardProgress | undefined {
  if (!duration || duration <= 0)
    return undefined

  const watched = progress === -1
    ? duration
    : Math.min(Math.max(progress ?? 0, 0), duration)
  return {
    watched: calcCurrentTime(watched),
    total: calcCurrentTime(duration),
    percent: Math.round((watched / duration) * 100),
    finished: progress === -1 || watched >= duration,
  }
}

/**
 * 排序。默认按时间倒序（保持接口返回顺序的思路），
 * 时长与标题排序只作用于已加载的条目。
 */
export function sortListItems(items: ListCardItem[], mode: ListSortMode): ListCardItem[] {
  const sorted = [...items]
  if (mode === 'duration')
    sorted.sort((a, b) => (b.video.duration ?? 0) - (a.video.duration ?? 0))
  else if (mode === 'title')
    sorted.sort((a, b) => a.video.title.localeCompare(b.video.title, 'zh-Hans-CN'))
  else
    sorted.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
  return sorted
}
