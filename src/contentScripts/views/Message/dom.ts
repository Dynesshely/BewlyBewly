/**
 * 原生消息中心（message.bilibili.com）的 DOM 适配层。
 *
 * 真机 dump（2026-11，CDP 只读）确认的稳定类名分两类：
 *
 * 1) **非哈希 BEM 类名**（可直接用）：
 *    `.message-layout` / `.message-aside` / `.message-sidebar` / `.message-main` /
 *    `.message-header` / `.message-content` / `.whisper` / `.reply` / `.system` /
 *    `.message-sidebar__item` / `__item-name` / `__item-num` / `__item-dot` /
 *    `.interaction-item` / `.notify-item` / `.system-item`
 *
 * 2) **CSS Modules 哈希类名**（后缀构建时变化，只能前缀/包含匹配）：
 *    `_SessionItem_t04g4_1`、`_SessionItem__Name_...`、`_SessionItemIsActive_...`、
 *    `_SidebarContent_...`、`_SidebarTitle_...`、`_ChatWindow_...`、
 *    `_Msg_o7f0t_1`（行）、`_MsgIsMe_o7f0t_9`（自己发的）、`_MsgText__Content_...`、
 *    `_MessageSendBox_...` 等。这里全部用 `[class*="前缀"]` 匹配，不写死哈希。
 *
 * 会话项本身带 `data-id="contact_<mid>"`，是点击转发的稳定锚点。
 */

/** 接管生效时挂在 <html> 上的类 */
export const DRAWN_CLASS = 'bewly-message-drawn'

/** 是否为 B 站消息中心 */
export function isMessageCenterPage(url: string = location.href): boolean {
  try {
    return new URL(url).hostname === 'message.bilibili.com'
  }
  catch {
    return false
  }
}

/** 当前消息中心路由（hash 路由） */
export function getMessageRoute(hash: string = location.hash): string {
  const matched = /^#\/(reply|at|love|system|whisper|settings)/.exec(hash || '')
  return matched?.[1] ?? 'unknown'
}

export interface NativeCategoryItem {
  index: number
  name: string
  unread: number | null
  dot: boolean
  active: boolean
  element: HTMLElement
}

function textOf(el: Element | null): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function parseCount(text: string): number | null {
  const digits = text.replace(/\D/g, '')
  if (!digits)
    return null
  const value = Number.parseInt(digits, 10)
  return Number.isFinite(value)
    ? value
    : null
}

/** 原生左栏分类项（回复我的 / @我的 / 收到的赞 / 系统通知 / 我的消息） */
export function getNativeCategoryItems(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('.message-sidebar__interactions .message-sidebar__item'),
  )
}

/** 原生「消息设置」入口 */
export function getNativeSettingsItem(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.message-sidebar__settings .message-sidebar__item')
}

export function readCategories(): NativeCategoryItem[] {
  return getNativeCategoryItems().map((element, index) => ({
    index,
    name: textOf(element.querySelector('.message-sidebar__item-name')),
    unread: parseCount(textOf(element.querySelector('.message-sidebar__item-num'))),
    dot: Boolean(element.querySelector('.message-sidebar__item-dot')),
    active: element.classList.contains('is-active'),
    element,
  }))
}

/** 点击原生分类项（切换分类） */
export function clickNativeCategory(index: number): boolean {
  const item = getNativeCategoryItems()[index]
  if (!item)
    return false
  item.click()
  return true
}

/** 点击原生「消息设置」入口 */
export function clickNativeSettings(): boolean {
  const item = getNativeSettingsItem()
  if (!item)
    return false
  item.click()
  return true
}

export interface NativeSessionItem {
  dataId: string
  mid: string
  name: string
  summary: string
  redAlert: string
  unread: number | null
  dot: boolean
  silent: boolean
  pinned: boolean
  active: boolean
  avatar: string
  initial: string
}

function resolveImageSrc(img: HTMLImageElement | null): string {
  if (!img)
    return ''
  return img.currentSrc || img.src || img.getAttribute('data-src') || ''
}

/** 原生会话列表项（`data-id="contact_<mid>"`） */
export function getNativeSessionItems(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-id^="contact_"]'))
}

export function readSessions(): NativeSessionItem[] {
  return getNativeSessionItems().map((element) => {
    const dataId = element.getAttribute('data-id') ?? ''
    const mid = dataId.replace(/^contact_/, '')
    const name = textOf(element.querySelector('[class*="SessionItem__Name"]'))
    const avatarEl = element.querySelector<HTMLElement>('[class*="SessionItem__Avatar"]')
    const className = element.className
    return {
      dataId,
      mid,
      name,
      summary: textOf(element.querySelector('[class*="SessionItem__Message"]')),
      redAlert: textOf(element.querySelector('[class*="SessionItem__RedAlert"]')),
      unread: parseCount(textOf(element.querySelector('[class*="SessionItem__NotificationNumber"]'))),
      dot: Boolean(element.querySelector('[class*="SessionItem__NotificationDot"]')),
      silent: /SessionItem__NotificationSilent_/.test(className)
        || Boolean(element.querySelector('[class*="NotificationSilent_"]')),
      pinned: /SessionItemIsTop_/.test(className),
      active: /SessionItemIsActive_/.test(className),
      avatar: resolveImageSrc(avatarEl?.querySelector('img') ?? null),
      initial: name
        ? Array.from(name)[0] ?? ''
        : '',
    }
  })
}

/** 点击原生会话项（打开会话，完全交给 B 站自己处理） */
export function clickNativeSession(dataId: string): boolean {
  if (!dataId)
    return false
  const escaped = CSS.escape(dataId)
  const item = document.querySelector<HTMLElement>(`[data-id="${escaped}"]`)
  if (!item)
    return false
  item.click()
  return true
}

/** 会话列表所在的原生内容容器（自绘列表覆盖在它上面） */
export function getSessionListHostEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[class*="_SidebarContent_"]')
}

/** 会话列表标题（原生「最近消息」） */
export function getSessionTitle(): string {
  return textOf(document.querySelector('[class*="_SidebarTitle__"], [class*="_SidebarTitle_"]'))
}

/** 顶部消息头容器（自绘 tab pill 塞进这里） */
export function getHeaderEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.message-header')
}

/** 页面主区域，用来在消息头缺失时兜底挂载 tab pill */
export function getMainEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.message-main')
}

/** 当前是否已经打开了某个会话（右侧聊天窗口） */
export function isChatOpen(): boolean {
  return Boolean(document.querySelector('[class*="_ChatWindow_"]'))
}

/**
 * 触发原生会话列表的「加载更多」。
 *
 * 自绘列表滚动到底时调用：原生 InfiniteScroll 只在它自己的滚动容器里监听 scroll，
 * 所以这里把原生容器滚到底并派发一次 scroll 事件。
 */
export function triggerNativeLoadMore(): boolean {
  const host = getSessionListHostEl()
  const scroller = host?.querySelector<HTMLElement>('[class*="_InfiniteScroll_"]')
    ?? host?.querySelector<HTMLElement>('[class*="_SidebarSlide_"]')
  if (!scroller)
    return false
  scroller.scrollTop = scroller.scrollHeight
  scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
  return true
}

/** 原生页面结构是否已经就绪到可以接管 */
export function isNativeLayoutReady(): boolean {
  return Boolean(document.querySelector('.message-layout') && getNativeCategoryItems().length > 0)
}
