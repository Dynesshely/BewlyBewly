/**
 * 固定单页布局（第 28 轮引入，第 29 轮改为「单次布局事务」）。
 *
 * 用户要求：视频区 / 评论区 / 推荐轨道三块**互不重叠**，以 dock 形式分隔整个视图，页面不滚动。
 *
 * ## 为什么要重写（第 29 轮真机诊断）
 *
 * 第 28 轮有两个模块同时在改布局：
 * - `fixedLayout.ts` 改 `#playerWrap` 的高度；
 * - `commentColumn.ts` 每 500ms 读「播放器顶边 − 右栏顶边」反算 `margin-top`。
 *
 * 两者互相读对方的 rect 再写样式，形成震荡环：真机采样到评论列 `y` 在 120 ↔ 64 之间来回跳
 * （差 56px）、评论工具条 `top` 跟着 98 ↔ 154 跳。用户看到的就是「评论区有规律鬼畜」。
 *
 * ## 现在的约定：布局只有这一个所有者
 *
 * 本模块一次算出三区的全部尺寸，**只写 CSS 变量**（写到 `<html>` 上），由页面级 CSS 消费：
 *
 * | 变量 | 含义 |
 * | --- | --- |
 * | `--bvp-fixed-top` | `#mirror-vdcon` 距视口顶部的距离 |
 * | `--bvp-fixed-info` | 压缩后的信息栏高度 |
 * | `--bvp-fixed-gap` | 三个 dock 之间统一的 gutter |
 * | `--bvp-fixed-player-width` | 播放器宽度（= 左列宽度，严格 16:9 反算） |
 * | `--bvp-fixed-player-height` | 播放器高度（= 评论列高度） |
 * | `--bvp-fixed-rail-space` | 轨道预留高度（没渲染时为 0） |
 *
 * `commentColumn.ts` 在固定布局下**不再读任何 rect**，只用 `height: var(--bvp-fixed-player-height)`，
 * 因此不可能再和本模块互相驱动。
 *
 * ## 16:9 约束
 *
 * 用户要求「缩放比例正确、播放器不能侵入推荐区」：
 * ```
 * 可用高 = 视口高 − 顶部偏移 − 信息栏 − 详情 dock − 3 × gutter − 轨道预留
 * 左列可用宽 = 容器宽 − 评论区最小宽(280) − gutter
 * 播放器宽 = min(左列可用宽, round(可用高 × 16 / 9))    ← 可用高不足时宽度回收，而不是拉扁
 * 播放器高 = round(播放器宽 × 9 / 16)                   ← 严格 16:9
 * ```
 * 空出来的宽度全部补给评论区：右列 = 容器宽 − 播放器宽 − gutter（不再固定 350px）。
 *
 * ## 写入纪律
 *
 * - 每次写入前比较当前值，相同则跳过（避免每拍触发 style 重算 / 观察器回调）；
 * - 只读「本模块不修改的量」（`#mirror-vdcon` 的顶边、左列宽度、视口尺寸），
 *   不读自己写过的高度，因此没有反馈路径。
 */
import { watch } from 'vue'

import { settings } from '~/logic'

import { getPlayerWrapEl } from './dom'
import { computeRailHeight, getRenderedRailHeight, railState } from './recommendRail'
import { ui } from './state'

/** 固定布局生效时挂在 <html> 上的类（页面级样式与 e2e 都靠它） */
export const FIXED_LAYOUT_CLASS = 'bewly-video-fixed'

const TOP_VAR = '--bvp-fixed-top'
const INFO_VAR = '--bvp-fixed-info'
const GAP_VAR = '--bvp-fixed-gap'
const DETAILS_VAR = '--bvp-fixed-details'
const PLAYER_W_VAR = '--bvp-fixed-player-width'
const PLAYER_VAR = '--bvp-fixed-player-height'
const RAIL_VAR = '--bvp-fixed-rail-space'

/** 视口小于这个尺寸就放不下三块区域，自动回退原生可滚动布局 */
const MIN_VIEWPORT_WIDTH = 1280
const MIN_VIEWPORT_HEIGHT = 700

