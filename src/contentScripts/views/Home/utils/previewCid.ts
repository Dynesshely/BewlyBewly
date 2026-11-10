/**
 * 从首页各子标签的接口原始数据里读 cid（用于视频卡悬停预览）。
 *
 * 背景：首页「推荐 / 热门 / 排行」的映射已经带了 cid；「关注 / 订阅剧集 / 直播」用的
 * 接口模型（`models/moment/*`、`models/live/*`）里没有声明 cid 字段，但上游运行时
 * 可能把 cid 放在 `cid` / `player_args.cid` / `page.cid` 任一位置。
 *
 * 因此这里做**防御式读取**：能读到就透传给 VideoCard，读不到返回 undefined
 * （VideoCard 的预览前置条件要求 bvid + cid，缺一个就不会发请求）。
 * **不新增任何网络请求**，也绝不为了补 cid 调 getVideoInfo。
 */
export interface OptionalCidSource {
  cid?: unknown
  player_args?: { cid?: unknown } | null
  page?: { cid?: unknown } | null
}

function toCid(value: unknown): number | undefined {
  const cid = Number(value)
  return Number.isFinite(cid) && cid > 0
    ? cid
    : undefined
}

export function readPreviewCid(source?: object | null): number | undefined {
  if (!source)
    return undefined
  const raw = source as OptionalCidSource
  return toCid(raw.cid)
    ?? toCid(raw.player_args?.cid)
    ?? toCid(raw.page?.cid)
}
