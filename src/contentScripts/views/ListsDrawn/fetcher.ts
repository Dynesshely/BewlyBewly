/**
 * 三个列表页（稍后再看 / 历史 / 收藏）的数据获取。
 *
 * # 为什么不用 `~/utils/api`（后台转发）而走页面内 fetch
 *
 * 三个接口都在 `api.bilibili.com`，同源带 cookie 直接请求即可（与 `views/Space` /
 * `views/Search` / `views/Dynamic` 的 fetcher 做法一致）。后台转发那套多一次消息往返，
 * 且 POST 表单 + csrf 的语义（csrf 从 cookie 取）在页面内更直接。
 *
 * # 与 wbi 的关系（**真机结论，任务书此处有误**）
 *
 * 任务书给的 `/x/web-interface/wbi/history/cursor` 与 `/x/web-interface/wbi/history/search`
 * 在真机上是 **HTTP 404**（带不带签名都是 404）—— 这两个 wbi 路径不存在。
 * 正确的历史路径**没有 wbi 前缀**：
 *
 *   GET /x/web-interface/history/cursor?max&view_at&business&ps&type=all
 *   GET /x/web-interface/history/search?pn&ps&keyword&business
 *
 * 真机逐条验证（2026-11-19，登录态 mid=1961641805）：
 * - `/x/web-interface/history/cursor` 带 wbi 签名 code 0、不带签名同样 code 0；
 * - `/x/web-interface/history/search` 带 / 不带签名都 code 0；
 * - 原生页面（/account/history）自己发出的请求也**没有 w_rid / wts**，只带 web_location 与
 *   `x-bili-locale-json` / `x-bili-device-req-json` 两个装饰性请求头 —— 说明历史接口确实不需要签名。
 *
 * 所以历史请求统一走 {@link getJson}（不签名）；稍后再看 / 收藏同样不需要签名；
 * 只有「加入稍后再看」这类写操作需要 csrf（cookie `bili_jct`）。
 *
 * # 翻页（真机）
 *
 * 历史**不能**只传 `max`：第一次请求返回的 `data.cursor` 里有
 * `{ max, view_at, business, ps }`，下一页必须把 `max + view_at + business` **三个一起**带回去；
 * 真机用这三个字段翻页时与第 1 页 0 重叠（15 → 0 条，因为账号历史就这么多）。
 * 翻到末尾时服务端返回 `cursor = { max: 0, view_at: 0, business: '', ps: 0 }` 与空 list，
 * 页面据此判定「没有更多」。
 *
 * 稍后再看接口**不分页**，一次返回全部（真机 7 条，`data.count` 与 list 长度一致）。
 *
 * 收藏内容用 `pn` 页码翻页（真机 pn=1 返回 19 条、pn=2 返回 20 条、重叠 0，has_more=true）。
 */
import type {
  FavFolderApiData,
  FavFolderApiItem,
  FavResourceApiData,
  FavResourceApiItem,
  HistoryApiData,
  HistoryApiItem,
  WatchLaterApiData,
  WatchLaterApiItem,
} from './types'
import { getCSRF } from '~/utils/cookie'
import {
  API_ORIGIN,
  FAV_FOLDER_ADD_PATH,
  FAV_FOLDER_DEL_PATH,
  FAV_FOLDER_EDIT_PATH,
  FAV_FOLDER_LIST_PATH,
  FAV_FOLDER_WEB_LOCATION,
  FAV_RESOURCE_DEAL_PATH,
  FAV_RESOURCE_LIST_PATH,
  FAV_RESOURCE_PAGE_SIZE,
  HISTORY_CLEAR_PATH,
  HISTORY_CURSOR_PATH,
  HISTORY_DELETE_PATH,
  HISTORY_PAGE_SIZE,
  HISTORY_SHADOW_PATH,
  HISTORY_SHADOW_SET_PATH,
  REQUEST_MIN_GAP,
  REQUEST_TIMEOUT,
  RISK_CONTROL_CODES,
  WATCH_LATER_ADD_PATH,
  WATCH_LATER_CLEAR_PATH,
  WATCH_LATER_DEL_PATH,
  WATCH_LATER_LIST_PATH,
} from './constants'

/**
 * 接口返回非 0 code 时抛出的错误。
 *
 * 页面按 `code` 区分语义（-101 / -111 未登录、-352 / -412 风控…），不靠 message 字符串匹配。
 */
