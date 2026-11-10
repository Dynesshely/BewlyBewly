import type { Video } from '~/components/VideoCard/types'

/** 列表页三种视图模式：舒适网格 / 紧凑网格 / 时间轴列表 */
export type ListViewMode = 'comfortable' | 'compact' | 'list'

/** 列表页排序方式 */
export type ListSortMode = 'time' | 'duration' | 'title'

/** 卡片 hover / focus 时出现的快捷操作 */
export type ListQuickActionId = 'watchLater' | 'copy' | 'remove' | 'unfavorite'

/** 时间分组标识，顺序即渲染顺序 */
export type ListTimeGroupKey = 'today' | 'yesterday' | 'thisWeek' | 'earlier'

export interface ListCardProgress {
  /** 已观看时长（已格式化） */
  watched: string
  /** 总时长（已格式化） */
  total: string
  /** 0-100 */
  percent: number
  finished: boolean
}

/**
 * 列表页统一的卡片数据。
 * video 直接喂给 ~/components/VideoCard.vue，其余字段只服务于列表页自身。
 */
export interface ListCardItem {
  key: string | number
  video: Video
  /** 复制链接按钮使用的地址 */
  copyUrl: string
  /** 用于时间分组与时间轴的时间戳（毫秒） */
  timestamp?: number
  /** 时间轴上展示的时间文案 */
  timeLabel?: string
  progress?: ListCardProgress
  actions: ListQuickActionId[]
  /** 原始接口数据，页面据此执行删除 / 取消收藏等操作 */
  raw?: unknown
}

/** 收藏夹分类胶囊 */
export interface ListCategoryChip {
  id: number
  title: string
  count?: number
}
