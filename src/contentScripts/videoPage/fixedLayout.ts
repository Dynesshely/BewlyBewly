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
import { getPlayerScreenMode } from './playerMode'
import { computeRailHeight, getRenderedRailHeight, railState } from './recommendRail'
import { ui } from './state'

/** 固定布局生效时挂在 <html> 上的类（页面级样式与 e2e 都靠它） */
export const FIXED_LAYOUT_CLASS = 'bewly-video-fixed'

const TOP_VAR = '--bvp-fixed-top'
const INFO_VAR = '--bvp-fixed-info'
const GAP_VAR = '--bvp-fixed-gap'
const DETAILS_VAR = '--bvp-fixed-details'
const DOCK_H_VAR = '--bvp-fixed-dock-height'
const PLAYER_W_VAR = '--bvp-fixed-player-width'
const PLAYER_VAR = '--bvp-fixed-player-height'
const RAIL_VAR = '--bvp-fixed-rail-space'

/** 视口小于这个尺寸就放不下三块区域，自动回退原生可滚动布局 */
const MIN_VIEWPORT_WIDTH = 1280
const MIN_VIEWPORT_HEIGHT = 700

/**
 * 信息栏（标题组）高度：70，与简报 A3 的「标题组 70px」一致。
 *
 * 为什么必须 70：标题 2 行 = 20×1.35×2 = 54，元信息（12.5×1.25）= 15.6，合计 69.6；
 * 若沿用 56 会把第 2 行标题裁掉（第 34 轮真机复测）。此值写入 `--bvp-fixed-info`，
 * 页面级 CSS 的 `#viewbox_report` 高度与它联动。
 */
export const INFO_BAR_HEIGHT = 70
/** 三个 dock 之间统一的 gutter（页面级 CSS 用同一个变量，保证分隔感一致） */
export const DOCK_GAP = 8
/** 播放器下方「详情 dock」的固定高度：工具栏 / 简介 / 标签压成三行，不产生内部滚动 */
export const DETAILS_HEIGHT = 104
/**
 * dock 底边与轨道顶边之间的**分区间距**（Kimi 规范：面板之间 gutter 24px）。
 *
 * 第 34 轮曾按 `rail.top − 8` 做自检，真机上 8px 视觉上几乎贴在一起（用户截图反馈）。
 * 现在：
 * ```
 * railTop = 视口高 − railSpace − RAIL_BOTTOM_GAP(12)   // 轨道底部保留 12px
 * dock.bottom = railTop − DOCK_RAIL_GAP(24)
 * ⇒ dockH = 视口高 − top − railSpace − 36
 * ```
 */
const DOCK_RAIL_GAP = 24
/** 轨道离视口底部的间距（与 recommendRail/rail.ts 的 RAIl_FIXED_BOTTOM_GAP 保持一致） */
const RAIL_BOTTOM_GAP = 12
const DOCK_BOTTOM_MARGIN = RAIL_BOTTOM_GAP + DOCK_RAIL_GAP

/** 播放器最小 / 最大高度：避免极端窗口下压成一条或撑破 */
const MIN_PLAYER_HEIGHT = 320
/**
 * dock 布局下播放器允许的更小高度。
 *
 * dock 总高固定，播放器是「被减出来的那一项」：窗口贴近降级阈值（高 700）时，
 * 若仍用 320 的下限就会把 dock 撑破（内容溢出被裁）。这里放宽到 160，
 * 保证「dock 内容之和 = dock 高度」始终成立。
 */
const MIN_DOCK_PLAYER_HEIGHT = 160
const MAX_PLAYER_HEIGHT = 1200
/**
 * 评论区（右列）的最小宽度：与页面级栅格的第 34 轮令牌保持一致
 * （`--bvp-col-comment-w: 400px`）。播放器的宽度预算必须先扣掉它，否则两列会挤出容器。
 */
