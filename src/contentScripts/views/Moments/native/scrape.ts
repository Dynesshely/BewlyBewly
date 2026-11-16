/**
 * 原生动态 DOM（t.bilibili.com）→ 自绘数据模型（只读解析）。
 *
 * 真机 dump 的关键结构（第 93 轮）：
 *
 * ```
 * .bili-dyn-list__item
 *   .bili-dyn-item
 *     .bili-dyn-item__avatar  .b-avatar__layer[data-layer-tag="AVATAR_LAYER"] img
 *     .bili-dyn-item__header  [data-module="title"] .bili-dyn-title__text
 *                             [data-module="time"]
 *     .bili-dyn-item__body
 *       .bili-dyn-content
 *         .bili-dyn-content__forw__desc        ← 转发理由（仅转发）
 *         .bili-dyn-content__orig[.reference]  ← 原创内容 / 被转发的原动态
 *           .dyn-orig-author__name / __face img   ← 原动态作者（仅 reference）
 *           .bili-dyn-content__orig__major
 *             a.bili-dyn-card-video              ← 视频卡（封面 / 标题 / 时长 / 统计）
 *             .dyn-card-opus                     ← 图文 / 文章（标题 / 摘要 / 图片网格）
 *             .bili-dyn-card-reserve             ← 直播预约卡
 *     .bili-dyn-item__footer
 *       [data-module="action"][data-type=forward|comment|like]
 * ```
 *
 * 解析失败（改版 / 组件没渲染完）返回 null，由调用方保持原生卡片不动。
 */
import type {
  DrawnContent,
  DrawnMoment,
  DrawnPicture,
  DrawnQuote,
  DrawnReserve,
  DrawnStats,
  DrawnVideo,
} from './types'
import { NATIVE_CARD_SELECTOR } from './constants'

const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/g

