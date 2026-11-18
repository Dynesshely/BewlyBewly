/**
 * 三个列表页的纯函数：接口条目 → 列表卡片、URL 拼装、日期分组、格式化。
 *
 * 卡片类型直接复用 `views/listShared/types` 的 {@link ListCardItem}：
 * 那是仓库里三个列表页共用的卡片结构（`video` 直接喂给 `~/components/VideoCard`），
 * 自绘版沿用它可以保证卡片外观、快捷操作语义、滚动记忆 / 离屏优化都一致。
 */
import type { ListCardItem, ListCardProgress } from '../listShared/types'
import type { FavResourceApiItem, HistoryApiItem, WatchLaterApiItem } from './types'
import { calcCurrentTime } from '~/utils/dataFormatter'

/** 历史页的日期分组：今天 / 昨天 / 更早（需求明确只要三段） */
export type DateGroupKey = 'today' | 'yesterday' | 'earlier'

/** 今天 / 昨天 / 更早 —— 顺序即渲染顺序 */
export const DATE_GROUP_ORDER: DateGroupKey[] = ['today', 'yesterday', 'earlier']

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** 把时间戳（毫秒）归入 今天 / 昨天 / 更早 */
export function resolveDateGroup(timestamp: number, now = Date.now()): DateGroupKey {
  const todayStart = startOfDay(now)
  if (timestamp >= todayStart)
    return 'today'
  if (timestamp >= todayStart - DAY_MS)
    return 'yesterday'
  return 'earlier'
}

/** 按日期分组；空分组不返回；组内保持传入顺序（调用方已按时间倒序） */
export function groupByDate<T>(
  items: T[],
  getTimestamp: (item: T) => number | undefined,
  now = Date.now(),
): Array<{ key: DateGroupKey, items: T[] }> {
  const buckets: Record<DateGroupKey, T[]> = { today: [], yesterday: [], earlier: [] }
  for (const item of items) {
    const raw = getTimestamp(item)
    const key = typeof raw === 'number' && raw > 0
      ? resolveDateGroup(raw, now)
      : 'earlier'
    buckets[key].push(item)
  }
  return DATE_GROUP_ORDER
    .filter(key => buckets[key].length > 0)
    .map(key => ({ key, items: buckets[key] }))
}

function pad(value: number): string {
  return value < 10
    ? `0${value}`
    : String(value)
}