/** 压缩后的信息栏高度（与 videoPage.scss 里的 max-height 保持一致） */
export const INFO_BAR_HEIGHT = 56
/** 三个 dock 之间统一的 gutter（页面级 CSS 用同一个变量，保证分隔感一致） */
export const DOCK_GAP = 8
/** 播放器下方「详情 dock」的固定高度：工具栏 / 简介 / 标签压成三行，不产生内部滚动 */
export const DETAILS_HEIGHT = 104
/** 播放器最小 / 最大高度：避免极端窗口下压成一条或撑破 */
const MIN_PLAYER_HEIGHT = 320
const MAX_PLAYER_HEIGHT = 1200
/** 评论区（右列）的最小宽度：再窄就看不清评论了，此时宁可让播放器继续缩宽 */
const MIN_COMMENT_WIDTH = 280
/** 轨道离视口底部的间距（与 recommendRail/rail.ts 的 RAIl_FIXED_BOTTOM_GAP 保持一致） */
const RAIL_BOTTOM_GAP = 12

/** 播放器原来的行内高度（卸载时恢复） */
let originalPlayerHeight = ''
let originalPlayerMinHeight = ''
let applied = false

function getMirror(): HTMLElement | null {
  return document.querySelector<HTMLElement>('#mirror-vdcon')
}

/** 只在值变化时写 CSS 变量：相同值重复写会触发样式重算并可能唤醒 ResizeObserver */
function setVar(name: string, value: string): void {
  const root = document.documentElement
  if (root.style.getPropertyValue(name) === value)
    return
  root.style.setProperty(name, value)
}

function shouldEnable(): boolean {
  if (!settings.value.videoPageFixedLayout)
    return false
  // 固定布局只服务普通视频页；迷你态本身就是「播放器浮起来」
  if (ui.isBangumi || ui.mini)
    return false
  return window.innerWidth >= MIN_VIEWPORT_WIDTH && window.innerHeight >= MIN_VIEWPORT_HEIGHT
}

/**
 * 一次算完全部尺寸并写变量。
 *
 * 只读三类「本模块不修改」的量：`#mirror-vdcon` 顶边、左列宽度、视口尺寸。
 * 写出的高度不会回头影响这三者，因此不存在反馈环。
 */
function applyLayout(mirror: HTMLElement, playerWrap: HTMLElement): void {
  const topOffset = Math.max(0, Math.round(mirror.getBoundingClientRect().top))
  const railVisible = Boolean(railState.placement)

  // 容器可用宽：**不要读左列宽度** —— 左列宽度正是本模块写出来的（grid 第一列），
  // 读它就会形成「自己写 → 自己读」的反馈路径。这里只读 grid 容器自身的宽度与内边距。
  const mirrorStyle = window.getComputedStyle(mirror)
  const padX = (Number.parseFloat(mirrorStyle.paddingLeft) || 0)
    + (Number.parseFloat(mirrorStyle.paddingRight) || 0)
  const totalWidth = Math.max(0, Math.round(mirror.clientWidth - padX))
  const leftAvailW = Math.max(0, totalWidth - MIN_COMMENT_WIDTH - DOCK_GAP)

  // 轨道的宽度跟着左列（= 播放器宽）走，而轨道高度又由宽度决定 —— 这里从 0 开始迭代到不动点。
  // 必须固定起点：若以上一拍的轨道高为起点，迭代会停在振荡区间里的不同相位，真机表现为每拍
  // 变几像素；从 0 起迭代可保证同样输入得到同样输出（确定性）。
  // 视觉样式算出来的轨道实际可能比估算更高（真机 222 vs 估算 207）：
  // 预留空间取两者较大值，否则详情 dock 会压进轨道顶边（用户报告的「重叠」）。
  const renderedRailHeight = railVisible
    ? getRenderedRailHeight()
    : 0

  let railSpace = 0
  let width = 0
  let height = 0
  for (let iteration = 0; iteration < 10; iteration++) {
    // 可用高：视口 − 顶部 − 信息栏 − 详情 dock − 3 个 gutter − 轨道预留
    const availableH = window.innerHeight
      - topOffset
      - INFO_BAR_HEIGHT
      - DETAILS_HEIGHT
      - DOCK_GAP * 3
      - railSpace

    // 严格 16:9：**先按可用高反算宽度**（可用高不足时宽度回收，而不是把播放器拉扁）
    width = Math.min(leftAvailW, Math.round(availableH * 16 / 9))
    height = Math.round(width * 9 / 16)

    // 极端窗口的高度夹取：夹完重新按 16:9 反算宽度，保证比例不破
    if (height < MIN_PLAYER_HEIGHT || height > MAX_PLAYER_HEIGHT) {
      height = Math.min(MAX_PLAYER_HEIGHT, Math.max(MIN_PLAYER_HEIGHT, height))
      width = Math.min(leftAvailW, Math.round(height * 16 / 9))
      height = Math.round(width * 9 / 16)
    }

    if (!railVisible)
      break

    const nextRailSpace = Math.max(
      0,
      Math.round(computeRailHeight(width)),
      renderedRailHeight,
    )
    const converged = Math.abs(nextRailSpace - railSpace) < 1
    railSpace = nextRailSpace
    if (converged)
      break
  }

  // 自检 1：播放器底边不得越过「轨道顶边 − gutter − 详情 dock」
  // （用户要求三区互不重叠，这是最终兜底；越界时按可用高重算宽度，比例保持不变）
  if (railSpace > 0) {
    const railTop = window.innerHeight - railSpace - RAIL_BOTTOM_GAP
    const allowedH = railTop - DOCK_GAP - DETAILS_HEIGHT - DOCK_GAP
      - topOffset - INFO_BAR_HEIGHT - DOCK_GAP
    if (height > allowedH && allowedH > 0) {
      width = Math.min(leftAvailW, Math.round(allowedH * 16 / 9))
      height = Math.round(width * 9 / 16)
    }
  }

  // 自检 2：右列至少要拿到 MIN_COMMENT_WIDTH
  width = Math.max(0, Math.min(width, totalWidth - MIN_COMMENT_WIDTH - DOCK_GAP))
  height = Math.round(width * 9 / 16)

  setVar(TOP_VAR, `${topOffset}px`)
  setVar(INFO_VAR, `${INFO_BAR_HEIGHT}px`)
  setVar(GAP_VAR, `${DOCK_GAP}px`)
  setVar(DETAILS_VAR, `${DETAILS_HEIGHT}px`)
  setVar(PLAYER_W_VAR, `${width}px`)
  setVar(PLAYER_VAR, `${height}px`)
  setVar(RAIL_VAR, `${railSpace}px`)

  // 播放器容器同时写宽高（CSS 里也有变量兜底，这里保证首帧就正确）
  if (playerWrap.style.height !== `${height}px`)
    playerWrap.style.height = `${height}px`
}

