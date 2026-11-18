/**
 * 消息中心（自绘）的数据类型。
 *
 * 字段名与类型全部来自 2026-11-19 真机实测（CDP 9333，登录态），
 * 只声明本模块用到的字段；接口返回的其余字段保持宽松，不在这里穷举。
 */
import type { MessageTabId } from './constants'

/** `get_sessions` 一条会话（真机字段名） */
export interface SessionApiItem {
  /** 会话对方 mid（**注意：真机是数字，且系统账号会超过 Number.MAX_SAFE_INTEGER**） */
  talker_id: number
  session_type: number
  /** 最后一条消息时间（**微秒**，见 utils.microToSeconds） */
  session_ts?: number
  /** 已读位置时间（微秒） */
  ack_ts?: number
  /** 未读条数 */
  unread_count?: number
  /** 免打扰：0 / 1 */
  is_dnd?: number
  /** 置顶时间（微秒，非 0 即置顶） */
  top_ts?: number
  /** 是否可折叠（陌生人会话） */
  can_fold?: number
  /** 系统会话类型（7 = 社区中心 / 创作助手 / 直播助手这类官方号） */
  system_msg_type?: number
  /** 会话对方信息（普通用户可能没有这个字段，需要用 user/cards 补） */
  account_info?: {
    name?: string
    pic_url?: string
    face?: string
    mid?: number | string
  }
  /** 最后一条消息（摘要就取它的 content，需要按 msg_type 解析） */
  last_msg?: SessionLastMsg
}

/** 会话里最后一条消息 */
export interface SessionLastMsg {
  sender_uid?: number
  msg_type?: number
  /** **JSON 字符串**，结构随 msg_type 变化，必须 parse */
  content?: string
  timestamp?: number
  msg_seqno?: number
}

/** `fetch_session_msgs` 的一条消息 */
export interface ChatApiMsg {
  msg_key?: number | string
  msg_type: number
  sender_uid?: number
  timestamp?: number
  /** **JSON 字符串**，结构随 msg_type 变化，必须 parse */
  content?: string
  msg_seqno?: number
  account_info?: {
    name?: string
    pic_url?: string
  }
}

/** 聊天消息解析后的内容（按 msg_type 归一化） */
export type ChatContent
  = | { kind: 'text', text: string }
    | { kind: 'image', url: string, width: number, height: number }
    | { kind: 'share', title: string, author: string, thumb: string, cover: string, url: string, id: number }
    | { kind: 'card', title: string, text: string, cover: string, jumpUrl: string }
    | { kind: 'unsupported', label: string }

/** 自绘用的一条消息（已归一化） */
export interface ChatMessage {
  /** 稳定的 key（msg_key，缺失时用 seqno / 时间兜底） */
  key: string
  /** 我发的？ */
  mine: boolean
  /** 秒级时间戳 */
  time: number
  content: ChatContent
}

/** 一个会话（列表用，已归一化） */
export interface ChatSession {
  /** 会话对方 mid（**字符串**：真机存在超过 2^53 的系统账号 mid，必须全程按字符串处理） */
  mid: string
  name: string
  avatar: string
  /** 最后一条消息的摘要文本 */
  summary: string
  /** 最后一条消息时间（秒）；接口没给时为 null */
  time: number | null
  unread: number
  /** 免打扰 */
  muted: boolean
  /** 置顶 */
  pinned: boolean
  /** 系统 / 官方账号会话（不能发消息，气泡也没有「对方」语义之外的差别） */
  system: boolean
}

/** `msgfeed/reply` 的条目 */
export interface FeedReplyItem {
  id: number
  user?: FeedUser
  item?: FeedSource
  counts?: number
  is_multi?: number
  reply_time?: number
}

/** `msgfeed/at` 的条目 */
export interface FeedAtItem {
  id: number
  user?: FeedUser
  item?: FeedSource
  at_time?: number
}

/** `msgfeed/like` 的条目（users 是多个人一起点赞；counts 是总点赞数） */
export interface FeedLikeItem {
  id: number
  users?: FeedUser[]
  item?: FeedSource
  counts?: number
  like_time?: number
}