export class ListApiError extends Error {
  readonly code: number

  constructor(code: number, message: string) {
    super(message)
    this.name = 'ListApiError'
    this.code = code
  }
}

/** 未登录类 code（真机上 -101 账号未登录、-111 csrf 校验失败） */
const LOGIN_REQUIRED_CODES = new Set([-101, -111])

/** 这个错误是不是「需要登录」 */
export function isLoginRequiredError(error: unknown): boolean {
  return error instanceof ListApiError && LOGIN_REQUIRED_CODES.has(error.code)
}

/** 把任意错误转成一句可展示的文案 */
export function toErrorMessage(error: unknown): string {
  if (error instanceof ListApiError) {
    if (LOGIN_REQUIRED_CODES.has(error.code))
      return 'need-login'
    return error.message || `API code ${error.code}`
  }
  if (error instanceof Error)
    return error.message
  return String(error)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

/** 串行闸门：保证两次请求之间至少 {@link REQUEST_MIN_GAP} 毫秒 */
let lastRequestAt = 0

async function waitForRequestSlot(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt
  if (elapsed < REQUEST_MIN_GAP)
    await sleep(REQUEST_MIN_GAP - elapsed)
  lastRequestAt = Date.now()
}

/** 通用响应体 */
interface BiliResponse<T> {
  code?: number
  message?: string
  data?: T
}

/** 发一次 GET 并解析；HTTP 非 2xx 抛普通 Error，code !== 0 抛 {@link ListApiError} */
async function requestJson<T>(url: string, init?: RequestInit): Promise<BiliResponse<T>> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    const response = await fetch(url, {
      credentials: 'include',
      headers: { accept: 'application/json' },
      signal: controller.signal,
      ...init,
    })
    if (!response.ok)
      throw new Error(`HTTP ${response.status}`)
    return await response.json() as BiliResponse<T>
  }
  finally {
    window.clearTimeout(timer)
  }
}

/**
 * GET 一个接口并返回 `data`。
 *
 * **不签名**：本模块用到的读接口真机都接受无签名请求（见文件头注释）。
 * 风控 code 会等 1.2s 重试一次（只重试一次，避免放大风控）。
 */
async function getJson<T>(path: string, params: Record<string, string | number | undefined | null>): Promise<T> {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '')
      continue
    search.append(key, String(value))
  }
  const query = search.toString()
  const url = `${API_ORIGIN}${path}${query
    ? `?${query}`
    : ''}`

  await waitForRequestSlot()
  let payload = await requestJson<T>(url)
  if (payload.code !== 0 && RISK_CONTROL_CODES.includes(Number(payload.code))) {
    await sleep(1200)
    await waitForRequestSlot()
    payload = await requestJson<T>(url)
  }

  if (payload.code !== 0)
    throw new ListApiError(Number(payload.code) || -1, payload.message || `API code ${payload.code}`)
  if (payload.data === undefined)
    throw new Error('API returned no data')
  return payload.data
}

/**
 * POST 一个表单接口（写操作），返回原始响应体。
 *
 * csrf 从 cookie `bili_jct` 取；**取不到就不发请求**（直接抛 -101 语义的错误），
 * 避免打出一个注定失败的请求还占风控额度。
 */
async function postForm<T>(
  path: string,
  body: Record<string, string | number | undefined | null>,
  params: Record<string, string | number | undefined | null> = {},
): Promise<BiliResponse<T>> {
  const csrf = getCSRF()
  if (!csrf)
    throw new ListApiError(-101, 'login required')

  const form = new URLSearchParams()
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null)
      continue
    form.append(key, String(value))
  }
  form.set('csrf', csrf)

  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '')
      continue
    search.append(key, String(value))
  }
  const query = search.toString()
  const url = `${API_ORIGIN}${path}${query
    ? `?${query}`
    : ''}`

  await waitForRequestSlot()
  const payload = await requestJson<T>(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: form.toString(),
  })
  if (payload.code !== 0)
    throw new ListApiError(Number(payload.code) || -1, payload.message || `API code ${payload.code}`)
  return payload
}

/** 写操作的统一返回值：ok 与失败原因二选一，页面据此 toast / 回滚 */
export type Result = { ok: true } | { ok: false, reason: string }

