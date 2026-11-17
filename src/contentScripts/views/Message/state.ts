import { reactive } from 'vue'

/** 顶部 pill 的一个分类（来自原生左栏） */
export interface MessageCategoryView {
  /** 原生左栏里的下标，用于点击转发 */
  index: number
  name: string
  /** 数字未读数（无则 null） */
  unread: number | null
  /** 只有小圆点、没有数字 */
  dot: boolean
  active: boolean
}

/** 自绘会话列表的一行 */
export interface MessageSessionView {
  /** 原生会话项的 data-id，形如 contact_<mid>，点击转发靠它定位 */
  dataId: string
  mid: string
  name: string
  summary: string
  /** 红色前缀提示，例如「[账号登录通知]」 */
  redAlert: string
  unread: number | null
  dot: boolean
  /** 免打扰（来自会话接口） */
  silent: boolean
  /** 置顶（来自会话接口） */
  pinned: boolean
  active: boolean
  /** 头像 URL（取自原生 DOM 里的 img） */
  avatar: string
  /** 没有头像时显示的首字 */
  initial: string
  /** 展示用时间文本（接口没数据时为空串） */
  timeText: string
}

/** 互动类列表（回复 / @ / 收到的赞）的一行 */
export interface MessageInteractionView {
  /** 稳定 key：同一条里可能有多人，用原生下标 + 文本指纹 */
  key: string
  /** 原生列表里的下标，点击转发靠它定位 */
  index: number
  /** 参与的人（回复/@ 是 1 个，赞可能是 2 个展示名） */
  unames: string[]
  /** 动作文案：「对我的视频发表了评论」「等总计 47 人赞了我的视频」「在视频中@了我」 */
  action: string
  /** 引用原文（评论内容 / @ 到的正文），可能为空 */
  message: string
  /** 额外的引用内容（原生 `__reference`，出现时优先展示） */
  reference: string
  /** 源内容封面（视频封面等），可能为空 */
  cover: string
  /** 时间文本（原生已格式化） */
  time: string
  /** 头像列表（1–2 个） */
  avatars: string[]
  /** 多人点赞（原生 .interaction-item__left.multi），头像叠放展示 */
  multi: boolean
  /** 未读态（见 actions.ts 的说明：原生没有逐条已读标记，用分类未读计数近似） */
  unread: boolean
  /** 原生提供的按钮类型（按 hover 显隐，转发回原生） */
  buttons: Array<'reply' | 'like' | 'delete' | 'notice'>
}

/** 系统通知列表的一行 */
export interface MessageSystemView {
  key: string
  index: number
  title: string
  message: string
  time: string
  unread: boolean
}

export type MessageListKind = 'none' | 'interaction' | 'system'

export interface MessageDrawnState {
  /** 原生消息中心结构已就绪，接管生效 */
  ready: boolean
  /** 当前 hash 路由 */
  route: string
  /** 顶部分类 pill */
  categories: MessageCategoryView[]
  /** 自绘会话列表 */
  sessions: MessageSessionView[]
  /** 会话列表是否处于加载更多状态 */
  loadingMore: boolean
  /** 会话列表标题（原生「最近消息」） */
  sessionTitle: string
  /** 当前四类列表的类型（非 whisper 路由才有值） */
  listKind: MessageListKind
  /** 自绘互动列表 */
  interactions: MessageInteractionView[]
  /** 自绘系统通知列表 */
  systems: MessageSystemView[]
  /** 四类列表的标题（取当前激活分类名） */
  listTitle: string
  /** 该分类的未读数量（>0 时用于标未读，仅作近似） */
  listUnread: number
}

function createInitialState(): MessageDrawnState {
  return {
    ready: false,
    route: 'unknown',
    categories: [],
    sessions: [],
    loadingMore: false,
    sessionTitle: '',
    listKind: 'none',
    interactions: [],
    systems: [],
    listTitle: '',
    listUnread: 0,
  }
}

export const state = reactive<MessageDrawnState>(createInitialState())

export function resetState(): void {
  Object.assign(state, createInitialState())
}
