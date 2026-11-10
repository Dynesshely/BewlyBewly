/**
 * 动态页的视图模型与接口原始类型。
 *
 * 数据来自 `api.moment.getMoments`（B 站 polymer web-dynamic `feed/all` 接口）。
 * 接口字段随 B 站迭代增删，因此这里只声明用到的部分，其余一律可选，
 * 由 `utils/normalize.ts` 做容错解析。
 */

/** 归一化后的卡片类型 */
export type MomentCardType = 'video' | 'images' | 'text' | 'forward' | 'article' | 'live' | 'pgc' | 'unknown'

export interface MomentImage {
  url: string
  width: number
  height: number
}

export interface MomentVideo {
  title: string
  cover: string
  jumpUrl: string
  duration: string
  play: string
  danmaku: string
  /** 「投稿视频」「番剧」等角标文案 */
  badge: string
}

export interface MomentArticle {
  title: string
  desc: string
  cover: string
  jumpUrl: string
}

export interface MomentLive {
  title: string
  cover: string
  jumpUrl: string
  area: string
  online: number
  /** 1 = 直播中 */
  liveStatus: number
}

export interface MomentStats {
  forward: number
  comment: number
  like: number
  /** 当前登录用户是否已点赞（接口 module_stat.like.status） */
  liked: boolean
}

export interface MomentAuthor {
  mid: number
  name: string
  face: string
  jumpUrl: string
  /** 「投稿了视频」「发布了动态」等动作文案 */
  pubAction: string
  /** 认证 / 标签短文本 */
  label: string
}

export interface MomentCard {
  /** 动态 id（字符串，用作列表 key 与 DOM 上的 data 属性） */
  id: string
  type: MomentCardType
  author: MomentAuthor
  /** 发布时间戳（毫秒），0 表示接口没有给出 */
  pubTs: number
  text: string
  images: MomentImage[]
  video?: MomentVideo
  article?: MomentArticle
  live?: MomentLive
  /** 转发时被转发的原动态 */
  origin?: MomentCard
  stats: MomentStats
  /** 打开原动态的地址 */
  jumpUrl: string
}

/* #region 原始接口（只声明用到的字段） */

export interface RawRichTextNode {
  text?: string
  orig_text?: string
  type?: string
}

export interface RawDesc {
  text?: string
  rich_text_nodes?: RawRichTextNode[]
}

export interface RawArchive {
  aid?: string
  bvid?: string
  cover?: string
  desc?: string
  duration_text?: string
  jump_url?: string
  title?: string
  badge?: { text?: string }
  stat?: { play?: string, danmaku?: string }
}

export interface RawPgc {
  epid?: number
  season_id?: number
  cover?: string
  jump_url?: string
  title?: string
  badge?: { text?: string }
  stat?: { play?: string, danmaku?: string }
}

export interface RawDrawItem {
  src?: string
  url?: string
  width?: number
  height?: number
}

export interface RawOpus {
  jump_url?: string
  title?: string
  pics?: RawDrawItem[]
  summary?: RawDesc
}

export interface RawArticle {
  id?: number
  title?: string
  desc?: string
  covers?: string[]
  jump_url?: string
}

export interface RawLivePlayInfo {
  title?: string
  cover?: string
  link?: string
  area_name?: string
  online?: number
  live_status?: number
}

export interface RawLiveRcmd {
  content?: string
  live_play_info?: RawLivePlayInfo
}

export interface RawMajor {
  type?: string
  archive?: RawArchive
  pgc?: RawPgc
  draw?: { items?: RawDrawItem[] }
  opus?: RawOpus
  article?: RawArticle
  live?: RawLivePlayInfo
  live_rcmd?: RawLiveRcmd
  common?: { cover?: string, title?: string, desc?: string, jump_url?: string }
}

export interface RawAuthor {
  mid?: number
  name?: string
  face?: string
  jump_url?: string
  pub_action?: string
  pub_time?: string
  pub_ts?: number
  label?: string | { text?: string }
  official_verify?: { desc?: string, type?: number }
  vip?: { label?: { text?: string } }
}

export interface RawDynamicModule {
  desc?: RawDesc | null
  major?: RawMajor | null
  topic?: { name?: string, jump_url?: string } | null
}

export interface RawStatCount {
  count?: number
  forbidden?: boolean
  /** 仅 like 有：当前用户是否已点赞 */
  status?: boolean
}

export interface RawModules {
  module_author?: RawAuthor
  module_dynamic?: RawDynamicModule
  module_stat?: {
    forward?: RawStatCount
    comment?: RawStatCount
    like?: RawStatCount
  }
}

export interface RawMomentItem {
  id_str?: string
  type?: string
  visible?: boolean
  basic?: { comment_id_str?: string, comment_type?: number, rid_str?: string }
  modules?: RawModules
  /** 转发的原动态；已被删除时为 null */
  orig?: RawMomentItem | null
}

export interface RawMomentData {
  has_more?: boolean
  items?: RawMomentItem[]
  offset?: string
  update_baseline?: string
  update_num?: number
}

export interface RawMomentResult {
  code?: number
  message?: string
  data?: RawMomentData
}

/* #endregion */