/** 清掉固定布局留下的全部痕迹（类 / CSS 变量 / 播放器行内高度） */
export function clearFixedLayout(): void {
  document.documentElement.classList.remove(FIXED_LAYOUT_CLASS)
  for (const name of [
    TOP_VAR,
    INFO_VAR,
    GAP_VAR,
    DETAILS_VAR,
    PLAYER_W_VAR,
    PLAYER_VAR,
    RAIL_VAR,
  ])
    document.documentElement.style.removeProperty(name)

  const playerWrap = getPlayerWrapEl()
  if (playerWrap) {
    playerWrap.style.height = originalPlayerHeight
    playerWrap.style.minHeight = originalPlayerMinHeight
  }

  applied = false
  if (ui.fixedLayout)
    ui.fixedLayout = false
}

/**
 * 每次状态同步调用：满足条件就应用（并刷新尺寸），不满足就还原。
 *
 * 顺序固定为「先读、后写」：所有 rect 读取都在写变量之前完成，
 * 写完之后不再读任何自己改动过的量。
 */
export function syncFixedLayout(): void {
  const mirror = getMirror()
  const playerWrap = getPlayerWrapEl()

  if (!shouldEnable() || !mirror || !playerWrap) {
    if (applied || document.documentElement.classList.contains(FIXED_LAYOUT_CLASS))
      clearFixedLayout()
    return
  }

  if (!applied) {
    // 只在第一次接管时记录原始行内高度，避免把我们的值记成「原始值」
    originalPlayerHeight = playerWrap.style.height
    originalPlayerMinHeight = playerWrap.style.minHeight
    document.documentElement.classList.add(FIXED_LAYOUT_CLASS)
    applied = true
  }

  applyLayout(mirror, playerWrap)
  if (!ui.fixedLayout)
    ui.fixedLayout = true
}

export function setupFixedLayout(): () => void {
  const onResize = () => syncFixedLayout()
  window.addEventListener('resize', onResize, { passive: true })

  const stopWatch = watch(
    () => [settings.value.videoPageFixedLayout, ui.mini, ui.isBangumi] as const,
    () => syncFixedLayout(),
  )

  syncFixedLayout()

  return () => {
    window.removeEventListener('resize', onResize)
    stopWatch()
    clearFixedLayout()
  }
}
