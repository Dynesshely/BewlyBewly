/**
 * 直播页增强层的快捷键。
 *
 *   T  影院模式（再按退出）
 *   H  隐藏 / 显示右侧栏
 *   C  弹幕开关（点原生控件）
 *   F  全屏（优先点原生按钮）
 *   ?  打开 / 关闭面板（面板里有一份快捷键说明）
 *   Esc 退出影院模式 / 关闭面板
 *
 * 让行规则与前几轮一致：`defaultPrevented`、`isComposing`、输入框 / 弹幕输入框 /
 * contenteditable、Ctrl / Cmd / Alt、来自 Bewly 或本模块浮层的按键。
 */
import {
  toggleCinema,
  toggleDanmaku,
  toggleFullscreen,
  toggleHideAside,
  togglePanel,
} from './actions'
import { HOST_ID } from './constants'
import { isEditableTarget, isFromBewlyUi, isFromOverlay } from './dom'
import { ui } from './state'

function consume(event: KeyboardEvent): void {
  event.preventDefault()
  event.stopPropagation()
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.isComposing)
    return

  // 焦点在弹幕输入框 / 搜索框等可编辑区域里时不劫持按键
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
    if (ui.cinema) {
      consume(event)
      toggleCinema()
    }
    return
  }

  // 来自 Bewly 自己的 UI / 本模块浮层的按键不参与（浮层按钮自己处理点击与键盘）
  if (isFromBewlyUi(event) || isFromOverlay(event, HOST_ID))
    return

  // 「?」本来就是 Shift + /，要放在 Shift 让行之前
  if (key === '?') {
    consume(event)
    togglePanel()
    return
  }

  // Shift + 字母是组合键，不当作单个快捷键
  if (event.shiftKey)
    return

  const lower = key.toLowerCase()

  if (lower === 't') {
    consume(event)
    toggleCinema()
    return
  }
  if (lower === 'h') {
    consume(event)
    toggleHideAside()
    return
  }
  if (lower === 'c') {
    consume(event)
    toggleDanmaku()
    return
  }
  if (lower === 'f') {
    consume(event)
    void toggleFullscreen()
  }
}

/** 在冒泡阶段接管本模块负责的按键；返回解绑函数 */
export function setupKeyboard(): () => void {
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}
