/**
 * 消息中心（自绘）的数据获取。
 *
 * # 真机验证结论（2026-11-19，CDP 9333，登录态 Crequency mid=1961641805）
 *
 * 全部接口都用普通 `fetch` + `credentials: 'include'`：
 * **没有任何一个需要 wbi 签名**（对比 Space / Search 的 wbiGet）。真机对照：
 *   - `get_sessions` 带不带 `w_rid/wts` 都返回 code 0（原生页面自己带了签名）；
 *   - `/x/msgfeed/*` 原生请求没有任何 w_rid，直接 200；
 *   - `fetch_session_msgs` / `x/sys-msg/*` 同样不需要签名。
 * 所以本模块**不引入 wbiGet**（少一层依赖，也少一次 nav 请求）。
 *
 * | 接口 | 真机结果 |
 * |---|---|
 * | `session_svr/get_sessions` | ✅ code 0，20 条，`has_more=1`；`end_ts=最早一条的 session_ts`（**微秒**）可翻页（实测返回 7 条、has_more=0） |
 * | `svr_sync/fetch_session_msgs` | ✅ code 0；`size=100` 也接受；`end_seqno=min_seqno` 向前翻页有效（实测 has_more 从 1 变 0） |
 * | `x/msgfeed/reply` | ✅ code 0；游标 `{is_end,id,time}`；翻页参数是 `id` + `reply_time`（**不是 pn**，pn 被忽略，永远回第一页） |
 * | `x/msgfeed/at` | ✅ code 0；翻页参数 `id` + `at_time` |
 * | `x/msgfeed/like` | ✅ code 0；**结构特殊**：`{latest:{items,last_view_at}, total:{items,cursor}}`；列表在 `data.total.items`，翻页参数 `id` + `like_time` |
 * | `x/msgfeed/unread` | ✅ code 0（`{at,reply,recv_like,sys_msg,…}` 计数），本模块暂未用它做 tab 红点 |
 * | `message.bilibili.com/x/sys-msg/query_unified_notify` | ✅ code 0（`system_notify_list`）；游标是**最后一条的 `cursor`**（微秒量级） |
 * | `/x/msgfeed/system`、`/x/msgfeed/like/me`、`/x/msgfeed/dm` | ❌ **404，不存在**（不要用） |
 * | `api.vc.bilibili.com/link_group/.../get_system_msg` | ❌ 404 |
 * | `x/polymer/pc-electron/v1/user/cards` | ✅ code 0；补会话昵称 / 头像（`get_sessions` 的普通用户条目**没有** `account_info`） |
 *
 * # 为什么系统通知只能在本 origin 发
 *
 * `/x/sys-msg/*` 挂在 message.bilibili.com 自己身上（不是 api.bilibili.com），
 * 而本模块只挂载在 message.bilibili.com —— 同源，不会遇到 CORS / 登录态问题。
 */
import type { ChatApiMsg, ChatMessage, ChatSession, FeedAtData, FeedEntry, FeedLikeData, FeedReplyData, SessionMsgsData, SessionsData, SystemNotice, SystemNotifyData } from './types'
import {
  API_ORIGIN,
  CHAT_PAGE_SIZE,
  FEED_PAGE_SIZE,
  MESSAGE_ORIGIN,
  REQUEST_MIN_GAP,
  REQUEST_TIMEOUT,
  SYSTEM_PAGE_SIZE,
  VC_ORIGIN,
} from './constants'
import {
  toAtEntry,
  toChatMessage,
  toChatSession,
  toLikeEntry,
  toMidString,
  toReplyEntry,
  toSystemNotice,
} from './utils'

/** 接口失败：带回可读的 message，页面据此显示错误态 */
export class MessageApiError extends Error {
  readonly code: number
  constructor(message: string, code = -1) {
    super(message)
    this.name = 'MessageApiError'
    this.code = code
  }
}

/** 上一次请求的发起时间（串行闸门用） */
let lastRequestAt = 0

