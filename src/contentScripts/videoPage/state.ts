import { reactive } from 'vue'

/** 覆盖层 UI 状态。整个模块只用一个实例，生命周期与页面入口一致。 */
export interface VideoPageUiState {
  /** 播放器已经找到，UI 可以交互了 */
  ready: boolean
  /** 当前是不是番剧 / 电影播放页（页面布局与普通视频页不同） */
  isBangumi: boolean
  /** 页面上存在可用的集数列表（番剧 / 电影才可能为 true） */
  episodeNav: boolean
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