function toResult(error: unknown): Result {
  return {
    ok: false,
    reason: toErrorMessage(error),
  }
}

/* #region 稍后再看 */

/**
 * 拉取稍后再看全量列表。
 *
 * 真机：`data.list` 与 `data.count` 一致（接口不分页），所以页面一次拿完、
 * 「加载更多」对稍后再看是 no-op（列表页仍保留加载更多的 UI，因为 viewMode 允许分页渲染）。
 */
export async function fetchWatchLaterList(): Promise<WatchLaterApiItem[]> {
  const data = await getJson<WatchLaterApiData>(WATCH_LATER_LIST_PATH, {})
  return Array.isArray(data?.list)
    ? data.list
    : []
}

/** 移除稍后再看里的单条（aid）；`viewed=true` 时表示「移除所有已看完」 */
export async function removeWatchLater(aid: number, viewed = false): Promise<Result> {
  try {
    await postForm(WATCH_LATER_DEL_PATH, {
      aid,
      viewed: viewed ? 'true' : 'false',
    })
    return { ok: true }
  }
  catch (error) {
    return toResult(error)
  }
}

/**
 * 移除所有「看过」的条目。
 *
 * **真机更正（2026-11-19）**：接口的 `viewed=true` 语义不是「只看完的」，
 * 而是「所有**有过观看进度**的」（`progress > 0`），包括 `progress === -1`（已看完）。
 * 实测：一条 `progress=165 / duration=489`（看了 34%）的条目也被移除了。
 * 所以调用方（页面）的「可移除条数」也按 `progress !== 0` 统计，文案用「移除看过的」。
 */
export async function removeWatchedFromWatchLater(): Promise<Result> {
  try {
    await postForm(WATCH_LATER_DEL_PATH, { viewed: 'true' })
    return { ok: true }
  }
  catch (error) {
    return toResult(error)
  }
}

/** 清空稍后再看 */
export async function clearWatchLater(): Promise<Result> {
  try {
    await postForm(WATCH_LATER_CLEAR_PATH, {})
    return { ok: true }
  }
  catch (error) {
    return toResult(error)
  }
}

/** 加入稍后再看（历史 / 收藏页的快捷操作） */
export async function addToWatchLater(aid: number): Promise<Result> {
  try {
    await postForm(WATCH_LATER_ADD_PATH, { aid })
    return { ok: true }
  }
  catch (error) {
    return toResult(error)
  }
}

/* #endregion */

/* #region 历史 */

/** 历史翻页游标：三个字段必须一起带回 */
export interface HistoryCursor {
  max: number
  viewAt: number
  business: string
}

/** 历史一页 */
export interface HistoryPage {
  items: HistoryApiItem[]
  cursor: HistoryCursor
}

/**
 * 拉一页历史。
 *
 * 翻页必须带 `max + view_at + business` 三个（见文件头）；第一页不传（等价于全 0 / 空串）。
 * 请求带 `type=all`（与原生页面一致：视频 / 直播 / 专栏混排），页面自己按 business 决定卡片外观。
 */
export async function fetchHistoryPage(cursor?: HistoryCursor): Promise<HistoryPage> {
  const data = await getJson<HistoryApiData>(HISTORY_CURSOR_PATH, {
    max: cursor?.max ?? 0,
    view_at: cursor?.viewAt ?? 0,
    business: cursor?.business ?? '',
    ps: HISTORY_PAGE_SIZE,
    type: 'all',
  })

  const items = Array.isArray(data?.list)
    ? data.list
    : []
  return {
    items,
    cursor: {
      max: Number(data?.cursor?.max) || 0,
      viewAt: Number(data?.cursor?.view_at) || 0,
      business: data?.cursor?.business ?? '',
    },
  }
}

/**
 * 删除一条历史。
 *
 * 真机：kid 必须是 `${business}_${oid}`（`archive_999999999999999` 被接受，
 * 裸 id 与横线分隔都是 -400），business 缺省时按 archive 处理。
 */
export async function deleteHistoryItem(item: HistoryApiItem): Promise<Result> {
  const business = item.history?.business || 'archive'
  const oid = Number(item.history?.oid ?? item.kid ?? 0)
  if (!oid)
    return { ok: false, reason: 'missing oid' }
  try {
    await postForm(HISTORY_DELETE_PATH, { kid: `${business}_${oid}` })
    return { ok: true }
  }
  catch (error) {
    return toResult(error)
  }
}

