/**
 * 播放器 / 评论区分隔条拖拽调宽（第 46 轮）。
 *
 * 用户要求：在播放器列与评论列之间放一条竖向分隔条，拖拽实时改宽度；双击回到自动比例。
 *
 * ## 为什么是页面级 DOM 而不是 shadow 内组件
 *
 * 分隔条必须压在播放器列与评论列之间的 gutter 上，而这两列都是 B 站自己的 DOM；
 * 挂在 body 上、用 `position: fixed` + 固定布局写出的 CSS 变量定位最简单，
 * 也不会被评论区的滚动容器裁剪。
 *
 * ## 写入纪律
 *
 * - 拖拽过程中只改内存里的「预览比例」并写 CSS 变量（`previewSplitRatio`），**不写 settings**；
 * - `pointerup` 时写一次 `settings.value.videoPageSplitRatio`（刷新后保持）；
 * - 键盘 ←/→ 每次 1%，Home/End 与双击一样复位为 0（自动比例 + 40% 兜底）；
 * - 比例统一 clamp 到 `[MIN_SPLIT_RATIO, MAX_SPLIT_RATIO]`。
 */
import { settings } from '~/logic'

import { showToast } from './actions'
import { MAX_SPLIT_RATIO, MIN_SPLIT_RATIO, previewSplitRatio, syncFixedLayout } from './fixedLayout'
import { useMessages } from './i18n'

const SPLITTER_ID = 'bewly-video-splitter'
/** 松手后高亮闪烁的类（300ms 后移除） */
const JUST_SAVED_CLASS = 'is-just-saved'
const JUST_SAVED_MS = 300
/** 拖拽期间挂在 body 上：禁用文本选中（页面级样式负责） */
const RESIZING_CLASS = 'bewly-video-resizing'

let el: HTMLElement | null = null
let dragging = false
let dragPointerId: number | null = null
let rafId = 0
let pendingRatio: number | null = null

/** 读 fixedLayout 写到 <html> 上的布局变量（视口像素） */
function readCssVar(name: string): number {
  const raw = window.getComputedStyle(document.documentElement).getPropertyValue(name)
  const value = Number.parseFloat(raw)
  return Number.isFinite(value)
    ? value
    : 0
}

function clampRatio(ratio: number): number {
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio))
}

/** 指针位置 → 播放器占内容宽的比例 */
function ratioFromClientX(clientX: number): number {
  const left = readCssVar('--bvp-fixed-content-left')
  const width = readCssVar('--bvp-fixed-content-width')
  if (width <= 0)
    return 0
  return clampRatio((clientX - left) / width)
}

/** 当前生效比例（从实际布局变量反推，键盘微调用） */
function currentRatio(): number {
  const width = readCssVar('--bvp-fixed-content-width')
  if (width <= 0)
    return 0
  const playerWidth = readCssVar('--bvp-fixed-player-width')
  return clampRatio(playerWidth / width)
}

function persistRatio(ratio: number): void {
  // 只有松手 / 键盘时写一次 settings，避免拖拽期间每帧落盘
  const value = Math.round(ratio * 1000) / 1000
  if (settings.value.videoPageSplitRatio !== value)
    settings.value.videoPageSplitRatio = value
}

function flushPreview(): void {
  rafId = 0
  if (pendingRatio === null)
    return
  previewSplitRatio(pendingRatio)
  syncFixedLayout()
}

/** 合并同一帧内的多次 pointermove，避免每次移动都跑一遍布局测量 */
function schedulePreview(ratio: number): void {
  pendingRatio = ratio
  if (rafId)
    return
  rafId = window.requestAnimationFrame(flushPreview)
}

function endDrag(): void {
  if (!dragging)
    return
  dragging = false
  dragPointerId = null
  el?.removeAttribute('data-dragging')
  document.body.classList.remove(RESIZING_CLASS)
  if (pendingRatio !== null) {
    persistRatio(pendingRatio)
    pendingRatio = null
  }
  // 回到持久值（与刚写入的一致，不会跳动）
  previewSplitRatio(null)
  syncFixedLayout()

  // 松手后 300ms 高亮闪烁一次，确认「已保存」
  flashJustSaved()
}

