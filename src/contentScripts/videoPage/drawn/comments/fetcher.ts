/**
 * 视频播放页（自绘）评论区数据获取（第 110 轮）。
 *
 * # 真机结论（2026-11-19，CDP 9333 页面上下文，登录态 mid=1961641805，BV1GJ411x7h7 / aid=80433022）
 *
 * | 项 | 实测 |
 * |---|---|
 * | `GET /x/v2/reply?type=1&oid=<aid>&pn=1&ps=20&sort=2` | ✅ code 0、20 条、`data.page.count = 241443` |
 * | `sort` 取值 | `2` = 按热度（默认）、`0` = 按时间、`1` 与 2 结果相同；其它值不保证 |
 * | `ps` 上限 | **20**。ps=10/20 正常；**ps=21 起返回 -400 "ps out of bounds"**（不是 50，别照抄新版接口） |
 * | `pn` 翻页 | 有效：pn=1 first=3760801399，pn=2 first=143475134160，两页无重叠；**pn ≥ 500 返回 -400 "max offset exceeded"**（深翻页到此为止） |
 * | `data.top` | 本视频为空对象（无置顶）；`data.top_replies` 空数组。实现按两个字段兼容 |
 * | `data.replies[]` | `member.avatar` 才是头像（`member.face` 不下发）、`member.level_info.current_level` 是等级、`member.vip.vipStatus`=1 是大会员 |
 * | `up_action` | `{ like: boolean, reply: boolean }` —— UP 主是否点赞 / 回复过这条评论 |
 * | `content.message` | **保留 \\n 换行**（首条「坏消息：被骗了\\n好消息：真好听」），组件必须 pre-wrap |
 * | `content.emote` | `{ "[doge]": { url } }`；`content.pictures[].img_src` 是图片评论 |
 * | `reply_control` | `time_desc`（「2180天前发布」）、`sub_reply_entry_text`（「共2301条回复」）、`location`（IP 属地） |
 * | `replies[]` 预览 | 主评论里**直接带 2-3 条**楼中楼，无需额外请求；字段与主评论相同 |
 * | `GET /x/v2/reply/reply?root=<主评论rpid>&pn=1&ps=20` | ✅ code 0；`data.page.count` = 该楼总回复数；**root 必须是真实 rpid**（root=1 → code 12006） |
 * | 楼中楼 `ps` | 20/30/50 都返回 20 条（服务端固定 20），故本模块统一 ps=20 |
 * | 楼中楼 `pn` | 有效：pn=116 返回 2 条（共 2301 条 → 116 页），`page.count` 固定 |
 * | 新版 `/x/v2/reply/wbi/main` | 页面上下文**不带签名返回 -403**，必须走 `wbiGet`；本轮不用它（旧版 pn 分页已足够且无需签名） |
 *
 * # 为什么不用 wbi
 *
 * 旧版 `/x/v2/reply` 与 `/x/v2/reply/reply` 在**登录态 + 页面上下文**下不带签名也能通，
 * 少一层 nav 请求、少一次 md5 计算；新版 wbi/main 需要签名且 cursor 翻页更绕，本轮不引入。
 *
 * # 风控
 *
 * 同一接口连发会 -352。这里做两件事：
 *   1. 全局最小请求间隔（{@link REQUEST_MIN_GAP}，900ms），串行闸门；
 *   2. 遇到 -352 / -412 / -799 时按指数退避重试（最多 {@link MAX_RETRY} 次）。
 */
import type { CommentItem, CommentPage, CommentSort, FetchCommentsOptions, ReplyPage, VideoBrief } from './types'
import { dedupeById, normalizeComment } from './utils'

const API_ORIGIN = 'https://api.bilibili.com'

/** 主评论接口（旧版，pn 分页，登录态无需签名） */
const REPLY_API = `${API_ORIGIN}/x/v2/reply`
/** 楼中楼接口 */
const REPLY_SUB_API = `${API_ORIGIN}/x/v2/reply/reply`
/** 视频信息（拿 aid / owner / 评论总数）：不需要签名也能通，摸不到时再退回页面桥数据 */
const VIEW_API = `${API_ORIGIN}/x/web-interface/view`

/**
 * 两次请求之间的最小间隔（毫秒）。
 *
 * 真机连发 `/x/v2/reply` 间隔 < 1s 会吃 -352；900ms 是「翻页 / 切排序时用户感知不到卡顿」
 * 与「不触发风控」之间的折中（与任务要求一致）。
 */
