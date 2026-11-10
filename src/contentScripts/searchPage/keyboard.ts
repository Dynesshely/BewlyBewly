/**
 * 搜索结果页的键盘浏览。
 *
 * 按键：
 *   j / k      下一张 / 上一张结果卡（高亮 + 滚动到视口中央）
 *   ↑ / ↓      同上（仅当 Bewly 既有键盘导航没有处理这个按键时接管）
 *   Enter      在新标签页打开当前卡
 *   Esc        关闭面板 / 取消高亮
 *
 * 与既有导航共存：Bewly 已经在原生页上提供 ↑/↓/Enter 的卡片导航
 * （`useKeyboardCardNavigation`），它会先注册 `keydown` 并 `preventDefault()`。
 * 本模块注册在其之后，一旦发现 `defaultPrevented` 就直接让行，
 * 因此不会出现「一次按键移动两格」或「Enter 打开两个标签页」。
 */
import { ACTIVE_ATTR, clearActive, moveActive, openActiveCard, togglePanel } from './actions'
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

  // 焦点在搜索框 / 下拉框 / 可编辑区域里时不劫持按键
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

  // Shift + 字母是组合快捷键（例如 Shift + F 聚焦浏览），不当作 j/k
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

  // 方向键：既有导航开启时它已经 preventDefault，轮到这里的只有「它没接管」的情况
  if (key === 'ArrowDown') {
    consume(event)
    moveActive(1)
    return
  }
  if (key === 'ArrowUp') {
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