/**
 * 当前登录 mid 的缓存。
 *
 * 会话摘要（「我：」前缀）与聊天气泡的左右对齐都要判断「是不是我发的」，
 * 必须在任何请求之前就可用，所以放在文件顶部；由 mount.ts 预取 nav 后写入。
 */
const SELF_MID: { cached: string } = { cached: '' }

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

/** 等够最小请求间隔再发请求 */
async function waitForRequestSlot(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt
  if (elapsed < REQUEST_MIN_GAP)
    await sleep(REQUEST_MIN_GAP - elapsed)
  lastRequestAt = Date.now()
}

/** 拼 query（undefined / 空串跳过） */
function withQuery(base: string, params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '')
      continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs
    ? `${base}${base.includes('?')
      ? '&'
      : '?'}${qs}`
    : base
}

/**
 * 发一次 GET 并校验 `code === 0`。
 *
 * 失败一律抛 `MessageApiError`：`-101`（未登录）会被页面识别成「请先登录」，
 * 其余情况显示接口 message。
 */
async function requestJson<T>(url: string): Promise<T> {
  await waitForRequestSlot()
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    const response = await fetch(url, {
      credentials: 'include',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
    if (!response.ok)
      throw new MessageApiError(`HTTP ${response.status}`, response.status)

    const text = await response.text()
    let payload: { code?: number, message?: string, data?: T } | null = null
    try {
      payload = JSON.parse(text)
    }
    catch {
      throw new MessageApiError('接口返回的不是合法 JSON')
    }

    const code = Number(payload?.code)
    if (code !== 0) {
      throw new MessageApiError(payload?.message || `接口返回 code ${payload?.code}`, Number.isFinite(code)
        ? code
        : -1)
    }

    return (payload?.data ?? null) as T
  }
  catch (error) {
    if (error instanceof MessageApiError)
      throw error
    if ((error as Error)?.name === 'AbortError')
      throw new MessageApiError('请求超时，请稍后重试')
    throw new MessageApiError((error as Error)?.message || '网络请求失败')
  }
  finally {
    window.clearTimeout(timer)
  }
}

// ============================ 会话列表 ============================

/**
 * 拉一页会话列表。
 *
 * @param endTs 翻页游标：传上一页**最后一条**的 `session_ts`（微秒，原样传，不要换算）
 */
export async function fetchSessions(endTs?: number): Promise<{ sessions: ChatSession[], hasMore: boolean, minTs: number | null }> {
  const url = withQuery(`${VC_ORIGIN}/session_svr/v1/session_svr/get_sessions`, {
    session_type: 1,
    group_name: '',
    build: 0,
    mobi_app: 'web',
    ...(endTs
      ? { end_ts: endTs }
      : {}),
  })
  const data = await requestJson<SessionsData>(url)
  const list = Array.isArray(data?.session_list)
    ? data.session_list
    : []
  const sessions = list.map(item => toChatSession(item, SELF_MID.cached))
  const minTs = list.reduce<number | null>((min, item) => {
    const ts = Number(item.session_ts)
    if (!Number.isFinite(ts) || ts <= 0)
      return min
    return min === null || ts < min
      ? ts
      : min
  }, null)
  return {
    sessions,
    hasMore: Number(data?.has_more) === 1,
    minTs,
  }
}

/**
 * 会话列表接口对「普通用户」不返回 `account_info`（真机 20 条里只有 3 个系统号带）。
 * 昵称 / 头像用 `user/cards` 批量补，一次最多 50 个 mid。
 *
 * 失败返回空 Map（调用方退化成 `用户 <mid>` 占位，不阻断页面）。
 */
export async function fetchUserCards(mids: string[]): Promise<Map<string, { name: string, face: string }>> {
  const map = new Map<string, { name: string, face: string }>()
  const unique = [
    ...new Set(mids.filter(Boolean)),
  ]
  if (!unique.length)
    return map

  const chunks: string[][] = []
  for (let i = 0; i < unique.length; i += 50)
    chunks.push(unique.slice(i, i + 50))

  for (const chunk of chunks) {
    try {
      const data = await requestJson<Record<string, { name?: string, face?: string }>>(
        withQuery(`${API_ORIGIN}/x/polymer/pc-electron/v1/user/cards`, {
          uids: chunk.join(','),
          build: 0,
          mobi_app: 'web',
        }),
      )
      for (const [mid, card] of Object.entries(data ?? {})) {
        if (!card)
          continue
        map.set(String(mid), {
          name: String(card.name ?? ''),
          face: String(card.face ?? ''),
        })
      }
    }
    catch (error) {
      console.warn('[bewly] message drawn: user/cards failed', error)
    }
  }
  return map
}

/** 设置当前登录 mid（mount.ts 预取 nav 后写入） */
export function setSelfMid(mid: string): void {
  SELF_MID.cached = mid
}

/** 取当前登录 mid */
export function getSelfMid(): string {
  return SELF_MID.cached
}

// ============================ 聊天记录 ============================

/**
 * 拉一页聊天记录。
 *
 * @param talkerId 会话对方 mid（**字符串**，系统号的 mid 超过 2^53，必须原样传）
 * @param endSeqno 翻页游标：上一页的 `min_seqno`，用于加载更早的消息
 */
export async function fetchChatMessages(
  talkerId: string,
  endSeqno?: number,
): Promise<{ messages: ChatMessage[], hasMore: boolean, minSeqno: number | null }> {
  const url = withQuery(`${VC_ORIGIN}/svr_sync/v1/svr_sync/fetch_session_msgs`, {
    talker_id: talkerId,
    session_type: 1,
    size: CHAT_PAGE_SIZE,
    ...(endSeqno
      ? { end_seqno: endSeqno }
      : {}),
  })
  const data = await requestJson<SessionMsgsData>(url)
  const list: ChatApiMsg[] = Array.isArray(data?.messages)
    ? data.messages
    : []
  const selfMid = SELF_MID.cached
  const messages = list
    .map(item => toChatMessage(item, selfMid))
    // 接口按新→旧返回（真机：messages[0] 最新），页面要按时间正序渲染
    .sort((a, b) => a.time - b.time)
  const minSeqno = Number(data?.min_seqno)
  return {
    messages,
    hasMore: Number(data?.has_more) === 1,
    minSeqno: Number.isFinite(minSeqno) && minSeqno > 0
      ? minSeqno
      : null,
  }
}

// ============================ 回复 / @ / 赞 ============================

/** 回复我的 */
export async function fetchReplies(cursor?: { id?: number, time?: number }): Promise<{ entries: FeedEntry[], hasMore: boolean, cursor: { id?: number, time?: number } | null }> {
  const data = await requestJson<FeedReplyData>(
    withQuery(`${API_ORIGIN}/x/msgfeed/reply`, {
      ps: FEED_PAGE_SIZE,
      // 真机：翻页参数是 id + reply_time（pn 被忽略）
      ...(cursor?.id
        ? { id: cursor.id, reply_time: cursor.time }
        : {}),
    }),
  )
  const list = Array.isArray(data?.items)
    ? data.items
    : []
  const entries = list.map(item => toReplyEntry(item))
  return {
    entries,
    hasMore: !data?.cursor?.is_end,
    cursor: data?.cursor
      ? { id: data.cursor.id, time: data.cursor.time }
      : null,
  }
}

/** @ 我的 */
export async function fetchAts(cursor?: { id?: number, time?: number }): Promise<{ entries: FeedEntry[], hasMore: boolean, cursor: { id?: number, time?: number } | null }> {
  const data = await requestJson<FeedAtData>(
    withQuery(`${API_ORIGIN}/x/msgfeed/at`, {
      ps: FEED_PAGE_SIZE,
      ...(cursor?.id
        ? { id: cursor.id, at_time: cursor.time }
        : {}),
    }),
  )
  const list = Array.isArray(data?.items)
    ? data.items
    : []
  const entries = list.map(item => toAtEntry(item))
  return {
    entries,
    hasMore: !data?.cursor?.is_end,
    cursor: data?.cursor
      ? { id: data.cursor.id, time: data.cursor.time }
      : null,
  }
}

/**
 * 收到的赞。
 *
 * 真机结构是 `{ latest: { items, last_view_at }, total: { items, cursor } }`：
 * `latest` 是「新收到的赞」（已读后清空，真机读到时是空数组），
 * `total` 是全部赞的列表。页面展示总列表，所以取 `data.total`。
 */
export async function fetchLikes(cursor?: { id?: number, time?: number }): Promise<{ entries: FeedEntry[], hasMore: boolean, cursor: { id?: number, time?: number } | null }> {
  const data = await requestJson<FeedLikeData>(
    withQuery(`${API_ORIGIN}/x/msgfeed/like`, {
      ps: FEED_PAGE_SIZE,
      ...(cursor?.id
        ? { id: cursor.id, like_time: cursor.time }
        : {}),
    }),
  )
  const total = data?.total
  const list = Array.isArray(total?.items)
    ? total.items
    : []
  const entries = list.map(item => toLikeEntry(item))
  return {
    entries,
    hasMore: !total?.cursor?.is_end,
    cursor: total?.cursor
      ? { id: total.cursor.id, time: total.cursor.time }
      : null,
  }
}

// ============================ 系统通知 ============================

/**
 * 拉一页系统通知。
 *
 * 真机：`message.bilibili.com/x/sys-msg/query_unified_notify`（同源）。
 * 翻页游标是**上一页最后一条的 `cursor`**（微秒量级整数，原样传）。
 * `query_user_notify`（UP 主专属的通知）接口也存在，但它的内容与 unified 有重叠、
 * 且只有 UP 主账号才有，本轮只用 unified（原生「系统通知」tab 的主列表就是它）。
 */
export async function fetchSystemNotices(cursor?: number): Promise<{ entries: SystemNotice[], hasMore: boolean, cursor: number | null, lastViewId?: number }> {
  const data = await requestJson<SystemNotifyData>(
    withQuery(`${MESSAGE_ORIGIN}/x/sys-msg/query_unified_notify`, {
      page_size: SYSTEM_PAGE_SIZE,
      build: 0,
      mobi_app: 'web',
      ...(cursor
        ? { cursor }
        : {}),
    }),
  )
  const list = Array.isArray(data?.system_notify_list)
    ? data.system_notify_list
    : []
  const entries = list.map(item => toSystemNotice(item))
  const last = list[list.length - 1]
  const nextCursor = Number(last?.cursor)
  return {
    entries,
    // 真机：接口没有 is_end 字段，只能按「本页拿满」判断还有没有下一页
    hasMore: list.length >= SYSTEM_PAGE_SIZE,
    cursor: Number.isFinite(nextCursor) && nextCursor > 0
      ? nextCursor
      : null,
  }
}

// ============================ 当前登录用户 ============================

/** 登录态信息 */
export interface SelfInfo {
  mid: string
  name: string
  face: string
}

/**
 * 取当前登录用户（`/x/web-interface/nav`）。
 *
 * 消息页的数据全都需要登录态；未登录时这个接口返回 code=-101，
 * 挂载闸门据此**不接管**（原生消息页在未登录时会引导登录）。
 */
export async function fetchSelfInfo(): Promise<SelfInfo | null> {
  try {
    const data = await requestJson<{ isLogin?: boolean, mid?: number, uname?: string, face?: string }>(
      `${API_ORIGIN}/x/web-interface/nav`,
    )
    if (!data?.isLogin)
      return null
    const mid = toMidString(data.mid)
    if (!mid)
      return null
    return {
      mid,
      name: String(data.uname ?? ''),
      face: String(data.face ?? ''),
    }
  }
  catch {
    return null
  }
}
