/**
 * 专栏列表（`/read/home`）的数据源适配层。
 *
 * 真机 dump（2026-11，CDP 只读）确认了三种取数方式，按可靠性排序：
 *
 *   1. `window.__INITIAL_STATE__.home.list` —— 首屏 19 条，字段完整
 *      （id / title / summary / image_urls / author.face / stats.view / stats.like /
 *      publish_time / category.name / view_url）；
 *   2. 原生 DOM `.page-home .feed-item > a.article-item` —— 首屏数据被上游改动时兜底，
 *      缺点是没有发布时间（`publishTime = 0`，卡片上不显示时间）；
 *   3. 翻页接口 `GET /x/article/recommends?cid=0&pn=N&ps=20&aids=<已展示 id>` ——
 *      与原生页面滚动加载用的是同一个接口，实测 code=0、data 为文章数组。
 *
 * 三者都拿不到任何卡片时返回空数组，调用方据此**放弃改造、保留原生 DOM**（不做事就不破坏）。
 */
import type { ReadCard, ReadCardSource } from './types'

/** 专栏推荐分页接口（原生页面滚动加载用的就是它） */
const RECOMMEND_API = 'https://api.bilibili.com/x/article/recommends'
/** 每页条数，与原生页面保持一致 */
export const PAGE_SIZE = 20

/** 接口 / 初始状态里的文章对象（只声明我们用到的字段，其余忽略） */
interface RawArticle {
  id?: number
  title?: string
  summary?: string
  banner_url?: string
  image_urls?: string[]
  origin_image_urls?: string[]
  view_url?: string
  publish_time?: number
  category?: { name?: string }
  author?: { mid?: number, name?: string, face?: string }
  stats?: { view?: number, like?: number, favorite?: number }
}

interface BiliReadInitialState {
  home?: { pn?: number, isEnd?: boolean, list?: RawArticle[] }
}

/** 原生卡片选择器（真机 dump 的真实结构：div.page-home > div.main > div.content > div.feed） */
const NATIVE_CARD_SELECTOR = '.page-home .feed-item a.article-item'

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : 0
}

