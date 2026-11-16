/**
 * 直播页自绘模块的数据获取。
 *
 * 数据来源都是 B 站页面自己就在用的同源接口（真机 CDP 抓包确认）：
 *   - 首页推荐流：`/xlive/web-interface/v1/index/getListV2?platform=web&page=N`
 *     （返回 `list` 卡片、`area_list` 分区、`has_more`）；
 *   - 直播间信息：`/xlive/web-room/v1/index/getInfoByRoom?room_id=N`
 *     （`room_info` / `anchor_info` / `popularity` / `like_info_v3` / `watched_show`）；
 *   - 直播间推荐的其它直播间：`/xlive/web-interface/v1/index/recList?landing_room_id=N`；
 *   - 关注状态：`https://api.bilibili.com/x/relation?fid=<uid>`（只读，不写）。
 *
 * 请求一律带 cookie（`credentials: 'include'`），与页面自身请求一致；失败统一抛错，
 * 由组件层展示错误态并回退到原生页面，不在模块里吞掉异常。
 */
import type { FollowState, LiveAreaTab, LiveHomeFeed, LiveRoomCard, LiveRoomDetail } from './types'

const LIVE_API_ORIGIN = 'https://api.live.bilibili.com'
const BILI_API_ORIGIN = 'https://api.bilibili.com'
const REQUEST_TIMEOUT = 12_000
/** 首页接口的 web_location（真机抓包值，缺失时接口仍可用，带上更贴近原生） */
const HOME_WEB_LOCATION = '444.7'
const ROOM_WEB_LOCATION = '444.8'

interface RawResponse<T> {
  code?: number
  message?: string
  data?: T
}

/** 直连 B 站接口：超时 / HTTP 错误 / 非 0 code / 空 data 一律抛错 */
async function requestJson<T>(origin: string, path: string): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    const response = await fetch(`${origin}${path}`, {
      credentials: 'include',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok)
      throw new Error(`HTTP ${response.status}`)
    const payload = await response.json() as RawResponse<T>
    if (payload.code !== 0)
      throw new Error(payload.message || `API code ${String(payload.code)}`)
    if (payload.data === undefined || payload.data === null)
      throw new Error('API returned no data')
    return payload.data
  }
  finally {
    window.clearTimeout(timer)
  }
}

// #region 原始响应结构（只声明用到的字段）
interface RawRoomItem {
  roomid?: number
  uid?: number
  uname?: string
  face?: string
  title?: string
  cover?: string
  keyframe?: string
  online?: number
  area_v2_name?: string
  area_v2_parent_name?: string
  watched_show?: { text_small?: string } | null
}

interface RawAreaItem {
  name?: string
  link?: string
  sub_list?: RawAreaItem[] | null
}

interface RawHomeList {
  list?: (RawRoomItem | null)[] | null
  area_list?: RawAreaItem[] | null
  recommend_room_list?: (RawRoomItem | null)[] | null
  has_more?: number | boolean
}

interface RawRoomInfo {
  room_id?: number
  uid?: number
  title?: string
  live_status?: number
  online?: number
  area_name?: string
  parent_area_name?: string
}

interface RawRoomInfoPayload {
  room_info?: RawRoomInfo | null
  anchor_info?: {
    base_info?: { uname?: string, face?: string } | null
    relation_info?: { attention?: number } | null
  } | null
  popularity?: { popularity?: number } | null
  like_info_v3?: { total_likes?: number } | null
  watched_show?: { text_small?: string } | null
}

interface RawRecList {
  list?: (RawRoomItem | null)[] | null
}

interface RawRelation {
  attribute?: number
}
// #endregion

// #region 归一化
/** 接口卡片 → 组件卡片；返回 null 表示这条数据不可用 */
function normalizeCard(raw: RawRoomItem | null | undefined): LiveRoomCard | null {
  if (!raw?.roomid)
    return null
  return {
    roomId: raw.roomid,
    uid: raw.uid ?? 0,
    uname: raw.uname ?? '',
    face: raw.face ?? '',
    title: raw.title ?? '',
    cover: raw.cover ?? raw.keyframe ?? '',
    areaName: raw.area_v2_name ?? '',
    parentAreaName: raw.area_v2_parent_name ?? '',
    online: raw.online ?? 0,
    watchedText: raw.watched_show?.text_small ?? '',
  }
}

