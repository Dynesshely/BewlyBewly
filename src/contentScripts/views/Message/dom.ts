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

// ============================ 第 94 轮 B：回复 / @ / 赞 / 系统通知 ============================
//
// 真机 dump（2026-11，CDP 只读）：
//   reply  → .reply-layout > .reply-list           > .interaction-item × N
//   at     → .at-layout    > .at-list              > .interaction-item × N
//   love   → .love-section > .message-section__body > .love-list > .interaction-item × N
//   system → .system-layout> .system-list          > .system-item     × N
//
// 互动条目内部（非哈希 BEM，稳定）：
//   .interaction-item__left(.single|.multi) > .interaction-item__avatar img
//   .interaction-item__uname × 1-2（多人点赞时是 2 个）
//   .interaction-item__action       动作文案（前面带 &nbsp;）
//   .interaction-item__msg          引用原文（评论内容 / @ 到的正文）
//   .interaction-item__reference    额外引用块（部分条目才有）
//   .interaction-item__cover img    源内容封面（视频封面等）
//   .interaction-item__time         时间
//   .interaction-item__btn.reply|like|delete|notice   操作按钮（默认 invisible，hover 才显）
//
// 系统条目：.system-item > .notify-item > .notify-item__top(.notify-item__title/__time) + __bottom(.__msg)
//
// 注意：原生列表**没有逐条已读标记**（只有左栏分类级未读数 / 小圆点），
// 未读态由 actions.ts 用「分类未读数」近似（见那里的注释）。

export type MessageListRoute = 'reply' | 'at' | 'love' | 'system'

export type MessageListItemButton = 'reply' | 'like' | 'delete' | 'notice'

export interface NativeInteractionRow {
  index: number
  element: HTMLElement
  unames: string[]
  action: string
  message: string
  reference: string
  cover: string
  time: string
  avatars: string[]
  multi: boolean
  buttons: MessageListItemButton[]
  unreadMarker: boolean
}

export interface NativeSystemRow {
  index: number
  element: HTMLElement
  title: string
  message: string
  time: string
  unreadMarker: boolean
}

const LIST_SELECTOR_BY_ROUTE: Record<MessageListRoute, string> = {
  reply: '.reply-list',
  at: '.at-list',
  love: '.love-list',
  system: '.system-list',
}

const ITEM_SELECTOR_BY_ROUTE: Record<MessageListRoute, string> = {
  reply: '.interaction-item',
  at: '.interaction-item',
  love: '.interaction-item',
  system: '.system-item',
}

/** 当前路由是否属于本轮自绘的四类列表 */
export function isMessageListRoute(route: string): route is MessageListRoute {
  return route === 'reply' || route === 'at' || route === 'love' || route === 'system'
}

/** 四类列表的原生列表容器（.reply-list / .at-list / .love-list / .system-list） */
export function getMessageListEl(route: string = getMessageRoute()): HTMLElement | null {
  if (!isMessageListRoute(route))
    return null
  return document.querySelector<HTMLElement>(LIST_SELECTOR_BY_ROUTE[route])
}

/** 某一类列表的原生条目（顺序即展示顺序） */
export function getNativeListItems(route: string = getMessageRoute()): HTMLElement[] {
  if (!isMessageListRoute(route))
    return []
  const list = getMessageListEl(route)
  if (!list)
    return []
  return Array.from(list.querySelectorAll<HTMLElement>(ITEM_SELECTOR_BY_ROUTE[route]))
}

