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
/** 分隔条中心线（页面级绝对定位用）：内容左边缘 + 播放器宽 + gutter/2 */
const SPLIT_LEFT_VAR = '--bvp-fixed-split-left'
/** 内容区左边缘（视口坐标）与内容宽：分隔条拖拽换算比例用（第 46 轮） */
const CONTENT_LEFT_VAR = '--bvp-fixed-content-left'
const CONTENT_WIDTH_VAR = '--bvp-fixed-content-width'
/**
 * 视口小于这个尺寸就放不下三块区域，回退原生可滚动布局。
 * 第 48 轮：1280/700 → 900/600，让 900~1400 × 700~900 的首页空格预览抽屉也能用自定义布局。
 */
const MIN_VIEWPORT_WIDTH = 900
const MIN_VIEWPORT_HEIGHT = 600

/** 窄屏断点：低于它改「上下分区」（上播放器、下评论区、轨道隐藏），第 48 轮 */
const NARROW_VIEWPORT_WIDTH = 1280
const NARROW_VIEWPORT_HEIGHT = 700
/** 窄屏下评论区至少保留的高度 */
const NARROW_COMMENT_MIN_HEIGHT = 220
/** 窄屏断点标记类（页面级 CSS 用） */
const NARROW_CLASS = 'bewly-video-narrow'
/** 窄屏下评论区高度变量 */
const NARROW_COMMENT_VAR = '--bvp-fixed-narrow-comment-height'

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
/**
 * 评论区**相对视口宽**的下限比例（第 44 轮微调，用户看到的是视觉比例）。
 *
 * - 分母用 `window.innerWidth`（视口宽），不是内容宽：
 *   高位视口（如 1600×1300）时播放器会被允许更宽，若按内容宽算评论区能到 40%，
 *   但按视口宽只有 38.8%，用户看到的就是不足 40%；
 * - 只有「评论区 / 视口宽 < 40%」时才收窄播放器，收窄后保证
 *   `colW >= ceil(innerWidth × 0.4)`，播放器保持 16:9（变矮可接受）。
 */
const MIN_COMMENT_WIDTH_RATIO = 0.4
/** 触发 40% 兜底时，播放器宽度占视口宽的比例（0.6 = 1 − 0.4，与评论区 40% 对称） */
const MAX_PLAYER_WIDTH_RATIO = 0.6
/** 分隔条拖拽比例范围（第 46 轮：播放器占内容宽比例；第 47 轮上限放到 80%） */
export const MIN_SPLIT_RATIO = 0.35
export const MAX_SPLIT_RATIO = 0.8
/**
 * 拖拽时评论区相对**视口宽**的下限（第 47 轮：用户要求评论区最小 = 页面宽 1/5）。
 *
 * 与自动模式的 40% 兜底分开：
 * - 自动（splitRatio = 0）：评论区 ≥ 40%，另有 MIN_COMMENT_WIDTH=400 的绝对下限；
 * - 拖拽（splitRatio > 0）：以用户为准，只保证评论区 ≥ 20%（此时允许窄于 400）。
 */
const MIN_COMMENT_WIDTH_RATIO_DRAG = 0.2
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
/** 拖拽中的临时比例（第 46 轮）：非 null 时优先于 settings 的持久值，松手后置空 */
let splitPreviewRatio: number | null = null

/**
 * 设置拖拽预览比例（第 46 轮）。
 *
 * - 拖拽过程中只改内存值（不写 settings，避免每帧落盘）；
 * - 传 null 表示结束预览，回到 settings 的持久值；
 * - 调用方负责随后触发一次 syncFixedLayout()，把新宽度写进 CSS 变量。
 */
export function previewSplitRatio(ratio: number | null): void {
  splitPreviewRatio = ratio
}

/** 当前生效的播放器比例：拖拽预览优先，其次用户持久化值，0 表示自动 */
export function getSplitRatio(): number {
  if (splitPreviewRatio !== null)
    return splitPreviewRatio
  const stored = settings.value.videoPageSplitRatio
  return typeof stored === 'number' && stored > 0
    ? stored
    : 0
}

