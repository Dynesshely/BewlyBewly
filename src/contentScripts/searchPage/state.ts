import { reactive } from 'vue'

/** 结果密度：舒适（B 站原生节奏）/ 紧凑（一行标题 + 更小行距） */
export type SearchDensity = 'comfortable' | 'compact'

/** 快速筛选：全部 / 只看视频结果 / 只看用户结果 */
export type SearchFilterMode = 'all' | 'video' | 'user'

/**
 * 搜索页增强层的 UI 状态。
 *
 * 整个模块只用一个实例，生命周期与 setupSearchEnhance()／teardownSearchEnhance() 一致。
 * 卡片列表本身不进响应式（DOM 节点放进 Proxy 里既不必要也容易出问题），只把
 * 「有多少条 / 当前第几条」这类可渲染的标量同步进来。
 */
export interface SearchEnhanceUiState {
  /** 面板是否展开 */
  panelOpen: boolean
  density: SearchDensity
  filter: SearchFilterMode
  /** 当前页识别到的结果卡总数 */
  cardCount: number
  /** 当前页是否有视频 / 用户结果（决定筛选选项是否可用） */
  hasVideoCards: boolean
  hasUserCards: boolean
  /** 当前高亮卡片序号（从 0 开始，-1 表示未选中），相对「当前筛选下可浏览的卡片」 */
  activeIndex: number
  /** 当前筛选下可浏览的卡片总数（面板里显示「第 x / y 条」） */
  activeTotal: number
  /** 当前高亮卡片标题（面板里显示） */
  activeTitle: string
  toast: string
}

function createInitialState(): SearchEnhanceUiState {
  return {
    panelOpen: false,
    density: 'comfortable',
    filter: 'all',
    cardCount: 0,
    hasVideoCards: false,
    hasUserCards: false,
    activeIndex: -1,
    activeTotal: 0,
    activeTitle: '',
    toast: '',
  }
}

export const ui = reactive<SearchEnhanceUiState>(createInitialState())

export function resetUiState(): void {
  Object.assign(ui, createInitialState())
}
