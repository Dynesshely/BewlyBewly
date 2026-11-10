import { reactive } from 'vue'

/** 覆盖层 UI 状态。整个模块只用一个实例，生命周期与页面入口一致。 */
export interface VideoPageUiState {
  /** 播放器已经找到，UI 可以交互了 */
  ready: boolean
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