/** 相对地址 / 协议相对地址补全成 https 绝对地址 */
function toAbsoluteUrl(url: string | undefined): string {
  if (!url)
    return ''
  if (url.startsWith('//'))
    return `https:${url}`
  if (/^https?:\/\//.test(url))
    return url
  return `https://www.bilibili.com${url.startsWith('/')
    ? ''
    : '/'}${url}`
}

/**
 * 给 hdslb 图片补一个适合卡片封面的尺寸后缀（16:9、单次裁切）。
 *
 * 原始封面可能是 1416x798 的大图，直接塞进 16:9 卡片既浪费带宽又会被拉伸；
 * 已经带 `@` 尺寸后缀或不是 hdslb 图床时原样返回。
 */
function withCoverSize(url: string): string {
  if (!url || !/hdslb\.com\//.test(url) || url.includes('@'))
    return url
  return `${url}@640w_360h_1c.webp`
}

/** 把接口 / 初始状态里的文章对象归一成卡片；缺 id 或标题时视为无效 */
function normalizeArticle(raw: RawArticle | null | undefined): ReadCard | null {
  if (!raw || !raw.id || !raw.title)
    return null
  const cover = withCoverSize(
    toAbsoluteUrl(raw.image_urls?.[0] ?? raw.origin_image_urls?.[0] ?? raw.banner_url),
  )
  return {
    id: raw.id,
    title: raw.title.trim(),
    summary: (raw.summary ?? '').trim(),
    cover,
    author: {
      mid: toNumber(raw.author?.mid),
      name: (raw.author?.name ?? '').trim(),
      face: toAbsoluteUrl(raw.author?.face),
    },
    views: toNumber(raw.stats?.view),
    likes: toNumber(raw.stats?.like),
    favorites: toNumber(raw.stats?.favorite),
    publishTime: toNumber(raw.publish_time),
    category: (raw.category?.name ?? '').trim(),
    url: toAbsoluteUrl(raw.view_url) || `https://www.bilibili.com/read/cv${raw.id}`,
  }
}

function isReadCard(card: ReadCard | null): card is ReadCard {
  return card !== null
}

function getInitialState(): BiliReadInitialState | undefined {
  return (window as unknown as { __INITIAL_STATE__?: BiliReadInitialState }).__INITIAL_STATE__
}

/** 数据源 1：页面直出的首屏列表 */
export function readInitialStateCards(): ReadCard[] {
  const list = getInitialState()?.home?.list
  if (!Array.isArray(list))
    return []
  return list.map(normalizeArticle).filter(isReadCard)
}

/** 「29.1万」「1.2萬」「3.4K」这类简写数字还原成整数 */
function parseCountText(text: string | null | undefined): number {
  if (!text)
    return 0
  const match = /^([\d.]+)\s*([万萬亿億千KMB])?$/i.exec(text.trim())
  if (!match)
    return 0
  const base = Number(match[1])
  if (!Number.isFinite(base))
    return 0
  const unit = match[2]
  switch (unit) {
    case '万':
    case '萬':
    case '千':
      return Math.round(base * 1e4)
    case '亿':
    case '億':
      return Math.round(base * 1e8)
    case 'K':
    case 'k':
      return Math.round(base * 1e3)
    case 'M':
    case 'm':
      return Math.round(base * 1e6)
    case 'B':
    case 'b':
      return Math.round(base * 1e9)
    default:
      return Math.round(base)
  }
}

function textOf(parent: Element | null, selector: string): string {
  return parent?.querySelector(selector)?.textContent?.trim() ?? ''
}

/**
 * 数据源 2：直接读原生卡片 DOM。
 *
 * 只做「读取」，不移动 / 不删除任何原生节点；读到的卡片渲染到自绘层后，
 * 原生列表由页面级样式整体隐藏（见 readPage.scss），失败时什么都不做。
 */
export function readNativeCards(): ReadCard[] {
  const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>(NATIVE_CARD_SELECTOR))
  const cards: ReadCard[] = []
  for (const anchor of anchors) {
    const href = anchor.getAttribute('href') ?? ''
    const idMatch = /cv(\d+)/.exec(href)
    const id = idMatch
      ? Number(idMatch[1])
      : 0
    const title = textOf(anchor, '.article-item__title')
    if (!id || !title)
      continue
    const coverImg = anchor.querySelector<HTMLImageElement>('.article-item__right img')
    const faceImg = anchor.querySelector<HTMLImageElement>('.article-item__avatar img')
    cards.push({
      id,
      title,
      summary: textOf(anchor, '.article-item__desc'),
      cover: withCoverSize(toAbsoluteUrl(coverImg?.getAttribute('src') ?? '')),
      author: {
        mid: 0,
        name: textOf(anchor, '.article-item__uname'),
        face: toAbsoluteUrl(faceImg?.getAttribute('src') ?? ''),
      },
      views: parseCountText(textOf(anchor, '.article-item__stat.view')),
      likes: parseCountText(textOf(anchor, '.article-item__stat.like')),
      favorites: 0,
      publishTime: 0,
      category: textOf(anchor, '.article-item__label'),
      url: toAbsoluteUrl(href) || `https://www.bilibili.com/read/cv${id}`,
    })
  }
  return cards
}

/**
 * 取首屏卡片。
 *
 * 返回 `null` 表示两种数据源都不可用 —— 调用方必须放弃改造并保留原生页面；
 * 不要用空数组冒充成功，否则会出现「原生被隐藏、自绘层却没数据」的白页。
 */
export function getInitialCards(): { cards: ReadCard[], source: ReadCardSource } | null {
  const fromState = readInitialStateCards()
  if (fromState.length > 0)
    return { cards: fromState, source: 'initial-state' }
  const fromDom = readNativeCards()
  if (fromDom.length > 0)
    return { cards: fromDom, source: 'native-dom' }
  return null
}

/**
 * 翻页取更多卡片。
 *
 * `aids` 传已展示过的 id，接口会把它们排除掉；返回空数组表示到底了。
 * 网络 / 接口异常时抛错，由组件显示「重试」，不做无限静默重试。
 */
export async function fetchMoreCards(pn: number, excludeIds: number[]): Promise<ReadCard[]> {
  const params = new URLSearchParams({
    cid: '0',
    pn: String(pn),
    ps: String(PAGE_SIZE),
  })
  if (excludeIds.length > 0)
    params.set('aids', excludeIds.slice(-PAGE_SIZE).join(','))

  const response = await fetch(`${RECOMMEND_API}?${params.toString()}`, { credentials: 'include' })
  if (!response.ok)
    throw new Error(`[bewly] read recommends HTTP ${response.status}`)

  const json = await response.json() as { code?: number, data?: RawArticle[] | null }
  if (json.code !== 0)
    throw new Error(`[bewly] read recommends code ${json.code}`)
  if (!Array.isArray(json.data))
    return []

  return json.data.map(normalizeArticle).filter(isReadCard)
}
