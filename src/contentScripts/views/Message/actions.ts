/**
 * 消息中心自绘的行为层：读原生状态 → 写 reactive state；把用户操作转发回原生。
 *
 * 所有点击都转发给原生 DOM（原生才是数据的唯一来源，我们只负责画），
 * 自绘层本身不发任何写请求。
 */
import type { MessageListItemButton, MessageListRoute } from './dom'
import type { MessageCategoryView, MessageInteractionView, MessageSessionView, MessageSystemView } from './state'
import {
  clickNativeCategory,
  clickNativeListItem,
  clickNativeListItemButton,
  clickNativeSession,
  clickNativeSettings,
  getMessageRoute,
  getSessionTitle,
  isMessageListRoute,
  readCategories,
  readInteractionRows,
  readSessions,
  readSystemRows,
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

// ============================ 第 94 轮 B：回复 / @ / 赞 / 系统通知 ============================

/**
 * 未读态近似说明：
 * 原生列表**没有逐条已读标记**（真机 dump：条目上没有 unread / is-read / data-read 之类信息），
 * 只有左栏分类级的未读数字或小圆点。因此这里的策略是：
 * 1. 分类未读数 / 圆点 → 取进入分类时的快照（只增不减，避免原生「打开即已读」导致圆点闪烁）；
 * 2. 若将来原生给条目加了未读标记，优先用逐条标记；
 * 3. 否则把「前 N 条」标为未读（B 站消息中心按时间倒序，新消息在前）。
 */
const unreadSnapshots = new Map<string, number>()

const ROUTE_CATEGORY_PATTERN: Record<MessageListRoute, RegExp> = {
  reply: /回复/,
  at: /@/,
  love: /赞/,
  system: /系统/,
}

const DEFAULT_LIST_TITLE: Record<MessageListRoute, string> = {
  reply: '回复我的',
  at: '@ 我的',
  love: '收到的赞',
  system: '系统通知',
}

function resolveListUnread(route: MessageListRoute): number {
  const category = state.categories.find(item => ROUTE_CATEGORY_PATTERN[route].test(item.name))
  const current = category?.unread ?? (category?.dot ? 1 : 0)
  const previous = unreadSnapshots.get(route) ?? 0
  const budget = Math.max(previous, current)
  unreadSnapshots.set(route, budget)
  return budget
}

/** 切页 / 重新接管时清空未读快照 */
export function resetListUnreadSnapshots(): void {
  unreadSnapshots.clear()
}

function resolveUnreadFlags(nativeMarkers: boolean[], budget: number): boolean[] {
  if (nativeMarkers.some(Boolean))
    return nativeMarkers
  return nativeMarkers.map((_, index) => index < budget)
}

function interactionSignature(rows: MessageInteractionView[]): string {
  return rows.map(row => [
    row.key,
    row.unames.join('、'),
    row.action,
    row.message,
    row.reference,
    row.cover,
    row.time,
    row.avatars.join(
    ),
    row.multi ? 'm' : 's',
    row.buttons.join(
    ),
    row.unread ? 'u' : 'r',
  ].join('\u0001')).join('\u0002')
}

function systemSignature(rows: MessageSystemView[]): string {
  return rows.map(row => [
    row.key,
    row.title,
    row.message,
    row.time,
    row.unread ? 'u' : 'r',
  ].join('\u0001')).join('\u0002')
}

/** 同步当前路由对应的四类列表（reply / at / love / system） */
export function syncMessageList(): void {
  const route = getMessageRoute()
  if (!isMessageListRoute(route)) {
    clearMessageList()
    return
  }

  state.listTitle = state.categories.find(item => item.active)?.name || DEFAULT_LIST_TITLE[route]
  const budget = resolveListUnread(route)
  state.listUnread = budget

  if (route === 'system') {
    const native = readSystemRows(route)
    const flags = resolveUnreadFlags(native.map(row => row.unreadMarker), budget)
    const rows = native.map<MessageSystemView>((row, index) => ({
      key: `system-${row.index}-${row.time}`,
      index: row.index,
      title: row.title,
      message: row.message,
      time: row.time,
      unread: flags[index] ?? false,
    }))
    if (systemSignature(rows) !== systemSignature(state.systems))
      state.systems = rows
    state.listKind = 'system'
    if (state.interactions.length)
      state.interactions = []
    return
  }

  const native = readInteractionRows(route)
  const flags = resolveUnreadFlags(native.map(row => row.unreadMarker), budget)
  const rows = native.map<MessageInteractionView>((row, index) => ({
    key: `interaction-${row.index}-${row.time}`,
    index: row.index,
    unames: row.unames,
    action: row.action,
    message: row.message,
    reference: row.reference,
    cover: row.cover,
    time: row.time,
    avatars: row.avatars,
    multi: row.multi,
    buttons: row.buttons,
    unread: flags[index] ?? false,
  }))
  if (interactionSignature(rows) !== interactionSignature(state.interactions))
    state.interactions = rows
  state.listKind = 'interaction'
  if (state.systems.length)
    state.systems = []
}

/** 清空列表状态（离开四类列表路由时） */
export function clearMessageList(): void {
  state.listKind = 'none'
  state.listTitle = ''
  state.listUnread = 0
  if (state.interactions.length)
    state.interactions = []
  if (state.systems.length)
    state.systems = []
}

/** 点击自绘条目 → 转发原生条目 click */
export function openListItem(index: number): void {
  clickNativeListItem(getMessageRoute(), index)
}

/** 点击自绘条目上的操作按钮 → 转发原生按钮 click */
export function pressListItemButton(index: number, type: MessageListItemButton): void {
  clickNativeListItemButton(getMessageRoute(), index, type)
}
