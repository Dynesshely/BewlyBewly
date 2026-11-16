/**
 * 直播页自绘模块的数据模型。
 *
 * 字段名沿用 B 站接口的 snake_case，只在 `api.ts` 里做一次归一化，
 * 组件层只看到这里定义的 camelCase 结构。
 */

/** 一张直播卡（首页网格 / 侧栏推荐共用） */
export interface LiveRoomCard {
  roomId: number
  uid: number
  /** 主播昵称 */
  uname: string
  /** 主播头像（已带尺寸参数） */
  face: string
  /** 直播间标题 */
  title: string
  /** 封面（已带尺寸参数） */
  cover: string
  /** 二级分区名，例如「CS2」 */
  areaName: string
  /** 一级分区名，例如「网游」 */
  parentAreaName: string
  /** 人气值 */
  online: number
  /** 看过人数文案，例如「1.5万」 */
  watchedText: string
}

/** 首页分区 pill */
export interface LiveAreaTab {
  name: string
  /** 原生分区页链接（真机 `/p/eden/area-tags?parentAreaId=1&areaId=0`） */
  href: string
  /** 悬浮二级分区 */
  subs: LiveAreaTab[]
}

/** 首页一页数据 */
export interface LiveHomeFeed {
  list: LiveRoomCard[]
  areas: LiveAreaTab[]
  hasMore: boolean
}

/** 直播间顶部信息 */
export interface LiveRoomDetail {
  roomId: number
  uid: number
  /** 主播昵称 */
  uname: string
  /** 主播头像（已带尺寸参数） */
  face: string
  /** 直播间标题 */
  title: string
  areaName: string
  parentAreaName: string
  /** 是否在直播 */
  live: boolean
  /** 人气值 */
  online: number
  /** 看过人数文案 */
  watchedText: string
  /** 点赞数 */
  likes: number
  /** 粉丝数 */
  followers: number
}

/** 关注状态：null = 未查到（此时关注按钮显示为中性） */
export type FollowState = boolean | null
