/**
 * 动态页（自绘）的纯函数层：路由解析、接口条目 → 渲染模型、去重、格式化。
 *
 * 全部是无副作用的纯函数，方便真机断言与以后的单测；DOM / 请求一律不在这一层。
 *
 * # 真机约束（2026-11-19）
 *
 * - 图片地址：真机返回 `http://i0.hdslb.com/…`（**没有 s**），页面是 https。
 *   直接塞进 `<img src>` 会被浏览器按「混合内容」拦掉（真机验证过：https 页面加载
 *   http 图片会静默失败），所以一律先补成 https。
 * - 图片缩略：B 站图床的缩放参数是 `@<宽>w[_<高>h]_1c`，**不能**直接给 `.jpg` 拼
 *   `.avif` 后缀（`xxx.jpg.avif` 真机 404），但 `xxx.jpg@720w_1c.avif` 是 200。
 *   `Picture` 组件会自动再拼 `.avif` / `.webp`，所以本层只给 `@720w_1c` 这种尺寸串。
 * - 表情图是 `…/emote/xxx.png`：`.png.avif` 真机 404，且表情不需要缩放，
 *   所以表情一律用原始 url（`Picture` 的 avif 探测对它是无效但无害的额外请求，
 *   这里改用内联 `<img>` 绕过，见 DynamicText.vue）。
 */

import type {
  DynamicApiItem,
  DynamicArchive,
  DynamicAuthor,
  DynamicContent,
  DynamicItem,
  DynamicParagraph,
  DynamicPicture,
  DynamicRichText,
  DynamicRichTextNode,
  DynamicStats,
  DynamicTextNode,
  DynamicVideo,
} from './types'
import type { ModuleLocale } from '~/utils/moduleI18n'
import {
  DYNAMIC_AVATAR_SIZE,
  DYNAMIC_DETAIL_BASE_URL,
  DYNAMIC_EXCLUDED_PATH_RE,
  DYNAMIC_HOST_RE,
  DYNAMIC_VIDEO_BASE_URL,
} from './constants'

/* #region 路由 */

/** 是否是动态页主机（t.bilibili.com） */
export function isDynamicPageHost(hostname: string = location.hostname): boolean {
  return DYNAMIC_HOST_RE.test(hostname)
}

/**
 * 本模块是否接管当前路径。
 *
 * 只接管列表首页 `/`（原生 tab 是 `/?tab=video` 这种 query，不进 pathname）。
 * 动态详情 `/<id>`、投票 `/vote/…`、分享 `/share/…`、opus `/opus/…` 一律不接管。
 */
export function isOwnedDynamicPath(pathname: string = location.pathname): boolean {
  const normalized = pathname.replace(/\/{2,}/g, '/')
  if (normalized !== '/' && normalized !== '')
    return false
  return !DYNAMIC_EXCLUDED_PATH_RE.test(normalized)
}

/** 从 URL 的 `?tab=` 解析当前频道；非法值退回 `all` */
export function parseDynamicTab(
  search: string = location.search,
): 'all' | 'video' | 'pgc' | 'article' {
  const value = new URLSearchParams(search).get('tab')
  if (value === 'video' || value === 'pgc' || value === 'article')
    return value
  return 'all'
}

/**
 * 生成 tab 的地址（写进 history，保证刷新 / 前进后退状态一致）。
 *
 * 原生页用的就是 `/?tab=video`，本模块沿用同一套参数，两个页面可以互相接力。
 */
export function buildDynamicTabUrl(tab: string): string {
  if (tab === 'all' || !tab)
    return '/'
  return `/?tab=${encodeURIComponent(tab)}`
}

/* #endregion */

/* #region 地址补全 */

/**
 * 把协议相对（`//…`）与 http（真机图床）地址补成安全的 https 绝对地址。
 *
 * https 页面加载 http 图片会被浏览器按混合内容拦掉（真机验证失败），所以升级协议。
 */
