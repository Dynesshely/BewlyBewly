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
}

function createInitialState(): MessageDrawnState {
  return {
    ready: false,
    route: 'unknown',
    categories: [],
    sessions: [],
    loadingMore: false,
    sessionTitle: '',
  }
}

export const state = reactive<MessageDrawnState>(createInitialState())

export function resetState(): void {
  Object.assign(state, createInitialState())
}