/** 保留段落换行的文本归一化（引用原文里可能有换行） */
function normalizeMessage(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * B 站图片地址补全协议（原生 src 常是 //i0.hdslb.com/...）。
 *
 * 原生 src 带尺寸参数时形如 `xxx.jpg@92w_92h.webp`，结尾已有格式后缀；
 * 共享的 `<Picture>` 会自己追加 `.avif/.webp`，所以这里去掉结尾的格式后缀，
 * 否则会拼出 `...webp.avif` 这种非法地址（真机预览里会全部退化成兜底占位）。
 */
function absoluteImage(raw: string | null | undefined): string {
  let value = (raw ?? '').trim()
  if (!value)
    return ''
  if (value.startsWith('//'))
    value = `https:${value}`
  if (value.includes('@'))
    value = value.replace(/\.(?:avif|webp)$/i, '')
  return value
}

function imageOf(root: Element | null): string {
  if (!root)
    return ''
  return absoluteImage(root.querySelector('img')?.getAttribute('src'))
}

const BUTTON_CLASS_RE: Array<[MessageListItemButton, RegExp]> = [
  ['reply', /(?:^|\s)reply(?:\s|$)/],
  ['like', /(?:^|\s)like(?:\s|$)/],
  ['delete', /(?:^|\s)delete(?:\s|$)/],
  ['notice', /(?:^|\s)notice(?:\s|$)/],
]

function readButtons(element: Element): MessageListItemButton[] {
  const buttons: MessageListItemButton[] = []
  element.querySelectorAll<HTMLElement>('.interaction-item__btn').forEach((btn) => {
    const cls = btn.className
    BUTTON_CLASS_RE.forEach(([type, re]) => {
      if (re.test(cls) && !buttons.includes(type))
        buttons.push(type)
    })
  })
  return buttons
}

/** 原生若将来加上逐条未读标记，这里先识别；没有则返回 false，交给分类计数近似 */
function hasNativeUnreadMarker(element: Element): boolean {
  const cls = String(element.className)
  if (/unread|isUnread|is-unread/i.test(cls))
    return true
  if (element.getAttribute('data-read') === '0' || element.getAttribute('data-unread') === '1')
    return true
  return Boolean(element.querySelector('[class*="unread" i], [class*="Unread"]'))
}

export function readInteractionRows(route: string = getMessageRoute()): NativeInteractionRow[] {
  return getNativeListItems(route).map((element, index) => {
    const left = element.querySelector('.interaction-item__left')
    return {
      index,
      element,
      unames: Array.from(element.querySelectorAll('.interaction-item__uname'))
        .map(node => textOf(node))
        .filter(Boolean),
      action: textOf(element.querySelector('.interaction-item__action')),
      message: normalizeMessage(element.querySelector('.interaction-item__msg')?.textContent ?? ''),
      reference: normalizeMessage(element.querySelector('.interaction-item__reference')?.textContent ?? ''),
      cover: imageOf(element.querySelector('.interaction-item__cover')),
      time: textOf(element.querySelector('.interaction-item__time')),
      avatars: Array.from(element.querySelectorAll('.interaction-item__avatar img'))
        .map(img => absoluteImage(img.getAttribute('src')))
        .filter(Boolean),
      multi: Boolean(left?.classList.contains('multi')),
      buttons: readButtons(element),
      unreadMarker: hasNativeUnreadMarker(element),
    }
  })
}

export function readSystemRows(route: string = getMessageRoute()): NativeSystemRow[] {
  return getNativeListItems(route).map((element, index) => ({
    index,
    element,
    title: textOf(element.querySelector('.notify-item__title')),
    message: normalizeMessage(element.querySelector('.notify-item__msg')?.textContent ?? ''),
    time: textOf(element.querySelector('.notify-item__time')),
    unreadMarker: hasNativeUnreadMarker(element),
  }))
}

/** 点击原生条目（完全交给 B 站自己的跳转逻辑） */
export function clickNativeListItem(route: string, index: number): boolean {
  const item = getNativeListItems(route)[index]
  if (!item)
    return false
  item.click()
  return true
}

/** 点击原生条目上的操作按钮（回复 / 点赞 / 删除通知 / 不再通知） */
export function clickNativeListItemButton(route: string, index: number, type: MessageListItemButton): boolean {
  const item = getNativeListItems(route)[index]
  if (!item)
    return false
  const candidates = Array.from(item.querySelectorAll<HTMLElement>('.interaction-item__btn'))
  const target = candidates.find((btn) => {
    const cls = btn.className
    return BUTTON_CLASS_RE.some(([buttonType, re]) => buttonType === type && re.test(cls))
  })
  if (!target)
    return false
  target.click()
  return true
}
