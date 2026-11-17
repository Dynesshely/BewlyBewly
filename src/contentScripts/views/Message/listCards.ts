import type { MessageInteractionView, MessageSystemView } from './state'

/**
 * 四类列表的逐条目自绘桥（第 94 轮 B）。
 *
 * 做法与动态页自绘一致：**保留原生条目**（数据与点击行为都在原生身上），
 * 在它后面插入一个自绘宿主，并用 `render()` 渲染我们的卡片；
 * 原生条目用属性标记后由页面 CSS 隐藏（display:none），
 * 这样原生列表的滚动 / 无限加载 / 骨架都不受影响。
 *
 * 单条解析失败只 release 那一条（原生条目保持可见）；整体失败时由调用方
 * 不挂 `bewly-message-drawn` 类，页面保持原生。
 */
import { h, render } from 'vue'
import { openListItem, pressListItemButton } from './actions'
import MessageInteractionCard from './components/MessageInteractionCard.vue'
import MessageSystemCard from './components/MessageSystemCard.vue'
import { getMessageRoute, getNativeListItems, isMessageListRoute } from './dom'
import { state } from './state'

/** 已自绘的原生条目属性（CSS 用它隐藏原生条目） */
export const LIST_ITEM_DRAWN_ATTR = 'data-bewly-msg-item-drawn'

interface RenderedEntry {
  host: HTMLDivElement
  signature: string
}

/** 用 Map（而不是 WeakMap）才能在同步时清理已从 DOM 移除的条目 */
const rendered = new Map<Element, RenderedEntry>()

function ensureHost(nativeEl: HTMLElement): RenderedEntry {
  const existing = rendered.get(nativeEl)
  if (existing)
    return existing

  const host = document.createElement('div')
  host.className = 'bewly-msg-card-host'
  nativeEl.insertAdjacentElement('afterend', host)
  const entry: RenderedEntry = { host, signature: '' }
  rendered.set(nativeEl, entry)
  return entry
}

function signatureOf(view: MessageInteractionView | MessageSystemView): string {
  return JSON.stringify(view)
}

/** 解析后完全没有内容 → 视为解析失败，回退原生条目 */
function hasInteractionContent(view: MessageInteractionView): boolean {
  return Boolean(
    view.unames.length
    || view.action
    || view.message
    || view.reference
    || view.cover
    || view.avatars.length
    || view.time,
  )
}

/** 系统通知同理：标题 / 正文 / 时间全空 → 回退原生 */
function hasSystemContent(view: MessageSystemView): boolean {
  return Boolean(view.title || view.message || view.time)
}

export function renderInteractionRow(nativeEl: HTMLElement, view: MessageInteractionView): void {
  if (!hasInteractionContent(view)) {
    releaseListItem(nativeEl)
    return
  }
  const entry = ensureHost(nativeEl)
  nativeEl.setAttribute(LIST_ITEM_DRAWN_ATTR, '1')
  const signature = signatureOf(view)
  if (entry.signature === signature && entry.host.firstChild)
    return
  entry.signature = signature
  render(h(MessageInteractionCard, {
    item: view,
    onOpen: () => openListItem(view.index),
    onButton: (type: 'reply' | 'like' | 'delete' | 'notice') => pressListItemButton(view.index, type),
  }), entry.host)
}

export function renderSystemRow(nativeEl: HTMLElement, view: MessageSystemView): void {
  if (!hasSystemContent(view)) {
    releaseListItem(nativeEl)
    return
  }
  const entry = ensureHost(nativeEl)
  nativeEl.setAttribute(LIST_ITEM_DRAWN_ATTR, '1')
  const signature = signatureOf(view)
  if (entry.signature === signature && entry.host.firstChild)
    return
  entry.signature = signature
  render(h(MessageSystemCard, {
    item: view,
    onOpen: () => openListItem(view.index),
  }), entry.host)
}

/** 撤销单条自绘（原生条目重新可见） */
export function releaseListItem(nativeEl: Element): void {
  const entry = rendered.get(nativeEl)
  if (entry) {
    render(null, entry.host)
    entry.host.remove()
    rendered.delete(nativeEl)
  }
  nativeEl.removeAttribute(LIST_ITEM_DRAWN_ATTR)
}

/** 撤销全部四类列表的自绘 */
export function releaseAllListCards(): void {
  for (const [nativeEl, entry] of Array.from(rendered.entries())) {
    render(null, entry.host)
    entry.host.remove()
    nativeEl.removeAttribute(LIST_ITEM_DRAWN_ATTR)
  }
  rendered.clear()
}

/** 清理已从 DOM 移除的原生条目（切换分类 / 重新渲染时） */
export function cleanupDetachedListCards(): void {
  for (const [nativeEl, entry] of Array.from(rendered.entries())) {
    if (nativeEl.isConnected)
      continue
    render(null, entry.host)
    entry.host.remove()
    rendered.delete(nativeEl)
  }
}

/**
 * 按当前路由同步四类列表的卡片。
 *
 * 调用前需要先 `syncMessageList()` 把 state 更新好（index.ts 里保证顺序）。
 */
export function syncListCards(): void {
  const route = getMessageRoute()
  if (!isMessageListRoute(route)) {
    releaseAllListCards()
    return
  }

  const items = getNativeListItems(route)

  if (state.listKind === 'system') {
    items.forEach((nativeEl, index) => {
      const view = state.systems[index]
      if (!view) {
        releaseListItem(nativeEl)
        return
      }
      renderSystemRow(nativeEl, view)
    })
  }
  else if (state.listKind === 'interaction') {
    items.forEach((nativeEl, index) => {
      const view = state.interactions[index]
      if (!view) {
        releaseListItem(nativeEl)
        return
      }
      renderInteractionRow(nativeEl, view)
    })
  }
  else {
    releaseAllListCards()
  }

  cleanupDetachedListCards()
}
