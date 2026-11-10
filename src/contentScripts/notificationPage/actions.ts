/**
 * 消息页增强的行为层。
 *
 * 所有副作用（改 <html> 类、写条目属性、点原生按钮、写 sessionStorage）都收敛在这里，
 * Vue 组件只负责读 state 与调动作，方便将来单独测试或替换 UI。
 */

import type { NotificationCategoryId, NotificationDensity } from './state'

import { ROOT_CLASS_COMPACT, ROOT_CLASS_ONLY_UNREAD } from './constants'
import {
  CATEGORY_DEFS,
  clickCategory,
  findCategoryItem,
  findMarkAllReadButton,
  getNotificationItems,
  hasReadStateSignal,
  isItemUnread,
  readUnreadCount,
} from './dom'
import { formatName, getMessages } from './i18n'
import {
  migrateLegacyPreferences,
  readPreferenceDensity,
  readPreferenceUnreadOnly,
  readStoredPanelOpen,
  storePanelOpen,
  storePreferenceDensity,
  storePreferenceUnreadOnly,
} from './preferences'
import { state } from './state'

/** 条目上的已读 / 未读标记（CSS 用它隐藏已读条目） */
const ITEM_READ_ATTR = 'data-bewly-notif-read'

const TOAST_DURATION = 2200

let toastTimer: number | null = null

function t() {
  return getMessages()
}

function clearToastTimer(): void {
  if (toastTimer !== null) {
    window.clearTimeout(toastTimer)
    toastTimer = null
  }
  state.toast = ''
}

/** 显示一条短提示；新的提示会顶掉上一条 */
export function showToast(text: string): void {
  if (!text)
    return
  clearToastTimer()
  state.toast = text
  toastTimer = window.setTimeout(() => {
    state.toast = ''
    toastTimer = null
  }, TOAST_DURATION)
}

// #region 面板
export function setPanelOpen(open: boolean): void {
  if (state.panelOpen === open)
    return
  state.panelOpen = open
  storePanelOpen(open)
}

export function togglePanel(force?: boolean): void {
  setPanelOpen(force ?? !state.panelOpen)
}
// #endregion

// #region 只看未读
/**
 * 把状态同步到 <html>；页面没有可识别标记时强制关闭，避免出现「开了但什么都没变」。
 *
 * persist=false 用于「当前分类暂时没有未读、自动收起筛选」这种临时情况，
 * 不覆盖 settings 里的用户偏好。
 */
export function applyUnreadOnly(value: boolean, persist = true): void {
  const effective = value && state.canFilterUnread
  state.unreadOnly = effective
  document.documentElement.classList.toggle(ROOT_CLASS_ONLY_UNREAD, effective)
  if (persist)
    storePreferenceUnreadOnly(effective)
}

export function toggleUnreadOnly(): void {
  if (!state.canFilterUnread) {
    showToast(t().unreadFilterUnavailable)
    return
  }

  const next = !state.unreadOnly
  // 已经开着筛选、但当前列表里一条未读都没有：先提示，不要给用户一个空白列表
  if (next && state.itemCount > 0 && state.unreadItemCount === 0) {
    showToast(t().noUnreadItems)
    return
  }

  applyUnreadOnly(next)
  showToast(next
    ? t().unreadOnlyOn
    : t().unreadOnlyOff)
}
// #endregion

// #region 密度
export function applyDensity(value: NotificationDensity, options: { persist?: boolean } = {}): void {
  state.density = value
  document.documentElement.classList.toggle(ROOT_CLASS_COMPACT, value === 'compact')
  if (options.persist !== false)
    storePreferenceDensity(value)
}

export function toggleDensity(): void {
  applyDensity(state.density === 'compact'
    ? 'comfortable'
    : 'compact')
}
// #endregion

// #region 分类跳转
export function jumpToCategory(id: NotificationCategoryId): void {
  const def = CATEGORY_DEFS.find(item => item.id === id)
  if (!def)
    return
  const name = t().category[id]
  if (clickCategory(id)) {
    showToast(formatName(t().switchedTo, name))
    return
  }
  showToast(formatName(t().categoryNotFound, name))
}
// #endregion