/** 取纯文本：去零宽字符、去多余空行，保留段落换行 */
function textOf(element: Element | null | undefined): string {
  const raw = (element?.textContent ?? '').replace(ZERO_WIDTH_RE, '').replace(/\u00A0/g, ' ')
  if (!raw)
    return ''
  return raw
    .split('\n')
    .map(line => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 排除某个子节点后的文本（opus 摘要里的「展开」按钮要剔掉） */
function textWithout(element: Element | null | undefined, excludeSelector: string): string {
  if (!element)
    return ''
  const clone = element.cloneNode(true) as Element
  clone.querySelectorAll(excludeSelector).forEach(node => node.remove())
  return textOf(clone)
}

/** B 站图片地址：去掉已有的 @ 参数后缀，得到原图地址 */
function imageBase(raw: string | null | undefined): string {
  const value = (raw ?? '').trim()
  if (!value)
    return ''
  const at = value.indexOf('@')
  const base = at >= 0
    ? value.slice(0, at)
    : value
  if (base.startsWith('//'))
    return `https:${base}`
  return base
}

/** 原图地址（点击查看用，绝对地址） */
function originalImage(raw: string | null | undefined): string {
  return imageBase(raw)
}

/** 带尺寸参数的图片地址（交给 <Picture> 再补 .avif/.webp 后缀） */
function sizedImage(raw: string | null | undefined, size: string): string {
  const base = imageBase(raw)
  return base
    ? `${base}@${size}`
    : ''
}

function pxValue(raw: string): number {
  const value = Number.parseFloat(raw)
  return Number.isFinite(value)
    ? value
    : 0
}

function readPictures(root: ParentNode): DrawnPicture[] {
  return Array.from(root.querySelectorAll('.bili-album__preview__picture'))
    .map((element) => {
      const img = element.querySelector('img')
      const width = pxValue((element as HTMLElement).style.width)
      const height = pxValue((element as HTMLElement).style.height)
      const ratio = width > 0 && height > 0
        ? width / height
        : 1
      return {
        src: sizedImage(img?.getAttribute('src') ?? img?.getAttribute('data-src'), '560w_560h_1c'),
        href: originalImage(img?.getAttribute('src') ?? img?.getAttribute('data-src')),
        ratio,
      }
    })
    .filter(picture => Boolean(picture.src))
}

function readVideo(root: ParentNode): DrawnVideo | null {
  const anchor = root.querySelector<HTMLAnchorElement>('a.bili-dyn-card-video')
  if (!anchor)
    return null

  const cover = anchor.querySelector('.bili-dyn-card-video__cover img')?.getAttribute('src')
  const stats = Array.from(anchor.querySelectorAll('.bili-dyn-card-video__stat__item'))
    .map(item => textOf(item))
    .filter(Boolean)

  return {
    href: anchor.getAttribute('href') ?? '',
    cover: sizedImage(cover, '640w_360h_1c'),
    duration: textOf(anchor.querySelector('.duration-time')),
    title: textOf(anchor.querySelector('.bili-dyn-card-video__title')),
    desc: textOf(anchor.querySelector('.bili-dyn-card-video__desc')),
    badge: textOf(anchor.querySelector('.bili-dyn-card-video__badge')),
    stats,
  }
}

function readReserve(root: ParentNode): DrawnReserve | null {
  const card = root.querySelector('.bili-dyn-card-reserve')
  if (!card)
    return null
  return {
    title: textOf(card.querySelector('.bili-dyn-card-reserve__title')),
    when: textOf(card.querySelector('.bili-dyn-card-reserve__desc__first')),
    count: textOf(card.querySelector('.bili-dyn-card-reserve__desc__second')),
  }
}

function readContent(majorRoot: ParentNode): DrawnContent | null {
  const video = readVideo(majorRoot)
  if (video)
    return { kind: 'video', video, pics: [] }

  const reserve = readReserve(majorRoot)
  if (reserve)
    return { kind: 'reserve', reserve, pics: [] }

  const opus = majorRoot.querySelector('.dyn-card-opus')
  if (opus) {
    return {
      kind: 'opus',
      title: textOf(opus.querySelector('.dyn-card-opus__title')),
      text: textWithout(opus.querySelector('.dyn-card-opus__summary'), '.dyn-card-opus__summary__action'),
      pics: readPictures(opus),
    }
  }

  // 兜底：只有图片网格的图文（没有 dyn-card-opus 包裹）
  const pics = readPictures(majorRoot)
  if (pics.length)
    return { kind: 'opus', pics }

  return null
}

function readStats(item: Element): DrawnStats {
  const readAction = (type: string) => textOf(item.querySelector(`[data-module="action"][data-type="${type}"]`))
  return {
    forward: readAction('forward'),
    comment: readAction('comment'),
    like: readAction('like'),
    liked: Boolean(item.querySelector('[data-module="action"][data-type="like"].liked')),
  }
}

function readAvatar(item: Element): string {
  return sizedImage(item.querySelector('.b-avatar__layer[data-layer-tag="AVATAR_LAYER"] img')?.getAttribute('src'), '80w_80h_1c')
}

/**
 * 解析单条原生列表项。
 *
 * @param wrapper `.bili-dyn-list__item`（外层 wrapper，保留原生无限滚动）
 * @returns 解析成功返回模型；任何关键字段缺失都返回 null（调用方保持原生态）
 */
export function scrapeMoment(wrapper: Element): DrawnMoment | null {
  const item = wrapper.querySelector(NATIVE_CARD_SELECTOR)
  if (!item)
    return null

  const authorName = textOf(item.querySelector('[data-module="title"] .bili-dyn-title__text'))
  if (!authorName)
    return null

  const time = textOf(item.querySelector('[data-module="time"]'))
  const avatar = readAvatar(item)
  const forwText = textOf(item.querySelector('.bili-dyn-content__forw__desc .bili-rich-text__content'))
  const reference = item.querySelector('.bili-dyn-content__orig.reference')
  const stats = readStats(item)

  let quote: DrawnQuote | undefined
  let content: DrawnContent | undefined

  if (reference) {
    const majorRoot = reference.querySelector('.bili-dyn-content__orig__major') ?? reference
    quote = {
      authorName: textOf(reference.querySelector('.dyn-orig-author__name')),
      authorAvatar: sizedImage(reference.querySelector('.dyn-orig-author__face img')?.getAttribute('src'), '48w_48h_1c'),
      content: readContent(majorRoot) ?? undefined,
    }
  }
  else {
    const contentRoot = item.querySelector('.bili-dyn-content') ?? item
    const majorRoot = contentRoot.querySelector('.bili-dyn-content__orig__major') ?? contentRoot
    content = readContent(majorRoot) ?? undefined
  }

  // 既没有正文、也没有可渲染内容 → 视为解析失败，保持原生
  if (!forwText && !quote?.content && !content)
    return null

  return {
    authorName,
    avatar,
    time,
    text: forwText,
    content,
    quote,
    stats,
  }
}
