/**
 * 自绘页面的键盘导航（j / k / ↑ / ↓ / Enter / Esc / Home / End）。
 *
 * # 为什么需要它
 *
 * 第 100~103 轮把空间页、搜索结果页、热门页、分区频道页、动态页、消息中心改成了
 * API 自绘（覆盖层挂在原生页之上，卡片在 **light DOM**）。但键盘导航只给首页做过
 * （`composables/useKeyboardCardNavigation`：只查 `#bewly` 的 shadow root 与原生
 * `.bili-video-card`）—— 这些自绘页的卡片既不在 shadow 里、原生卡又被隐藏，
 * 于是「J / K / Enter / Esc 在快捷键注册表里登记了、命令面板与 ? 帮助都显示当前页可用、
 * 按下去却毫无反应」。真机实测（CDP 9333）：空间页 / 搜索结果页按 J、↓，高亮不变、
 * scrollTop 恒为 0 —— 这是纯心智负担，用户必须先试一次才知道那是假的。
 *
 * 本 composable 把注册表已承诺的行为真正接上：
 *   - `space` scope：J / K / Enter / Esc（见 constants/shortcutRegistry）
 *   - `search` scope：J ↓ / K ↑ / Enter / Esc
 *   - 热门 / 分区 / 动态 / 消息这几个「有卡片但没有登记 scope」的页面：同一套语义
 *
 * # 与全局键盘导航的关系
 *
 * `useKeyboardCardNavigation` 在 window 的**冒泡**阶段监听；本模块在 **capture** 阶段
 * 监听并在命中导航键时 `stopPropagation()`，所以自绘页上一旦接管，全局那套不会再对
 * 同一批按键做第二次判断（避免双高亮 / 双滚动）。没命中卡 / 没高亮时全部原样放行。
 *
 * # 边界（都不接管，按键原样下传）
 *
 * - 焦点在输入框 / 可编辑区（搜索关键词、消息过滤框、收藏夹重命名）；
 * - 浮层打开（命令面板 / 设置 / 快捷键帮助 / iframe 抽屉 / 通用 Dialog）；
 * - 页面上没有卡片时；Esc 在没有高亮时（把语义让给「退出清屏 / 聚焦浏览」）。
 */
import { injectCSS } from '~/utils/dom'

/** 高亮属性：与首页的 `data-keyboard-active` 分开，避免两套导航互相抢高亮 */
const ACTIVE_ATTR = 'data-bewly-page-active'

/** 浮层选择器：命令面板 / 设置 / 快捷键帮助 / 抽屉 / 通用 Dialog（都在 `#bewly` shadow 内） */
const OVERLAY_SELECTOR = '.command-palette-mask, .keyboard-help-mask, .keyboard-help-panel, #settings-window, .bewly-iframe-drawer, .dialog'

/** 只注入一次的高亮样式（自绘页在 light DOM，走页面级样式） */
const ACTIVE_STYLE_ID = 'bewly-page-keyboard-style'

const ACTIVE_CSS = `
[data-bewly-page-active] {
  outline: 2px solid var(--bew-theme-color);
  outline-offset: 4px;
  border-radius: var(--bew-radius);
  box-shadow: 0 0 0 6px color-mix(in oklab, var(--bew-theme-color), transparent 80%);
  transition: outline-color 120ms ease-out, box-shadow 120ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  [data-bewly-page-active] {
    transition: none;
  }
}
`

function ensureActiveStyle(): void {
  if (typeof document === 'undefined' || document.getElementById(ACTIVE_STYLE_ID))
    return
  const style = injectCSS(ACTIVE_CSS, document.head)
  style.id = ACTIVE_STYLE_ID
}

export interface DrawnPageKeyboardNavOptions {
  /** 卡片选择器，默认自绘页统一使用的 `[data-video-card]` */
  cardSelector?: string
  /**
   * 打开卡片。缺省：点卡片里第一个 `a[href]`，走 ALink / VideoCard 的原生逻辑，
   * 从而沿用用户设置（新标签页 / 当前页 / 内嵌预览）。
   */
  openCard?: (card: HTMLElement) => void
  /** 额外启用条件（如「消息页只有会话列表有内容时才启用」），返回 false 不接管 */
  enabled?: () => boolean
  /** 高亮变化回调（消息页据此切换会话等） */
  onActiveChange?: (card: HTMLElement | null, index: number) => void
}

export interface DrawnPageKeyboardNavHandle {
  /** 当前高亮下标（-1 = 没有高亮） */
  activeIndex: Ref<number>
  /** 相对移动（+1 下一个 / -1 上一个），没有高亮时按方向落到首 / 尾 */
  move: (delta: number) => void
  /** 跳到指定下标（越界自动收敛） */
  moveTo: (index: number) => void
  /** 清除高亮 */
  clear: () => void
  /** 当前高亮卡片 */
  current: () => HTMLElement | null
  /** 列表变化后收敛下标（数据刷新、筛选变化时调用） */
  reconcile: () => void
}