const REQUEST_MIN_GAP = 900

/** 风控类 code：遇到就退避重试 */
const RETRY_CODES = new Set([-352, -412, -799])
/** 最多重试次数（不含首次） */
const MAX_RETRY = 2
/** 重试退避基数（毫秒），第 n 次重试等 n * RETRY_BASE */
const RETRY_BASE = 1200
/** 单次请求超时（毫秒） */
const REQUEST_TIMEOUT = 12_000

/** 评论最大字数（B 站限制；超长会被接口拒） */
export const MAX_COMMENT_LENGTH = 1000

/** 接口失败：带 code 与可读 message，页面据此显示错误态 */
export class CommentApiError extends Error {
  readonly code: number
  constructor(message: string, code = -1) {
    super(message)
    this.name = 'CommentApiError'
    this.code = code
  }
}

let lastRequestAt = 0

/**
 * 当前视频的 UP 主 mid（归一化时用来打「UP 主」标记）。
 *
 * 放进模块级：主评论与楼中楼走同一个判定，保证两层徽章一致；
 * 由挂载层（commentDrawn.ts）在拿到视频信息后写入。
 */
let ownerMidCache = ''

/** 设置当前视频的 UP 主 mid（挂载层在拿到视频信息后调用；空串表示未知） */
export function setCommentOwnerMid(mid: string): void {
  ownerMidCache = mid
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

/** 等够最小间隔再放行（串行闸门：并发调用会排队） */
let gate: Promise<void> = Promise.resolve()
function waitForSlot(): Promise<void> {
  gate = gate.then(async () => {
    const elapsed = Date.now() - lastRequestAt
    if (elapsed < REQUEST_MIN_GAP)
      await sleep(REQUEST_MIN_GAP - elapsed)
    lastRequestAt = Date.now()
  })
  return gate
}

function withQuery(base: string, params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '')
      continue
    search.set(key, String(value))
  }
  return `${base}?${search.toString()}`
}

interface RawPayload<T> {
  code: number
  message?: string
  data?: T
}

/**
 * 发一次 GET 并**原样返回 payload**（不在这里判 code）：
 * 分类讨论（重试 / 无更多）交给调用方。
 */
