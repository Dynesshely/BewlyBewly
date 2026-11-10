import { reactive } from 'vue'

/** 列表密度：舒适（B 站原生节奏）/ 紧凑（标题单行 + 更小字号） */
export type SpaceDensity = 'comfortable' | 'compact'

/** 可筛选的内容类型 */
export type SpaceContentKind = 'video' | 'article' | 'dynamic' | 'collection'

/** 内容筛选：全部 / 只看某一类 */
export type SpaceFilterMode = 'all' | SpaceContentKind

/** 快速跳转目标 */
export type SpaceQuickJumpId = 'home' | 'video' | 'collection' | 'favorites'

/** 面板里的一个快捷跳转入口；B 站页面上找不到对应 tab 时 available=false（按钮隐藏） */
export interface SpaceQuickJumpView {
  id: SpaceQuickJumpId
  available: boolean
}

/**
 * 空间页增强层的 UI 状态。
 *
 * 整个模块只用一个实例，生命周期与 setupSpacePage()／teardownSpacePage() 一致。
 * DOM 节点不进响应式（既没必要也容易出问题），只把面板要渲染的标量同步进来。
 */
export interface SpaceUiState {
  /** 面板是否展开 */
  panelOpen: boolean
  density: SpaceDensity
  filter: SpaceFilterMode
  /** 当前页识别到的内容卡总数（不受筛选影响） */
  cardCount: number
  /** 当前筛选下可见的卡片数 */
  visibleCount: number
  /** 当前页每一类内容是否存在（决定筛选按钮是否可用） */
  availableKinds: Record<SpaceContentKind, boolean>
  /** 快速跳转入口及可用性 */
  quickJumps: SpaceQuickJumpView[]
  /** 当前高亮卡序号（从 0 开始，-1 表示未选中），相对当前筛选下可浏览的卡片 */
  activeIndex: number
  /** 当前筛选下可浏览的卡片总数 */
  activeTotal: number
  /** 当前高亮卡标题（面板里显示） */
  activeTitle: string
  /** 短暂提示文案 */
  toast: string
}

function createInitialState(): SpaceUiState {
  return {
    panelOpen: false,
    density: 'comfortable',
    filter: 'all',
    cardCount: 0,
    visibleCount: 0,
    availableKinds: {
      video: false,
      article: false,
      dynamic: false,
      collection: false,
    },
    quickJumps: [
      { id: 'home', available: false },
      { id: 'video', available: false },
      { id: 'collection', available: false },
      { id: 'favorites', available: false },
    ],
    activeIndex: -1,
    activeTotal: 0,
    activeTitle: '',
    toast: '',
  }
}

export const ui = reactive<SpaceUiState>(createInitialState())

export function resetUiState(): void {
  Object.assign(ui, createInitialState())
}