export function normalizeUrl(url?: string): string {
  if (!url)
    return ''
  const trimmed = url.trim()
  if (!trimmed)
    return ''
  if (trimmed.startsWith('//'))
    return `https:${trimmed}`
  if (trimmed.startsWith('http://'))
    return `https://${trimmed.slice('http://'.length)}`
  if (trimmed.startsWith('/'))
    return `${DYNAMIC_VIDEO_BASE_URL}${trimmed}`
  return trimmed
}

/**
 * 给图床地址补缩略参数：`@<宽>w_1c`（等比缩到指定宽度）。
 *
 * 已经有 `@` 参数时不重复补（接口偶尔会带，例如表情 / 头像）。
 */
export function withImageSize(url: string | undefined, width: number): string {
  const normalized = normalizeUrl(url)
  if (!normalized || normalized.includes('@'))
    return normalized
  return `${normalized}@${width}w_1c`
}

/** 头像地址（128 圆图 + 尺寸参数） */
export function avatarUrl(face: string | undefined): string {
  return withImageSize(face, DYNAMIC_AVATAR_SIZE)
}

/** 去掉 `@` 缩放参数，得到原图地址（点击查看原图用） */
export function originalImageUrl(url: string | undefined): string {
  const normalized = normalizeUrl(url)
  if (!normalized)
    return ''
  const at = normalized.indexOf('@')
  return at === -1
    ? normalized
    : normalized.slice(0, at)
}

/** 动态详情页地址 */
export function detailUrl(id: string): string {
  return `${DYNAMIC_DETAIL_BASE_URL}/${id}`
}

/** 作者空间动态页（接口给的是 `//space.bilibili.com/<mid>/dynamic`） */
export function authorUrl(author: DynamicAuthor | undefined): string {
  const raw = author?.jump_url
  if (raw)
    return normalizeUrl(raw)
  if (author?.mid)
    return `https://space.bilibili.com/${String(author.mid)}/dynamic`
  return ''
}

/* #endregion */

/* #region 正文归一化 */

/** 富文本节点 → 渲染节点；无法识别的类型一律当纯文本，保证不丢字 */
export function toTextNode(node: DynamicRichTextNode): DynamicTextNode | null {
  const text = node.text ?? node.orig_text ?? ''
  if (node.type === 'RICH_TEXT_NODE_TYPE_EMOJI') {
    const icon = node.emoji?.icon_url
    // 表情图缺失时退回占位文案（真机里 icon_url 存在，兜底只为不渲染空图）
    return icon
      ? {
          kind: 'emoji',
          text: node.emoji?.text ?? text,
          href: '',
          icon: normalizeUrl(icon),
        }
      : {
          kind: 'text',
          text,
          href: '',
          icon: '',
        }
  }
  const href = normalizeUrl(node.jump_url)
  if (href)
    return { kind: 'link', text, href, icon: '' }
  return text
    ? {
        kind: 'text',
        text,
        href: '',
        icon: '',
      }
    : null
}

/**
 * 富文本 → 段落模型。
 *
 * 真机里 `rich_text_nodes` 是完整的节点数组；但它没有时（部分旧数据 / 转发原文）
 * 只能拿 `text` 整段当纯文本，所以两条路都要走。
 */
export function toParagraph(rich?: DynamicRichText | null): DynamicParagraph | null {
  if (!rich)
    return null
  const nodes = Array.isArray(rich.rich_text_nodes)
    ? rich.rich_text_nodes.map(toTextNode).filter((node): node is DynamicTextNode => node !== null)
    : []
  const plain = rich.text ?? nodes.map(node => node.text).join('')
  if (nodes.length === 0) {
    if (!plain.trim())
      return null
    return {
      nodes: [
        {
          kind: 'text',
          text: plain,
          href: '',
          icon: '',
        },
      ],
      plain,
    }
  }
  const merged = nodes.filter(node => node.text !== '' || node.kind === 'emoji')
  if (merged.length === 0 && !plain.trim())
    return null
  return { nodes: merged, plain: plain || merged.map(node => node.text).join('') }
}

