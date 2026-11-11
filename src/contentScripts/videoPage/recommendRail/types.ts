/** 轨道里的一张推荐卡（从原生 `.video-page-card-small` 采集而来） */
export interface RailCard {
  bvid: string
  /** 绝对地址（https://www.bilibili.com/video/BV...） */
  url: string
  title: string
  cover: string
  /** 形如 12:34，拿不到时为空 */
  duration: string
  upName: string
  /** 播放量文本（形如 12.3万），拿不到时为空 */
  views: string
}

/** 轨道在视口里的位置（fixed 定位，渲染在 videoPage shadow root 内） */
export interface RailPlacement {
  top: number
  left: number
  width: number
  height: number
}

/** 可见卡片数量的范围（用户要求同时可见 4~7 张） */
export const RAIL_MIN_VISIBLE = 4
export const RAIL_MAX_VISIBLE = 7
/** 单张卡片的最小宽度（px）：低于它会挤掉标题 */
export const RAIL_MIN_CARD_WIDTH = 168
/** 卡片之间的间隙（px） */
export const RAIL_CARD_GAP = 12
