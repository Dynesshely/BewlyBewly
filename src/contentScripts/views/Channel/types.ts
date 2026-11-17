/**
 * 分区页（自绘）的数据类型。
 *
 * 字段全部来自真机抓包确认的接口
 * `GET https://api.bilibili.com/x/web-interface/region/feed/rcmd`：
 *
 *   {
 *     "code": 0,
 *     "data": {
 *       "archives": [{
 *         "aid": 117359041841081, "bvid": "BV1v1aZ6zEjg", "cid": 42334424226,
 *         "title": "…", "cover": "http://i1.hdslb.com/bfs/archive/….jpg",
 *         "duration": 667, "pubdate": 1790757438,
 *         "stat": { "view": 3577923, "like": 230323, "danmaku": 1034 },
 *         "author": { "mid": 490404737, "name": "…" },
 *         "trackid": "", "goto": "av", "rec_reason": "…"
 *       }]
 *     }
 *   }
 *
 * 注意：接口**没有** `tname`（二级分区名）与 `tid`，所以二级分区筛选
 * 不是「按 tid 过滤」能做的（详见 constants.ts 的说明）。
 */

/** 分区 feed 里的单条稿件 */
export interface RegionArchive {
  aid: number
  bvid?: string
  cid?: number
  title: string
  cover: string
  /** 秒 */
  duration?: number
  /** Unix 秒 */
  pubdate?: number
  stat?: {
    view?: number
    like?: number
    danmaku?: number
  }
  author?: {
    mid?: number
    name?: string
  }
  /** 推荐理由（B 站自己给的角标文案，可能为空） */
  rec_reason?: string
  /** `av` / `pgc` / `live` 等跳转类型 */
  goto?: string
}

/** 一页 feed */
export interface RegionFeedPage {
  archives: RegionArchive[]
  /** 接口这一页直接给了空数组 → 没有下一页了 */
  noMore: boolean
}

/** B 站 Web 接口通用响应外壳 */
export interface BiliResponse<T> {
  code: number
  message?: string
  ttl?: number
  data?: T
}