const MIN_COMMENT_WIDTH = 400
/** 主区左右两列之间的横向 gutter（第 34 轮 `--bvp-gutter: 24px`） */
const COLUMN_GUTTER = 24

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
/**
 * 量左列「播放器之外」的可见块高度（信息栏 / 工具栏 / 标签 …）。
 *
 * 这些块的高度由 B 站 DOM + 我们的压缩样式决定，**不由本模块写的播放器高度决定**，
 * 所以读它们不会形成反馈环。被隐藏的块（例如 B 工作流收拢后的 #v_desc）自动跳过。
 */
function measureDockBlocks(leftCol: HTMLElement, playerWrap: HTMLElement): { total: number, count: number } {
  let total = 0
  let count = 0
  for (const child of Array.from(leftCol.children)) {
    if (!(child instanceof HTMLElement) || child === playerWrap)
      continue
    if (child.id === 'commentapp')
      continue
    const style = window.getComputedStyle(child)
    if (style.display === 'none' || style.visibility === 'hidden')
      continue
    const height = Math.round(child.getBoundingClientRect().height)
    if (height <= 0)
      continue
    total += height
    count += 1
  }
  return { total, count }
}

/**
 * 一次算完全部尺寸并写变量（第 32 轮：以「播放器 dock」为单位）。
 *
 * 用户要的是「左列整块（信息栏 + 播放器 + 工具栏 + 标签）与右侧评论区等高」，
 * 所以这里先算 dock 高，再**反算**播放器高度：
 *
 * ```
 * dockH   = 视口高 − top − railSpace − (gutter*2 + 4)      // dock.bottom = rail.top − 8
 * 其它块  = 实测 #viewbox_report / #arc_toolbar_report / 标签 … 高度之和
 * playerH = dockH − 其它块 − 内部 gap × (可见块数 − 1)
 * playerW = min(左列可用宽, round(playerH × 16 / 9))       // 仍锁 16:9
 * ```
 *
 * 若 16:9 反算出的宽度超过左列可用宽，则按宽度定高（播放器变矮），**剩余高度留在 dock 里**
 * （不拉伸播放器）。评论列高度 = dockH，与 dock 严格对齐。
 */
