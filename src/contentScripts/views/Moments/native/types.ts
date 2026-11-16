/**
 * 动态页自绘的数据模型（由原生 DOM 只读解析而来）。
 *
 * 字段名与原生类名解耦：解析逻辑只在 `scrape.ts`，渲染组件只看这里的结构，
 * 后续 B 站改 DOM 时只需要修 `scrape.ts`。
 */

export type DrawnActionType = 'forward' | 'comment' | 'like'

export interface DrawnStats {
  /** 原生按钮上的文本（数字或「转发」这类零计数文案），保持原样展示 */
  forward: string
  comment: string
  like: string
  /** 原生点赞按钮是否处于已赞态 */
  liked: boolean
}

export interface DrawnPicture {
  /** 已经带好尺寸参数的图片地址（交给 Picture 组件再补 .avif/.webp 后缀） */
  src: string
  /** 原图地址（去掉 @ 参数），用于点击查看原图 */
  href: string
  /** 宽高比（width / height），单图大图布局用；未知时按 1 */
  ratio: number
}

export interface DrawnVideo {
  href: string
  cover: string
  duration: string
  title: string
  desc: string
  /** 「动态视频」等角标；为空时不渲染 */
  badge: string
  /** 播放 / 弹幕等统计数据文本 */
  stats: string[]
}

export interface DrawnReserve {
  title: string
  when: string
  count: string
}

export type DrawnContentKind = 'video' | 'opus' | 'reserve'

export interface DrawnContent {
  kind: DrawnContentKind
  video?: DrawnVideo
  reserve?: DrawnReserve
  /** opus / 文章标题 */
  title?: string
  /** opus / 文章正文摘要 */
  text?: string
  /** 图片网格（1 张 / 2–4 张 / 5–9 张按不同列数渲染） */
  pics: DrawnPicture[]
}

export interface DrawnQuote {
  authorName: string
  authorAvatar: string
  content?: DrawnContent
}

export interface DrawnMoment {
  authorName: string
  avatar: string
  time: string
  /** 转发理由（转发时作者自己写的话）；原创动态为空 */
  text: string
  /** 原创内容；转发时为空 */
  content?: DrawnContent
  /** 被转发的原动态；非转发时为空 */
  quote?: DrawnQuote
  stats: DrawnStats
}