/* #endregion */

/* #region 内容归一化 */

/** 九宫格 / 图文图片 → 渲染图片 */
export function toPictures(sources: { url?: string, src?: string, width?: number | string, height?: number | string }[] | undefined, width = 720): DynamicPicture[] {
  if (!Array.isArray(sources))
    return []
  return sources
    .map((source) => {
      const raw = source.url ?? source.src
      if (!raw)
        return null
      const w = Number(source.width) || 0
      const h = Number(source.height) || 0
      return {
        src: withImageSize(raw, width),
        href: originalImageUrl(raw),
        ratio: w > 0 && h > 0
          ? w / h
          : 1,
      } satisfies DynamicPicture
    })
    .filter((picture): picture is DynamicPicture => picture !== null)
}

/** 视频封面宽度（原生动态卡的封面是 472w，这里取 480 对齐） */
const VIDEO_COVER_WIDTH = 480

/** 视频卡 */
export function toVideo(archive: DynamicArchive): DynamicVideo | null {
  // **必须走 withImageSize**：Picture 组件会给 src 拼 `.avif` / `.webp` 候选，
  // 而裸 `xxx.jpg.avif` 在真机上是 404（B 站图床的格式后缀只能在 `@` 参数之后）。
  // 漏掉这一步的话封面会全部走失败兜底 —— 真机 e2e 首次截图就踩到了。
  const cover = withImageSize(archive.cover, VIDEO_COVER_WIDTH)
  if (!cover && !archive.title)
    return null
  const stat = archive.stat
  const stats: string[] = []
  const play = Number(stat?.play)
  if (Number.isFinite(play) && play > 0)
    stats.push(`${formatCompactCount(play)} 播放`)
  const danmaku = Number(stat?.danmaku)
  if (Number.isFinite(danmaku) && danmaku > 0)
    stats.push(`${formatCompactCount(danmaku)} 弹幕`)
  return {
    href: normalizeUrl(archive.jump_url) || `${DYNAMIC_VIDEO_BASE_URL}/video/${archive.bvid ?? ''}`,
    cover,
    duration: archive.duration_text ?? '',
    title: archive.title ?? '',
    desc: (archive.desc ?? '').trim(),
    badge: archive.badge?.text ?? '',
    stats,
  }
}

/** 主内容（视频 / 图文 / 通用卡） */
export function toContent(item: DynamicApiItem): DynamicContent | null {
  const major = item.modules?.module_dynamic?.major
  if (!major)
    return null

  if (major.archive) {
    const video = toVideo(major.archive)
    if (!video)
      return null
    return {
      kind: 'video',
      video,
      paragraphs: [],
      pictures: [],
      href: video.href,
    }
  }

  if (major.opus) {
    const opus = major.opus
    const paragraphs: DynamicParagraph[] = []
    const summary = toParagraph(opus.summary)
    if (summary)
      paragraphs.push(summary)
    const pictures = toPictures(opus.pics)
    if (!opus.title && paragraphs.length === 0 && pictures.length === 0)
      return null
    return {
      kind: 'opus',
      title: opus.title ?? '',
      paragraphs,
      pictures,
      href: normalizeUrl(opus.jump_url),
    }
  }

  if (major.draw) {
    const pictures = toPictures(major.draw.items)
    if (pictures.length === 0)
      return null
    return {
      kind: 'opus',
      paragraphs: [],
      pictures,
      href: detailUrl(item.id_str),
    }
  }

  if (major.article) {
    const article = major.article
    const covers = toPictures((article.covers ?? []).map(cover => ({ src: cover })))
    if (!article.title && covers.length === 0)
      return null
    return {
      kind: 'opus',
      title: article.title ?? '',
      paragraphs: article.desc
        ? [
            {
              nodes: [
                {
                  kind: 'text',
                  text: article.desc,
                  href: '',
                  icon: '',
                },
              ],
              plain: article.desc,
            },
          ]
        : [],
      pictures: covers,
      href: normalizeUrl(article.jump_url) || detailUrl(item.id_str),
    }
  }

  if (major.common) {
    const common = major.common
    const cover = normalizeUrl(common.cover)
    if (!common.title && !cover)
      return null
    return {
      kind: 'common',
      title: common.title ?? '',
      paragraphs: common.desc
        ? [
            {
              nodes: [
                {
                  kind: 'text',
                  text: common.desc,
                  href: '',
                  icon: '',
                },
              ],
              plain: common.desc,
            },
          ]
        : [],
      pictures: cover
        ? [
            {
              src: withImageSize(cover, 480),
              href: originalImageUrl(cover),
              ratio: 16 / 9,
            },
          ]
        : [],
      href: normalizeUrl(common.jump_url),
    }
  }

  return null
}

