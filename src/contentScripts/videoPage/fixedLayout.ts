/**
 * 固定单页布局（第 28 轮，用户点名需求）。
 *
 * 用户要求：``视频播放区域、评论区域、推荐视频 flip 区域始终可见``，页面不滚动。
 *
 * 真机实测（2026-11-11 23:45，1600×1000，BV1wvWM6RE3Z）：
 * ```
 * document.documentElement.scrollHeight = 1520 > innerHeight = 1000   ← 页面在滚
 * #mirror-vdcon                  y=64
 *   ├─ #viewbox_report           y=64   h=108
 *   ├─ #playerWrap               y=172  h=919（宽度溢出左栏）
 *   ├─ #arc_toolbar_report       y=1091 h=67
 *   ├─ #v_desc                   y=1176 h=26
 *   ├─ .video-tag-container      y=1220 h=51
 *   ├─ .video-resource-list      y=1294 h=101
 *   └─ .ad-report.strip-ad       y=1420 h=128   ← 广告（B 工作流负责隐藏）
 *   .bewly-comment-column        y=168  h=919   ← 第 27 轮的评论右列
 *   .bvp-rail                    y=1298 h=222   ← 第 27 轮的推荐轨道（fixed）
 * ```
 *
 * 布局目标（自上而下占满一屏，不产生页面滚动）：
 * ```
 * ┌ B 站顶栏 64px ────────────────────────────┐
 * ├ 信息栏（压缩成一行，≤56px）──────────────┤
 * ├ 播放器（= 剩余高度）│ 评论区（严格等高）──┤
 * ├ 推荐轨道（固定高度，始终可见）───────────┤
 * └──────────────────────────────────────────┘
 * ```
 *
 * 做法：
 * - `html.bewly-video-fixed` 打开：`html` / `body` 都是 `overflow: hidden; height: 100%`；
 * - 播放器高度 = 视口高 − 顶部偏移 − 信息栏 − 轨道高 − 间隙，写到 CSS 变量
 *   `--bvp-fixed-player-height`（页面级样式在 adaptedStyles/pages/videoPage.scss）；
 * - 左栏的工具栏 / 简介 / 标签由同一份页面级 CSS 压成单行并 `overflow: hidden`，不产生内部滚动；
 * - 评论列（第 27 轮）靠自己挂在 `#playerWrap` 上的 ResizeObserver 跟随，自动等高；
 * - 轨道高度从 `railState.placement` 反算（rail 不可见时不留空间，播放器可以更高）；
 * - 降级：视口高 <700 或宽 <1280、番剧页、迷你播放器态 → 关闭固定布局，回到原生可滚动布局；
 * - 卸载 / 关开关：移除类、清 CSS 变量、恢复 `#playerWrap` 原来的行内高度。
 */
import { watch } from 'vue'

import { settings } from '~/logic'

import { getPlayerWrapEl } from './dom'
import { computeRailHeight, railState } from './recommendRail'
import { ui } from './state'

/** 固定布局生效时挂在 <html> 上的类（页面级样式与 e2e 都靠它） */
export const FIXED_LAYOUT_CLASS = 'bewly-video-fixed'

const PLAYER_HEIGHT_VAR = '--bvp-fixed-player-height'
const RAIL_SPACE_VAR = '--bvp-fixed-rail-space'

/** 视口小于这个尺寸就放不下三块区域，自动回退原生可滚动布局 */
const MIN_VIEWPORT_WIDTH = 1280
const MIN_VIEWPORT_HEIGHT = 700
/** 压缩后的信息栏高度（与 videoPage.scss 里的 max-height 保持一致） */
const INFO_BAR_HEIGHT = 56
/** 播放器最小 / 最大高度：避免极端窗口下压成一条或撑破 */
const MIN_PLAYER_HEIGHT = 320
const MAX_PLAYER_HEIGHT = 1200
/** 区域之间的呼吸间隙（上下各一份） */
const REGION_GAP = 12

/** 播放器原来的行内高度（卸载时恢复） */
let originalPlayerHeight = ''
let originalPlayerMinHeight = ''
let applied = false

function getMirror(): HTMLElement | null {
  return document.querySelector<HTMLElement>('#mirror-vdcon')
}

/** 轨道当前占的高度：没渲染就是 0（播放器可以把这块空间吃掉） */
function getRailSpace(): number {
  const placement = railState.placement
  if (!placement)
    return 0
  return Math.max(0, Math.round(computeRailHeight(placement.width)))
}

function shouldEnable(): boolean {
  if (!settings.value.videoPageFixedLayout)
    return false
  // 固定布局只服务普通视频页：番剧页结构不同，迷你播放器态本身就是「播放器浮起来」
  if (ui.isBangumi || ui.mini)
    return false
  if (!ui.ready)
    return false
  return window.innerWidth >= MIN_VIEWPORT_WIDTH && window.innerHeight >= MIN_VIEWPORT_HEIGHT
}

function applyPlayerHeight(playerWrap: HTMLElement, mirrorTop: number, railSpace: number): void {
  const topOffset = Math.max(0, Math.round(mirrorTop))
  const available = window.innerHeight
    - topOffset
    - INFO_BAR_HEIGHT
    - railSpace
    - REGION_GAP * 2
  const height = Math.min(MAX_PLAYER_HEIGHT, Math.max(MIN_PLAYER_HEIGHT, Math.round(available)))

  document.documentElement.style.setProperty(PLAYER_HEIGHT_VAR, `${height}px`)
  if (playerWrap.style.height !== `${height}px`)
    playerWrap.style.height = `${height}px`
  if (railSpace > 0)
    document.documentElement.style.setProperty(RAIL_SPACE_VAR, `${railSpace}px`)
  else
    document.documentElement.style.removeProperty(RAIL_SPACE_VAR)
}

/** 清掉固定布局留下的全部痕迹（类 / CSS 变量 / 播放器行内高度） */
export function clearFixedLayout(): void {
  document.documentElement.classList.remove(FIXED_LAYOUT_CLASS)
  document.documentElement.style.removeProperty(PLAYER_HEIGHT_VAR)
  document.documentElement.style.removeProperty(RAIL_SPACE_VAR)

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
 * 每次状态同步调用：满足条件就应用（并刷新高度），不满足就还原。
 *
 * 高度每拍都重算：窗口缩放、轨道出现 / 收起、评论区让位都会改变可用高度，
 * 靠 ResizeObserver 反而会因为「我们自己改了高度」自激。
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

  applyPlayerHeight(playerWrap, mirror.getBoundingClientRect().top, getRailSpace())
  if (!ui.fixedLayout)
    ui.fixedLayout = true
}

export function setupFixedLayout(): () => void {
  const onResize = () => syncFixedLayout()
  window.addEventListener('resize', onResize, { passive: true })

  const stopWatch = watch(
    () => [
      settings.value.videoPageFixedLayout,
      ui.mini,
      ui.isBangumi,
      ui.ready,
    ] as const,
    () => syncFixedLayout(),
  )

  syncFixedLayout()

  return () => {
    window.removeEventListener('resize', onResize)
    stopWatch()
    clearFixedLayout()
  }
}
