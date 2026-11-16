import type { PopularTabId, RankRegionDef } from './constants'
import type { PopularVideoItem } from './types'
import type { Video } from '~/components/VideoCard/types'
import { numFormatter } from '~/utils/dataFormatter'
import { POPULAR_TABS, RANK_REGIONS } from './constants'

/** 是否为热门 / 排行榜原生页面（`/v/popular*`，含 weekly / precious / rank） */
export function isPopularPage(url: string = location.href): boolean {
  try {
    const parsed = new URL(url)
    return /(?:^|\.)bilibili\.com$/i.test(parsed.hostname)
      && /^\/v\/popular(?:\/|$)/.test(parsed.pathname)
  }
  catch {
    return false
  }
}

/** 秒数 → mm:ss / h:mm:ss（用于排行列表的时长角标） */
export function formatDuration(seconds?: number): string {
  if (!seconds || seconds < 0)
    return ''
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(secs)}`
    : `${minutes}:${pad(secs)}`
}

/** 播放量 / 弹幕数等计数（跟随界面语言用万/萬/K/M/B） */
export function formatCount(value?: number): string {
  if (!value)
    return '0'
  return numFormatter(value).trim()
}

/** 综合热门卡片的推荐角标（接口里是 `{ content }` 对象） */
export function getRcmdTag(item: PopularVideoItem): string {
  const reason = (item as { rcmd_reason?: string | { content?: string } }).rcmd_reason
  if (!reason)
    return ''
  return typeof reason === 'string'
    ? reason
    : (reason.content ?? '')
}

/** 入站必刷的成就文案（接口里是 `achievement` 字符串） */
export function getAchievementTag(item: PopularVideoItem): string {
  return (item as { achievement?: string }).achievement ?? ''
}

export interface VideoCardOptions {
  /** 序号徽章（热门 / 每周必看 / 排行榜都用它） */
  rank?: number
  /** 封面角标文案 */
  tag?: string
}

/** 把热门 / 排行榜条目转换成 `VideoCard` 需要的结构 */
export function toVideoCard(item: PopularVideoItem, options: VideoCardOptions = {}): Video {
  const tag = options.tag?.trim()
  return {
    id: item.aid,
    aid: item.aid,
    bvid: item.bvid,
    cid: item.cid,
    title: item.title,
    desc: item.desc,
    cover: item.pic,
    duration: item.duration,
    publishedTimestamp: item.pubdate,
    view: item.stat?.view,
    danmaku: item.stat?.danmaku,
    author: {
      name: item.owner?.name,
      authorFace: item.owner?.face,
      mid: item.owner?.mid,
    },
    rank: options.rank,
    tag: tag || undefined,
    // VideoCard 的右键菜单会读这个字段；三连点菜单在热门页没有数据来源，给空数组即可
    threePointV2: [],
  }
}

export interface PageState {
  tab: PopularTabId
  region: RankRegionDef
}

/** 由当前路径解析出「顶层 tab + 排行榜分区」 */
export function resolvePageState(pathname: string): PageState {
  const rankMatch = /^\/v\/popular\/rank(?:\/([^/]+))?/.exec(pathname)
  if (rankMatch) {
    const region = RANK_REGIONS.find(item => item.path.endsWith(`/${rankMatch[1] ?? 'all'}`))
      ?? RANK_REGIONS[0]
    return { tab: 'rank', region }
  }
  if (/^\/v\/popular\/weekly(?:\/|$)/.test(pathname))
    return { tab: 'weekly', region: RANK_REGIONS[0] }
  if (/^\/v\/popular\/precious(?:\/|$)/.test(pathname))
    return { tab: 'precious', region: RANK_REGIONS[0] }
  return { tab: 'popular', region: RANK_REGIONS[0] }
}

/** 顶层 tab 对应的原生路径 */
export function pathForTab(tab: PopularTabId, region: RankRegionDef = RANK_REGIONS[0]): string {
  if (tab === 'rank')
    return region.path
  return POPULAR_TABS.find(item => item.id === tab)?.path ?? POPULAR_TABS[0].path
}

/** 排行榜分区对应的原生路径 */
export function pathForRegion(region: RankRegionDef): string {
  return region.path
}
