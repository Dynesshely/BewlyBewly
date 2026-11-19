/**
 * 视频信息 API 数据类型（第 109 轮）。
 */
export interface ApiVideoMeta {
  bvid: string
  aid: number
  title: string
  view: number | null
  like: number | null
  coin: number | null
  favorite: number | null
  share: number | null
  danmaku: number | null
  reply: number | null
  pubdate: number | null
  copyright: number | null
  /** 分区名，可能为空串 */
  tname: string
  /** 简介，B 站可能返回 '-' 表示空 */
  desc: string
  /** 分 P 数 */
  pages: number | null
  duration: number | null
  owner: {
    mid: number
    name: string
    face: string
  } | null
  tags: string[]
}

export interface ApiRelatedItem {
  bvid: string
  aid: number
  title: string
  pic: string
  duration: number | null
  owner: { mid: number, name: string, face: string } | null
  stat: { view: number | null, danmaku: number | null } | null
}
