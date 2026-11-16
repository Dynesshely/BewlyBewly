import type { List as RankVideoItem } from '~/models/video/ranking'
import type { List as PgcRankItem } from '~/models/video/rankingPgc'
/**
 * 热门 / 排行榜页（自绘）的数据类型。
 *
 * 综合热门、排行榜、番剧类排行榜直接复用仓库已有的接口模型
 * （`~/models/video/trending` / `ranking` / `rankingPgc`）；
 * 「每周必看」「入站必刷」两个接口不在 `src/background/messageListeners/api` 里，
 * 由本模块自己取（见 `fetcher.ts`），所以类型定义在本目录。
 */
import type { List as PopularListItem } from '~/models/video/trending'

/** 综合热门 / 每周必看 / 入站必刷接口里的视频条目（字段与 trending 的 List 同构） */
export type PopularVideoItem = PopularListItem
/** 排行榜（视频分区）条目 */
export type RankVideoRankItem = RankVideoItem
/** 排行榜（番剧 / 国创 / 电影…）条目 */
export type RankPgcRankItem = PgcRankItem

/** 每周必看：期号列表项 */
export interface WeeklyIssue {
  number: number
  subject: string
  status: number
  name: string
}

/** 每周必看：单期信息（config 里带期号、主题、分享文案） */
export interface WeeklyIssueConfig {
  id: number
  type: string
  number: number
  subject: string
  stime: number
  etime: number
  status: number
  name: string
  label: string
  hint: string
  cover: string
  share_title: string
  share_subtitle: string
  media_id: number
}

/** 每周必看：单期详情 */
export interface WeeklyIssueDetail {
  config: WeeklyIssueConfig
  reminder: string
  /** 单期视频列表（接口里带 rcmd_reason 字符串，与 trending 的 List 略有差异） */
  list: unknown[]
}

/** 入站必刷 */
export interface PreciousData {
  title: string
  explain: string
  media_id: number
  list: unknown[]
}

/** B 站 Web 接口通用响应 */
export interface BiliResponse<T> {
  code: number
  message?: string
  ttl?: number
  data?: T
}
