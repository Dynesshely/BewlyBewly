/**
 * 把 B 站动态接口的原始条目归一化成卡片视图模型。
 *
 * 容错原则：接口缺字段、类型不认识、单条解析失败都只丢这一条，不影响整个列表。
 */
import type {
  MomentArticle,
  MomentAuthor,
  MomentCard,
  MomentImage,
  MomentLive,
  MomentVideo,
  RawDrawItem,
  RawLivePlayInfo,
  RawMajor,
  RawMomentItem,
} from '../types'

const MOMENTS_ORIGIN = 'https://t.bilibili.com'
const OPUS_ORIGIN = 'https://www.bilibili.com/opus'

/** 补全协议相对地址（//i0.hdslb.com/...） */
function absoluteUrl(url?: string): string {
  const value = url?.trim()
  if (!value)
    return ''
  if (value.startsWith('//'))
    return `https:${value}`
  if (value.startsWith('http://'))
    return `https://${value.slice('http://'.length)}`
  return value
}

/** 去掉 B 站图片地址上已有的 @ 尺寸后缀，换成需要的尺寸 */
export function momentImageUrl(url: string | undefined, size?: string): string {
  const absolute = absoluteUrl(url)
  if (!absolute)
    return ''
  const base = absolute.split('@')[0] ?? absolute
  return size
    ? `${base}@${size}`
    : base
}

function toImage(item?: RawDrawItem): MomentImage | null {
  const url = momentImageUrl(item?.src ?? item?.url)
  if (!url)
    return null
  const width = Number(item?.width) || 0
  const height = Number(item?.height) || 0
  return { url, width, height }
}

function pickImages(major: RawMajor): MomentImage[] {
  const raw = major.draw?.items ?? major.opus?.pics ?? []
  const images: MomentImage[] = []
  for (const item of raw) {
    const image = toImage(item)
    if (image)
      images.push(image)
  }
  // 单条动态最多 9 图，多余的直接丢弃，避免布局兜不住
  return images.slice(0, 9)
}

function pickVideo(major: RawMajor): MomentVideo | undefined {
  if (major.archive) {
    const archive = major.archive
    const jumpUrl = absoluteUrl(archive.jump_url)
      || (archive.bvid
        ? `https://www.bilibili.com/video/${archive.bvid}`
        : '')
    if (!jumpUrl)
      return undefined
    return {
      title: archive.title ?? '',
      cover: momentImageUrl(archive.cover, '480w_300h_1c'),
      jumpUrl,
      duration: archive.duration_text ?? '',
      play: archive.stat?.play ?? '',
      danmaku: archive.stat?.danmaku ?? '',
      badge: archive.badge?.text ?? '',
    }
  }

  if (major.pgc) {
    const pgc = major.pgc
    const jumpUrl = absoluteUrl(pgc.jump_url)
      || (pgc.epid
        ? `https://www.bilibili.com/bangumi/play/ep${pgc.epid}`
        : '')
    if (!jumpUrl)
      return undefined
    return {
      title: pgc.title ?? '',
      cover: momentImageUrl(pgc.cover, '480w_300h_1c'),
      jumpUrl,
      duration: '',
      play: pgc.stat?.play ?? '',
      danmaku: pgc.stat?.danmaku ?? '',
      // 接口没给角标时留空，由卡片按当前语言补「番剧 / 番劇 / Bangumi」文案
      badge: pgc.badge?.text ?? '',
    }
  }

  return undefined
}

function pickArticle(major: RawMajor): MomentArticle | undefined {
  const article = major.article
  if (!article)
    return undefined
  const jumpUrl = absoluteUrl(article.jump_url)
    || (article.id
      ? `https://www.bilibili.com/read/cv${article.id}`
      : '')
  if (!jumpUrl)
    return undefined
  return {
    title: article.title ?? '',
    desc: article.desc ?? '',
    cover: momentImageUrl(article.covers?.[0], '320w_200h_1c'),
    jumpUrl,
  }
}

function parseLiveInfo(major: RawMajor): RawLivePlayInfo | null {
  if (major.live_rcmd?.live_play_info)
    return major.live_rcmd.live_play_info
  if (major.live)
    return major.live

  const content = major.live_rcmd?.content
  if (content) {
    try {
      const parsed = JSON.parse(content) as { live_play_info?: RawLivePlayInfo }
      if (parsed?.live_play_info)
        return parsed.live_play_info
    }
    catch {
      // content 不是合法 JSON 时忽略这一条
    }
  }
  return null
}

