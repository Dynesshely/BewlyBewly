/**
 * 评论区移到播放器右侧、与播放器同高（第 27 轮，用户点名需求）。
 *
 * 真机结构（2026-11，1600×1000，BV1wvWM6RE3Z）：
 * ```
 * #mirror-vdcon
 *   ├─ .left-container（sticky）
 *   │    ├─ #playerWrap（播放器，高 683）
 *   │    ├─ …视频标题 / 工具条 / 简介…
 *   │    └─ #commentapp（评论区 Web Components，原本在左栏底部）
 *   └─ .right-container（350 宽）
 *        └─ .right-container-inner.scroll-sticky
 *             ├─ .up-panel-container
 *             ├─ .video-pod-above-modules
 *             └─ .rcmd-tab（推荐列表，由 recommendRail 负责，本模块不碰）
 * ```
 *
 * 做法：
 * - 把 `#commentapp` 移动进一个我们创建的 `.bewly-comment-column` 容器，容器插在右栏顶部；
 * - **固定单页布局下（html.bewly-video-fixed）本模块不参与任何尺寸计算**：
 *   高度来自 `fixedLayout.ts` 写的 `--bvp-fixed-player-height`，顶部对齐由页面级 CSS 的
 *   `padding-top: calc(信息栏 + gutter)` 保证。第 29 轮之前这里每拍读 rect 反算 margin-top，
 *   与 fixedLayout 互相驱动导致评论区 y 在 120 ↔ 64 之间震荡（真机实测差 56px），现已移除；
 * - 非固定布局（原生可滚动页面）下容器高度仍按 `#playerWrap` 实测高度设置，
 *   但只在值变化时写入，避免无意义的重排；
 * - 记录 `#commentapp` 原来的 parent / nextSibling，关闭开关、窄屏、影院模式、卸载时**原样放回**；
 * - 找不到 `#mirror-vdcon` / `#commentapp` / `#playerWrap` / 右栏容器任一 → 完全不生效（原生布局）。
 */
import { watch } from 'vue'

import { settings } from '~/logic'

import { ui } from './state'

export const COMMENT_COLUMN_CLASS = 'bewly-comment-column'
export const COMMENT_COLUMN_WRAPPER_ID = 'bewly-comment-column'
const HEIGHT_VAR = '--bewly-comment-column-height'
const OFFSET_VAR = '--bewly-comment-column-offset'
/** 窄于这个宽度放不下「主栏 + 评论区」两列，自动回退原生布局 */
const MIN_COLUMN_WIDTH = 1280

interface LayoutParts {
  mirror: HTMLElement
  rightInner: HTMLElement
  playerWrap: HTMLElement
  commentApp: HTMLElement
}

interface MovedState {
  wrapper: HTMLElement
  commentApp: HTMLElement
  originalParent: HTMLElement
  originalNextSibling: Node | null
  playerWrap: HTMLElement
}

let moved: MovedState | null = null
let playerObserver: ResizeObserver | null = null

function getLayoutParts(): LayoutParts | null {
  const mirror = document.querySelector<HTMLElement>('#mirror-vdcon')
  if (!mirror)
    return null

  const left = mirror.querySelector<HTMLElement>('.left-container')
  const right = mirror.querySelector<HTMLElement>('.right-container')
  const rightInner = right?.querySelector<HTMLElement>('.right-container-inner') ?? right
  const playerWrap = left?.querySelector<HTMLElement>('#playerWrap')
    ?? mirror.querySelector<HTMLElement>('#playerWrap')
  const commentApp = left?.querySelector<HTMLElement>('#commentapp')
    ?? mirror.querySelector<HTMLElement>('#commentapp')
    ?? document.querySelector<HTMLElement>('#commentapp')

  if (!rightInner || !playerWrap || !commentApp)
    return null

  return {
    mirror,
    rightInner,
    playerWrap,
    commentApp,
  }
}

function shouldEnable(): boolean {
  if (!settings.value.videoPageCommentColumn)
    return false
  // 窄屏放不下两列：保持原生布局
  return window.innerWidth >= MIN_COLUMN_WIDTH
}

function clearColumnVars(): void {
  document.documentElement.classList.remove(COMMENT_COLUMN_CLASS)
  document.documentElement.style.removeProperty(HEIGHT_VAR)
  document.documentElement.style.removeProperty(OFFSET_VAR)
}

/** 固定布局是否正在接管页面（此时高度 / 对齐全部由页面级 CSS 决定） */
function isFixedLayoutActive(): boolean {
  return document.documentElement.classList.contains('bewly-video-fixed')
}

/** 值相同就不写：重复写 CSS 变量会让浏览器重算样式，也容易唤醒别的观察器 */
function setVarIfChanged(name: string, value: string): void {
  const root = document.documentElement
  if (root.style.getPropertyValue(name) === value)
    return
  root.style.setProperty(name, value)
}

/**
 * 非固定布局：容器高度 = 播放器实测高度，margin-top = 播放器顶边 − 右栏顶边。
 *
 * ⚠️ 固定布局下**必须直接返回**：那时播放器高度由 fixedLayout.ts 写，
 * 这里再读 rect 反算会和它互相驱动（第 29 轮修掉的震荡环）。
 */
