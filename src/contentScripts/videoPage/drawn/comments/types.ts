/**
 * 视频播放页「自绘评论区」的数据类型（第 110 轮）。
 *
 * 数据源是**旧版评论接口**（真机 2026-11-19 验证，BV1GJ411x7h7 / aid=80433022）：
 *
 *   GET /x/v2/reply?type=1&oid=<aid>&pn=<n>&ps=20&sort=<2|0>
 *     → code 0，data.replies 20 条，data.page.count = 总条数（本视频 241443）
 *   GET /x/v2/reply/reply?type=1&oid=<aid>&root=<主评论 rpid>&pn=<n>&ps=20
 *     → code 0，data.replies 为楼中楼
 *
 * 这里只保留组件真正消费的字段；原始响应在 fetcher 里归一化，组件不碰裸 JSON。
 */

/** 排序：2 = 按热度，0 = 按时间（真机 sort=1 等同热度，不用） */
export type CommentSort = 'hot' | 'latest'

/** 主评论 / 楼中楼共用的归一化条目 */
export interface CommentItem {
  /** 评论 id（字符串：真机存在 143475134160 这类超过 2^31 的值） */
  rpid: string
  /** 楼层根 id（楼中楼条目用；主评论等于自身 rpid） */
  root: string
  /** 直接父级（楼中楼回复的子回复用） */
  parent: string
  /** 用户 mid（字符串，同上理由） */
  mid: string
  /** 昵称 */
  uname: string
  /** 头像 URL（真机字段是 member.avatar；member.face 已不再下发） */
  avatar: string
  /** 等级（member.level_info.current_level；0 表示接口没给） */
  level: number
  /** 大会员状态（member.vip.vipStatus === 1 才算） */
  vip: boolean
  /** UP 主本人 */
  isUp: boolean
  /** 正文（保留换行，组件用 white-space: pre-wrap 渲染） */
  message: string
  /** 表情：[doge] → url */
  emote: Record<string, string>
  /** 图片评论 */
  pictures: string[]
  /** 发表时间（秒） */
  ctime: number
  /** 点赞数 */
  like: number
  /** 当前登录用户是否已赞（接口 action > 0） */
  liked: boolean
  /** 楼中楼条数（主评论才有；楼中楼为 0） */
  rcount: number
  /** IP 属地（reply_control.location，形如「IP属地：湖北」，可能为空） */
  location: string
  /** 置顶（reply_control.is_up_top，本视频无置顶） */
  isTop: boolean
  /** UP 主是否点赞过这条评论（up_action.like） */
  upLiked: boolean
  /** UP 主是否回复过这条评论（up_action.reply） */
  upReplied: boolean
  /** 楼中楼预览（接口在主评论里直接带 2-3 条，不再额外请求） */
  replies: CommentItem[]
}

/** 一页主评论 */
export interface CommentPage {
  /** 本页条目（已去重、已合并置顶） */
  items: CommentItem[]
  /** 接口给的总条数（data.page.count）；拿不到时为 null */
  total: number | null
  /** 是否还有下一页 */
  hasMore: boolean
  /** 本页请求的页码（1 起） */
  page: number
}

/** 一页楼中楼 */
export interface ReplyPage {
  items: CommentItem[]
  hasMore: boolean
  page: number
  /** 楼中楼总条数（data.page.count） */
  total: number | null
}

/** 拉主评论的参数 */
export interface FetchCommentsOptions {
  sort: CommentSort
  /** 页码，1 起 */
  page: number
  /** 每页条数：接口硬上限 ps=20（ps=21 起返回 -400 "ps out of bounds"） */
  ps?: number
}

/** 视频基础信息（自绘层判断 UP 主与总评论数用） */
export interface VideoBrief {
  aid: number
  bvid: string
  /** UP 主 mid（字符串） */
  ownerMid: string
  /** 评论总数（接口 data.page.count，拿不到时退回视频 stat.reply） */
  replyCount: number | null
}

/** 自绘评论区的视图状态（挂载层与评论列表共享） */
export type CommentDrawnStatus = 'idle' | 'loading' | 'ready' | 'error'
