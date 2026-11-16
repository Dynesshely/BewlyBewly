/**
 * 消息中心会话元数据（只读）。
 *
 * 真机 dump 确认：消息页自己会请求
 * `https://api.vc.bilibili.com/session_svr/v1/session_svr/get_sessions`，
 * 返回的 session_list 里带 `talker_id` / `session_ts` / `unread_count` /
 * `is_dnd` / `top_ts`。原生 DOM 的会话项不带时间、也不暴露置顶/免打扰，
 * 所以自绘会话列表用这份数据补元信息；接口失败时整条链路退化到 DOM 数据，
 * 只是没有时间，不影响列表本身。
 *
 * 只发 GET、只读自己的会话列表，不发任何写请求。
 */

const GET_SESSIONS_URL
  = 'https://api.vc.bilibili.com/session_svr/v1/session_svr/get_sessions?session_type=1&group_name=&build=0&mobi_app=web'

/** 接口缓存时长：短时间内多次同步不重复请求 */
const CACHE_TTL = 30_000
const REQUEST_TIMEOUT = 8_000

export interface SessionMeta {
  /** 会话对方 mid（字符串，与原生 `data-id="contact_<mid>"` 对齐） */
  mid: string
  /** 最后一条消息时间（秒，已从微秒换算） */
  time: number | null
  unread: number
  /** 免打扰 */
  dnd: boolean
  /** 置顶 */
  pinned: boolean
}

let cache: { at: number, data: Map<string, SessionMeta> } | null = null
let inflight: Promise<Map<string, SessionMeta> | null> | null = null

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value))
    return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed)
      ? parsed
      : null
  }
  return null
}

/** `session_ts` 是微秒时间戳，统一换算成秒 */
function microToSeconds(value: unknown): number | null {
  const raw = toNumber(value)
  if (raw === null || raw <= 0)
    return null
  // 大于 1e12 视为微秒（1e12 微秒 ≈ 1970+；毫秒时间戳量级是 1e12 以内）
  const seconds = raw > 1e12
    ? raw / 1_000_000
    : raw
  return Math.floor(seconds)
}

function parseSessionList(payload: any): Map<string, SessionMeta> {
  const map = new Map<string, SessionMeta>()
  const list = payload?.data?.session_list
  if (!Array.isArray(list))
    return map
  for (const raw of list) {
    const talkerId = toNumber(raw?.talker_id)
    if (talkerId === null)
      continue
    map.set(String(talkerId), {
      mid: String(talkerId),
      time: microToSeconds(raw?.session_ts) ?? microToSeconds(raw?.ack_ts),
      unread: Math.max(0, toNumber(raw?.unread_count) ?? 0),
      dnd: raw?.is_dnd === 1 || raw?.is_dnd === true,
      pinned: (toNumber(raw?.top_ts) ?? 0) > 0,
    })
  }
  return map
}

/**
 * 拉取会话元数据。失败（网络 / CORS / 接口变更）返回 `null`，调用方退化为纯 DOM 数据。
 */
export function fetchSessionMeta(): Promise<Map<string, SessionMeta> | null> {
  if (cache && Date.now() - cache.at < CACHE_TTL)
    return Promise.resolve(cache.data)
  if (inflight)
    return inflight

  inflight = (async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
    try {
      const response = await fetch(GET_SESSIONS_URL, {
        credentials: 'include',
        signal: controller.signal,
        headers: { accept: 'application/json' },
      })
      if (!response.ok)
        return null
      const payload = await response.json()
      if (payload?.code !== 0)
        return null
      const data = parseSessionList(payload)
      cache = {
        at: Date.now(),
        data,
      }
      return data
    }
    catch {
      return null
    }
    finally {
      clearTimeout(timer)
      inflight = null
    }
  })()

  return inflight
}

/** 清缓存（会话列表变化时由调用方按需触发） */
export function invalidateSessionMetaCache(): void {
  cache = null
}
