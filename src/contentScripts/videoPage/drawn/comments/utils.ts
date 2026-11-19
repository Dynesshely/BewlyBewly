/**
 * 自绘评论区的格式化 / 归一化工具（第 110 轮）。
 *
 * 数字格式化刻意**复刻** `videoPage/drawn/meta.ts` 那一套（1.0万 / 1.2亿，保留一位小数），
 * 与信息栏（`infoBar.ts` 的 `formatCount`）视觉一致；此处不 import 它，
 * 因为那边对 0 / 负数返回 '-'（信息栏用），评论区要的是空串（不显示「赞 -」）。
 */
import type { CommentTimeLabels } from './i18n'
import type { CommentItem } from './types'
import { fillTemplate } from './i18n'

/** 与信息栏一致的数量格式：1.0万 / 1.2亿；0 或非法值返回空串（评论区不显示占位横线） */
export function formatCount(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
    return ''
  if (value >= 1e8)
    return `${(value / 1e8).toFixed(1)}亿`
  if (value >= 1e4)
    return `${(value / 1e4).toFixed(1)}万`
  return String(Math.round(value))
}

/** 默认（简体中文）时间文案；其它语言由调用方传入 i18n 的 `t.time` */
const DEFAULT_TIME_LABELS: CommentTimeLabels = {
  justNow: '刚刚',
  minutesAgo: '{n} 分钟前',
  hoursAgo: '{n} 小时前',
  daysAgo: '{n} 天前',
}

/**
 * 时间格式化成「3 小时前」/「2020-01-01」。
 *
 * 规则（与原生评论区观感一致）：
 *   < 1 分钟   → 刚刚
 *   < 1 小时   → N 分钟前
 *   < 24 小时  → N 小时前
 *   < 30 天    → N 天前
 *   其它       → YYYY-MM-DD
 *
 * @param ctime 发表时间（秒级时间戳）
 * @param labels 当前语言的文案（不传则用简中）
 */
export function formatCommentTime(
  ctime: number | null | undefined,
  labels: CommentTimeLabels = DEFAULT_TIME_LABELS,
): string {
  if (typeof ctime !== 'number' || !Number.isFinite(ctime) || ctime <= 0)
    return ''
  const date = new Date(ctime * 1000)
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60)
    return labels.justNow
  if (diff < 3600)
    return fillTemplate(labels.minutesAgo, Math.floor(diff / 60))
  if (diff < 86400)
    return fillTemplate(labels.hoursAgo, Math.floor(diff / 3600))
  if (diff < 86400 * 30)
    return fillTemplate(labels.daysAgo, Math.floor(diff / 86400))
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * 正文里的 `[表情]` 切成片段，供组件渲染成 `<img>`。
 *
 * 保留换行：返回的纯文本片段不做任何换行处理，组件侧统一 `white-space: pre-wrap`。
 */
export interface MessageSegment {
  type: 'text' | 'emote'
  /** type === 'text' 是原文；type === 'emote' 是表情 key（形如 `[doge]`） */
  value: string
  /** 仅 emote 有：表情图片地址 */
  url?: string
}

export function splitMessage(message: string, emote: Record<string, string>): MessageSegment[] {
  if (!message)
    return []
  const keys = Object.keys(emote).filter(Boolean)
  if (!keys.length) {
    return [
      { type: 'text', value: message },
    ]
  }

  // 长 key 优先，避免 `[doge]` 被更短的 `[do]` 抢先匹配
  const escaped = keys
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'g')

  const segments: MessageSegment[] = []
  let last = 0
  for (const match of message.matchAll(re)) {
    const index = match.index ?? 0
    if (index > last) {
      segments.push({
        type: 'text',
        value: message.slice(last, index),
      })
    }
    const key = match[0]
    segments.push({ type: 'emote', value: key, url: emote[key] })
    last = index + key.length
  }
  if (last < message.length) {
    segments.push({
      type: 'text',
      value: message.slice(last),
    })
  }
  return segments
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number'
    ? value
    : Number(value)
  return Number.isFinite(parsed)
    ? parsed
    : fallback
}

function str(value: unknown): string {
  return typeof value === 'string'
    ? value
    : ''
}

/**
 * 原始评论 → `CommentItem`（主评论与楼中楼共用）。
 *
 * 字段来源（真机 out-2.json 实测）：
 *   rpid / root / parent / mid（另有 mid_str）/ ctime / like / action / rcount
 *   member.uname / member.avatar / member.level_info.current_level / member.vip.vipStatus
 *   content.message / content.emote{key:{url}} / content.pictures[]{img_src}
 *   reply_control.location / reply_control.is_up_top
 *   up_action.like / up_action.reply
 *
 * `ownerMid` 用来判定「是不是 UP 主本人」——视频页的 owner 从桥数据拿，
 * 楼中楼条目也走同一份判定，保证「UP 主徽章」在两层一致。
 */
export function normalizeComment(raw: Record<string, any>, ownerMid: string): CommentItem {
  const member = raw?.member ?? {}
  const content = raw?.content ?? {}
  const control = raw?.reply_control ?? {}
  const upAction = raw?.up_action ?? {}

  const emote: Record<string, string> = {}
  if (content.emote && typeof content.emote === 'object') {
    for (const [key, value] of Object.entries(content.emote)) {
      const url = (value as { url?: string } | null)?.url
      if (typeof url === 'string' && url)
        emote[key] = url
    }
  }

  const pictures: string[] = Array.isArray(content.pictures)
    ? content.pictures
        .map((pic: { img_src?: string } | null) => (typeof pic?.img_src === 'string'
          ? pic.img_src
          : ''))
        .filter((src: string): src is string => Boolean(src))
    : []

  const mid = str(raw?.mid_str) || String(raw?.mid ?? member.mid ?? '')
  const rpid = str(raw?.rpid_str) || String(raw?.rpid ?? '')

  return {
    rpid,
    root: str(raw?.root_str) || String(raw?.root ?? rpid),
    parent: str(raw?.parent_str) || String(raw?.parent ?? rpid),
    mid,
    uname: str(member.uname),
    avatar: str(member.avatar),
    level: num(member.level_info?.current_level),
    vip: num(member.vip?.vipStatus) === 1,
    isUp: Boolean(ownerMid && mid === ownerMid),
    message: str(content.message),
    emote,
    pictures,
    ctime: num(raw?.ctime),
    like: num(raw?.like),
    liked: num(raw?.action) > 0,
    rcount: num(raw?.rcount),
    location: str(control.location),
    isTop: Boolean(control.is_up_top ?? raw?.top),
    upLiked: Boolean(upAction.like),
    upReplied: Boolean(upAction.reply),
    replies: Array.isArray(raw?.replies)
      ? raw.replies
          .map((item: Record<string, any>) => normalizeComment(item, ownerMid))
          .filter((item: CommentItem) => Boolean(item.rpid))
      : [],
  }
}

/** 按 rpid 去重（保持首次出现的顺序，置顶条目在前时不会被后来的同 id 覆盖） */
export function dedupeById(items: CommentItem[]): CommentItem[] {
  const seen = new Set<string>()
  const result: CommentItem[] = []
  for (const item of items) {
    if (!item.rpid || seen.has(item.rpid))
      continue
    seen.add(item.rpid)
    result.push(item)
  }
  return result
}

/** 头像占位：昵称首字（无头像时显示） */
export function avatarFallback(uname: string): string {
  return (uname || '?').trim().slice(0, 1) || '?'
}
