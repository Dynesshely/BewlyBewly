import { reactive } from 'vue'

/**
 * 直播页增强层的 UI 状态。
 *
 * 整个模块只用一个实例，生命周期与 setupLivePage()／teardownLivePage() 一致。
 * DOM 节点不进响应式，只把面板要渲染的标量同步进来。
 */
export interface LiveUiState {
  /** 面板是否展开 */
  panelOpen: boolean
  /** 影院模式：播放器铺满视口 + 页面压暗 */
  cinema: boolean
  /** 隐藏右侧栏（礼物 / 榜单 / 推荐） */
  hideAside: boolean
  /** 弹幕当前是否为开启状态（由原生控件读回） */
  danmakuOn: boolean
  /** 是否找到了播放器舞台（找不到时影院 / 全屏不可用） */
  playerReady: boolean
  /** 页面上是否有可隐藏的右侧栏 */
  asideAvailable: boolean
  /** 页面上是否找得到原生弹幕开关 */
  danmakuAvailable: boolean
  /** 页面上是否找得到原生全屏按钮 */
  fullscreenAvailable: boolean
  /** 短暂提示文案 */
  toast: string
}

function createInitialState(): LiveUiState {
  return {
    panelOpen: false,
    cinema: false,
    hideAside: false,
    danmakuOn: true,
    playerReady: false,
    asideAvailable: false,
    danmakuAvailable: false,
    fullscreenAvailable: false,
    toast: '',
  }
}

export const ui = reactive<LiveUiState>(createInitialState())

export function resetUiState(): void {
  Object.assign(ui, createInitialState())
}