async function requestRaw<T>(url: string): Promise<RawPayload<T>> {
  await waitForSlot()
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    const response = await fetch(url, {
      credentials: 'include',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
    if (!response.ok)
      throw new CommentApiError(`HTTP ${response.status}`, response.status)
    const text = await response.text()
    try {
      return JSON.parse(text) as RawPayload<T>
    }
    catch {
      throw new CommentApiError('接口返回的不是合法 JSON')
    }
  }
  catch (error) {
    if (error instanceof CommentApiError)
      throw error
    if ((error as Error)?.name === 'AbortError')
      throw new CommentApiError('请求超时，请稍后重试')
    throw new CommentApiError((error as Error)?.message || '网络请求失败')
  }
  finally {
    window.clearTimeout(timer)
  }
}

/** 带风控重试的请求：一次成功即返回；风控 code 退避重试，其它 code 直接抛 */
async function requestJson<T>(url: string): Promise<T> {
  let attempt = 0
  for (;;) {
    const payload = await requestRaw<T>(url)
    if (payload.code === 0)
      return (payload.data ?? null) as T
    if (RETRY_CODES.has(payload.code) && attempt < MAX_RETRY) {
      attempt += 1
      await sleep(RETRY_BASE * attempt)
      continue
    }
    throw new CommentApiError(payload.message || `接口返回 code ${payload.code}`, payload.code)
  }
}

/** 排序 → 接口 sort 参数（真机：2 热度 / 0 时间） */
export function sortToParam(sort: CommentSort): number {
  return sort === 'latest'
    ? 0
    : 2
}

interface RawReplyPage {
  replies?: Record<string, any>[] | null
  top?: Record<string, any> | Record<string, any>[] | null
  top_replies?: Record<string, any>[] | null
  page?: { count?: number, num?: number, size?: number } | null
}

/**
 * 拉一页主评论。
 *
 * 置顶处理：`data.top` 可能是单条对象、也可能是数组（不同视频返回不同）；
 * `data.top_replies` 是数组。依次兼容，置顶条目排在列表最前、按 rpid 去重。
 */
export async function fetchComments(aid: number, options: FetchCommentsOptions): Promise<CommentPage> {
  const { sort, page } = options
  const ps = options.ps ?? 20
  if (!aid)
    throw new CommentApiError('缺少 aid，无法请求评论')

  const url = withQuery(REPLY_API, {
    type: 1,
    oid: aid,
    pn: page,
    ps,
    sort: sortToParam(sort),
  })
  const data = await requestJson<RawReplyPage>(url)

  const rawList: Record<string, any>[] = Array.isArray(data?.replies)
    ? data.replies
    : []

  const topRaw: Record<string, any>[] = []
  if (Array.isArray(data?.top))
    topRaw.push(...data.top.filter(Boolean))
  else if (data?.top && typeof data.top === 'object' && (data.top as Record<string, any>).rpid)
    topRaw.push(data.top as Record<string, any>)
  if (Array.isArray(data?.top_replies))
    topRaw.push(...data.top_replies.filter(Boolean))

  // 置顶只跟着第 1 页走：后续页接口不再下发，避免翻页时把置顶重复插到列表中间
  const head = page === 1
    ? topRaw
    : []
  const items: CommentItem[] = dedupeById(
    [
      ...head,
      ...rawList,
    ].map(raw => normalizeComment(raw, ownerMidCache)),
  )

  const total = typeof data?.page?.count === 'number'
    ? data.page.count
    : null

  // 真机的 page.count 是精确总数；hasMore 只用「本页拿满 + 未超过总数」判断
  const hasMore = rawList.length >= ps && (total === null || page * ps < total)

  return { items, total, hasMore, page }
}

/** 一页楼中楼 */
export async function fetchReplies(aid: number, rootRpid: string, page = 1, ps = 20): Promise<ReplyPage> {
  if (!aid || !rootRpid)
    throw new CommentApiError('缺少 oid / root，无法请求楼中楼')

  const url = withQuery(REPLY_SUB_API, {
    type: 1,
    oid: aid,
    root: rootRpid,
    pn: page,
    ps,
  })
  const data = await requestJson<RawReplyPage>(url)
  const rawList: Record<string, any>[] = Array.isArray(data?.replies)
    ? data.replies
    : []
  const items = dedupeById(rawList.map(raw => normalizeComment(raw, ownerMidCache)))
  const total = typeof data?.page?.count === 'number'
    ? data.page.count
    : null
  const hasMore = rawList.length >= ps && (total === null || page * ps < total)

  return { items, hasMore, page, total }
}

/** 视频基础信息缓存（同一视频不重复请求） */
const briefCache = new Map<string, VideoBrief>()
/** 进行中的视频信息请求（并发去重） */
const briefInflight = new Map<string, Promise<VideoBrief | null>>()

interface RawViewData {
  aid?: number
  bvid?: string
  owner?: { mid?: number } | null
  stat?: { reply?: number } | null
}

/**
 * 取视频基础信息（aid / UP 主 mid / 评论总数）。
 *
 * 优先级：
 *   1. 页面桥数据（`bewly-video-data` 事件里已经有 aid / bvid / owner.mid，零请求）；
 *   2. `/x/web-interface/view?bvid=`（旧接口，不需要 wbi 签名）；
 *   3. URL 里的 bvid + aid 拿不到 → 返回 null（**调用方必须据此放弃自绘接管**）。
 *
 * 为什么不用 `videoPage/drawn/meta.ts` 的 `fetchVideoMeta`：那个走 wbi 且只按 bvid 缓存，
 * 这里需要的是「能拿到 aid 就够」，走轻量旧接口可以少一次 nav + md5，失败率更低。
 */
export async function fetchVideoBrief(bvid: string): Promise<VideoBrief | null> {
  if (!bvid)
    return null
  const hit = briefCache.get(bvid)
  if (hit)
    return hit
  const running = briefInflight.get(bvid)
  if (running)
    return running

  const task = (async (): Promise<VideoBrief | null> => {
    try {
      const data = await requestJson<RawViewData>(withQuery(VIEW_API, { bvid }))
      const aid = typeof data?.aid === 'number'
        ? data.aid
        : 0
      if (!aid)
        return null
      const brief: VideoBrief = {
        aid,
        bvid: typeof data?.bvid === 'string' && data.bvid
          ? data.bvid
          : bvid,
        ownerMid: data?.owner?.mid
          ? String(data.owner.mid)
          : '',
        replyCount: typeof data?.stat?.reply === 'number'
          ? data.stat.reply
          : null,
      }
      briefCache.set(bvid, brief)
      return brief
    }
    catch {
      return null
    }
    finally {
      briefInflight.delete(bvid)
    }
  })()

  briefInflight.set(bvid, task)
  return task
}

/** 从页面桥事件里读到的视频信息（`videoPage/index.ts` 的数据桥） */
export interface BridgeVideoData {
  bvid?: string
  aid?: number
  isLogin?: boolean
  owner?: { mid?: string | number }
}

/** 把桥数据归一化成 VideoBrief（缺 aid 时返回 null，让调用方走接口） */
export function briefFromBridge(data: BridgeVideoData | null | undefined): VideoBrief | null {
  if (!data)
    return null
  const aid = typeof data.aid === 'number' && data.aid > 0
    ? data.aid
    : 0
  if (!aid)
    return null
  return {
    aid,
    bvid: data.bvid ?? '',
    ownerMid: data.owner?.mid !== undefined
      ? String(data.owner.mid)
      : '',
    replyCount: null,
  }
}

// ============================ 发评论 ============================

/** 读 cookie（content script 与页面同源，非 httpOnly 的 bili_jct / DedeUserID 可读） */
function readCookie(name: string): string {
  return document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1] ?? ''
}

