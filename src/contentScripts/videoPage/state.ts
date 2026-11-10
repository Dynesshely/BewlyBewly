import { reactive } from 'vue'

/** 播放列表面板里的一行 */
export interface PlaylistItemView {
  index: number
  title: string
  active: boolean
}

/** 覆盖层 UI 状态。整个模块只用一个实例，生命周期与页面入口一致。 */
export interface VideoPageUiState {
  /** 播放器已经找到，UI 可以交互了 */
  ready: boolean
  /** 当前是不是番剧 / 电影播放页（页面布局与普通视频页不同） */
  isBangumi: boolean
  /** 页面上存在可用的集数列表（番剧 / 电影才可能为 true） */
  episodeNav: boolean
  /** 页面上存在可用的播放列表（仅 /list/* 页面才可能为 true） */
  playlistNav: boolean
  /** 播放列表面板是否展开 */
  playlistPanelOpen: boolean
  /** 自动连播：默认关，状态存 sessionStorage */
  playlistAutoplay: boolean
  /** 播放列表条目（同步自原生 DOM，只在内容变化时写入） */
  playlistItems: PlaylistItemView[]
  /** 当前播放项下标，-1 表示判定失败 */
  playlistCurrentIndex: number
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
    playlistNav: false,
    playlistPanelOpen: false,
    playlistAutoplay: false,
    playlistItems: [],
    playlistCurrentIndex: -1,
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
