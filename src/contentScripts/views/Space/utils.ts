/**
 * 空间页（自绘）的纯函数层：路由解析、接口条目 → `VideoCard`、去重、格式化。
 *
 * 全部是无副作用的纯函数，方便真机断言与以后的单测。
 */
import type { ArcSearchItem, SpaceRelationStat, SpaceUpInfo } from './types'
import type { Author, Video } from '~/components/VideoCard/types'
import { NATIVE_SPACE_BASE_URL } from './constants'

/** 空间页各类子路由（`/2`、`/2/upload`、`/2/dynamic`…） */
const SPACE_PATH_RE = /^\/(\d+)(?:\/([^/?#]+))?/

/**
 * 从 `location.pathname` 解析 UP 的 mid。
 *
 * 真机确认：主空间页是 `/2`、`/2/upload`、`/2/lists` 这类；`/v/note-list` 是笔记页，
 * 没有视频列表，返回 null（不接管）。
 */
export function parseSpaceMid(pathname: string = location.pathname, hostname: string = location.hostname): number | null {
  if (!/(?:^|\.)space\.bilibili\.com$/i.test(hostname))
    return null
  if (/^\/v\/note-list/.test(pathname))
    return null
  const matched = SPACE_PATH_RE.exec(pathname)
  if (!matched)
    return null
  const mid = Number.parseInt(matched[1], 10)
  return Number.isFinite(mid) && mid > 0
    ? mid
    : null
}

/** 空间页子路由的 slug（`/2/upload` → `upload`；`/2` → 空串） */
export function parseSpaceTab(pathname: string = location.pathname): string {
  const matched = SPACE_PATH_RE.exec(pathname)
  return matched?.[2] ?? ''
}

/**
 * 本模块只在「主页」（`/<mid>`）接管。
 *
 * 原生空间页的其它子路由（动态 / 投稿 / 合集 / 追番 / 关注粉丝）各是一套完全不同的布局，
 * 本轮只做主页视频列表；其它子路由**完全不接管**，保证原生页面可用。
 */
export function isSpaceHomePath(pathname: string = location.pathname): boolean {
  return parseSpaceTab(pathname) === ''
}

/** 接口里的图片地址统一补成绝对地址（真机有 `//` 与 `http://` 两种） */
export function normalizeUrl(url?: string): string {
  if (!url)
    return ''
  if (url.startsWith('//'))
    return `https:${url}`
  return url
}

/**
 * `length` 字段（"24:11"）→ 秒。
 *
 * `VideoCard` 的时长角标优先用 `duration`（数字，走 `calcCurrentTime`），
 * 没有数字时退回 `durationStr`；这里两个都给，保证角标一定能显示。
 */
export function parseDuration(length?: string): number | undefined {
  if (!length)
    return undefined
  const parts = length.split(':').map(part => Number.parseInt(part, 10))
  if (parts.some(part => !Number.isFinite(part)))
    return undefined
  if (parts.length === 3)
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2)
    return parts[0] * 60 + parts[1]
  return undefined
}

/** 当前页面 UP 的最小信息（用来补 `arc/search` 不返回的字段） */
export interface SpaceUpBrief {
  mid?: number
  name?: string
  face?: string
}

/**
 * `arc/search` 条目 → `VideoCard` 需要的结构。
 *
 * 卡片要的六件事都给全：封面（组件自己裁 16:9）/ 标题（组件两行截断）/
 * UP（`author`）/ 播放量（`view`，组件走 `numFormatter` 出「万 / 亿」）/
 * 时长（`duration` 秒）/ 发布时间（`publishedTimestamp` 秒，组件出「N 天前」）。
 *
 * `authorFace`：`arc/search` 不返回头像，用**当前页面 UP 的头像**兜底
 * （本页所有投稿都属于这个 UP，语义正确，也避免掉进「空 src 的破图请求」）。
 * `authorUrl` 显式给空间页地址，避免组件按 `mid` 拼出 `//space.bilibili.com/...`
 * 与站点协议不一致。
 */
export function toVideoCard(item: ArcSearchItem, up: SpaceUpBrief | null): Video {
  const author: Author = {
    name: item.author || up?.name || '',
    mid: item.mid ?? up?.mid,
    authorFace: up?.face
      ? normalizeUrl(up.face)
      : '',
    authorUrl: `${NATIVE_SPACE_BASE_URL}/${item.mid ?? up?.mid ?? ''}`,
  }
  return {
    id: item.aid ?? 0,
    aid: item.aid,
    bvid: item.bvid,
    title: item.title ?? '',
    desc: item.description,
    cover: normalizeUrl(item.pic),
    duration: parseDuration(item.length),
    durationStr: item.length,
    publishedTimestamp: item.created,
    view: item.play,
    danmaku: item.video_review,
    author,
    // 右键菜单会读这个字段；空间页接口没有三连点数据来源，给空数组即可
    threePointV2: [],
  }
}

/** 条目的稳定键（去重：优先 bvid，其次 aid） */
export function videoKey(item: ArcSearchItem): string {
  return item.bvid || `av${item.aid ?? ''}`
}

/** 追加去重：接口相邻两页偶发回同一条（尤其是刚投的稿） */
export function appendVideos(current: ArcSearchItem[], incoming: ArcSearchItem[]): ArcSearchItem[] {
  const seen = new Set(current.map(videoKey))
  const merged = [...current]
  for (const item of incoming) {
    const key = videoKey(item)
    if (seen.has(key))
      continue
    seen.add(key)
    merged.push(item)
  }
  return merged
}

/**
 * 是否还有下一页。
 *
 * 主判据是页码：**`pn > ceil(count / ps)` 时停止**（`count` = 接口 `data.page.count`，
 * 也就是该 UP 的总投稿数）。真机验证：mid=2 时 count=43、ps=20 → 共 3 页，
 * 第 3 页只回 3 条，第 4 页为空。
 *
 * 之所以用页码而不是「已加载条数」：`appendVideos` 会去掉相邻页的重复条目，
 * 用条数判断会低估、多拉一页；用页码判断与接口分页语义一致。
 *
 * 接口没给 `count`（=0）时退化为「这一页不满就到底」+「空页就到底」。
 */
export function hasMorePages(pn: number, ps: number, total: number, lastPageCount: number): boolean {
  if (lastPageCount === 0)
    return false
  if (total > 0)
    return pn < Math.ceil(total / ps)
  return lastPageCount >= ps
}

/**
 * UP 头图地址（自绘页顶部背景）。
 *
 * 优先 `top_photo_v2.l_200h_img`（原生空间页用的就是 200 高度裁切版），
 * 其次 `l_img`，最后退回旧字段 `top_photo`（真机是 `bfs/space/xxx.png` 相对路径，
 * 要补 `https://i0.hdslb.com/`）。
 *
 * 都没有时返回空串 —— 页面不渲染头图，只留页面底色（与改动前的深色底一致）。
 */
export function bannerUrl(info: SpaceUpInfo | null): string {
  const v2 = info?.top_photo_v2
  const fromV2 = normalizeUrl(v2?.l_200h_img || v2?.l_img)
  if (fromV2)
    return fromV2
  const legacy = info?.top_photo
  if (!legacy)
    return ''
  return legacy.startsWith('http') || legacy.startsWith('//')
    ? normalizeUrl(legacy)
    : `https://i0.hdslb.com/${legacy.replace(/^\/+/, '')}`
}

/** 头像地址补尺寸参数（真机原生用的是 `@128w_128h_1c_1s`） */
export function faceWithSize(face: string, size = 128): string {
  const url = normalizeUrl(face)
  if (!url)
    return ''
  return url.includes('@')
    ? url
    : `${url}@${size}w_${size}h_1c_1s`
}

/**
 * 认证文案：机构认证用 `title`（真机是「bilibili创始人（站长）」），
 * 个人认证用 `title` 或 `desc`；未认证返回空串（整行不渲染）。
 */
export function officialText(info: SpaceUpInfo | null): string {
  const official = info?.official
  if (!official || !official.type)
    return ''
  const title = (official.title ?? '').trim()
  const desc = (official.desc ?? '').trim()
  return title || desc
}

/** 粉丝 / 关注数：接口失败时返回 null，页面据此隐藏这两项而不是显示 0 */
export function normalizeRelationStat(raw: unknown): SpaceRelationStat | null {
  if (!raw || typeof raw !== 'object')
    return null
  const data = raw as { follower?: unknown, following?: unknown }
  const follower = Number(data.follower)
  const following = Number(data.following)
  if (!Number.isFinite(follower) || !Number.isFinite(following))
    return null
  return { follower, following }
}
