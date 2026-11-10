/**
 * 原生消息页（message.bilibili.com）的 DOM 适配层。
 *
 * 这里集中所有依赖 B 站页面结构的查询，页面改版时只需要改这一处。
 * 选择器来源：仓库既有 `src/styles/adaptedStyles/pages/notificationsPage.scss`
 * 里本来就在使用的类名（.space-left / .space-right / .side-bar / .notify-dot /
 * .notify-number / .reply-card / .at-card / .love-card / .msg-notify / .msg-time /
 * .operate-btn / .bl-button--ghost 等），以及 NotificationsPop.vue 里确认过的
 * `#/reply #/at #/love #/system` 路由，没有凭空新造类名。
 *
 * 每条查询都带候选列表并允许返回 null —— 消息页是异步渲染的，结构也可能随上游改版。
 */
import type { NotificationCategoryId } from './state'
import { HOST_ID } from './constants'

const NOTIFICATION_PAGE_URL_RE = /^https?:\/\/message\.bilibili\.com(?:[/?#]|$)/i

/** 四类消息条目的根类名（第 2 轮 native-style 文档确认过的四类卡片） */
const ITEM_SELECTOR = '.reply-card, .at-card, .love-card, .msg-notify'

/** 列表容器候选：从最具体的滚动列表逐级退化到整块右栏 */
const LIST_ROOT_SELECTORS = [
  '.space-right .message-list',
  '.space-right .space-right-bottom .message-list',
  '.space-right .space-right-bottom',
  '.space-right',
  '#link-message-container',
]

/** 观察 DOM 变化用的容器：优先整个消息容器，兜底 body */
const OBSERVE_ROOT_SELECTORS = [
  '#message-navbar + .container',
  '.container',
]

const EDITABLE_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
].join(', ')

/**
 * 已读 / 未读状态类名。
 *
 * 不写死某个具体 B 站类名（仓库里没有证据），而是识别语义 token：
 * 页面上只要出现 `unread` / `is-read` 这类类名就能识别出来；
 * 一个都识别不到时，面板会把「只看未读」置灰并给出说明，而不是假装能用。
 */
const UNREAD_CLASS_RE = /^(?:unread|un-read|no-read|not-read|is-unread|is-new|new-msg|msg-unread)$/i
const READ_STATE_CLASS_RE = /^(?:read|readed|is-read|has-read|is-old|old-msg|msg-read)$/i

export interface NotificationCategoryDef {
  id: NotificationCategoryId
  /** 原生 hash 路由（见 NotificationsPop.vue） */
  hash: string
  /** 左栏条目文字兜底（去掉空白后做包含判断） */
  textHints: string[]
}

export const CATEGORY_DEFS: NotificationCategoryDef[] = [
  {
    id: 'reply',
    hash: '#/reply',
    textHints: ['回复', 'Reply'],
  },
  {
    id: 'at',
    hash: '#/at',
    textHints: ['@', '提到'],
  },
  {
    id: 'love',
    hash: '#/love',
    textHints: ['点赞', 'Like'],
  },
  {
    id: 'system',
    hash: '#/system',
    textHints: ['系统', 'System'],
  },
]

export function isNativeNotificationPage(url: string = location.href): boolean {
  return NOTIFICATION_PAGE_URL_RE.test(url)
}

/** 列表容器（找不到时返回 null，调用方可以退化为整页查询） */
export function getListRoot(): HTMLElement | null {
  for (const selector of LIST_ROOT_SELECTORS) {
    const el = document.querySelector<HTMLElement>(selector)
    if (el)
      return el
  }
  return null
}

/** 观察容器（用于 MutationObserver），返回 null 表示只能观察 body */
export function getObserveRoot(): HTMLElement | null {
  for (const selector of OBSERVE_ROOT_SELECTORS) {
    const el = document.querySelector<HTMLElement>(selector)
    if (el)
      return el
  }
  return null
}

/**
 * 当前分类下的消息条目。
 *
 * 列表容器命中时只查容器内部；容器没命中（页面结构变化）时退化为全文档查询，
 * 保证功能不会因为一个容器类名失效而整体失效。
 */
export function getNotificationItems(): HTMLElement[] {
  const root = getListRoot()
  const scoped = root
    ? Array.from(root.querySelectorAll<HTMLElement>(ITEM_SELECTOR))
    : []
  const items = scoped.length > 0
    ? scoped
    : Array.from(document.querySelectorAll<HTMLElement>(ITEM_SELECTOR))
  // 去掉嵌套在另一个条目里的重复命中
  return items.filter(el => !el.parentElement?.closest(ITEM_SELECTOR))
}

function hasClassMatching(el: HTMLElement, pattern: RegExp): boolean {
  for (const token of Array.from(el.classList)) {
    if (pattern.test(token))
      return true
  }
  return false
}

function readUnreadAttribute(el: HTMLElement): string | null {
  return el.getAttribute('data-unread')
    ?? el.getAttribute('data-is-unread')
    ?? el.getAttribute('data-read')
}

/** 条目内部的「未读」文字小标签（原生页面偶尔用文字而不是圆点标记） */
function hasUnreadTextBadge(el: HTMLElement): boolean {
  for (const node of Array.from(el.querySelectorAll<HTMLElement>('i, span, em, b, strong, s'))) {
    const text = node.textContent?.trim()
    if (text === '未读' || text === '未读消息')
      return true
  }
  return false
}

/**
 * 条目是否未读。
 *
 * 正向信号（任一命中即认为未读）：
 *   1. 条目里有 .notify-dot（仓库 scss 里确认存在的未读圆点）
 *   2. 条目类名里出现 unread / is-new 语义 token
 *   3. data-unread / data-is-unread 属性为真
 *   4. aria-label 或短文字标签里写了「未读」
 */
export function isItemUnread(el: HTMLElement): boolean {
  if (el.querySelector('.notify-dot'))
    return true
  if (hasClassMatching(el, UNREAD_CLASS_RE))
    return true
  const attr = readUnreadAttribute(el)
  if (attr === '1' || attr === 'true' || attr === 'unread')
    return true
  if (el.getAttribute('aria-label')?.includes('未读'))
    return true
  return hasUnreadTextBadge(el)
}

/**
 * 页面是否暴露了可区分的已读 / 未读状态。
 *
 * 只有它成立，「只看未读」才有意义；否则开关置灰并说明原因。
 */
export function hasReadStateSignal(el: HTMLElement): boolean {
  if (isItemUnread(el))
    return true
  if (hasClassMatching(el, READ_STATE_CLASS_RE))
    return true
  const attr = readUnreadAttribute(el)
  return attr === '0' || attr === 'false' || attr === 'read'
}

/**
 * 未读总数。
 *
 * 优先读左栏分类徽标（.notify-number，仓库 scss 里确认存在），
 * 没有数字徽标时退化为「当前列表里识别到的未读条目数」，
 * 两者都读不到就返回 null —— 面板据此隐藏数字（简报要求「找不到就隐藏数字」）。
 */
export function readUnreadCount(items: HTMLElement[]): number | null {
  const badges = Array.from(document.querySelectorAll<HTMLElement>('.side-bar .notify-number'))
  let total = 0
  let found = false
  for (const badge of badges) {
    const digits = (badge.textContent ?? '').replace(/\D/g, '')
    if (!digits)
      continue
    const value = Number.parseInt(digits, 10)
    if (!Number.isFinite(value))
      continue
    total += value
    found = true
  }
  if (found)
    return total

  const unreadItems = items.filter(el => isItemUnread(el)).length
  return unreadItems > 0
    ? unreadItems
    : null
}

function getSideBarItems(): HTMLElement[] {
  const sideBar = document.querySelector<HTMLElement>('.space-left .side-bar')
    ?? document.querySelector<HTMLElement>('.side-bar')
  if (!sideBar)
    return []
  return Array.from(sideBar.querySelectorAll<HTMLElement>('.item'))
}

/** 左栏里对应分类的条目（href 命中优先，文字兜底） */
export function findCategoryItem(id: NotificationCategoryId): HTMLElement | null {
  const def = CATEGORY_DEFS.find(item => item.id === id)
  if (!def)
    return null

  const items = getSideBarItems()
  for (const item of items) {
    const href = item.querySelector<HTMLAnchorElement>('a[href]')?.getAttribute('href') ?? ''
    if (href.includes(def.hash))
      return item
  }

  for (const item of items) {
    const text = (item.textContent ?? '').replace(/\s+/g, '')
    if (def.textHints.some(hint => text.includes(hint)))
      return item
  }

  return null
}

/**
 * 派发原生分类点击。
 *
 * 点击的是分类项里的 `<a>`（消息页用 hash 路由，原生监听器挂在链接上），
 * 没有链接时才点条目本身。
 */
export function clickCategory(id: NotificationCategoryId): boolean {
  const item = findCategoryItem(id)
  if (!item)
    return false
  const target = item.querySelector<HTMLElement>('a[href]') ?? item
  target.click()
  return true
}

/** 「全部已读」类按钮的文字特征（按去掉空白后的整段文字匹配） */
const READ_ALL_TEXT_RE = /^(?:全部已读|一键已读|标记全部已读|全部标为已读|全部设为已读|markallread|markallasread)$/i

/**
 * 原生「全部已读」按钮。
 *
 * 文字匹配是主路径（B 站可能改类名，但按钮文案相对稳定），
 * 类名里出现 read-all 时作为兜底。找不到就返回 null，面板隐藏该按钮。
 */
export function findMarkAllReadButton(): HTMLElement | null {
  const scope = document.querySelector<HTMLElement>('.space-right')
    ?? document.querySelector<HTMLElement>('#link-message-container')
    ?? document.body
  if (!scope)
    return null

  const candidates = Array.from(scope.querySelectorAll<HTMLElement>(
    'button, a, [role="button"], .operate-btn, .bl-button--ghost, .bl-button--primary, [class*="read-all"], [class*="readAll"]',
  ))
  for (const candidate of candidates) {
    const text = (candidate.textContent ?? '').replace(/\s+/g, '')
    if (text && READ_ALL_TEXT_RE.test(text))
      return candidate
  }
  for (const candidate of candidates) {
    const className = candidate.getAttribute('class') ?? ''
    if (/read-?all/i.test(className) && (candidate.textContent ?? '').trim())
      return candidate
  }
  return null
}

/** 事件是否来自 Bewly 自己的 UI（浮层或设置弹窗），来自它时不接管按键 */
export function isFromBewlyUi(event: Event): boolean {
  const path = event.composedPath?.() ?? []
  for (const node of path) {
    if (!(node instanceof HTMLElement))
      continue
    if (node.id === HOST_ID || node.id === 'bewly')
      return true
  }
  return false
}

/** 键盘事件是否发生在输入框里（在 shadow root 内时 target 会被重定向，用 composedPath 判断） */
export function isEditableEvent(event: KeyboardEvent): boolean {
  for (const node of event.composedPath()) {
    if (!(node instanceof HTMLElement))
      continue
    if (node.isContentEditable || node.matches?.(EDITABLE_SELECTOR))
      return true
  }
  return false
}
