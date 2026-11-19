/**
 * 真实 DOM 测量（第 113 轮 layout-fit）。
 *
 * compute.ts 是纯函数，只认数字；这里的职责是把「B 站页面当下的事实」
 * 量成那几个数字：
 * - topBarH   → Bewly 顶栏高度（--bew-top-bar-height，缺失时按 64）
 * - reserveH  → 播放器下方信息栏 / 工具栏 / 标签行的总高度 + 间距
 * - controlH  → B 站播放器控制条高度（画面高 = 外层高 − controlH）
 * - railH     → 推荐轨道高度（轨道没渲染时为 0）
 *
 * 全部是只读操作，不写任何样式，因此不会形成「自己写 → 自己读」的震荡环。
 */
import { computeRailHeight, getRenderedRailHeight, railState } from '../recommendRail'

export interface FitMeasurements {
  topBarH: number
  reserveH: number
  controlH: number
  railH: number
}

function heightOf(el: Element | null): number {
  if (!(el instanceof HTMLElement))
    return 0
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden')
    return 0
  return Math.round(el.getBoundingClientRect().height)
}

/** Bewly 顶栏高度：默认布局是 64，去掉顶栏时变量为 0 */
export function readTopBarHeight(): number {
  const raw = window.getComputedStyle(document.documentElement).getPropertyValue('--bew-top-bar-height')
  return Math.max(0, Math.round(Number.parseFloat(raw) || 64))
}

/**
 * 播放器下方其它块占用的高度。
 *
 * 左列是 flex column：播放器 + 信息栏 + 工具栏 + 标签行，
 * 每两块之间 8px 间距。被隐藏的块（例如 #viewbox_report 为 display:none）自动跳过。
 */
export function measureReserveHeight(): number {
  const left = document.querySelector<HTMLElement>('#mirror-vdcon .left-container')
  const player = document.querySelector<HTMLElement>('#playerWrap')
  if (!left)
    return 0

  const gap = Math.max(0, Math.round(Number.parseFloat(window.getComputedStyle(left).rowGap) || 8))
  let total = 0
  let count = 0
  for (const child of Array.from(left.children)) {
    if (!(child instanceof HTMLElement) || child === player)
      continue
    const height = heightOf(child)
    if (height <= 0)
      continue
    total += height
    count += 1
  }
  // 可见块 = 播放器 + N 个其它块，它们之间有 N 个间距
  return count > 0
    ? total + count * gap
    : 0
}

/**
 * B 站播放器控制条高度。
 *
 * 播放器内部结构（真机实测）：#playerWrap > div > [画面区, 控制条]，
 * 画面区高度 = 外层高度 − 控制条高度。踩过的坑：把外层直接做成 16:9，
 * 会让画面区比 16:9 更扁，视频被 object-fit: contain 压成左右黑边。
 */
export function measureControlBarHeight(): number {
  const playerWrap = document.querySelector<HTMLElement>('#playerWrap')
  if (!playerWrap)
    return 56
  const videoArea = playerWrap.querySelector<HTMLElement>('.bpx-player-video-wrap')
    ?? document.querySelector<HTMLVideoElement>('#playerWrap video')?.parentElement
    ?? null
  const playerHeight = Math.round(playerWrap.getBoundingClientRect().height)
  const videoHeight = Math.round(videoArea?.getBoundingClientRect().height ?? 0)
  const diff = playerHeight - videoHeight
  // 合理区间：控制条 30~80；量不到（播放器还没初始化）时用 56 兜底
  return diff >= 30 && diff <= 80
    ? diff
    : 56
}

/** 推荐轨道高度上限：超过它就把播放器挤成一条缝（真机 1280×800 实测过 312px） */
const RAIL_H_MAX = 200

/**
 * 推荐轨道高度：轨道没渲染（窄屏 / 关闭 / 采集失败）时为 0。
 *
 * 第 113 轮修：原来取 `max(computeRailHeight, getRenderedRailHeight())`，
 * 实测 1280×800 下拿到 312 —— 直接把播放器压到 320×180（用户看到的「视频很小」）。
 * 夹到 200 以内，轨道宁可矮一点也不吃播放器空间。
 */
export function measureRailHeight(): number {
  if (!railState.placement)
    return 0
  const raw = Math.max(computeRailHeight(window.innerWidth), getRenderedRailHeight())
  return Math.min(RAIL_H_MAX, Math.max(120, raw))
}

/** 一次量齐 compute.ts 需要的全部输入 */
export function measureFitLayout(): FitMeasurements {
  return {
    topBarH: readTopBarHeight(),
    reserveH: measureReserveHeight(),
    controlH: measureControlBarHeight(),
    railH: measureRailHeight(),
  }
}
