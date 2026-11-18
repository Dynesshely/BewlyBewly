/**
 * 首页推荐流（自绘）的纯函数层：路由判定、条目归一化、去重、是否还有下一页。
 *
 * 全部是无副作用的纯函数，方便真机断言与以后的单测。
 */
import type { HomeFeedItem } from './types'
import type { Author, Video } from '~/components/VideoCard/types'
import {
  HOME_GOTO_AD,
  HOME_GOTO_BANGUMI,
  HOME_GOTO_LIVE,
  HOME_LIVE_BASE_URL,
  HOME_MAX_PAGES,
  HOME_VIDEO_BASE_URL,
} from './constants'

/**
 * 是否首页（`www.bilibili.com` 根路径）。
 *
 * 与 `~/utils/page.ts` 的 `isHomePage()` 语义一致，但**只认根路径**，
 * 不接受内嵌 iframe：本模块接管的是整页，抽屉里的首页必须保持原样。
 */
export function isHomeDrawnPath(
  pathname: string = location.pathname,
  search: string = location.search,
  hostname: string = location.hostname,
): boolean {
  if (!/^(?:www\.)?bilibili\.com$/i.test(hostname))
    return false
  if (pathname !== '/' && pathname !== '/index.html')
    return false
  // `?page=Search` 这类是 Bewly 自己的 dock 参数，仍在首页上；`spm_id_from` 也一样
  const params = new URLSearchParams(search)
  const page = params.get('page')
  if (page && page !== 'Home')
    return false
  return true
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
 * 是否是广告卡片。
 *
 * 真机：广告条目的 `goto === 'ad'`，且 `id=0`、`bvid=''`、`title=''`、
 * 真正的素材在 `business_info` 里。不过滤会在网格里留下一个三无空卡。
 */
export function isAdItem(item: HomeFeedItem): boolean {
  if (item.goto === HOME_GOTO_AD)
    return true
  // 兜底：没有 bvid、没有 goto 视频语义、没有标题的一律当作广告 / 无内容
  return !item.bvid && !item.title && !item.room_info
}

/** 条目是否有可展示的内容（标题 + 封面/直播封面至少有一个） */
export function isRenderableItem(item: HomeFeedItem): boolean {
  if (isAdItem(item))
    return false
  const cover = item.pic || item.room_info?.show?.cover
  return Boolean(item.title) && Boolean(cover) && (Boolean(item.bvid) || Boolean(item.room_info?.room_id))
}

/** 条目的稳定键（去重：优先 bvid，其次直播房间号，最后 aid） */
export function videoKey(item: HomeFeedItem): string {
  if (item.bvid)
    return item.bvid
  const roomId = item.room_info?.room_id
  if (roomId)
    return `live${roomId}`
  return `av${item.id ?? ''}`
}

/** 追加去重：服务端偶发回同一条（真机相邻两页重叠 0，但同参数重拉会有少量重复） */
export function appendItems(current: HomeFeedItem[], incoming: HomeFeedItem[]): HomeFeedItem[] {
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
 * 接口**没有**「到底」信号（真机翻 30 页不断流、不重复），所以停止条件只有：
 *   1. 这一页过滤后**一条可展示的都没有**（例如整页都是广告 / 接口异常回空）；
 *   2. 已经达到单次会话上限 {@link HOME_MAX_PAGES}。
 *
 * 之所以不用「不满一页就到底」：`ps=12` 里恒有 2 条广告，过滤后**永远只有 10 条**，
 * 拿 `items.length < ps` 判断会立刻误判成「到底」。
 */
export function hasMorePages(freshIdx: number, renderableCount: number): boolean {
  if (renderableCount === 0)
    return false
  return freshIdx < HOME_MAX_PAGES
}

/** 当前页下一页的 `fresh_idx`（接口语义：每页 +1，真机相邻页视频重叠 0/12） */
export function nextFreshIdx(freshIdx: number): number {
  return freshIdx + 1
}

/** 发布日期文案要的是秒级时间戳，接口本来就给秒；0 视为未知 */
function normalizeTimestamp(seconds?: number): number | undefined {
  const value = Number(seconds)
  if (!Number.isFinite(value) || value <= 0)
    return undefined
  return Math.floor(value)
}

/**
 * 接口条目 → `VideoCard` 需要的结构。
 *
 * 卡片要的六件事都给全：封面（组件自己裁 16:9）/ 标题（组件两行截断）/
 * UP（`author`）/ 播放量（`view`，组件走 `numFormatter` 出「万 / 亿」）/
 * 时长（`duration` 秒）/ 发布时间（`publishedTimestamp` 秒，组件出「N 天前」）。
 *
 * - `view` 显式给 bvid，让 `VideoCard` 的「稍后再看 / 点赞 / 收藏」能定位资源；
 * - `id` 用接口的 `id`（= aid，真机验证），快捷操作条据此直接发写请求，
 *   不需要额外 `getVideoInfo` 反查；
 * - 直播卡片（`goto === 'live'`）走 `url` + `liveStatus`，卡片会显示 LIVE 角标；
 * - `reason` 只在接口真的给了 `rcmd_reason.content` 时才填（真机常常只有 `reason_type`）。
 */
export function toVideoCard(item: HomeFeedItem): Video {
  const isLive = item.goto === HOME_GOTO_LIVE || Boolean(item.room_info?.room_id)
  const isBangumi = item.goto === HOME_GOTO_BANGUMI
  const roomId = item.room_info?.room_id
  const cover = isLive
    ? (item.room_info?.show?.cover || item.pic)
    : item.pic

  const author: Author = {
    name: item.owner?.name ?? '',
    // 尺寸后缀由 VideoCardAuthorAvatar / Picture 自己拼（再带一个 @ 会变成双后缀）
    authorFace: normalizeUrl(item.owner?.face),
    mid: item.owner?.mid,
    followed: Boolean(item.is_followed),
    authorUrl: item.owner?.mid
      ? `https://space.bilibili.com/${item.owner.mid}`
      : undefined,
  }

  const url = isLive && roomId
    ? `${HOME_LIVE_BASE_URL}/${roomId}`
    : normalizeUrl(item.uri)
      || (item.bvid
        ? `${HOME_VIDEO_BASE_URL}/${item.bvid}`
        : '')

  return {
    // 直播卡片的 id 是房间号之外的直播 id，写操作（稍后再看）对直播无意义，
    // 由 VideoCardQuickActions 自己按 liveStatus / roomid 关掉这几个按钮。
    id: item.id ?? 0,
    aid: item.id,
    bvid: item.bvid || undefined,
    cid: item.cid,
    title: item.title ?? '',
    // 注意：**不要**在这里拼 `@672w_…` 尺寸参数 —— VideoCard 会自己拼一次，
    // 双后缀会让 B 站图片服务返回 4xx（views/Space 的 toVideoCard 同样只做协议补全）
    cover: normalizeUrl(cover),
    duration: isLive
      ? undefined
      : (typeof item.duration === 'number' && item.duration > 0
          ? item.duration
          : undefined),
    publishedTimestamp: normalizeTimestamp(item.pubdate),
    view: item.stat?.view,
    danmaku: item.stat?.danmaku,
    reason: item.rcmd_reason?.content || undefined,
    author,
    goto: item.goto,
    url,
    liveStatus: isLive
      ? (item.room_info?.live_status ?? 1)
      : undefined,
    roomid: roomId,
    type: isBangumi ? 'bangumi' : undefined,
    // 右键菜单会读这个字段；本项目没有 app 端的三连点数据来源，给空数组即可
    threePointV2: [],
  }
}

/** 一页原始条目 → 可展示的卡片数据（过滤广告 / 无内容条目） */
export function normalizePageItems(items: HomeFeedItem[]): HomeFeedItem[] {
  return items.filter(isRenderableItem)
}
