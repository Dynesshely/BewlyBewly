import type { MessageTabId } from './constants'
/**
 * 消息中心（自绘）的纯函数工具：路由解析、时间格式化、消息内容归一化。
 *
 * 这里不放任何 DOM 读取 —— 自绘页面完全不读原生 DOM（那是第 93/94 轮的事），
 * 唯一与 DOM 相关的是 mount.ts 里的挂载 / 还原。
 */
import type { ChatApiMsg, ChatContent, ChatMessage, ChatSession, FeedAtItem, FeedEntry, FeedLikeItem, FeedReplyItem, FeedSource, SessionApiItem, SessionLastMsg, SystemNotice, SystemNotifyItem } from './types'
import { DEFAULT_MESSAGE_TAB, MESSAGE_HOST, MESSAGE_TABS } from './constants'

/** 是否为 B 站消息中心（挂载闸门第一道） */
export function isMessageHost(url: string = location.href): boolean {
  try {
    return new URL(url).hostname === MESSAGE_HOST
  }
  catch {
    return false
  }
}

/** 从 hash 解析当前 tab；无法识别时回落到默认 tab */
export function parseMessageTab(hash: string = location.hash): MessageTabId {
  const matched = /^#\/(whisper|reply|at|love|system)\b/.exec(hash || '')
  const tab = matched?.[1] as MessageTabId | undefined
  return tab && MESSAGE_TABS.includes(tab)
    ? tab
    : DEFAULT_MESSAGE_TAB
}

/** 写 hash 用的地址（tab → `#/xxx`） */
export function buildMessageHash(tab: MessageTabId): string {
  return `#/${tab}`
}

/** 消息中心页面地址（错误态里的回退入口） */
export function buildNativeMessageUrl(tab: MessageTabId = DEFAULT_MESSAGE_TAB): string {
  return `https://${MESSAGE_HOST}/${buildMessageHash(tab)}`
}

/** 用户空间地址（点击头像 / 昵称用） */
export function buildSpaceUrl(mid: string | number): string {
  return `https://space.bilibili.com/${mid}`
}

/**
 * 会话地址。
 *
 * 真机确认：原生消息中心**没有**「用 hash 直达某个会话」的路由（`#/whisper` 只能到列表），
 * 所以「在站内打开」只能落到 whisper 列表页 —— 本模块用 vc 接口自己渲染会话，
 * 不依赖原生路由，这里只在错误态回退时用。
 */
export function buildSessionUrl(): string {
  return buildNativeMessageUrl('whisper')
}

// ============================ 数字 / 时间 ============================

