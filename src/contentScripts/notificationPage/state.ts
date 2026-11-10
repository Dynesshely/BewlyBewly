import { reactive } from 'vue'

/** 列表密度：舒适 / 紧凑 */
export type NotificationDensity = 'comfortable' | 'compact'

/** 四类消息：回复 / @我 / 点赞 / 系统通知 */
export type NotificationCategoryId = 'reply' | 'at' | 'love' | 'system'

/** 面板里的一个分类快捷入口 */
export interface NotificationCategoryView {
  id: NotificationCategoryId
  /** 左栏里能找到对应分类项才可点 */
  available: boolean
}

/** 覆盖层 UI 状态，整个模块共用一个实例，生命周期与页面入口一致 */
export interface NotificationUiState {
  /** 面板是否展开 */
  panelOpen: boolean
  /** 用户偏好：只看未读（持久化在 sessionStorage） */
  unreadOnly: boolean
  /** 列表密度（持久化在 sessionStorage） */
  density: NotificationDensity

  /** 原生 DOM 读到的未读总数；读不到时为 null（面板隐藏数字） */
  unreadCount: number | null
  /** 当前列表里识别出的未读条目数 */
  unreadItemCount: number
  /** 列表条目总数 */
  itemCount: number
  /** 页面是否暴露了可识别的已读 / 未读状态（否则筛选开关禁用） */
  canFilterUnread: boolean
  /** 页面是否存在原生「全部已读」按钮 */
  canMarkAllRead: boolean
  /** 分类快捷入口 */
  categories: NotificationCategoryView[]

  /** 短暂提示文案 */
  toast: string
}

function createInitialState(): NotificationUiState {
  return {
    panelOpen: false,
    unreadOnly: false,
    density: 'comfortable',
    unreadCount: null,
    unreadItemCount: 0,
    itemCount: 0,
    canFilterUnread: false,
    canMarkAllRead: false,
    categories: [
      { id: 'reply', available: false },
      { id: 'at', available: false },
      { id: 'love', available: false },
      { id: 'system', available: false },
    ],
    toast: '',
  }
}

export const state = reactive<NotificationUiState>(createInitialState())

export function resetUiState(): void {
  Object.assign(state, createInitialState())
}