/** 松手确认：加 is-just-saved 类播放 300ms 闪烁动画，动画结束自动移除 */
function flashJustSaved(): void {
  if (!el)
    return
  el.classList.remove(JUST_SAVED_CLASS)
  // 强制重排，保证连续两次拖拽都能重新触发动画
  void el.offsetWidth
  el.classList.add(JUST_SAVED_CLASS)
  window.setTimeout(() => el?.classList.remove(JUST_SAVED_CLASS), JUST_SAVED_MS)
}

/** 双击 / Home / End：回到自动比例（settings = 0 → 自动计算 + 40% 兜底） */
function resetSplit(): void {
  if (settings.value.videoPageSplitRatio !== 0)
    settings.value.videoPageSplitRatio = 0
  pendingRatio = null
  previewSplitRatio(null)
  syncFixedLayout()
  showToast(useMessages().value.splitReset)
}

function onPointerDown(event: PointerEvent): void {
  if (!el || event.button !== 0)
    return
  event.preventDefault()
  el.setPointerCapture(event.pointerId)
  dragging = true
  dragPointerId = event.pointerId
  el.setAttribute('data-dragging', '')
  document.body.classList.add(RESIZING_CLASS)
}

function onPointerMove(event: PointerEvent): void {
  if (!dragging || dragPointerId !== event.pointerId)
    return
  schedulePreview(ratioFromClientX(event.clientX))
}

function onPointerUp(event: PointerEvent): void {
  if (!dragging || dragPointerId !== event.pointerId)
    return
  el?.releasePointerCapture(event.pointerId)
  endDrag()
}

function onDoubleClick(event: MouseEvent): void {
  event.preventDefault()
  resetSplit()
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    resetSplit()
    return
  }
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
    return
  event.preventDefault()
  const delta = event.key === 'ArrowRight'
    ? 0.01
    : -0.01
  const next = clampRatio(currentRatio() + delta)
  persistRatio(next)
  previewSplitRatio(next)
  syncFixedLayout()
  previewSplitRatio(null)
}

/** 每拍调用：保持无障碍属性 / 提示文案是当前值（显示隐藏由页面级 CSS 负责） */
export function syncSplitter(): void {
  if (!el)
    return
  const title = '双击重置宽度比例'
  if (el.getAttribute('title') !== title)
    el.setAttribute('title', title)
  if (el.getAttribute('aria-valuenow') !== String(Math.round(currentRatio() * 100)))
    el.setAttribute('aria-valuenow', String(Math.round(currentRatio() * 100)))
}

/** 创建分隔条（iframe 降级时不调用） */
export function setupSplitter(): () => void {
  if (el)
    return teardownSplitter

  el = document.createElement('div')
  el.id = SPLITTER_ID
  el.className = 'bewly-video-splitter'
  el.tabIndex = 0
  el.setAttribute('role', 'separator')
  el.setAttribute('aria-orientation', 'vertical')
  el.setAttribute('aria-label', '调整播放器与评论区宽度')
  el.setAttribute('aria-valuemin', String(Math.round(MIN_SPLIT_RATIO * 100)))
  el.setAttribute('aria-valuemax', String(Math.round(MAX_SPLIT_RATIO * 100)))
  el.setAttribute('title', '双击重置宽度比例')

  // 把手：3 个竖点，hover / 拖拽时显示（样式在 pages/videoPage.scss 第 51 轮段）
  const handle = document.createElement('div')
  handle.className = 'bvp-splitter__handle'
  handle.setAttribute('aria-hidden', 'true')
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('span')
    dot.className = 'bvp-splitter__dot'
    handle.appendChild(dot)
  }
  el.appendChild(handle)

  el.addEventListener('pointerdown', onPointerDown)
  el.addEventListener('pointermove', onPointerMove)
  el.addEventListener('pointerup', onPointerUp)
  el.addEventListener('pointercancel', endDrag)
  el.addEventListener('dblclick', onDoubleClick)
  el.addEventListener('keydown', onKeyDown)
  document.body.appendChild(el)
  return teardownSplitter
}

/** 卸载：移除元素、取消未执行的预览帧、清掉拖拽类 */
export function teardownSplitter(): void {
  if (rafId) {
    window.cancelAnimationFrame(rafId)
    rafId = 0
  }
  pendingRatio = null
  dragging = false
  dragPointerId = null
  document.body.classList.remove(RESIZING_CLASS)
  previewSplitRatio(null)
  el?.remove()
  el = null
}
