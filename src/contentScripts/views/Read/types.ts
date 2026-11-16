/**
 * 专栏页（`bilibili.com/read/*`）自绘层的数据结构。
 *
 * 数据来源有两个，最终都归一到这里：
 *   1. 页面自带的 `window.__INITIAL_STATE__.home.list`（B 站首屏直出数据，最稳）；
 *   2. 原生 DOM 里的 `.feed-item > a.article-item` 卡片（首屏数据拿不到时的兜底）。
 *
 * 卡片字段选择依据真机 dump：
 *   __INITIAL_STATE__.home.list[0] = { id, title, summary, image_urls[],
 *     author: { mid, name, face }, stats: { view, like, favorite },
 *     publish_time, category: { name }, view_url }
 */
export interface ReadAuthor {
  mid: number
  name: string
  face: string
}

/** 列表卡片（自绘卡片网格的唯一数据形状） */
export interface ReadCard {
  /** 专栏 id（cv 号） */
  id: number
  title: string
  summary: string
  /** 封面地址（已补全 `https:`，可能为空串） */
  cover: string
  author: ReadAuthor
  views: number
  likes: number
  favorites: number
  /** 发布时间（秒级时间戳；DOM 兜底数据源拿不到时间时为 0） */
  publishTime: number
  /** 二级分区名（如「日常」），可能为空串 */
  category: string
  /** 文章地址（绝对 URL） */
  url: string
}

/** 首屏数据从哪来：`initial-state` 为页面直出数据，`native-dom` 为 DOM 兜底 */
export type ReadCardSource = 'initial-state' | 'native-dom'