/** 卡片时间文案：今天 / 昨天只给时:分，更早补上日期 */
export function formatTimeLabel(timestamp: number, now = Date.now()): string {
  const date = new Date(timestamp)
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  const group = resolveDateGroup(timestamp, now)
  if (group === 'today' || group === 'yesterday')
    return clock
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${clock}`
}

/**
 * 把封面地址归一化成 https 绝对地址。
 *
 * 真机返回三种形态：
 *  - `http://i0.hdslb.com/...`（历史 / 稍后再看常见，**明文 http**）
 *  - `//i1.hdslb.com/...`（协议相对）
 *  - `bfs/archive/xxx.jpg`（极少见，相对路径）
 *
 * 页面是 https，混用 http 会被混合内容策略拦掉（封面全白），所以统一升到 https。
 */
export function resolveCoverUrl(raw: string | undefined | null): string {
  if (!raw)
    return ''
  const value = String(raw).trim()
  if (!value)
    return ''
  if (value.startsWith('//'))
    return `https:${value}`
  if (value.startsWith('http://'))
    return `https://${value.slice(7)}`
  if (value.startsWith('https://'))
    return value
  return `https://i0.hdslb.com/${value.replace(/^\/+/, '')}`
}

/**
 * 生成进度信息。
 *
 * 真机语义（历史与稍后再看一致）：`progress === -1` 表示**已看完**，
 * 其余是已看秒数；`duration` 为 0（直播 / 专栏）时不给进度条。
 */
export function buildCardProgress(
  progress: number | undefined,
  duration: number | undefined,
): ListCardProgress | undefined {
  if (!duration || duration <= 0)
    return undefined

  const raw = typeof progress === 'number'
    ? progress
    : 0
  const finished = raw === -1 || raw >= duration
  const watched = finished
    ? duration
    : Math.max(raw, 0)
  return {
    watched: calcCurrentTime(watched),
    total: calcCurrentTime(duration),
    percent: Math.min(100, Math.round((watched / duration) * 100)),
    finished,
  }
}

/** 稍后再看条目的播放地址：真机每条都有 bvid，退回 aid */
export function watchLaterUrl(item: WatchLaterApiItem): string {
  if (item.bvid)
    return `https://www.bilibili.com/video/${item.bvid}`
  if (item.aid)
    return `https://www.bilibili.com/video/av${item.aid}`
  return ''
}

/** 稍后再看条目 → 卡片（时间用 add_at，取不到退回 pubdate） */
export function watchLaterToCard(item: WatchLaterApiItem): ListCardItem {
  const url = watchLaterUrl(item)
  const seconds = item.add_at || item.pubdate
  const timestamp = seconds
    ? seconds * 1000
    : undefined

  return {
    key: `wl-${item.aid ?? item.bvid ?? url}`,
    copyUrl: url,
    timestamp,
    timeLabel: timestamp
      ? formatTimeLabel(timestamp)
      : undefined,
    progress: buildCardProgress(item.progress, item.duration),
    actions: ['copy', 'remove'],
    raw: item,
    video: {
      id: Number(item.aid) || 0,
      title: item.title ?? '',
      cover: resolveCoverUrl(item.pic),
      duration: item.duration,
      url,
      author: item.owner
        ? {
            name: item.owner.name,
            authorFace: resolveCoverUrl(item.owner.face),
            mid: item.owner.mid,
          }
        : undefined,
      view: typeof item.stat?.view === 'number'
        ? item.stat.view
        : undefined,
      danmaku: typeof item.stat?.danmaku === 'number'
        ? item.stat.danmaku
        : undefined,
      publishedTimestamp: item.pubdate || undefined,
      bvid: item.bvid || undefined,
      // 真机每条都带 cid 与 page.cid：直接透传，卡片悬停预览不用再发请求
      cid: item.cid || item.page?.cid || undefined,
      capsuleText: timestamp
        ? formatTimeLabel(timestamp)
        : undefined,
      threePointV2: [],
    },
  }
}

/**
 * 历史条目的地址。
 *
 * 三种 business 的地址不同（真机字段）：
 *  - archive：`/video/${bvid}?p=${page}`（分 P 时带页码）
 *  - live：`https://live.bilibili.com/${oid}`
 *  - article / article-list：`/read/cv${cid 或 oid}`
 *
 * 优先用接口自带的 `uri`（原生页面就是用它跳转的），没有再自己拼。
 */
export function historyUrl(item: HistoryApiItem): string {
  if (item.uri)
    return item.uri
  const business = item.history?.business
  const oid = Number(item.history?.oid ?? 0)
  if (business === 'archive') {
    const bvid = item.history?.bvid
    if (!bvid) {
      return oid
        ? `https://www.bilibili.com/video/av${oid}`
        : ''
    }
    const page = Number(item.history?.page) || 1
    return page > 1
      ? `https://www.bilibili.com/video/${bvid}?p=${page}`
      : `https://www.bilibili.com/video/${bvid}`
  }
  if (business === 'live')
    return `https://live.bilibili.com/${oid}`
  if (business === 'article' || business === 'article-list') {
    const cid = Number(item.history?.cid ?? 0)
    return `https://www.bilibili.com/read/cv${cid || oid}`
  }
  return ''
}

/** 历史条目封面：专栏优先 covers[0]（真机 covers 可能是 null，不能直接取 [0]） */
export function historyCover(item: HistoryApiItem): string {
  const business = item.history?.business
  if ((business === 'article' || business === 'article-list') && item.covers && item.covers.length)
    return resolveCoverUrl(item.covers[0])
  return resolveCoverUrl(item.cover)
}

/** 历史条目的稳定 key：business + oid（与删除接口的 kid 同源） */
export function historyKey(item: HistoryApiItem): string {
  const business = item.history?.business || 'archive'
  const oid = item.history?.oid ?? item.kid ?? 0
  return `h-${business}-${oid}`
}

/** 历史条目 → 卡片（时间用 view_at；进度只对视频 / 番剧给） */
export function historyToCard(item: HistoryApiItem): ListCardItem {
  const url = historyUrl(item)
  const business = item.history?.business
  const playable = business === 'archive' || business === 'pgc'
  const timestamp = item.view_at
    ? item.view_at * 1000
    : undefined

  return {
    key: historyKey(item),
    copyUrl: url,
    timestamp,
    timeLabel: timestamp
      ? formatTimeLabel(timestamp)
      : undefined,
    progress: playable
      ? buildCardProgress(item.progress, item.duration)
      : undefined,
    actions: ['watchLater', 'copy', 'remove'],
    raw: item,
    video: {
      id: Number(item.history?.oid ?? item.kid ?? 0),
      title: item.show_title || item.title || '',
      cover: historyCover(item),
      duration: playable ? item.duration : undefined,
      url,
      author: item.author_name
        ? {
            name: item.author_name,
            authorFace: resolveCoverUrl(item.author_face),
            mid: item.author_mid,
          }
        : undefined,
      capsuleText: timestamp
        ? formatTimeLabel(timestamp)
        : undefined,
      // 普通投稿透传 bvid / cid 供悬停预览；直播 / 专栏的 playurl 语义不同，不下发
      bvid: business === 'archive'
        ? (item.history?.bvid || undefined)
        : undefined,
      cid: business === 'archive'
        ? (item.history?.cid || undefined)
        : undefined,
      threePointV2: [],
    },
  }
}

/** 收藏条目是否已失效（真机 attr=9，标题是「已失效视频」） */
export function isFavResourceInvalid(item: FavResourceApiItem): boolean {
  return Number(item.attr) === 9
}

/**
 * 收藏条目是不是音频（原版页面用 `link.startsWith('bilibili://music')` 判断）。
 *
 * 收藏夹里可能混有音乐，它的 id 是音频 id 而不是 aid，按视频地址拼会 404。
 */
export function isFavResourceAudio(item: FavResourceApiItem): boolean {
  return typeof item.link === 'string' && item.link.includes('bilibili://music')
}

/** 收藏条目播放地址：失效条目不给地址（点进去只会 404）；音频走 au 地址 */
export function favResourceUrl(item: FavResourceApiItem): string {
  if (isFavResourceInvalid(item))
    return ''
  if (isFavResourceAudio(item)) {
    return item.id
      ? `https://www.bilibili.com/audio/au${item.id}`
      : ''
  }
  if (item.bvid)
    return `https://www.bilibili.com/video/${item.bvid}`
  if (item.id)
    return `https://www.bilibili.com/video/av${item.id}`
  return ''
}

/** 收藏条目 → 卡片（时间用 fav_time） */
export function favResourceToCard(item: FavResourceApiItem): ListCardItem {
  const url = favResourceUrl(item)
  const timestamp = item.fav_time
    ? item.fav_time * 1000
    : undefined
  const invalid = isFavResourceInvalid(item)

  return {
    key: `f-${item.id ?? url}`,
    copyUrl: url,
    timestamp,
    timeLabel: timestamp
      ? formatTimeLabel(timestamp)
      : undefined,
    actions: invalid
      ? ['remove']
      : ['watchLater', 'copy', 'unfavorite'],
    raw: item,
    video: {
      id: Number(item.id) || 0,
      title: item.title || (invalid ? '已失效视频' : ''),
      cover: resolveCoverUrl(item.cover),
      duration: invalid ? undefined : item.duration,
      url: url || undefined,
      author: item.upper
        ? {
            name: item.upper.name,
            authorFace: resolveCoverUrl(item.upper.face),
            mid: item.upper.mid,
          }
        : undefined,
      view: item.cnt_info?.play,
      danmaku: item.cnt_info?.danmaku,
      publishedTimestamp: item.pubtime || undefined,
      bvid: invalid
        ? undefined
        : (item.bvid || undefined),
      cid: invalid
        ? undefined
        : (item.ugc?.first_cid || undefined),
      capsuleText: timestamp
        ? formatTimeLabel(timestamp)
        : undefined,
      threePointV2: [],
    },
  }
}

/** 关键词匹配（历史 / 收藏的前端过滤：标题 + UP 主 + 分区 / 简介） */
export function matchesKeyword(fields: Array<string | undefined | null>, keyword: string): boolean {
  const needle = keyword.trim().toLowerCase()
  if (!needle)
    return true
  return fields
    .filter((field): field is string => Boolean(field))
    .join(' ')
    .toLowerCase()
    .includes(needle)
}