function applyLayout(mirror: HTMLElement, playerWrap: HTMLElement): void {
  const mirrorRect = mirror.getBoundingClientRect()
  const topOffset = Math.max(0, Math.round(mirrorRect.top))

  // 第 37 轮：网页全屏 / 宽屏时右列（评论区）隐藏 → 单列布局。
  // 网页全屏下轨道也隐藏（并被 recommendRail 撤掉渲染），因此不再预留 railSpace，播放器吃满高度。
  const mode = getPlayerScreenMode()
  // 第 48 轮：窄视口（含 iframe 抽屉）走「上下分区」——播放器在上、评论区在下、轨道隐藏。
  const narrowLayout = window.innerWidth < NARROW_VIEWPORT_WIDTH
    || window.innerHeight < NARROW_VIEWPORT_HEIGHT
  const singleColumn = mode !== 'normal' || narrowLayout
  // 网页全屏必须隐藏轨道（会盖播放器）；宽屏下评论区已隐藏，轨道再留着会把 16:9 播放器压小，
  // 所以宽屏也一并隐藏（用户诉求是「播放器占满」，视觉上更连贯）。
  const hideRail = mode === 'webfull' || mode === 'wide' || narrowLayout
  const railVisible = !hideRail && Boolean(railState.placement)

  const leftCol = document.querySelector<HTMLElement>('#mirror-vdcon .left-container')

  // 容器可用宽：**不要读左列宽度** —— 左列宽度正是本模块写出来的（grid 第一列），
  // 读它就会形成「自己写 → 自己读」的反馈路径。这里只读 grid 容器自身的宽度与内边距。
  const mirrorStyle = window.getComputedStyle(mirror)
  const padLeft = Number.parseFloat(mirrorStyle.paddingLeft) || 0
  const padX = padLeft + (Number.parseFloat(mirrorStyle.paddingRight) || 0)
  const totalWidth = Math.max(0, Math.round(mirror.clientWidth - padX))
  /** 内容区左边缘（视口坐标）：分隔条定位与拖拽比例换算都用它（第 46 轮） */
  const contentLeft = Math.round(mirrorRect.left + padLeft)
  // 单列（网页全屏 / 宽屏）时播放器可用宽 = 整个内容宽；否则要给评论区留最小宽。
  // 第 47 轮：拖拽模式下评论区只保证 ≥ 视口宽 20%（用户可以把评论区压得比 400 更窄），
  // 自动模式仍用 MIN_COMMENT_WIDTH(400) 的绝对下限。
  const splitRatioForAvail = getSplitRatio()
  const minCommentForAvail = splitRatioForAvail > 0
    ? Math.ceil(window.innerWidth * MIN_COMMENT_WIDTH_RATIO_DRAG)
    : MIN_COMMENT_WIDTH
  const leftAvailW = singleColumn
    ? totalWidth
    : Math.max(0, totalWidth - minCommentForAvail - COLUMN_GUTTER)

  // 视觉样式算出来的轨道实际可能比估算更高（真机 222 vs 估算 207）：
  // 预留空间取两者较大值，否则 dock 会压进轨道顶边。
  const renderedRailHeight = railVisible
    ? getRenderedRailHeight()
    : 0

  // 左列其它块的实测高度（不含播放器）
  const blocks = leftCol
    ? measureDockBlocks(leftCol, playerWrap)
    : { total: 0, count: 0 }

  // 第 48 轮：窄视口（含首页空格预览抽屉）→ 上下分区
  //   上：信息栏 / 播放器 / 工具栏 / 标签（左列）
  //   下：评论区（右列变成第二行，高度 = dock 剩余）
  // 轨道隐藏、不预留空间；播放器优先按内容宽 16:9，超出高度预算时按高度反算宽度。
  if (narrowLayout) {
    const dockH = Math.max(
      MIN_DOCK_PLAYER_HEIGHT + NARROW_COMMENT_MIN_HEIGHT,
      window.innerHeight - topOffset - DOCK_BOTTOM_MARGIN,
    )
    const gaps = DOCK_GAP * blocks.count
    // 两行之间还有 grid row-gap（= DOCK_GAP），必须预留，否则「左列内容 + row-gap + 评论」会超 dock 高，
    // 评论列被 overflow 裁掉（第 52 轮真机 4px 的根因）。
    const heightBudget = Math.max(
      MIN_DOCK_PLAYER_HEIGHT,
      dockH - blocks.total - gaps - DOCK_GAP - NARROW_COMMENT_MIN_HEIGHT,
    )
    let narrowWidth = totalWidth
    let narrowHeight = Math.round(narrowWidth * 9 / 16)
    if (narrowHeight > heightBudget) {
      narrowHeight = heightBudget
      narrowWidth = Math.round(narrowHeight * 16 / 9)
    }
    const commentHeight = Math.max(120, dockH - blocks.total - gaps - DOCK_GAP - narrowHeight)

    setVar(TOP_VAR, `${topOffset}px`)
    setVar(INFO_VAR, `${INFO_BAR_HEIGHT}px`)
    setVar(GAP_VAR, `${DOCK_GAP}px`)
    setVar(DETAILS_VAR, `${DETAILS_HEIGHT}px`)
    setVar(DOCK_H_VAR, `${dockH}px`)
    setVar(PLAYER_W_VAR, `${narrowWidth}px`)
    setVar(PLAYER_VAR, `${narrowHeight}px`)
    setVar(RAIL_VAR, '0px')
    setVar(NARROW_COMMENT_VAR, `${commentHeight}px`)
    setVar(SPLIT_LEFT_VAR, '0px')
    setVar(CONTENT_LEFT_VAR, `${contentLeft}px`)
    setVar(CONTENT_WIDTH_VAR, `${totalWidth}px`)

    document.documentElement.classList.add(NARROW_CLASS)

    if (playerWrap.style.height !== `${narrowHeight}px`)
      playerWrap.style.height = `${narrowHeight}px`

    const narrowMetrics = `narrow=1;dock=${dockH};player=${narrowHeight}x${narrowWidth};comment=${commentHeight};top=${topOffset};mode=${mode}`
    if (document.documentElement.getAttribute('data-bewly-fixed-metrics') !== narrowMetrics)
      document.documentElement.setAttribute('data-bewly-fixed-metrics', narrowMetrics)
    return
  }

  document.documentElement.classList.remove(NARROW_CLASS)

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

  // 第 46 轮：用户拖拽过比例（> 0）时优先按比例定宽，绕过 40% 兜底。
  // 宽度同时受「高度反算宽」约束：高度不足时按高度反算的宽度更小，取小保证不越界。
  const splitRatio = getSplitRatio()
  if (!singleColumn && splitRatio > 0 && totalWidth > 0) {
    const ratio = Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, splitRatio))
    const widthByRatio = Math.round(totalWidth * ratio)
    // 用户拖拽优先，但评论区不能小于视口宽 20%（第 47 轮）
    const maxPlayerByComment = totalWidth - COLUMN_GUTTER
      - Math.ceil(window.innerWidth * MIN_COMMENT_WIDTH_RATIO_DRAG)
    width = Math.max(0, Math.min(width, widthByRatio, maxPlayerByComment))
    height = Math.round(width * 9 / 16)
  }

  // 第 44 轮：评论区至少占内容宽 40%（单列模式——网页全屏 / 宽屏——评论区已隐藏，不适用）；
  // 用户拖拽过比例时不再强制 40%（拖拽优先）。
  // 玩家按 16:9 反算后如果评论区不足 40%，就把播放器收窄到 60%（含 gutter 修正），
  // 收窄后播放器高度按 16:9 回算（会变矮，用户明确接受）。
  // 口径按**视口宽**（用户看到的是视觉比例）：colW / innerWidth < 40% 时收窄播放器，
  // 使 colW 至少达到 ceil(innerWidth × 0.4)；ceil 保证边界（如 1601 宽）也不低于 40%。
  // 播放器可用宽上限 = 内容宽 − gutter − 评论最小宽（内容宽 = 视口宽 − 左右 padding）。
  const minCommentWidth = Math.ceil(window.innerWidth * MIN_COMMENT_WIDTH_RATIO)
  if (!singleColumn && totalWidth > 0 && splitRatio <= 0) {
    const colWidth = totalWidth - width - COLUMN_GUTTER
    if (colWidth < minCommentWidth) {
      // 两个等价上限取小，保证边界（如 1601 宽）也不会低于 40%：
      // 1) 按视口宽比例：innerWidth × 0.6 − gutter − 左右 padding；
      // 2) 按评论最小宽反推：contentW − gutter − ceil(innerWidth × 0.4)。
      const pagePadding = Math.max(0, window.innerWidth - totalWidth)
      const maxPlayerByRatio = Math.round(window.innerWidth * MAX_PLAYER_WIDTH_RATIO)
        - COLUMN_GUTTER - pagePadding
      const maxPlayerByMinCol = totalWidth - COLUMN_GUTTER - minCommentWidth
      width = Math.max(0, Math.min(width, maxPlayerByRatio, maxPlayerByMinCol))
      height = Math.round(width * 9 / 16)
    }
  }

  // 右列最小宽：自动模式用 MIN_COMMENT_WIDTH(400) 绝对下限；
  // 拖拽模式只保证评论区 ≥ 视口宽 20%（第 47 轮：允许用户把评论区压得更窄）。
  const minCommentForDrag = Math.ceil(window.innerWidth * MIN_COMMENT_WIDTH_RATIO_DRAG)
  const minCommentWidthFinal = splitRatio > 0
    ? minCommentForDrag
    : MIN_COMMENT_WIDTH
  width = Math.max(0, Math.min(width, singleColumn
    ? totalWidth
    : totalWidth - minCommentWidthFinal - COLUMN_GUTTER))
  height = Math.round(width * 9 / 16)

  setVar(TOP_VAR, `${topOffset}px`)
  setVar(INFO_VAR, `${INFO_BAR_HEIGHT}px`)
  setVar(GAP_VAR, `${DOCK_GAP}px`)
  setVar(DETAILS_VAR, `${DETAILS_HEIGHT}px`)
  setVar(DOCK_H_VAR, `${dockHeight}px`)
  setVar(PLAYER_W_VAR, `${width}px`)
  setVar(PLAYER_VAR, `${height}px`)
  setVar(RAIL_VAR, `${railSpace}px`)
  // 第 46 轮：分隔条中心线（gutter 中间，6px 宽 → 左移 3）与拖拽换算基准
  setVar(SPLIT_LEFT_VAR, `${contentLeft + width + Math.round(COLUMN_GUTTER / 2) - 3}px`)
  setVar(CONTENT_LEFT_VAR, `${contentLeft}px`)
  setVar(CONTENT_WIDTH_VAR, `${totalWidth}px`)

  if (playerWrap.style.height !== `${height}px`)
    playerWrap.style.height = `${height}px`

  // 真机诊断（第 36 轮回归排查）：把布局关键值写到 DOM 属性，页面控制台可直接读：
  //   document.documentElement.dataset.bewlyFixedMetrics
  const commentWidth = singleColumn
    ? totalWidth
    : Math.max(0, totalWidth - width - COLUMN_GUTTER)
  const commentPct = totalWidth > 0
    ? (commentWidth / totalWidth * 100).toFixed(2)
    : '0.00'
  const metrics = `dock=${dockHeight};player=${height}x${width};rail=${railSpace};top=${topOffset};mode=${mode};colPct=${commentPct}`
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
    SPLIT_LEFT_VAR,
    CONTENT_LEFT_VAR,
    CONTENT_WIDTH_VAR,
    NARROW_COMMENT_VAR,
  ])
    document.documentElement.style.removeProperty(name)
  document.documentElement.classList.remove(NARROW_CLASS)

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
