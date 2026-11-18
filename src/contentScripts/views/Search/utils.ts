import type { SearchDurationId, SearchOrderId } from './constants'
import type { SearchApiItem, SearchFiltersState, SearchRouteState } from './types'
/**
 * 搜索结果页（自绘）的纯函数层：路由解析、URL 构造、接口字段清洗、分页窗口。
 *
 * 全部无副作用，方便真机断言与以后的单测。
 */
import type { Author, Video } from '~/components/VideoCard/types'
import {
  DEFAULT_SEARCH_ORDER,
  NATIVE_SEARCH_BASE_URL,
  OWNED_SEARCH_PATHS,
  SEARCH_DEFAULT_PATH,
  SEARCH_DURATIONS,
  SEARCH_HOST_RE,
  SEARCH_ORDERS,
  SEARCH_TIDS,
} from './constants'

/** 是否搜索页主机（search.bilibili.com 及其子域） */
export function isSearchPageHost(hostname: string = location.hostname): boolean {
  return SEARCH_HOST_RE.test(hostname)
}

/**
 * 是否是本模块接管的路径。
 *
 * 真机确认搜索页的 tab 路径是 `/all`、`/video`、`/bangumi`、`/article`…
 * 本轮只接管视频结果为主的 `/all` 与 `/video`（以及根路径），
 * 其它 tab 的数据源不是 video，**完全不接管**，保证原生页可用。
 */
export function isOwnedSearchPath(pathname: string = location.pathname): boolean {
  return OWNED_SEARCH_PATHS.includes(pathname)
}

/** 从 query 里取关键词（去空白）；没有则空串（调用方据此回退原生页） */
export function parseSearchKeyword(search: string = location.search): string {
  try {
    return (new URLSearchParams(search).get('keyword') ?? '').trim()
  }
  catch {
    // URLSearchParams 不会抛，兜底只为语法完整
    return ''
  }
}

/** 从 query 里取页码；非法 / 缺省 / 小于 1 一律按第 1 页 */
export function parseSearchPage(search: string = location.search): number {
  try {
    const raw = Number.parseInt(new URLSearchParams(search).get('page') ?? '', 10)
    return Number.isFinite(raw) && raw > 0
      ? raw
      : 1
  }
  catch {
    return 1
  }
}

/** 分区 id 是否在已验证的选项里 */
export function isKnownTid(tid: string): boolean {
  return SEARCH_TIDS.some(option => String(option.id) === tid)
}

/**
 * 从 query 解析筛选条件（白名单校验）。
 *
 * 参数名与原生搜索页一致：`order` / `duration` / `tids_1`（一级分区）。
 * 非白名单取值一律回落默认，避免把用户的脏 URL 直接透传给接口。
 */
export function parseSearchFilters(search: string = location.search): SearchFiltersState {
  let params: URLSearchParams
  try {
    params = new URLSearchParams(search)
  }
  catch {
    return { order: DEFAULT_SEARCH_ORDER, duration: '', tid: '' }
  }

  const rawOrder = params.get('order') ?? ''
  const rawDuration = params.get('duration') ?? ''
  const rawTid = params.get('tids_1') ?? params.get('tids') ?? ''

  return {
    order: (SEARCH_ORDERS as string[]).includes(rawOrder)
      ? rawOrder as SearchOrderId
      : DEFAULT_SEARCH_ORDER,
    duration: (SEARCH_DURATIONS as string[]).includes(rawDuration)
      ? rawDuration as SearchDurationId
      : '',
    tid: isKnownTid(rawTid)
      ? rawTid
      : '',
  }
}

/** 从 URL 解析出完整的视图状态 */
export function parseSearchRoute(search: string = location.search): SearchRouteState {
  return {
    keyword: parseSearchKeyword(search),
    page: parseSearchPage(search),
    filters: parseSearchFilters(search),
  }
}

/** 两个视图状态是否等价（用于路由同步时短路，避免自己写 URL 又自己响应） */
export function isSameRoute(a: SearchRouteState, b: SearchRouteState): boolean {
  return a.keyword === b.keyword
    && a.page === b.page
    && a.filters.order === b.filters.order
    && a.filters.duration === b.filters.duration
    && a.filters.tid === b.filters.tid
}

/**
 * 构造写回地址栏的相对 URL（只带本模块认识的参数）。
 *
 * 用相对路径 + pushState，保留当前 pathname（/all 或 /video），
 * 与原生搜索页的参数名保持一致：
 *   ?keyword=原神&page=2&order=pubdate&duration=2&tids_1=4
 * 默认值不进 URL（第 1 页 / 综合排序 / 全部分区 / 全部时长），保持地址干净。
 */