/** 是否处于「不该接管按键」的上下文：浮层打开 / 焦点在输入框 */
function isBlockedContext(event: KeyboardEvent): boolean {
  const shadowRoot = document.querySelector('#bewly')?.shadowRoot
  if (shadowRoot?.querySelector(OVERLAY_SELECTOR))
    return true

  const path = typeof event.composedPath === 'function'
    ? event.composedPath()
    : []
  for (const node of path) {
    if (!(node instanceof HTMLElement))
      continue
    if (node.isContentEditable || node.matches('input, textarea, select'))
      return true
    if (node.closest?.('input, textarea, select, [contenteditable="true"]'))
      return true
  }

  const active = document.activeElement as HTMLElement | null
  if (active && active !== document.body && active.matches('input, textarea, select, [contenteditable="true"]'))
    return true

  return false
}

/** 卡片列表：只取可见的（离屏优化 / 筛选会把卡片 display:none） */
function readCards(selector: string): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(selector))
    .filter(card => card.getClientRects().length > 0)
}

function defaultOpenCard(card: HTMLElement): void {
  const link = card.querySelector<HTMLAnchorElement>('a[href]')
  if (link)
    link.click()
}

export function useDrawnPageKeyboardNav(options: DrawnPageKeyboardNavOptions = {}): DrawnPageKeyboardNavHandle {
  const cardSelector = options.cardSelector ?? '[data-video-card]'
  const activeIndex = ref<number>(-1)

  function list(): HTMLElement[] {
    return readCards(cardSelector)
  }

  function current(): HTMLElement | null {
    const cards = list()
    const index = activeIndex.value
    return index >= 0 && index < cards.length
      ? cards[index]
      : null
  }

  function paint(cards: HTMLElement[], index: number): void {
    cards.forEach((card, i) => {
      if (i === index) {
        card.setAttribute(ACTIVE_ATTR, '')
        card.setAttribute('aria-current', 'true')
      }
      else {
        card.removeAttribute(ACTIVE_ATTR)
        card.removeAttribute('aria-current')
      }
    })
  }

  /** 滚动到可视区：`nearest` 不会把已经可见的卡片再推走 */
  function reveal(card: HTMLElement | null): void {
    if (!card)
      return
    try {
      card.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
    catch {
      // 极老浏览器不支持 options：高亮本身仍然可见
    }
  }

  function moveTo(index: number): void {
    const cards = list()
    if (!cards.length) {
      activeIndex.value = -1
      return
    }
    const next = Math.min(cards.length - 1, Math.max(0, index))
    activeIndex.value = next
    paint(cards, next)
    reveal(cards[next])
    options.onActiveChange?.(cards[next], next)
  }

  function move(delta: number): void {
    const cards = list()
    if (!cards.length)
      return
    const base = activeIndex.value >= 0
      ? activeIndex.value
      : (delta > 0
          ? -1
          : cards.length)
    moveTo(base + delta)
  }

  function clear(): void {
    activeIndex.value = -1
    document.querySelectorAll<HTMLElement>(`[${ACTIVE_ATTR}]`).forEach((card) => {
      card.removeAttribute(ACTIVE_ATTR)
      card.removeAttribute('aria-current')
    })
    options.onActiveChange?.(null, -1)
  }

  function reconcile(): void {
    if (activeIndex.value < 0)
      return
    const cards = list()
    if (!cards.length) {
      activeIndex.value = -1
      return
    }
    if (activeIndex.value >= cards.length) {
      activeIndex.value = cards.length - 1
      paint(cards, activeIndex.value)
    }
  }

  function isEnabled(): boolean {
    return options.enabled
      ? options.enabled()
      : true
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.isComposing)
      return
    if (event.ctrlKey || event.metaKey || event.altKey)
      return
    if (!isEnabled())
      return

    const { key } = event
    const isNavKey = key === 'j' || key === 'k' || key === 'J' || key === 'K'
      || key === 'ArrowDown' || key === 'ArrowUp'
      || key === 'Home' || key === 'End'
      || key === 'Enter'
      || key === 'Escape'
    if (!isNavKey)
      return
    if (isBlockedContext(event))
      return

    const cards = list()

    if (!cards.length) {
      if (key === 'Escape' && activeIndex.value >= 0) {
        clear()
        event.preventDefault()
        event.stopPropagation()
      }
      return
    }

    if (key === 'Escape') {
      // 没有高亮时把 Esc 让给全局（退出清屏 / 聚焦浏览 / 关浮层）
      if (activeIndex.value < 0)
        return
      event.preventDefault()
      event.stopPropagation()
      clear()
      return
    }

    if (key === 'Enter') {
      const card = current()
      if (!card)
        return
      // 焦点在按钮 / 链接上时，Enter 交给原生行为（与全局导航同一约定）
      const active = document.activeElement as HTMLElement | null
      if (active && active !== document.body && active.matches('a, button, input, textarea, select'))
        return
      event.preventDefault()
      event.stopPropagation()
      ;(options.openCard ?? defaultOpenCard)(card)
      return
    }

    if (key === 'Home' || key === 'End') {
      event.preventDefault()
      event.stopPropagation()
      moveTo(key === 'Home'
        ? 0
        : cards.length - 1)
      return
    }

    event.preventDefault()
    event.stopPropagation()
    const forward = key === 'j' || key === 'J' || key === 'ArrowDown'
    move(forward
      ? 1
      : -1)
  }

  onMounted(() => {
    ensureActiveStyle()
    // capture：先于全局 keyboard nav（window 冒泡）拿到事件；接管后不再下传
    window.addEventListener('keydown', handleKeydown, true)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeydown, true)
    clear()
  })

  return {
    activeIndex,
    move,
    moveTo,
    clear,
    current,
    reconcile,
  }
}