// #region 全部已读
export function markAllRead(): void {
  const button = findMarkAllReadButton()
  if (!button) {
    showToast(t().markAllReadUnavailable)
    return
  }
  button.click()
  showToast(t().markedAllRead)
}
// #endregion

// #region 列表同步
/** 给条目写入已读 / 未读标记（CSS 据此隐藏已读条目） */
function markItems(items: HTMLElement[]): void {
  for (const item of items) {
    const value = isItemUnread(item)
      ? '0'
      : '1'
    // 值没变就不要重写属性：定时同步每 1.5 秒跑一次，避免无意义的 DOM 写入
    if (item.getAttribute(ITEM_READ_ATTR) !== value)
      item.setAttribute(ITEM_READ_ATTR, value)
  }
}

/** 卸载时清掉写在原生 DOM 上的标记，恢复页面原样 */
export function clearItemMarks(): void {
  const selector = `[${ITEM_READ_ATTR}]`
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector)))
    el.removeAttribute(ITEM_READ_ATTR)
}

/**
 * 从原生 DOM 同步一次状态。
 *
 * 由 MutationObserver（节流）+ 定时器调用：消息列表是异步渲染、翻页会整段替换，
 * 只靠一次初始化读不到后续条目。
 */
export function syncNotificationState(): void {
  const items = getNotificationItems()
  markItems(items)

  state.itemCount = items.length
  state.unreadItemCount = items.filter(item => isItemUnread(item)).length
  state.canFilterUnread = items.some(item => hasReadStateSignal(item))
  state.unreadCount = readUnreadCount(items)
  state.canMarkAllRead = findMarkAllReadButton() !== null

  // 条目是异步渲染的，每次 sync 都新建数组会让面板白白重渲染；只在真正变化时赋值
  const categories = CATEGORY_DEFS.map(def => ({
    id: def.id,
    available: findCategoryItem(def.id) !== null,
  }))
  const categoriesChanged = categories.some((category, index) => {
    const current = state.categories[index]
    return !current || current.id !== category.id || current.available !== category.available
  })
  if (categoriesChanged)
    state.categories = categories

  // 页面没有可识别标记时，「只看未读」不能保持开启，否则会一直挂着一个空筛选；
  // 设置页里的默认偏好保留不动，等页面重新暴露未读状态后再自动应用
  if (!state.canFilterUnread && state.unreadOnly)
    applyUnreadOnly(false, false)
  else if (readPreferenceUnreadOnly() && state.canFilterUnread && !state.unreadOnly)
    applyUnreadOnly(true, false)
}
// #endregion

// #region 初始化 / 复位
/**
 * 从 settings 恢复偏好并写到 DOM 上（幂等，可重复调用）。
 *
 * 读取前先做一次旧 sessionStorage 偏好迁移；这里只读取、不回写 settings，
 * 避免「页面暂时识别不到未读状态」把用户的默认偏好改掉。
 */
export function restorePreferences(): void {
  migrateLegacyPreferences()

  const density = readPreferenceDensity()
  state.density = density
  document.documentElement.classList.toggle(ROOT_CLASS_COMPACT, density === 'compact')

  state.panelOpen = readStoredPanelOpen()

  // 未读筛选要等第一次 sync 知道 canFilterUnread 之后再决定是否恢复
  syncNotificationState()
  applyUnreadOnly(readPreferenceUnreadOnly() && state.canFilterUnread, false)
}

/**
 * 设置页改动后把 settings 同步到当前页面（不写回 settings，避免无意义的往返）。
 * 由入口里的 watch 调用，实现「设置页改了立刻生效」。
 */
export function applySettingsPreferences(): void {
  applyDensity(readPreferenceDensity(), { persist: false })

  const unreadOnly = readPreferenceUnreadOnly()
  if (unreadOnly !== state.unreadOnly)
    applyUnreadOnly(unreadOnly, false)
}

/** 卸载时把挂在页面上的状态全部撤掉；偏好（settings / 会话内面板状态）保留，下次进页恢复 */
export function resetPageState(): void {
  document.documentElement.classList.remove(ROOT_CLASS_ONLY_UNREAD, ROOT_CLASS_COMPACT)
  clearItemMarks()
  clearToastTimer()
  state.panelOpen = false
}
// #endregion
