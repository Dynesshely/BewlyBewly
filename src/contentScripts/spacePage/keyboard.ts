import { clearActive, moveActive, openActiveCard, togglePanel } from './actions'
/**
 * 用户空间增强层的键盘浏览。
 *
 * 按键：
 *   j / k      下一张 / 上一张内容卡（高亮 + 滚动到视口中央）
 *   Enter      在新标签页打开当前卡
 *   Esc        关闭面板 / 取消高亮
 *
 * 让行规则与第 3 轮的搜索页增强一致：
 *   - `event.defaultPrevented`（被其它脚本处理过）、`isComposing`（输入法组词）；
 *   - 焦点在输入框 / 下拉框 / contenteditable 里；
 *   - 带 Ctrl / Cmd / Alt 的组合键；
 *   - Shift + 字母是组合快捷键，不当成 j/k。
 */
import { ACTIVE_ATTR } from './constants'
import { isEditableTarget, isFocusOnInteractive, isFromBewlyUi, isFromOverlay } from './dom'
import { ui } from './state'

function consume(event: KeyboardEvent): void {
  event.preventDefault()
  event.stopPropagation()
}

function handleKeyDown(event: KeyboardEvent): void {
  // 已被原生 / 其它扩展 / Bewly 既有导航处理过的按键一律让行
  if (event.defaultPrevented || event.isComposing)
    return

  // 焦点在输入框 / 下拉框 / 可编辑区域里时不劫持按键
  if (isEditableTarget(event.target))
    return

  // 带系统修饰键的组合交给浏览器与原生页面
  if (event.ctrlKey || event.metaKey || event.altKey)
    return

  const key = event.key

  if (key === 'Escape') {
    if (ui.panelOpen) {
      consume(event)
      togglePanel(false)
      return
    }
    if (document.querySelector(`[${ACTIVE_ATTR}]`)) {
      consume(event)
      clearActive()
    }
    return
  }

  // 来自 Bewly 自己 UI 的按键不参与卡片浏览
  if (isFromBewlyUi(event))
    return

  // Shift + 字母是组合快捷键，不当作 j/k
  if (event.shiftKey)
    return

  const lower = key.toLowerCase()

  if (lower === 'j') {
    consume(event)
    moveActive(1)
    return
  }
  if (lower === 'k') {
    consume(event)
    moveActive(-1)
    return
  }

  if (key === 'Enter') {
    // 焦点在原生按钮 / 链接上，或在本模块浮层的按钮上时，Enter 应该点击它而不是打开高亮卡
    if (isFocusOnInteractive() || isFromOverlay(event))
      return
    if (!document.querySelector(`[${ACTIVE_ATTR}]`))
      return
    consume(event)
    openActiveCard()
  }
}

/** 在冒泡阶段接管本模块负责的按键；返回解绑函数 */
export function setupKeyboard(): () => void {
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}