/** 互动列表里的用户 */
export interface FeedUser {
  mid: number
  nickname?: string
  avatar?: string
  follow?: boolean
}

/** 互动列表里被引用的内容（视频 / 专栏 / 动态 / 评论…） */
export interface FeedSource {
  /** 视频 / 专栏 / 动态 id（带过 type 语义，见 utils.buildFeedLink） */
  subject_id?: number
  item_id?: number
  type?: string
  business?: string
  business_id?: number
  title?: string
  desc?: string
  image?: string
  /** 站内地址（真机是 https 绝对地址） */
  uri?: string
  native_uri?: string
  source_content?: string
  root_reply_content?: string
  target_reply_content?: string
  at_details?: FeedUser[]
  topic_details?: FeedUser[]
}

/** 接口的通用响应外壳 */
export interface ApiEnvelope<T> {
  code: number
  message?: string
  data?: T
}

/** get_sessions 的 data */
export interface SessionsData {
  session_list?: SessionApiItem[]
  has_more?: number
}

/** fetch_session_msgs 的 data */
export interface SessionMsgsData {
  messages?: ChatApiMsg[]
  has_more?: number
  min_seqno?: number
}

/** msgfeed/reply 的 data */
export interface FeedReplyData {
  items?: FeedReplyItem[]
  cursor?: FeedCursor
  last_view_at?: number
}

/** msgfeed/at 的 data */
export interface FeedAtData {
  items?: FeedAtItem[]
  cursor?: FeedCursor
}

/** msgfeed/like 的 data（latest 是「新收到的赞」，total 是全部） */
export interface FeedLikeData {
  latest?: { items?: FeedLikeItem[], last_view_at?: number }
  total?: { items?: FeedLikeItem[], cursor?: FeedCursor }
}

/** 游标（真机三张列表都是 { is_end, id, time }） */
export interface FeedCursor {
  is_end?: boolean
  id?: number
  time?: number
}

/** 系统通知（`query_unified_notify`）的一条 */
export interface SystemNotifyItem {
  id: number
  /** **微秒**量级的游标，翻页就传最后一条的这个值 */
  cursor?: number
  /** 通知类型（4 = 系统公告） */
  type?: number
  title?: string
  /** **JSON 字符串**：`{"web":"..."}`，正文在 web 字段里 */
  content?: string
  source?: { name?: string, logo?: string }
  /** 真机是格式化好的字符串 "2026-03-16 19:00:00"（不是时间戳） */
  time_at?: string
  card_type?: number
  card_cover?: string
  card_link?: string
}

/** query_unified_notify 的 data */
export interface SystemNotifyData {
  system_notify_list?: SystemNotifyItem[]
}

/** 自绘用的系统通知（已归一化） */
export interface SystemNotice {
  key: string
  title: string
  text: string
  time: string
  /** 秒级时间戳（由 time_at 解析，解析不出来为 null） */
  timestamp: number | null
  logo: string
  /** 正文里的第一个 http 链接（有的话渲染成「查看详情」） */
  link: string
}

/** 自绘用的互动条目（回复 / @ / 赞 三合一） */
export interface FeedEntry {
  key: string
  kind: 'reply' | 'at' | 'like'
  /** 动作人（赞里是多个人，这里取前几个 + 总数） */
  actors: Array<{ mid: string, name: string, avatar: string }>
  /** 「总共 N 人」这类计数（赞才有意义，其它为 0） */
  actorCount: number
  title: string
  /** 引用 / 回复的正文 */
  text: string
  /** 源内容封面 */
  cover: string
  /** 点条目要打开的站内地址 */
  url: string
  /** 秒级时间戳 */
  time: number
  /** 未读数（本模块没有逐条已读，恒为 false；字段留着便于后续接接口） */
  unread: boolean
}

/**
 * mount.ts 与 MessagePage.vue 之间的调用通道。
 *
 * provide/inject 的键定义在 `constants.ts`（`MESSAGE_PAGE_BRIDGE_KEY`），
 * 这里只放类型。
 */
export interface MessagePageBridge {
  /** 外部路由（hash）变化时把新 tab 推给页面 */
  syncRoute?: (tab: MessageTabId) => void
  /** 重拉当前 tab */
  reload?: () => void
}
