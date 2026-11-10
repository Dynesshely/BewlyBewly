/**
 * 分区 / 频道页增强层的键盘浏览。
 *
 * 按键：
 *   j / k      下一张 / 上一张视频卡（高亮 + 滚动到视口中央）
 *   Enter      在新标签页打开当前卡
 *   Esc        关闭面板 / 取消高亮
 *
 * 让行规则与前几轮增强层一致：`defaultPrevented`、`isComposing`、输入框 /
 * contenteditable、Ctrl / Cmd / Alt、Shift + 字母全部让行。
 */
import { clearActive, moveActive, openActiveCard, togglePanel } from './actions'
import { ACTIVE_ATTR } from './constants'
import { isEditableTarget, isFocusOnInteractive, isFromBewlyUi, isFromOverlay } from './dom'
import { ui } from './state'

function consume(event: KeyboardEvent): void {
  event.preventDefault()
  event.stopPropagation()
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.isComposing)
    return

  if (isEditableTarget(event.target))
    return

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

  if (isFromBewlyUi(event))
    return

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
