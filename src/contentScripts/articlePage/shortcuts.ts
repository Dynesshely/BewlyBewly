/**
 * 阅读模式的键盘快捷键。
 *
 * 捕获阶段接管：先于 B 站自身的监听器执行，处理完直接 stopPropagation，
 * 避免和原生快捷键重复触发；不认识的按键一律不拦截。
 * 输入框 / 可编辑区域、带修饰键、已有人处理过的按键全部让行。
 *
 * 快捷键清单（与 docs/article-page.md、TOC 面板底部提示一致）：
 *   R    切换沉浸阅读
 *   [ ]  字号减 / 增
 *   T    回到顶部
 *   Esc  退出沉浸阅读（目录展开时先收起目录）
 */
import {
  decreaseFont,
  increaseFont,
  scrollToTop,
  setReading,
  setTocOpen,
  toggleReading,
} from './actions'
import { HOST_ID } from './constants'
import { isArticlePage, isEditableEvent, isFromBewlyUi } from './dom'
import { ui } from './state'

function consume(event: KeyboardEvent): void {
  event.preventDefault()
  event.stopPropagation()
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.isComposing)
    return
  if (event.ctrlKey || event.metaKey || event.altKey)
    return
  if (!isArticlePage())
    return

  const key = event.key

  // Esc 优先处理：目录展开时先收起目录，再按一次才退出阅读模式
  if (key === 'Escape') {
    if (ui.tocOpen) {
      consume(event)
      setTocOpen(false)
      return
    }
    if (ui.reading) {
      consume(event)
      setReading(false)
      return
    }
    return
  }

  if (isEditableEvent(event) || isFromBewlyUi(event, HOST_ID))
    return

  if (event.shiftKey)
    return

  const lower = key.toLowerCase()

  if (lower === 'r') {
    consume(event)
    toggleReading()
    return
  }
  if (lower === 't') {
    consume(event)
    scrollToTop()
    return
  }
  if (key === '[') {
    consume(event)
    decreaseFont()
    return
  }
  if (key === ']') {
    consume(event)
    increaseFont()
  }
}

/** 在捕获阶段注册；返回解绑函数 */
export function setupShortcuts(): () => void {
  window.addEventListener('keydown', handleKeyDown, true)
  return () => window.removeEventListener('keydown', handleKeyDown, true)
}