/** 清空历史 */
export async function clearHistory(): Promise<Result> {
  try {
    await postForm(HISTORY_CLEAR_PATH, {})
    return { ok: true }
  }
  catch (error) {
    return toResult(error)
  }
}

/** 查询历史是否被暂停记录（真机 data 是布尔） */
export async function fetchHistoryPaused(): Promise<boolean> {
  const data = await getJson<boolean>(HISTORY_SHADOW_PATH, {})
  return Boolean(data)
}

/** 暂停 / 恢复历史记录 */
export async function setHistoryPaused(paused: boolean): Promise<Result> {
  try {
    await postForm(HISTORY_SHADOW_SET_PATH, {
      switch: paused ? 'true' : 'false',
    })
    return { ok: true }
  }
  catch (error) {
    return toResult(error)
  }
}

/* #endregion */

/* #region 收藏 */

/** 拉当前登录用户的全部收藏夹 */
export async function fetchFavFolders(mid: string): Promise<FavFolderApiItem[]> {
  const data = await getJson<FavFolderApiData>(FAV_FOLDER_LIST_PATH, {
    up_mid: mid,
    web_location: FAV_FOLDER_WEB_LOCATION,
  })
  return Array.isArray(data?.list)
    ? data.list
    : []
}

/** 收藏内容一页 */
export interface FavResourcePage {
  items: FavResourceApiItem[]
  hasMore: boolean
  /** 收藏夹信息（封面 / 标题 / 总数），第一页才有意义 */
  info: FavResourceApiData['info']
}

/**
 * 拉一页收藏内容。
 *
 * 真机：`medias` 可能为 null（空收藏夹），`has_more` 用于判断是否还有下一页；
 * 失效视频（attr=9）也在列表里，标题是「已失效视频」—— 页面保留卡片但不给播放地址。
 */
export async function fetchFavResources(mediaId: number, pn: number): Promise<FavResourcePage> {
  const data = await getJson<FavResourceApiData>(FAV_RESOURCE_LIST_PATH, {
    media_id: mediaId,
    pn,
    ps: FAV_RESOURCE_PAGE_SIZE,
    platform: 'web',
  })
  return {
    items: Array.isArray(data?.medias)
      ? data.medias
      : [],
    hasMore: Boolean(data?.has_more),
    info: data?.info,
  }
}

/** 新建收藏夹（真机：空标题是 -400，调用方必须先校验非空） */
export async function createFavFolder(title: string): Promise<Result> {
  const name = title.trim()
  if (!name)
    return { ok: false, reason: 'empty title' }
  try {
    await postForm(FAV_FOLDER_ADD_PATH, { title: name, privacy: 0 })
    return { ok: true }
  }
  catch (error) {
    return toResult(error)
  }
}

/** 重命名收藏夹 */
export async function renameFavFolder(mediaId: number, title: string): Promise<Result> {
  const name = title.trim()
  if (!name)
    return { ok: false, reason: 'empty title' }
  try {
    await postForm(FAV_FOLDER_EDIT_PATH, { title: name, media_id: mediaId })
    return { ok: true }
  }
  catch (error) {
    return toResult(error)
  }
}

/** 删除收藏夹 */
export async function deleteFavFolder(mediaId: number): Promise<Result> {
  try {
    await postForm(FAV_FOLDER_DEL_PATH, { media_ids: mediaId })
    return { ok: true }
  }
  catch (error) {
    return toResult(error)
  }
}

/** 取消收藏（单个资源，取消后从当前收藏夹移除，不影响其他夹） */
export async function unfavoriteResource(resource: FavResourceApiItem, mediaId: number): Promise<Result> {
  const rid = Number(resource?.id)
  if (!rid)
    return { ok: false, reason: 'missing rid' }
  try {
    await postForm(FAV_RESOURCE_DEAL_PATH, {
      rid,
      // 真机：视频是 type=2，其它类型沿用接口给的 type
      type: Number(resource?.type) || 2,
      add_media_ids: '',
      del_media_ids: mediaId,
    })
    return { ok: true }
  }
  catch (error) {
    return toResult(error)
  }
}

/* #endregion */