function normalizeCards(raw: (RawRoomItem | null)[] | null | undefined): LiveRoomCard[] {
  if (!Array.isArray(raw))
    return []
  const seen = new Set<number>()
  const cards: LiveRoomCard[] = []
  for (const item of raw) {
    const card = normalizeCard(item)
    if (!card || seen.has(card.roomId))
      continue
    seen.add(card.roomId)
    cards.push(card)
  }
  return cards
}

/** 分区链接 → pill；接口给的是绝对地址，缺失时退回原生分区页 */
function normalizeAreas(raw: RawAreaItem[] | null | undefined): LiveAreaTab[] {
  if (!Array.isArray(raw))
    return []
  return raw
    .filter((item): item is RawAreaItem => Boolean(item?.name))
    .map(item => ({
      name: item.name ?? '',
      href: item.link || `https://live.bilibili.com/p/eden/area-tags?parentAreaId=0&areaId=0`,
      subs: normalizeAreas(item.sub_list),
    }))
}
// #endregion

/** 首页一页推荐流 */
export async function fetchHomeFeed(page: number, pageSize: number): Promise<LiveHomeFeed> {
  const query = new URLSearchParams({
    platform: 'web',
    page: String(page),
    page_size: String(pageSize),
    web_location: HOME_WEB_LOCATION,
  })
  const data = await requestJson<RawHomeList>(
    LIVE_API_ORIGIN,
    `/xlive/web-interface/v1/index/getListV2?${query.toString()}`,
  )
  return {
    list: normalizeCards(data.list),
    areas: normalizeAreas(data.area_list),
    hasMore: Boolean(data.has_more),
  }
}

/** 直播间顶部信息 */
export async function fetchRoomDetail(roomId: number | string): Promise<LiveRoomDetail> {
  const data = await requestJson<RawRoomInfoPayload>(
    LIVE_API_ORIGIN,
    `/xlive/web-room/v1/index/getInfoByRoom?room_id=${String(roomId)}`,
  )
  const room = data.room_info ?? {}
  const anchor = data.anchor_info ?? {}
  const base = anchor.base_info ?? {}
  const areaName = room.area_name ?? ''
  const parentAreaName = room.parent_area_name ?? ''
  return {
    roomId: room.room_id ?? Number(roomId),
    uid: room.uid ?? 0,
    uname: base.uname ?? '',
    face: base.face ?? '',
    title: room.title ?? '',
    areaName,
    parentAreaName,
    live: room.live_status === 1,
    online: data.popularity?.popularity ?? room.online ?? 0,
    watchedText: data.watched_show?.text_small ?? '',
    likes: data.like_info_v3?.total_likes ?? 0,
    followers: anchor.relation_info?.attention ?? 0,
  }
}

/** 直播间侧栏的「推荐直播」（同一分区的其它直播间） */
export async function fetchRoomRecommend(roomId: number | string): Promise<LiveRoomCard[]> {
  const query = new URLSearchParams({
    platform: 'web',
    from: 'index',
    page: '1',
    landing_room_id: String(roomId),
    web_location: ROOM_WEB_LOCATION,
  })
  const data = await requestJson<RawRecList>(
    LIVE_API_ORIGIN,
    `/xlive/web-interface/v1/index/recList?${query.toString()}`,
  )
  return normalizeCards(data.list).filter(card => String(card.roomId) !== String(roomId))
}

/**
 * 关注状态。
 *
 * `x/relation` 的 `attribute`：0 未关注、2 已关注、6 互相关注、128 拉黑。
 * 查询失败返回 null（按钮显示中性态），不抛错——关注状态读不到不该让顶部栏整体失败。
 */
export async function fetchFollowState(uid: number): Promise<FollowState> {
  if (!uid)
    return null
  try {
    const data = await requestJson<RawRelation>(BILI_API_ORIGIN, `/x/relation?fid=${String(uid)}`)
    const attribute = data.attribute ?? 0
    return attribute === 2 || attribute === 6
  }
  catch (error) {
    console.warn('[BewlyBewly] 直播关注状态读取失败', error)
    return null
  }
}
