import type { SelectionKind } from './dom'

import { reactive } from 'vue'

/** 选集面板（播放列表 / 分P）里的一行 */
export interface SelectionItemView {
  index: number
  title: string
  active: boolean
}

/** 长评论折叠按钮（fixed 定位，随滚动更新） */
export interface CommentFoldButtonView {
  id: number
  top: number
  left: number
}

/** 覆盖层 UI 状态。整个模块只用一个实例，生命周期与页面入口一致。 */
export interface VideoPageUiState {
  /** 播放器已经找到，UI 可以交互了 */
  ready: boolean
  /** 当前是不是番剧 / 电影播放页（页面布局与普通视频页不同） */
  isBangumi: boolean
  /** 页面上存在可用的集数列表（番剧 / 电影才可能为 true） */
  episodeNav: boolean
  /** 页面上存在可用的选集结构（播放列表或分P），面板据此渲染 */
  selectionNav: boolean
  /** 选集来源：播放列表 / 分P / 无（与番剧集数互斥） */
  selectionKind: SelectionKind
  /** 选集面板是否展开 */
  selectionPanelOpen: boolean
  /** 自动连播（仅播放列表页可用）：默认关，状态存 sessionStorage */
  playlistAutoplay: boolean
  /** 选集条目（同步自原生 DOM，只在内容变化时写入） */
  selectionItems: SelectionItemView[]
  /** 当前选集项下标，-1 表示判定失败 */
  selectionCurrentIndex: number
  /** 评论区是否存在（没有评论区时评论增强整块不渲染） */
  commentFound: boolean
  /** 是否找到原生排序标签（最热 / 最新） */
  commentSortAvailable: boolean
  /** 当前生效的排序（'' 表示判定不出） */
  commentActiveSort: '' | 'hot' | 'latest'
  /** 是否找到 UP 主标识（找不到时「只看 UP」禁用并说明） */
  commentUpAvailable: boolean
  /** 只看 UP 主评论 */
  commentsOnlyUp: boolean
  /** 评论工具条是否在视口内（fixed 坐标） */
  commentToolbarVisible: boolean
  commentToolbarTop: number
  commentToolbarLeft: number
  /** 长评论折叠按钮（fixed 坐标） */
  commentFoldButtons: CommentFoldButtonView[]
  /** 推荐轨道是否已渲染（第 27 轮；由 recommendRail/index.ts 写入） */
  recommendRailVisible: boolean
  cinema: boolean
  mini: boolean
  compact: boolean
  helpOpen: boolean
  danmakuOn: boolean
  muted: boolean
  paused: boolean
  title: string
  upName: string
  currentTime: number
  duration: number
  toast: string
}

function createInitialState(): VideoPageUiState {
  return {
    ready: false,
    isBangumi: false,
    episodeNav: false,
    selectionNav: false,
    selectionKind: 'none',
    selectionPanelOpen: false,
    playlistAutoplay: false,
    selectionItems: [],
    selectionCurrentIndex: -1,
    commentFound: false,
    commentSortAvailable: false,
    commentActiveSort: '',
    commentUpAvailable: false,
    commentsOnlyUp: false,
    commentToolbarVisible: false,
    commentToolbarTop: 0,
    commentToolbarLeft: 0,
    commentFoldButtons: [],
    recommendRailVisible: false,
    cinema: false,
    mini: false,
    compact: false,
    helpOpen: false,
    danmakuOn: true,
    muted: false,
    paused: false,
    title: '',
    upName: '',
    currentTime: 0,
    duration: 0,
    toast: '',
  }
}

export const ui = reactive<VideoPageUiState>(createInitialState())

export function resetUiState(): void {
  Object.assign(ui, createInitialState())
}