function pickLive(major: RawMajor): MomentLive | undefined {
  const info = parseLiveInfo(major)
  if (!info)
    return undefined
  const jumpUrl = absoluteUrl(info.link)
  if (!jumpUrl)
    return undefined
  return {
    title: info.title ?? '',
    cover: momentImageUrl(info.cover, '480w_300h_1c'),
    jumpUrl,
    area: info.area_name ?? '',
    online: Number(info.online) || 0,
    liveStatus: Number(info.live_status) || 0,
  }
}

function pickAuthor(item: RawMomentItem): MomentAuthor {
  const author = item.modules?.module_author
  const label = typeof author?.label === 'string'
    ? author.label
    : author?.label?.text ?? ''
  return {
    mid: Number(author?.mid) || 0,
    name: author?.name ?? '',
    face: momentImageUrl(author?.face, '96w_96h_1c'),
    jumpUrl: absoluteUrl(author?.jump_url)
      || (author?.mid
        ? `https://space.bilibili.com/${author.mid}`
        : ''),
    pubAction: author?.pub_action ?? '',
    label: label || author?.official_verify?.desc || author?.vip?.label?.text || '',
  }
}

function detailUrl(item: RawMomentItem, major: RawMajor, fallback: string): string {
  if (fallback)
    return fallback
  if (major.opus?.jump_url)
    return absoluteUrl(major.opus.jump_url)
  const id = item.id_str?.trim()
  if (!id)
    return MOMENTS_ORIGIN
  return item.type === 'DYNAMIC_TYPE_OPUS'
    ? `${OPUS_ORIGIN}/${id}`
    : `${MOMENTS_ORIGIN}/${id}`
}

/**
 * 归一化一条动态。
 *
 * @param item 接口原始条目
 * @param depth 0 = 顶层卡片；1 = 转发里的原动态（不再继续向下解析转发）
 */
export function normalizeMoment(item: RawMomentItem | null | undefined, depth = 0): MomentCard | null {
  if (!item || item.visible === false)
    return null

  const modules = item.modules ?? {}
  const dynamicModule = modules.module_dynamic ?? {}
  const major = dynamicModule.major ?? {}
  const text = (dynamicModule.desc?.text ?? '').trim()

  const images = pickImages(major)
  const video = pickVideo(major)
  const article = pickArticle(major)
  const live = pickLive(major)

  // 未知类型（如课程、横幅）只要没有可用内容就丢弃，避免出现空卡片
  const origin = depth === 0 && item.orig
    ? normalizeMoment(item.orig, depth + 1) ?? undefined
    : undefined

  /** 原动态被删除时 orig 为 null，但类型仍然是转发 */
  const isForward = item.type === 'DYNAMIC_TYPE_FORWARD'

  let type: MomentCard['type'] = 'unknown'
  if (video)
    type = major.pgc ? 'pgc' : 'video'
  else if (article)
    type = 'article'
  else if (live)
    type = 'live'
  else if (origin || isForward)
    type = 'forward'
  else if (images.length)
    type = 'images'
  else if (text)
    type = 'text'

  if (type === 'unknown' && !text)
    return null

  const stats = modules.module_stat
  const pubTs = Number(modules.module_author?.pub_ts) || 0

  return {
    id: item.id_str?.trim() || `moment-${pubTs}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    author: pickAuthor(item),
    pubTs: pubTs
      ? pubTs * 1000
      : 0,
    text,
    images,
    video,
    article,
    live,
    origin,
    stats: {
      forward: Number(stats?.forward?.count) || 0,
      comment: Number(stats?.comment?.count) || 0,
      like: Number(stats?.like?.count) || 0,
      liked: stats?.like?.status === true,
    },
    jumpUrl: detailUrl(item, major, video?.jumpUrl || article?.jumpUrl || live?.jumpUrl || ''),
  }
}

/** 批量归一化，自动跳过无法解析的条目 */
export function normalizeMoments(items: RawMomentItem[]): MomentCard[] {
  const cards: MomentCard[] = []
  for (const item of items) {
    try {
      const card = normalizeMoment(item)
      if (card)
        cards.push(card)
    }
    catch {
      // 单条解析异常不影响整个列表
    }
  }
  return cards
}
