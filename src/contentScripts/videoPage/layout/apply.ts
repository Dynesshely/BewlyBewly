/**
 * 把 compute.ts 的计算结果落到 DOM 上（第 113 轮 layout-fit）。
 *
 * 三件事：
 * 1. 把结果写成 :root 上的 --bvp-* 变量（只写变化的值，避免无意义的样式重算）；
 * 2. 在 <html> 上挂 html.bewly-video-fit（+ 窄屏时 bewly-video-fit-stacked）；
 * 3. 注入/移除两份样式表：页面级（layout/style.ts 的 FIT_PAGE_CSS）与
 *    增强层 shadow root 级（FIT_SHADOW_CSS，用于把推荐轨道钉在底部）。
 *
 * 回退：clearFitLayout() 一次性移除类 / 变量 / 样式表，旧布局（html.bewly-video-fixed）
 * 的 CSS 与 fixedLayout.ts 完全没被改动，因此移除即恢复旧版式。
 */
import type { FitLayoutResult } from './compute'

import { FIT_PAGE_CSS, FIT_SHADOW_CSS } from './style'

/** 新布局开关类（页面级 CSS 与真机诊断都靠它） */
export const FIT_CLASS = 'bewly-video-fit'
/** 窄视口上下分区标记类 */
export const STACKED_CLASS = 'bewly-video-fit-stacked'
/** 诊断属性：document.documentElement.dataset.bewlyFitMetrics */
export const FIT_METRICS_ATTR = 'data-bewly-fit-metrics'
/** 窄屏（上下分区）类名：与旧 fixedLayout 的语义保持一致 */
const NARROW_CLASS = 'bewly-video-narrow'

const PAGE_STYLE_ID = 'bewly-video-fit-style'
const SHADOW_STYLE_ID = 'bewly-video-fit-shadow-style'

/** 已经写到 :root 的变量名，clear 时按这张表逐个删除 */
let writtenVars: string[] = []

function ensurePageStyle(): void {
  if (document.getElementById(PAGE_STYLE_ID))
    return
  const style = document.createElement('style')
  style.id = PAGE_STYLE_ID
  style.textContent = FIT_PAGE_CSS
  // 放到 head 末尾：与旧布局的 !important 规则同级时以「后出现的」胜出
  document.head.appendChild(style)
}

/**
 * 往增强层 shadow root 注入轨道样式。
 *
 * 宿主 #bewly-video-page 是异步挂载的（videoPage/index.ts 里创建），
 * 所以每次 sync 都调用一次；已注入就跳过，宿主还没出现就安静返回。
 */
export function ensureShadowStyle(): void {
  const root = document.getElementById('bewly-video-page')?.shadowRoot
  if (!root || root.getElementById(SHADOW_STYLE_ID))
    return
  const style = document.createElement('style')
  style.id = SHADOW_STYLE_ID
  style.textContent = FIT_SHADOW_CSS
  root.appendChild(style)
}

function removeShadowStyle(): void {
  document.getElementById('bewly-video-page')?.shadowRoot?.getElementById(SHADOW_STYLE_ID)?.remove()
}

function setVar(name: string, value: string): void {
  const root = document.documentElement
  if (root.style.getPropertyValue(name) === value)
    return
  root.style.setProperty(name, value)
}

/** 应用一次布局结果（幂等：同样的结果重复调用不会产生新的样式写入） */
export function applyFitLayout(result: FitLayoutResult): void {
  const root = document.documentElement

  ensurePageStyle()
  ensureShadowStyle()

  for (const [name, value] of Object.entries(result.vars))
    setVar(`--${name}`, value)

  writtenVars = Object.keys(result.vars).map(name => `--${name}`)

  root.classList.add(FIT_CLASS)
  if (result.mode === 'stacked') {
    root.classList.add(STACKED_CLASS)
    // 第 113 轮兼容：既有 e2e 与视频页脚本都按 `html.bewly-video-narrow` 判定「窄屏上下分区」，
    // 新布局复用这个类名，避免两套窄屏语义并存
    root.classList.add(NARROW_CLASS)
  }
  else {
    root.classList.remove(STACKED_CLASS)
    root.classList.remove(NARROW_CLASS)
  }

  const metrics = `${result.vw}x${result.vh};mode=${result.mode};player=${result.player.width}x${result.player.height};video=${result.video.width}x${result.video.height};side=${result.right.width};rail=${result.rail.height}@${result.rail.top}`
  if (root.getAttribute(FIT_METRICS_ATTR) !== metrics)
    root.setAttribute(FIT_METRICS_ATTR, metrics)
}

/** 清掉新布局留下的一切痕迹（回到旧布局 / 原生布局） */
export function clearFitLayout(): void {
  const root = document.documentElement
  root.classList.remove(FIT_CLASS)
  root.classList.remove(STACKED_CLASS)
  root.classList.remove(NARROW_CLASS)
  root.removeAttribute(FIT_METRICS_ATTR)

  for (const name of writtenVars)
    root.style.removeProperty(name)
  writtenVars = []

  document.getElementById(PAGE_STYLE_ID)?.remove()
  removeShadowStyle()
}
