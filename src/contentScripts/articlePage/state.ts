import { reactive } from 'vue'

/** 正文字号三档 */
export type ArticleFontStep = 's' | 'm' | 'l'

export const FONT_STEPS: ArticleFontStep[] = ['s', 'm', 'l']

/** 目录里的一条标题 */
export interface TocItem {
  /** 在标题列表里的序号，用来定位原生标题元素 */
  index: number
  /** 标题层级：2 = h2，3 = h3（h1 兜底时按 2 处理） */
  level: number
  text: string
}

/** 正文图片大图（lightbox）状态 */
export interface ArticleLightboxState {
  open: boolean
  /** 当前正文里的所有图片地址（顺序即 ←/→ 顺序） */
  images: string[]
  /** 当前展示的下标 */
  index: number
  /** 打开前的滚动位置，关闭时恢复 */
  scrollY: number
}

/** 覆盖层 UI 状态；整个模块共用一个实例，生命周期与页面入口一致 */
export interface ArticlePageUiState {
  /** 已经找到正文容器，UI 可以交互 */
  ready: boolean
  /** 沉浸阅读模式 */
  reading: boolean
  /** 正文字号档位（只在阅读模式下生效） */
  fontStep: ArticleFontStep
  /** 阅读进度 0–100（整数） */
  progress: number
  /** 页面够不够长，够长才显示进度条与百分比 */
  showProgress: boolean
  /** 目录条目 */
  tocItems: TocItem[]
  /** 当前章节在目录里的下标，-1 表示还没进入正文 */
  activeTocIndex: number
  /** 目录浮层是否展开 */
  tocOpen: boolean
  /** 短暂提示 */
  toast: string
  /** 正文图片大图 */
  lightbox: ArticleLightboxState
}

function createInitialState(): ArticlePageUiState {
  return {
    ready: false,
    reading: false,
    fontStep: 'm',
    progress: 0,
    showProgress: false,
    tocItems: [],
    activeTocIndex: -1,
    tocOpen: false,
    toast: '',
    lightbox: {
      open: false,
      images: [],
      index: 0,
      scrollY: 0,
    },
  }
}

export const ui = reactive<ArticlePageUiState>(createInitialState())

export function resetUiState(): void {
  Object.assign(ui, createInitialState())
}