/** 当前登录用户（发评论后本地插入用） */
export interface SelfProfile {
  mid: string
  uname: string
  face: string
  level: number
}

let selfProfileCache: SelfProfile | null = null
let selfRequested = false

/** 取当前登录用户；未登录返回 null（调用方据此显示「登录后可评论」） */
export async function fetchSelfProfile(): Promise<SelfProfile | null> {
  if (selfProfileCache)
    return selfProfileCache
  if (selfRequested)
    return null
  selfRequested = true
  try {
    const data = await requestJson<{
      isLogin?: boolean
      mid?: number
      uname?: string
      face?: string
      level_info?: { current_level?: number }
    }>(withQuery(`${API_ORIGIN}/x/web-interface/nav`, {}))
    if (!data?.isLogin)
      return null
    const mid = data.mid
      ? String(data.mid)
      : readCookie('DedeUserID')
    if (!mid)
      return null
    selfProfileCache = {
      mid,
      uname: data.uname ?? '',
      face: data.face ?? '',
      level: data.level_info?.current_level ?? 0,
    }
    return selfProfileCache
  }
  catch {
    return null
  }
}

/**
 * 发表主评论（`POST /x/v2/reply/add`）。
 *
 * 真机约束：需要 cookie 里的 `bili_jct` 做 csrf；未登录返回 `code -101`。
 * 成功后返回 rpid（字符串），接口不给 rpid 时返回空串、由调用方本地插入。
 */
export async function addComment(aid: number, message: string): Promise<{ ok: boolean, rpid: string, message: string }> {
  const text = message.trim()
  if (!text)
    return { ok: false, rpid: '', message: '' }
  if (text.length > MAX_COMMENT_LENGTH)
    return { ok: false, rpid: '', message: `评论不能超过 ${MAX_COMMENT_LENGTH} 字` }
  const csrf = readCookie('bili_jct')
  if (!csrf)
    return { ok: false, rpid: '', message: '请先登录后再发评论' }

  await waitForSlot()
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    const body = new URLSearchParams({
      oid: String(aid),
      type: '1',
      message: text,
      csrf,
    })
    const response = await fetch(`${API_ORIGIN}/x/v2/reply/add`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: body.toString(),
      signal: controller.signal,
    })
    const payload = await response.json() as { code?: number, message?: string, data?: { rpid?: number | string } }
    if (payload?.code !== 0)
      return { ok: false, rpid: '', message: payload?.message || `发表失败（code ${payload?.code}）` }
    const rpid = payload.data?.rpid !== undefined
      ? String(payload.data.rpid)
      : ''
    return { ok: true, rpid, message: text }
  }
  catch (error) {
    return { ok: false, rpid: '', message: (error as Error)?.message || '发表失败' }
  }
  finally {
    window.clearTimeout(timer)
  }
}

/** 清掉缓存（切视频 / 卸载时用；按 bvid 键控，不清也不会串数据） */
export function clearCommentCaches(): void {
  briefCache.clear()
  briefInflight.clear()
  ownerMidCache = ''
  selfProfileCache = null
  selfRequested = false
}
