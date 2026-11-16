import type { MessageCategoryView, MessageSessionView } from './state'
/**
 * 消息中心自绘的行为层：读原生状态 → 写 reactive state；把用户操作转发回原生。
 *
 * 所有点击都转发给原生 DOM（原生才是数据的唯一来源，我们只负责画），
 * 自绘层本身不发任何写请求。
 */
import {
  clickNativeCategory,
  clickNativeSession,
  clickNativeSettings,
  getSessionTitle,
  readCategories,
  readSessions,
  triggerNativeLoadMore,
} from './dom'
import { formatSessionTime } from './format'
import { getMessages } from './i18n'
import { fetchSessionMeta } from './sessionApi'
import { state } from './state'

/** 分类 pill 同步（顺序与原生左栏一致，点击靠 index 转发） */
export function syncCategories(): void {
  state.categories = readCategories().map<MessageCategoryView>(item => ({
    index: item.index,
    name: item.name,
    unread: item.unread,
    dot: item.dot,
    active: item.active,
  }))
}

function sessionSignature(rows: MessageSessionView[]): string {
  return rows.map(row => [
    row.dataId,
    row.name,
    row.summary,
    row.unread ?? '',
    row.dot ? '1' : '0',
    row.active ? '1' : '0',
    row.timeText,
    row.avatar,
  ].join('\u0001')).join('\u0002')
}

/**
 * 会话列表同步。
 *
 * DOM 提供「有哪些会话、叫什么、摘要、未读数、头像、当前选中」，
 * 会话接口补「时间 / 免打扰 / 置顶」；接口失败时只是没有时间，列表照常渲染。
 */
export async function syncSessions(): Promise<void> {
  const native = readSessions()
  const messages = getMessages()
  const meta = await fetchSessionMeta()

  const rows = native.map<MessageSessionView>((item) => {
    const extra = meta?.get(item.mid)
    return {
      dataId: item.dataId,
      mid: item.mid,
      name: item.name,
      summary: item.summary,
      redAlert: item.redAlert,
      unread: item.unread ?? (extra && extra.unread > 0
        ? extra.unread
        : null),
      dot: item.dot,
      silent: item.silent || Boolean(extra?.dnd),
      pinned: item.pinned || Boolean(extra?.pinned),
      active: item.active,
      avatar: item.avatar,
      initial: item.initial,
      timeText: formatSessionTime(extra?.time ?? null, { yesterday: messages.yesterday }),
    }
  })

  if (sessionSignature(rows) !== sessionSignature(state.sessions))
    state.sessions = rows

  state.sessionTitle = getSessionTitle() || messages.recent
  state.loadingMore = false
}

/** 点击自绘会话 → 转发原生会话点击 */
export function openSession(dataId: string): void {
  clickNativeSession(dataId)
}

/** 点击自绘分类 pill → 转发原生分类点击 */
export function selectCategory(index: number): void {
  clickNativeCategory(index)
}

/** 打开原生「消息设置」 */
export function openSettings(): void {
  clickNativeSettings()
}

/** 自绘列表滚到底 → 让原生列表加载更多 */
export function requestLoadMore(): void {
  if (state.loadingMore)
    return
  state.loadingMore = true
  const triggered = triggerNativeLoadMore()
  if (!triggered)
    state.loadingMore = false
}