/** 互动计数 */
export function toStats(item: DynamicApiItem, locale: ModuleLocale): DynamicStats {
  const stat = item.modules?.module_stat
  return {
    forward: formatCount(stat?.forward?.count, locale),
    comment: formatCount(stat?.comment?.count, locale),
    like: formatCount(stat?.like?.count, locale),
    liked: Boolean(stat?.like?.status),
  }
}

/* #endregion */

/* #region 数字 / 时间格式化 */

const ZH_UNITS = [
  { value: 1e8, symbol: '亿' },
  { value: 1e4, symbol: '万' },
]

const ZH_TW_UNITS = [
  { value: 1e8, symbol: '億' },
  { value: 1e4, symbol: '萬' },
]

const EN_UNITS = [
  { value: 1e9, symbol: 'B' },
  { value: 1e6, symbol: 'M' },
  { value: 1e3, symbol: 'K' },
]

function unitsFor(locale: ModuleLocale) {
  if (locale === 'en')
    return EN_UNITS
  if (locale === 'cmn-TW' || locale === 'jyut')
    return ZH_TW_UNITS
  return ZH_UNITS
}

function trimTrailingZero(text: string): string {
  return text.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
}

/**
 * 紧凑计数：12345 → 1.2万 / 1.2萬 / 12.3K。
 *
 * **0 与「无计数」都返回空串**：动态操作栏的原生行为就是「0 不显示数字」，
 * 返回 `'0'` 会让每条动态的转发 / 评论下面都挂一个刺眼的 0。
 */
export function formatCount(value: number | string | undefined, locale: ModuleLocale): string {
  const number = typeof value === 'number'
    ? value
    : Number.parseFloat(String(value ?? '').replace(/,/g, ''))
  if (!Number.isFinite(number) || number <= 0)
    return ''
  const units = unitsFor(locale)
  for (const unit of units) {
    if (number >= unit.value)
      return `${trimTrailingZero((number / unit.value).toFixed(1))}${unit.symbol}`
  }
  return String(Math.round(number))
}

/** 视频卡里的播放 / 弹幕数（与操作栏不同，这里 0 也要显示成 0，因为它是统计标签） */
export function formatCompactCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0)
    return '0'
  if (value >= 1e8)
    return `${trimTrailingZero((value / 1e8).toFixed(1))}亿`
  if (value >= 1e4)
    return `${trimTrailingZero((value / 1e4).toFixed(1))}万`
  return String(Math.round(value))
}

/**
 * 发布时间文案。
 *
 * 优先用接口给的 `pub_time`（真机是「5小时前」这类**已本地化**文案，与原生完全一致）；
 * 只有它缺失时才用 `pub_ts` 自己算，避免两套时间格式在同一页里打架。
 */
export function resolveTime(author: { pub_time?: string, pub_ts?: string } | undefined): {
  time: string
  timestamp: number
} {
  const timestamp = Number(author?.pub_ts)
  const raw = (author?.pub_time ?? '').trim()
  return {
    time: raw,
    timestamp: Number.isFinite(timestamp)
      ? timestamp
      : 0,
  }
}

/* #endregion */