function applyLayout(mirror: HTMLElement, playerWrap: HTMLElement): void {
  const topOffset = Math.max(0, Math.round(mirror.getBoundingClientRect().top))

  // 第 37 轮：网页全屏 / 宽屏时右列（评论区）隐藏 → 单列布局。
  // 网页全屏下轨道也隐藏（并被 recommendRail 撤掉渲染），因此不再预留 railSpace，播放器吃满高度。
  const mode = getPlayerScreenMode()
  const singleColumn = mode !== 'normal'
  // 网页全屏必须隐藏轨道（会盖播放器）；宽屏下评论区已隐藏，轨道再留着会把 16:9 播放器压小，
  // 所以宽屏也一并隐藏（用户诉求是「播放器占满」，视觉上更连贯）。
  const hideRail = mode === 'webfull' || mode === 'wide'
  const railVisible = !hideRail && Boolean(railState.placement)

  const leftCol = document.querySelector<HTMLElement>('#mirror-vdcon .left-container')

  // 容器可用宽：**不要读左列宽度** —— 左列宽度正是本模块写出来的（grid 第一列），
  // 读它就会形成「自己写 → 自己读」的反馈路径。这里只读 grid 容器自身的宽度与内边距。
  const mirrorStyle = window.getComputedStyle(mirror)
  const padX = (Number.parseFloat(mirrorStyle.paddingLeft) || 0)
    + (Number.parseFloat(mirrorStyle.paddingRight) || 0)
  const totalWidth = Math.max(0, Math.round(mirror.clientWidth - padX))
  // 单列（网页全屏 / 宽屏）时播放器可用宽 = 整个内容宽；否则要给评论区留最小宽
  const leftAvailW = singleColumn
    ? totalWidth
    : Math.max(0, totalWidth - MIN_COMMENT_WIDTH - COLUMN_GUTTER)

  // 视觉样式算出来的轨道实际可能比估算更高（真机 222 vs 估算 207）：
  // 预留空间取两者较大值，否则 dock 会压进轨道顶边。
  const renderedRailHeight = railVisible
    ? getRenderedRailHeight()
    : 0

  // 左列其它块的实测高度（不含播放器）
  const blocks = leftCol
    ? measureDockBlocks(leftCol, playerWrap)
    : { total: 0, count: 0 }

  let railSpace = 0
  let width = 0
  let height = 0
  let dockHeight = 0

  for (let iteration = 0; iteration < 10; iteration++) {
    // dock 高：视口 − 顶部 − 轨道预留 − 底部留白（含 dock 与轨道的 gutter）
    const dockH = Math.max(
      MIN_PLAYER_HEIGHT,
      window.innerHeight - topOffset - railSpace - DOCK_BOTTOM_MARGIN,
    )

    // 反算播放器高：dock 减去其它块与块之间的 gap（左列是 flex column，gap = DOCK_GAP）
    const gaps = DOCK_GAP * blocks.count
    const byDock = Math.floor(dockH - blocks.total - gaps)
    height = Math.max(MIN_DOCK_PLAYER_HEIGHT, byDock)

    // 16:9：先按高度反算宽度，再用左列可用宽夹住；被夹住时按宽度回算高度（不拉伸）
    width = Math.round(height * 16 / 9)
    if (width > leftAvailW) {
      width = leftAvailW
      height = Math.round(width * 9 / 16)
    }
    height = Math.min(MAX_PLAYER_HEIGHT, height)
    width = Math.round(height * 16 / 9)

    dockHeight = dockH

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

  // 自检：dock 底边不得越过「轨道顶边 − gutter」（三区互不重叠）
  if (railSpace > 0) {
    const railTop = window.innerHeight - railSpace - RAIL_BOTTOM_GAP
    const allowedDock = railTop - DOCK_RAIL_GAP - topOffset
    if (dockHeight > allowedDock && allowedDock > 0) {
      dockHeight = allowedDock
      const byDock = Math.floor(dockHeight - blocks.total - DOCK_GAP * blocks.count)
      height = Math.max(MIN_DOCK_PLAYER_HEIGHT, byDock)
      width = Math.round(height * 16 / 9)
      if (width > leftAvailW) {
        width = leftAvailW
        height = Math.round(width * 9 / 16)
      }
    }
  }

  // 右列至少要拿到 MIN_COMMENT_WIDTH（单列模式下不需要让位）
  width = Math.max(0, Math.min(width, singleColumn
    ? totalWidth
    : totalWidth - MIN_COMMENT_WIDTH - COLUMN_GUTTER))
  height = Math.round(width * 9 / 16)

  setVar(TOP_VAR, `${topOffset}px`)
  setVar(INFO_VAR, `${INFO_BAR_HEIGHT}px`)
  setVar(GAP_VAR, `${DOCK_GAP}px`)
  setVar(DETAILS_VAR, `${DETAILS_HEIGHT}px`)
  setVar(DOCK_H_VAR, `${dockHeight}px`)
  setVar(PLAYER_W_VAR, `${width}px`)
  setVar(PLAYER_VAR, `${height}px`)
  setVar(RAIL_VAR, `${railSpace}px`)

  if (playerWrap.style.height !== `${height}px`)
    playerWrap.style.height = `${height}px`

  // 真机诊断（第 36 轮回归排查）：把布局关键值写到 DOM 属性，页面控制台可直接读：
  //   document.documentElement.dataset.bewlyFixedMetrics
  const metrics = `dock=${dockHeight};player=${height}x${width};rail=${railSpace};top=${topOffset};mode=${mode}`
  if (document.documentElement.getAttribute('data-bewly-fixed-metrics') !== metrics)
    document.documentElement.setAttribute('data-bewly-fixed-metrics', metrics)
}

/** 清掉固定布局留下的全部痕迹（类 / CSS 变量 / 播放器行内高度） */
export function clearFixedLayout(): void {
  document.documentElement.removeAttribute('data-bewly-fixed-metrics')
  document.documentElement.classList.remove(FIXED_LAYOUT_CLASS)
  for (const name of [
    TOP_VAR,
    INFO_VAR,
    GAP_VAR,
    DETAILS_VAR,
    DOCK_H_VAR,
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