function applyColumnMetrics(parts: LayoutParts): void {
  if (isFixedLayoutActive()) {
    // 固定布局接管时把本模块的变量清掉：尺寸完全交给 fixedLayout 的 CSS 变量
    document.documentElement.style.removeProperty(HEIGHT_VAR)
    document.documentElement.style.removeProperty(OFFSET_VAR)
    return
  }

  const playerRect = parts.playerWrap.getBoundingClientRect()
  const height = Math.round(playerRect.height)
  if (height > 0)
    setVarIfChanged(HEIGHT_VAR, `${height}px`)

  const wrapper = moved?.wrapper
  if (!wrapper)
    return

  // 容器是右栏第一个子节点：用右栏顶边作为自然顶边，偏移 = 播放器顶边 - 右栏顶边
  const rightRect = parts.rightInner.getBoundingClientRect()
  const offset = Math.max(0, Math.round(playerRect.top - rightRect.top))
  setVarIfChanged(OFFSET_VAR, `${offset}px`)
}

function moveCommentApp(parts: LayoutParts): void {
  const wrapper = document.createElement('div')
  wrapper.id = COMMENT_COLUMN_WRAPPER_ID
  wrapper.className = COMMENT_COLUMN_CLASS
  wrapper.setAttribute('data-bewly-comment-column', '')

  // 插到右栏最前面：配合 margin-top 偏移，让评论列顶边对齐播放器顶边，
  // 原来的 UP 主卡 / 选集 / 推荐顺延到评论列下方。
  parts.rightInner.insertBefore(wrapper, parts.rightInner.firstChild)

  const originalParent = parts.commentApp.parentElement
  if (!originalParent) {
    wrapper.remove()
    return
  }
  const originalNextSibling = parts.commentApp.nextSibling

  wrapper.appendChild(parts.commentApp)
  document.documentElement.classList.add(COMMENT_COLUMN_CLASS)

  moved = {
    wrapper,
    commentApp: parts.commentApp,
    originalParent,
    originalNextSibling,
    playerWrap: parts.playerWrap,
  }
  observePlayer(parts.playerWrap)
  applyColumnMetrics(parts)
}

/** 把评论宿主放回原位（节点已被 B 站替换时尽力而为），并清理容器 / 类 / 变量 */
export function restoreCommentColumn(): void {
  const state = moved
  moved = null

  disconnectPlayerObserver()

  if (state) {
    const { wrapper, commentApp, originalParent, originalNextSibling } = state
    if (commentApp.isConnected && originalParent.isConnected) {
      try {
        if (originalNextSibling && originalNextSibling.parentNode === originalParent)
          originalParent.insertBefore(commentApp, originalNextSibling)
        else
          originalParent.appendChild(commentApp)
      }
      catch {
        // 原位置已不可用：保持节点在原父级即可，不抛错
      }
    }
    wrapper.remove()
  }

  clearColumnVars()
}

/**
 * 每次状态同步调用：满足条件就重排，不满足就还原。
 *
 * 同时处理「B 站重建了 #commentapp / 右栏」的情况：旧节点断开则先尽量还原，再把新节点移进去。
 */
export function syncCommentColumn(): void {
  const parts = getLayoutParts()

  if (!shouldEnable() || !parts) {
    restoreCommentColumn()
    return
  }

  // B 站重建了评论宿主 / 右栏：清掉旧容器后重新接管（旧节点已断开，不需要再插回原位）
  if (moved && (!moved.commentApp.isConnected || !moved.wrapper.isConnected || moved.commentApp !== parts.commentApp)) {
    moved.wrapper.remove()
    moved = null
    clearColumnVars()
  }

  if (moved && moved.wrapper.isConnected && moved.commentApp.parentElement === moved.wrapper) {
    applyColumnMetrics(parts)
    return
  }

  moveCommentApp(parts)
}

/**
 * 播放器尺寸变化（窗口缩放 / 全屏 / 迷你播放器）时同步重算评论列高度。
 *
 * 固定布局下播放器高度是本模块之外的 `fixedLayout.ts` 写的，观察它只会形成
 * 「自己写高度 → 观察器回调 → 再写高度」的回环，所以那时不观察。
 */
function observePlayer(playerWrap: HTMLElement): void {
  playerObserver?.disconnect()
  playerObserver = null
  if (isFixedLayoutActive())
    return
  playerObserver = new ResizeObserver(() => syncCommentColumn())
  playerObserver.observe(playerWrap)
}

function disconnectPlayerObserver(): void {
  playerObserver?.disconnect()
  playerObserver = null
}

export function setupCommentColumn(): () => void {
  const onResize = () => syncCommentColumn()
  window.addEventListener('resize', onResize, { passive: true })

  const stopWatch = watch(
    () => [settings.value.videoPageCommentColumn, ui.fixedLayout] as const,
    () => syncCommentColumn(),
  )

  syncCommentColumn()

  return () => {
    window.removeEventListener('resize', onResize)
    stopWatch()
    disconnectPlayerObserver()
    restoreCommentColumn()
  }
}