export function buildSearchUrl(
  pathname: string,
  keyword: string,
  page: number,
  filters: SearchFiltersState,
): string {
  const params = new URLSearchParams()
  params.set('keyword', keyword)
  if (page > 1)
    params.set('page', String(page))
  if (filters.order !== DEFAULT_SEARCH_ORDER)
    params.set('order', filters.order)
  if (filters.duration)
    params.set('duration', filters.duration)
  if (filters.tid)
    params.set('tids_1', filters.tid)

  const path = isOwnedSearchPath(pathname)
    ? pathname
    : SEARCH_DEFAULT_PATH
  return `${path}?${params.toString()}`
}

/** 原生搜索结果页的绝对地址（错误态 / 关键词为空时的回退链接） */
export function buildNativeSearchUrl(
  keyword: string,
  page = 1,
): string {
  const params = new URLSearchParams()
  params.set('keyword', keyword)
  if (page > 1)
    params.set('page', String(page))
  return `${NATIVE_SEARCH_BASE_URL + SEARCH_DEFAULT_PATH}?${params.toString()}`
}

/** 接口里的图片地址统一补成绝对地址（真机有 `//` 与 `https://` 两种） */
export function normalizeUrl(url?: string): string {
  if (!url)
    return ''
  if (url.startsWith('//'))
    return `https:${url}`
  return url
}

/**
 * 清理接口标题里的 HTML 标签。
 *
 * 真机：`title` 形如 `一口气看完，<em class="keyword">原神</em>1.0-7.0！`，
 * 直接交给 VideoCard 会把标签当文字显示（VideoCard 的标题是纯文本插槽，{{ video.title }}）。
 *
 * 这里用 **不挂载的 DOMParser 文档** 做解析：它不执行脚本、不加载图片，
 * 是拿 textContent 最安全的方式；解析出实体（`&amp;` 之类）也一并还原。
 * DOMParser 不可用时退回正则 + 实体表。
 */
export function stripHtml(input?: string): string {
  if (!input)
    return ''
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(input, 'text/html')
      return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
    }
    catch {
      // 落到下面的正则兜底
    }
  }
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 时长文本 → 秒。
 *
 * 真机格式是 `分钟:秒`，**两段都不补零**：`"0:12"`、`"7:2"`、`"137:7"`、
 * `"6910:41"`（三 / 四位分钟也走同一格式，没有 `H:MM:SS`）。
 * 仍兼容三段式，防止以后改格式。
 */
export function parseSearchDuration(text?: string): number | undefined {
  if (!text)
    return undefined
  const parts = text.split(':').map(part => Number.parseInt(part, 10))
  if (parts.length < 2 || parts.some(part => !Number.isFinite(part)))
    return undefined
  if (parts.length === 3)
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return parts[0] * 60 + parts[1]
}

/**
 * 接口条目 → VideoCard 需要的结构。
 *
 * 卡片要的都给全：封面（组件自己裁 16:9）/ 标题（已清理 HTML，组件两行截断）/
 * UP（author + 头像 upic，真机两个都返回）/ 播放量 / 弹幕数 / 时长 / 发布时间，
 * 外加 `tag`（分区名，卡片会渲染成一枚主题色 pill）与 `threePointV2`（右键菜单读它）。
 * 没有收藏 / 三重星级来源，本轮不展示。
 */
export function toVideoCard(item: SearchApiItem): Video {
  const author: Author = {
    name: item.author ?? '',
    mid: item.mid,
    authorFace: normalizeUrl(item.upic),
    authorUrl: item.mid
      ? `https://space.bilibili.com/${String(item.mid)}`
      : undefined,
  }

  return {
    id: item.aid ?? 0,
    aid: item.aid,
    bvid: item.bvid,
    title: stripHtml(item.title),
    desc: stripHtml(item.description),
    cover: normalizeUrl(item.pic),
    duration: parseSearchDuration(item.duration),
    durationStr: item.duration,
    publishedTimestamp: item.pubdate,
    view: item.play,
    danmaku: item.danmaku ?? item.video_review,
    author,
    tag: item.typename,
    threePointV2: [],
  }
}

/** 条目的稳定键（去重 / v-for key：优先 bvid，其次 aid） */
export function videoKey(item: SearchApiItem): string {
  return item.bvid || `av${String(item.aid ?? '')}`
}

/** 页码窗口：首尾页 + 当前页左右各 span 页，中间用 `gap-<前一个页码>` 占位 */
export type PageToken = number | string

export function toPageTokens(current: number, total: number, span: number): PageToken[] {
  if (total <= 0)
    return []
  if (total === 1)
    return [1]

  const pages = new Set<number>([1, total])
  for (let index = current - span; index <= current + span; index++) {
    if (index >= 1 && index <= total)
      pages.add(index)
  }

  const sorted = [...pages].sort((a, b) => a - b)
  const tokens: PageToken[] = []
  let previous = 0
  for (const page of sorted) {
    if (page - previous > 1)
      tokens.push(`gap-${String(previous)}`)
    tokens.push(page)
    previous = page
  }
  return tokens
}

/** 页码 token 是否是占位符 */
export function isGapToken(token: PageToken): token is string {
  return typeof token === 'string'
}
