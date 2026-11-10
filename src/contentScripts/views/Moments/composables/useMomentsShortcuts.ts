/**
 * 动态页模块内键盘操作：
 * - `j` / `↓` 下一张卡片，`k` / `↑` 上一张；
 * - `o` 打开当前高亮卡片；
 * - `Esc` 取消高亮（大图打开时由 lightbox 自己处理）。
 *
 * 与全局快捷键的关系：全局监听在 App 层，先于这里执行且会 `preventDefault`；
 * 因此这里先看 `event.defaultPrevented`，命中就完全让行。
 */
import type { Ref } from 'vue'
import type { MomentCard } from '../types'

interface MomentsShortcutOptions {
  cards: Ref<MomentCard[]>
  activeIndex: Ref<number>
  /** 大图 / 弹层打开时不接管按键 */
  isOverlayOpen: () => boolean
  onOpen: (card: MomentCard) => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement))
    return false
  if (target.isContentEditable)
    return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/** 聚焦浏览模式整页接管，交给它 */
function isFocusBrowseActive(): boolean {
  return document.documentElement.classList.contains('bewly-focus-browse')
}

export function useMomentsShortcuts(options: MomentsShortcutOptions) {
  /** Bewly 的页面渲染在 #bewly 的 shadow root 里，不能直接用 document 查 DOM */
  function findCardElement(id: string): HTMLElement | null {
    const scope: ParentNode = document.querySelector('#bewly')?.shadowRoot ?? document
    return scope.querySelector<HTMLElement>(`[data-moment-id="${id}"]`)
  }

  function scrollActiveIntoView() {
    const card = options.cards.value[options.activeIndex.value]
    if (!card)
      return
    findCardElement(card.id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  function move(delta: number) {
    const total = options.cards.value.length
    if (!total)
      return

    const current = options.activeIndex.value
    const next = current < 0
      ? (delta > 0
          ? 0
          : total - 1)
      : Math.min(total - 1, Math.max(0, current + delta))

    options.activeIndex.value = next
    nextTick(scrollActiveIntoView)
  }

  function openActive() {
    const total = options.cards.value.length
    if (!total)
      return

    if (options.activeIndex.value < 0)
      options.activeIndex.value = 0

    const card = options.cards.value[options.activeIndex.value]
    if (card)
      options.onOpen(card)
  }

  function clearActive() {
    options.activeIndex.value = -1
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing)
      return
    if (event.ctrlKey || event.metaKey || event.altKey)
      return
    if (isTypingTarget(event.target))
      return
    if (isFocusBrowseActive())
      return
    if (options.isOverlayOpen())
      return

    if (event.key === 'j' || event.key === 'ArrowDown') {
      event.preventDefault()
      move(1)
      return
    }
    if (event.key === 'k' || event.key === 'ArrowUp') {
      event.preventDefault()
      move(-1)
      return
    }
    if (event.key === 'o') {
      event.preventDefault()
      openActive()
      return
    }
    if (event.key === 'Escape' && options.activeIndex.value >= 0) {
      event.preventDefault()
      clearActive()
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKeydown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

  return { move, openActive, clearActive }
}
