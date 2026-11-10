import type { NotificationCategoryId } from './state'
/**
 * 消息页增强的键盘快捷键。
 *
 * 捕获阶段接管：先于 B 站自身的监听器执行，处理完直接 stopPropagation，
 * 避免「原生行为 + 本模块行为」重复触发；不认识的按键一律不拦截。
 * 输入框 / 回复框里、带修饰键、以及来自 Bewly 自身 UI 的按键全部让行。
 */
import { jumpToCategory, toggleDensity, togglePanel, toggleUnreadOnly } from './actions'
import { isEditableEvent, isFromBewlyUi, isNativeNotificationPage } from './dom'
import { state } from './state'

/** 数字键 1–4 对应的分类顺序 */
const CATEGORY_ORDER: NotificationCategoryId[] = ['reply', 'at', 'love', 'system']

function consume(event: KeyboardEvent): void {
  event.preventDefault()
  event.stopPropagation()
}

function handleKeyDown(event: KeyboardEvent): void {
  // 已经有人（B 站原生 / 其它扩展）处理过的按键让行
  if (event.defaultPrevented || event.isComposing)
    return
  if (event.ctrlKey || event.metaKey || event.altKey)
    return
  if (isFromBewlyUi(event) || isEditableEvent(event))
    return
  if (!isNativeNotificationPage())
    return

  const key = event.key

  if (key === 'Escape') {
    // 面板开着才接管 Esc；否则交给原生（关闭弹窗 / 退出全屏等）
    if (state.panelOpen) {
      consume(event)
      togglePanel(false)
    }
    return
  }

  const lower = key.toLowerCase()

  if (lower === 'u') {
    consume(event)
    toggleUnreadOnly()
    return
  }

  if (lower === 'd') {
    consume(event)
    toggleDensity()
    return
  }

  if (/^[1-4]$/.test(key)) {
    const category = CATEGORY_ORDER[Number(key) - 1]
    if (!category)
      return
    consume(event)
    jumpToCategory(category)
  }
}

/** 在捕获阶段注册；返回解绑函数 */
export function setupShortcuts(): () => void {
  window.addEventListener('keydown', handleKeyDown, true)
  return () => window.removeEventListener('keydown', handleKeyDown, true)
}