/** 宽松转数字；非法值返回 null */
export function toNumber(value: unknown): number | null {
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

/**
 * 微秒时间戳 → 秒。
 *
 * 真机：`session_ts` / `ack_ts` / `top_ts` 都是**微秒**（1.79e15 量级），
 * 而 `timestamp` / `reply_time` 是秒。1e12 以上视为微秒。
 */
export function microToSeconds(value: unknown): number | null {
  const raw = toNumber(value)
  if (raw === null || raw <= 0)
    return null
  return Math.floor(raw > 1e12
    ? raw / 1_000_000
    : raw)
}

/** 取「今天 / 昨天 / 本周 / 具体日期」的短标签（会话列表右上角） */
export function formatSessionTime(timestamp: number | null, now: number = Date.now()): string {
  if (!timestamp)
    return ''
  const date = new Date(timestamp * 1000)
  const nowDate = new Date(now)
  const startOfToday = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime()
  const at = date.getTime()

  if (at >= startOfToday)
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  if (at >= startOfToday - 86_400_000)
    return '昨天'
  if (at >= startOfToday - 6 * 86_400_000)
    return `周${'日一二三四五六'[date.getDay()]}`
  if (date.getFullYear() === nowDate.getFullYear())
    return `${date.getMonth() + 1}月${date.getDate()}日`
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

/** 聊天区的时间分隔标签（同一分钟内的消息只显示一次） */
export function formatChatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
  const time = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  if (sameDay)
    return time
  const sameYear = date.getFullYear() === now.getFullYear()
  const day = sameYear
    ? `${date.getMonth() + 1}月${date.getDate()}日`
    : `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
  return `${day} ${time}`
}

/** 互动列表的时间（相对时间：刚刚 / N 分钟前 / N 小时前 / 日期） */
export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  if (!timestamp)
    return ''
  const diff = Math.floor(now / 1000) - timestamp
  if (diff < 60)
    return '刚刚'
  if (diff < 3600)
    return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86_400)
    return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 7 * 86_400)
    return `${Math.floor(diff / 86_400)} 天前`
  const date = new Date(timestamp * 1000)
  const nowDate = new Date(now)
  if (date.getFullYear() === nowDate.getFullYear())
    return `${date.getMonth() + 1}月${date.getDate()}日`
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

function pad2(value: number): string {
  return value < 10
    ? `0${value}`
    : String(value)
}

/** 解析系统通知返回的 `"2026-03-16 19:00:00"`（真机就是格式化字符串，不是时间戳） */
export function parseTimeAt(text: string | undefined): number | null {
  if (!text)
    return null
  const matched = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(text.trim())
  if (!matched)
    return null
  const [, y, m, d, hh, mm, ss] = matched
  const stamp = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)).getTime()
  return Number.isFinite(stamp)
    ? Math.floor(stamp / 1000)
    : null
}

// ============================ 文本 / 图片 ============================

/** B 站图片地址补全：`//i0.hdslb.com/...` → `https://...` */
export function absoluteImage(raw: string | null | undefined): string {
  const value = (raw ?? '').trim()
  if (!value)
    return ''
  if (value.startsWith('//'))
    return `https:${value}`
  // 真机有 http:// 的历史图片，混在 https 页面里会被浏览器拦截
  return value.replace(/^http:\/\//i, 'https://')
}

/** 去掉 HTML 标签、解码常见实体、压缩空白（接口偶尔回带 `<em>` 高亮） */
export function stripHtml(raw: string | null | undefined): string {
  const value = (raw ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  return decodeEntities(value).trim()
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&amp;/g, '&')
}

/**
 * 把「摘要」压成一行。
 *
 * 会话列表的最后一条消息可能是图片 / 分享卡 / 系统卡片，这类没有可读文本，
 * 由 `summarizeLastMsg` 先归类，这里只负责压行 + 截断。
 */
export function oneLine(raw: string, max = 80): string {
  const value = raw.replace(/\s+/g, ' ').trim()
  if (value.length <= max)
    return value
  return `${value.slice(0, max)}…`
}

/** 安全 parse 一个可能是 JSON 字符串的 content */
export function parseContent<T = any>(raw: unknown): T | null {
  if (typeof raw !== 'string' || !raw.trim())
    return null
  try {
    return JSON.parse(raw) as T
  }
  catch {
    return null
  }
}

// ============================ 会话 ============================

/**
 * `get_sessions` 条目 → 自绘会话。
 *
 * 注意 talker_id 的处理：真机**系统账号的 mid 会超过 Number.MAX_SAFE_INTEGER**
 * （如 844424930131964、3546928191114035），JSON.parse 之后尾数已经失真。
 * 所以这里用 `BigInt` 走到字符串、只在拿不到 BigInt 时退回 String(数字)；
 * 打开会话时传的 talker_id 也必须用这条完全一致的字符串，
 * 否则 fetch_session_msgs 会拉不到那个系统账号的会话。
 */
export function toChatSession(raw: SessionApiItem, selfMid: string): ChatSession {
  const name = stripHtml(raw.account_info?.name ?? '')
  const avatar = absoluteImage(raw.account_info?.pic_url ?? raw.account_info?.face)
  return {
    mid: toMidString(raw.talker_id),
    name: name || `用户 ${toMidString(raw.talker_id)}`,
    avatar,
    summary: summarizeLastMsg(raw.last_msg, selfMid),
    time: microToSeconds(raw.session_ts) ?? microToSeconds(raw.ack_ts),
    unread: Math.max(0, Math.trunc(toNumber(raw.unread_count) ?? 0)),
    muted: raw.is_dnd === 1 || (raw.is_dnd as unknown) === true,
    pinned: (microToSeconds(raw.top_ts) ?? 0) > 0,
    system: (toNumber(raw.system_msg_type) ?? 0) > 0,
  }
}

/** 数字 mid → 字符串（超过安全整数时用 BigInt 保住精度） */
export function toMidString(value: unknown): string {
  if (typeof value === 'string')
    return value.trim()
  const numeric = toNumber(value)
  if (numeric === null)
    return ''
  if (!Number.isSafeInteger(numeric)) {
    try {
      return BigInt(String(Math.trunc(numeric))).toString()
    }
    catch {
      // 老浏览器没有 BigInt：至少给出一个稳定的字符串
    }
  }
  return String(Math.trunc(numeric))
}

/**
 * 会话最后一条消息的摘要。
 *
 * 真机见到的 msg_type：
 *   1  纯文本        `{"content":"..."}`
 *   2  图片          `{"url":"...","width":..,"height":..,"imageType":".."}`
 *   5  撤回 / 系统序号（content 是一串数字）
 *   7  视频分享卡    `{"author":"..","thumb":"..","title":"..","id":..}`
 *   10 系统卡片      `{"title":"..","text":"..","jump_text":"..","jump_uri":".."}`
 *   13 图片卡片      `{"pic_url":"..","jump_url":"..","title":".."}`
 * 其它（11 / 12 / 14…）一律给 `[消息]`，不猜。
 */
export function summarizeLastMsg(lastMsg: SessionLastMsg | undefined, selfMid: string): string {
  if (!lastMsg)
    return ''
  const prefix = String(lastMsg.sender_uid ?? '') === selfMid
    ? '我：'
    : ''
  const payload = parseContent<Record<string, any>>(lastMsg.content)

  switch (lastMsg.msg_type) {
    case 1:
      return prefix + oneLine(stripHtml(payload?.content ?? ''))
    case 2:
      return `${prefix}[图片]`
    case 7:
      return `${prefix}[视频] ${oneLine(stripHtml(payload?.title ?? ''), 40)}`
    case 10:
      return `${prefix}${oneLine(stripHtml(payload?.title || payload?.text || ''), 60)}`
    case 13:
      return `${prefix}[卡片] ${oneLine(stripHtml(payload?.title ?? ''), 40)}`
    case 5:
      return `${prefix}[已撤回]`
    default:
      return `${prefix}[消息]`
  }
}

// ============================ 聊天记录 ============================

/** `fetch_session_msgs` 条目 → 自绘消息 */
export function toChatMessage(raw: ChatApiMsg, selfMid: string): ChatMessage {
  const time = toNumber(raw.timestamp) ?? 0
  return {
    key: chatMessageKey(raw),
    mine: String(raw.sender_uid ?? '') === selfMid,
    time,
    content: parseChatContent(raw),
  }
}

function chatMessageKey(raw: ChatApiMsg): string {
  const key = raw.msg_key
  if (key !== undefined && key !== null)
    return String(key)
  return `${raw.msg_seqno ?? 0}-${raw.timestamp ?? 0}-${raw.msg_type}`
}

/**
 * 解析消息内容。真机验证过的 msg_type（见 `summarizeLastMsg` 的注释）；
 * 未知类型不丢消息，返回 `{ kind: 'unsupported' }` 让气泡显示占位。
 */
export function parseChatContent(raw: ChatApiMsg): ChatContent {
  const payload = parseContent<Record<string, any>>(raw.content)

  switch (raw.msg_type) {
    case 1:
      return {
        kind: 'text',
        text: stripHtml(payload?.content ?? ''),
      }
    case 2:
      return {
        kind: 'image',
        url: absoluteImage(payload?.url),
        width: toNumber(payload?.width) ?? 0,
        height: toNumber(payload?.height) ?? 0,
      }
    case 7:
      return {
        kind: 'share',
        title: stripHtml(payload?.title ?? ''),
        author: stripHtml(payload?.author ?? ''),
        thumb: absoluteImage(payload?.thumb),
        cover: absoluteImage(payload?.cover),
        url: buildVideoUrl(payload?.id, payload?.source),
        id: toNumber(payload?.id) ?? 0,
      }
    case 10:
      return {
        kind: 'card',
        title: stripHtml(payload?.title ?? ''),
        text: stripHtml(payload?.text ?? ''),
        cover: absoluteImage(payload?.cover ?? payload?.pic_url),
        jumpUrl: String(payload?.jump_uri ?? ''),
      }
    case 13:
      return {
        kind: 'card',
        title: stripHtml(payload?.title ?? ''),
        text: '',
        cover: absoluteImage(payload?.pic_url),
        jumpUrl: String(payload?.jump_url ?? ''),
      }
    default:
      return {
        kind: 'unsupported',
        label: `type:${raw.msg_type}`,
      }
  }
}

/**
 * 分享卡的视频地址。
 *
 * 真机 msg_type=7 的 payload：`{"author":"Ele实验室","id":426600347,"source":5,"thumb":"…","title":"…"}`。
 * `id` 是 **aid**（不是 bvid），source=5 是视频。
 */
function buildVideoUrl(id: unknown, source: unknown): string {
  const aid = toNumber(id)
  if (aid === null || aid <= 0)
    return ''
  return String(source) === '5' || source === undefined
    ? `https://www.bilibili.com/video/av${aid}`
    : ''
}

// ============================ 互动列表 ============================

/** reply 条目 → 自绘互动条目 */
export function toReplyEntry(raw: FeedReplyItem): FeedEntry {
  const actors = raw.user
    ? [
        {
          mid: toMidString(raw.user.mid),
          name: stripHtml(raw.user.nickname ?? ''),
          avatar: absoluteImage(raw.user.avatar),
        },
      ]
    : []
  const source = raw.item
  return {
    key: `reply-${raw.id}`,
    kind: 'reply',
    actors,
    actorCount: Math.max(1, Math.trunc(toNumber(raw.counts) ?? 1)),
    title: stripHtml(source?.title ?? ''),
    text: firstNonEmpty([
      stripHtml(source?.target_reply_content ?? ''),
      stripHtml(source?.source_content ?? ''),
      stripHtml(source?.root_reply_content ?? ''),
    ]),
    cover: absoluteImage(source?.image),
    url: feedSourceUrl(source),
    time: toNumber(raw.reply_time) ?? 0,
    unread: false,
  }
}

/** at 条目 → 自绘互动条目 */
export function toAtEntry(raw: FeedAtItem): FeedEntry {
  const actors = raw.user
    ? [
        {
          mid: toMidString(raw.user.mid),
          name: stripHtml(raw.user.nickname ?? ''),
          avatar: absoluteImage(raw.user.avatar),
        },
      ]
    : []
  const source = raw.item
  return {
    key: `at-${raw.id}`,
    kind: 'at',
    actors,
    actorCount: 1,
    title: stripHtml(source?.title ?? ''),
    text: firstNonEmpty([
      stripHtml(source?.source_content ?? ''),
      stripHtml(source?.target_reply_content ?? ''),
    ]),
    cover: absoluteImage(source?.image),
    url: feedSourceUrl(source),
    time: toNumber(raw.at_time) ?? 0,
    unread: false,
  }
}

/** like 条目 → 自绘互动条目（多个人点赞时 actors 是列表） */
export function toLikeEntry(raw: FeedLikeItem): FeedEntry {
  const users = Array.isArray(raw.users)
    ? raw.users
    : []
  const source = raw.item
  return {
    key: `like-${raw.id}`,
    kind: 'like',
    actors: users.map(user => ({
      mid: toMidString(user.mid),
      name: stripHtml(user.nickname ?? ''),
      avatar: absoluteImage(user.avatar),
    })),
    actorCount: Math.max(0, Math.trunc(toNumber(raw.counts) ?? users.length)),
    title: stripHtml(source?.title ?? ''),
    text: stripHtml(source?.desc ?? ''),
    cover: absoluteImage(source?.image),
    url: feedSourceUrl(source),
    time: toNumber(raw.like_time) ?? 0,
    unread: false,
  }
}

function firstNonEmpty(values: string[]): string {
  return values.find(value => Boolean(value)) ?? ''
}

/** 互动条目的源内容地址（真机 uri 就是 https 绝对地址，没有时退到 native_uri 的解析） */
function feedSourceUrl(source: FeedSource | undefined): string {
  if (!source)
    return ''
  const uri = String(source.uri ?? '').trim()
  if (/^https?:\/\//i.test(uri))
    return uri
  const native = String(source.native_uri ?? '')
  const video = /bilibili:\/\/video\/(\d+)/.exec(native)
  if (video)
    return `https://www.bilibili.com/video/av${video[1]}`
  return ''
}

// ============================ 系统通知 ============================

/**
 * 系统通知条目 → 自绘通知。
 *
 * 真机：`content` 是 JSON 字符串 `{"web":"正文…"}`，正文里可能带
 * `>>#{链接文案}{https://…}` 这种 B 站自有标记（见 user_notify 的条目），
 * 这里把标记还原成文案 + 链接。
 */
export function toSystemNotice(raw: SystemNotifyItem): SystemNotice {
  const payload = parseContent<Record<string, any>>(raw.content)
  const bodyRaw = typeof payload?.web === 'string'
    ? payload.web
    : typeof raw.content === 'string'
      ? raw.content
      : ''
  const parsed = extractMarkupLinks(bodyRaw)
  return {
    key: `sys-${raw.id}`,
    title: stripHtml(raw.title ?? ''),
    text: parsed.text,
    time: (raw.time_at ?? '').trim(),
    timestamp: parseTimeAt(raw.time_at),
    logo: absoluteImage(raw.source?.logo),
    link: firstNonEmpty([parsed.links[0] ?? '', /https?:\/\/[^\s)]+/.exec(parsed.text)?.[0] ?? '']),
  }
}

/**
 * 还原 B 站通知正文里的自有标记：
 *   `>>#{周报传送门}{https://example.com}`  →  文案「周报传送门」，链接 https://example.com
 *   `>>#{立即查看}{"https://example.com"}`    →  链接可能带引号
 */
export function extractMarkupLinks(raw: string): { text: string, links: string[] } {
  const links: string[] = []
  const text = stripHtml(
    raw
      // >>#{文案}{地址}（地址可能被 JSON 引号包住）
      .replace(/>>#\{([^}]*)\}\{("?)([^}"]*)\2\}/g, (_match, label: string, _quote: string, url: string) => {
        const clean = url.trim()
        if (clean)
          links.push(clean)
        return label || clean
      })
      // 单独出现的 #{文案}{地址}
      .replace(/#\{([^}]*)\}\{("?)([^}"]*)\2\}/g, (_match, label: string, _quote: string, url: string) => {
        const clean = url.trim()
        if (clean)
          links.push(clean)
        return label || clean
      }),
  )
  return { text, links }
}