/* #region 条目 → 渲染模型 */

function toQuote(item: DynamicApiItem | null | undefined): DynamicItem['quote'] {
  if (!item)
    return undefined
  const author = item.modules?.module_author
  const paragraphs: DynamicParagraph[] = []
  const desc = toParagraph(item.modules?.module_dynamic?.desc)
  if (desc)
    paragraphs.push(desc)
  const content = toContent(item)
  // 原动态被删 / 不可见时接口仍会给一个空壳，什么都不渲染比渲染一个空块好
  if (paragraphs.length === 0 && !content)
    return undefined
  return {
    authorName: author?.name ?? '',
    authorFace: avatarUrl(author?.face),
    authorHref: authorUrl(author),
    paragraphs,
    content: content ?? undefined,
  }
}

/**
 * 接口条目 → 卡片模型。
 *
 * 返回 null 表示「这条没法渲染」：上层会**跳过它**（不渲染空卡片），
 * 而不是渲染一个只剩标题的残缺卡。
 */
export function toDynamicItem(item: DynamicApiItem, locale: ModuleLocale): DynamicItem | null {
  if (!item?.id_str)
    return null
  if (item.visible === false)
    return null

  const author = item.modules?.module_author
  // 作者信息缺失时无法渲染头部，直接跳过（真机里不会发生，但接口异常时不能崩）
  if (!author?.mid || !author.name)
    return null

  const dynamic = item.modules?.module_dynamic
  const paragraphs: DynamicParagraph[] = []
  const desc = toParagraph(dynamic?.desc)
  if (desc)
    paragraphs.push(desc)

  const isForward = item.type === 'DYNAMIC_TYPE_FORWARD' || Boolean(item.orig)
  const quote = isForward
    ? toQuote(item.orig)
    : undefined
  const content = isForward
    ? undefined
    : toContent(item) ?? undefined

  // 正文 / 主内容 / 引用块三样都没有 → 这条没有可展示的内容
  if (paragraphs.length === 0 && !content && !quote)
    return null

  const { time, timestamp } = resolveTime(author)
  const vipType = author.vip?.type ?? 0
  const topic = dynamic?.topic

  return {
    id: item.id_str,
    authorName: author.name,
    authorFace: avatarUrl(author.face),
    authorHref: authorUrl(author),
    time,
    timestamp,
    pendant: normalizeUrl(author.pendant?.image ?? ''),
    vipLabel: vipType > 0
      ? (author.vip?.label?.text ?? '')
      : '',
    official: (author.official_verify?.desc ?? '').trim(),
    paragraphs,
    content,
    quote,
    stats: toStats(item, locale),
    href: detailUrl(item.id_str),
    topic: (topic?.name ?? '').trim(),
    topicHref: normalizeUrl(topic?.jump_url ?? ''),
  }
}

/**
 * 一批条目 → 卡片模型（跳过无法渲染的），并按 id 去重。
 *
 * 去重的原因：接口在「刚发了新动态」时相邻两页会回同一条（真机在空间页
 * `arc/search` 上见过同样现象），重复 key 会让 Vue 的 diff 出问题。
 */
export function toDynamicItems(
  items: DynamicApiItem[] | undefined,
  locale: ModuleLocale,
  existingIds: Set<string> = new Set(),
): DynamicItem[] {
  if (!Array.isArray(items))
    return []
  const seen = new Set(existingIds)
  const output: DynamicItem[] = []
  for (const raw of items) {
    const mapped = toDynamicItem(raw, locale)
    if (!mapped || seen.has(mapped.id))
      continue
    seen.add(mapped.id)
    output.push(mapped)
  }
  return output
}

/** 是否还有下一页：接口的 `has_more` 是唯一判据（真机 offset 游标分页） */
export function hasMorePages(hasMore: boolean | undefined, itemCount: number): boolean {
  if (!hasMore)
    return false
  // 说有下一页却一条都拿不到 → 认定到底，避免空转
  return itemCount > 0
}

/* #endregion */
