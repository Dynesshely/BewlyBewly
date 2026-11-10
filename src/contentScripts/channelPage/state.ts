import { reactive } from 'vue'

/** 列表密度：舒适（B 站原生节奏）/ 紧凑（标题单行 + 更小字号） */
export type ChannelDensity = 'comfortable' | 'compact'

/** 排序快捷目标 */
export type ChannelSortId = 'default' | 'views' | 'newest'

/** 面板里的一个排序入口；页面上找不到对应 tab 时 available=false（按钮隐藏） */
export interface ChannelSortView {
  id: ChannelSortId
  available: boolean
}

/**
 * 分区页增强层的 UI 状态。
 *
 * 整个模块只用一个实例，生命周期与 setupChannelPage()／teardownChannelPage() 一致。
 * DOM 节点不进响应式，只把面板要渲染的标量同步进来。
 */
export interface ChannelUiState {
  /** 面板是否展开 */
  panelOpen: boolean
  density: ChannelDensity
  /** 当前页识别到的视频卡总数 */
  cardCount: number
  /** 排序快捷入口及可用性 */
  sortTabs: ChannelSortView[]
  /** 当前高亮卡序号（从 0 开始，-1 表示未选中） */
  activeIndex: number
  activeTotal: number
  activeTitle: string
  /** 短暂提示文案 */
  toast: string
}

function createInitialState(): ChannelUiState {
  return {
    panelOpen: false,
    density: 'comfortable',
    cardCount: 0,
    sortTabs: [
      { id: 'default', available: false },
      { id: 'views', available: false },
      { id: 'newest', available: false },
    ],
    activeIndex: -1,
    activeTotal: 0,
    activeTitle: '',
    toast: '',
  }
}

export const ui = reactive<ChannelUiState>(createInitialState())

export function resetUiState(): void {
  Object.assign(ui, createInitialState())
}
