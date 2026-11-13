import type { RailCard, RailPlacement } from './types'

import { computed, reactive } from 'vue'

import { settings } from '~/logic'

import { useMessages } from '../i18n'
import { getPlayerScreenMode } from '../playerMode'
import {
  clearRailSpace,
  collectRailCards,
  computeRailPlacement,
  countHiddenNativeBlocks,
  findNativeContainer,
  hideDuplicateRecommendBlocks,
  hideOverlappingNativeLinks,
  markNativeTaken,
  refreshRailCovers,
  releaseNativeTaken,
  reserveRailSpace,
  warmUpNativeCovers,
} from './rail'
import { RAIL_MIN_CARD_WIDTH } from './types'

export { getRenderedRailHeight } from './rail'

/**
 * 推荐轨道的状态与生命周期（第 27 轮）。
 *
 * 只做三件事：
 * 1. 采集：从原生 `.rcmd-tab` 读 20 张卡（读不到就整块不渲染）；
 * 2. 放下：算轨道在视口里的矩形（贴主列下方），给页面留出同等高度；
 * 3. 接管：**只有轨道真的渲染出来**之后，才给原生列表打标记并隐藏
 *    （与 A 工作流约定：A 不隐藏 `.rcmd-tab`，由 B 在成功后接管；卸载时还原）。
 *
 * 刷新节奏与 videoPage 的 sync（500ms）一致：切视频 / 换分 P 后原生列表会重建，
 * 这里按「bvid 序列变化」判断是否需要更新，序列没变就不写状态，避免每拍重渲染。
 */

export interface RecommendRailState {
  /** 采集到的卡片 */
  cards: RailCard[]
  /** 轨道位置（视口坐标）；null 表示不渲染 */
  placement: RailPlacement | null
  /** 用户手动关闭了轨道（本次会话内不再自动打开，直到刷新页面） */
  dismissed: boolean
}

export const railState = reactive<RecommendRailState>({
  cards: [],
  placement: null,
  dismissed: false,
})

const t = useMessages()

/**
 * 轨道高度：卡片宽度按可见张数算出后，16:9 封面 + 标题 + 元信息。
 *
 * 第 46 轮：轨道头部（标题行 / 左右箭头 / 关闭按钮）已从模板删除，
 * native-style 的 CSS 也改成「无头部 + 上下 12px padding + 底部圆角 14px」，
 * 因此公式去掉头部 26 与间隙 8，改为：
 * `12 * 2(轨道上下 padding) + 8 * 2(卡片内边距) + 封面 + 8 + 34(标题两行) + 4 + 16(元信息)`
 * 真机轨道高度从 222~243 降到 ~196~217（减少 ≥24px）。
 */
export function computeRailHeight(width: number): number {
  const visible = Math.min(7, Math.max(4, Math.floor(width / RAIL_MIN_CARD_WIDTH)))
  const gaps = 12 * (visible - 1)
  const cardWidth = Math.max(148, Math.floor((width - gaps) / visible))

  // 第 52 轮：密度影响轨道上下 padding、卡片内边距与标题行高（字号不变）。
  const density = settings.value.videoPageDensity || 'comfortable'
  const railPadding = density === 'compact'
    ? 8
    : density === 'relaxed'
      ? 14
      : 12
  const cardPadding = density === 'compact'
    ? 6
    : density === 'relaxed'
      ? 10
      : 8
  const titleLine = density === 'compact'
    ? 30
    : density === 'relaxed'
      ? 36
      : 34

  const coverHeight = Math.round((cardWidth - cardPadding * 2) * 9 / 16)
  return railPadding * 2 + cardPadding * 2 + coverHeight + 8 + titleLine + 4 + 16
}

function sameSequence(a: RailCard[], b: RailCard[]): boolean {
  return a.length === b.length && a.every((card, index) => card.bvid === b[index].bvid)
}

/** 重新采集并更新轨道（渲染状态由 railState.placement 表示） */
export function syncRecommendRail(options: { enabled: boolean }): void {
  // 关闭开关 / 用户手动关闭 / 网页全屏与宽屏：轨道不渲染，并把原生列表还回去。
  // 第 37 轮：网页全屏时轨道会盖在播放器上（用户截图），宽屏下留着轨道又会把播放器压小；
  // 这里直接从渲染状态移除（不是降 z-index），退出模式后下一拍自动重算 placement 并恢复。
  // 第 48 轮：窄屏（宽 <1280 或高 <700，含 iframe 抽屉）走上下分区，轨道不渲染
  const narrowViewport = window.innerWidth < 1280 || window.innerHeight < 700
  if (!options.enabled || railState.dismissed || getPlayerScreenMode() !== 'normal' || narrowViewport) {
    if (railState.placement)
      railState.placement = null
    if (railState.cards.length)
      railState.cards = []
    document.documentElement.removeAttribute('data-bewly-rail-cover')
    document.documentElement.removeAttribute('data-bewly-rail-native-hidden')
    clearRailSpace()
    // 关闭轨道 / 降级：把被隐藏的原生推荐块全部还原，不能留空
    releaseNativeTaken()
    // 轨道不显示了：宿主恢复样式表的 pointer-events: none
    setHostHitOpen(false)
    updatePointerWatch()
    return
  }

  // 封面必须在隐藏原生列表**之前**预热：一旦 display:none，B 站的懒加载就再也不会触发
  // （第 31 轮真机：轨道卡片里根本没有 <img>，因为采集时 src 还是空串）。
  warmUpNativeCovers()

  const cards = collectRailCards()
  if (!cards.length || !findNativeContainer()) {
    // 读不到卡片 / 原生容器不在：完全不接管，保持 B 站原样
    if (railState.placement)
      railState.placement = null
    if (railState.cards.length)
      railState.cards = []
    clearRailSpace()
    releaseNativeTaken()
    setHostHitOpen(false)
    updatePointerWatch()
    return
  }

  if (!sameSequence(railState.cards, cards))
    railState.cards = cards

  // 位置每次都要重算：评论区移到右侧（A 工作流）会改变主列高度，滚动也会改变 bottom
  const height = computeRailHeight(window.innerWidth)
  const placement = computeRailPlacement(height)
  if (!placement) {
    railState.placement = null
    clearRailSpace()
    releaseNativeTaken()
    setHostHitOpen(false)
    updatePointerWatch()
    return
  }

  const prev = railState.placement
  if (!prev || Math.abs(prev.top - placement.top) > 1 || Math.abs(prev.width - placement.width) > 1 || Math.abs(prev.left - placement.left) > 1)
    railState.placement = placement

  // 轨道已经渲染出来：此时才接管（隐藏）原生推荐列表
  reserveRailSpace(height)
  markNativeTaken()

  // 重复推荐栏兜底（第 32 轮）：轨道渲染成功后，把「仍在视口内、含 ≥3 个视频链接」的原生块
  // 一并隐藏（覆盖 B 站切视频重建 / 未知容器类名的情况）。每拍重扫补齐。
  hideDuplicateRecommendBlocks()
  const hiddenNative = countHiddenNativeBlocks()
  const hiddenStat = String(hiddenNative)
  if (document.documentElement.getAttribute('data-bewly-rail-native-hidden') !== hiddenStat)
    document.documentElement.setAttribute('data-bewly-rail-native-hidden', hiddenStat)

  // 封面补齐：B 站推荐是异步插入的，首拍采集时图片可能还没加载 → cover 为空。
  // 这里每拍和**当前 cards** 比较（不是和缓存比），有补充就**整体替换数组**（保证 Vue 响应）。
  const filled = refreshRailCovers(railState.cards)
  if (filled)
    railState.cards = filled

  // 诊断标记：真机可直接读 `<html data-bewly-rail-cover="20/20">` 判断采集是否成功
  const withCover = railState.cards.filter(card => Boolean(card.cover)).length
  const coverStat = `${withCover}/${railState.cards.length}`
  if (document.documentElement.getAttribute('data-bewly-rail-cover') !== coverStat)
    document.documentElement.setAttribute('data-bewly-rail-cover', coverStat)
  // 宿主命中改为「随指针位置」开关：指针进入轨道矩形才打开，移出立即恢复
  updatePointerWatch()
  // 兜底：把坐标落在轨道矩形内、但不在推荐容器里的原生视频链接也隐藏（避免点击被抢）
  hideOverlappingNativeLinks({
    top: placement.top,
    left: placement.left,
    width: placement.width,
    height: Math.max(height, 120),
  })
}

/** 用户点关闭：收起轨道并把原生列表还原（本次会话内不再自动出现） */
export function dismissRecommendRail(): void {
  railState.dismissed = true
  railState.placement = null
  railState.cards = []
  clearRailSpace()
  releaseNativeTaken()
  setHostHitOpen(false)
  updatePointerWatch()
}

/**
 * 宿主元素（`#bewly-video-page`）的命中开关（第 27 轮真机第三轮收敛）。
 *
 * 真机实验结论（Lead 提供）：
 * - 宿主 `:host { pointer-events: none }` 时，点击轨道卡片 → 抽屉打开 **但 URL 被改成推荐视频地址**；
 * - 把宿主的 `pointer-events` 临时设为 `auto` → **URL 不变 + 抽屉打开**（正确）；
 * - 点击坐标下并没有原生 `<a href="/video/">`（`overlappingAnchors: []`），
 *   说明不是链接竞争，而是宿主 `pointer-events: none` 让 B 站的 click 委托最终跑在宿主的命中路径上。
 *
 * 因此：**只在轨道显示期间**把宿主打开命中（行内样式，优先级高于样式表的 none），
 * 轨道隐藏 / 卸载时清掉行内样式、回到样式表的 `none`（页面其它区域仍可正常点击）。
 */
const HOST_ATTR = 'data-bewly-rail-hit'
let hostElRef: HTMLElement | null = null

/** 由 index.ts 在挂载时注入宿主元素引用（避免两个模块各自 query） */
export function bindRailHost(host: HTMLElement | null): void {
  hostElRef = host
  if (!host)
    setHostHitOpen(false)
}

/**
 * 指针是否落在轨道矩形内。
 *
 * 为什么不是「轨道显示期间一直打开」：宿主是 `position: fixed; inset: 0`，
 * 一直 `pointer-events: auto` 会把**整页**的点击都吃掉（评论区、播放器、导航都点不动）。
 * 实验 A 的结论是「宿主打开命中时 B 站委托不再改 URL」，所以这里做成**空间受限**的开关：
 * 只有当指针落在轨道矩形内时才打开宿主命中，指针移出立即恢复 `none`。
 */
function isInRailRect(x: number, y: number): boolean {
  const placement = railState.placement
  if (!placement)
    return false
  const height = computeRailHeight(placement.width)
  return x >= placement.left
    && x <= placement.left + placement.width
    && y >= placement.top
    && y <= placement.top + Math.max(height, 120)
}

let pointerWatchBound = false
let pointerRaf = 0
let pendingPointer: { x: number, y: number } | null = null

function onPointerMove(event: PointerEvent): void {
  pendingPointer = { x: event.clientX, y: event.clientY }
  if (pointerRaf)
    return
  pointerRaf = window.requestAnimationFrame(() => {
    pointerRaf = 0
    const point = pendingPointer
    pendingPointer = null
    if (!point)
      return
    setHostHitOpen(isInRailRect(point.x, point.y))
  })
}

function updatePointerWatch(): void {
  const shouldWatch = Boolean(railState.placement)
  if (shouldWatch && !pointerWatchBound) {
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    pointerWatchBound = true
  }
  else if (!shouldWatch && pointerWatchBound) {
    window.removeEventListener('pointermove', onPointerMove)
    if (pointerRaf) {
      window.cancelAnimationFrame(pointerRaf)
      pointerRaf = 0
    }
    pointerWatchBound = false
    pendingPointer = null
    setHostHitOpen(false)
  }
}

/**
 * 打开 / 关闭宿主的指针命中。
 *
 * @param open 指针落在轨道矩形内时为 true
 */
export function setHostHitOpen(open: boolean): void {
  const host = hostElRef ?? document.getElementById('bewly-video-page')
  if (!host)
    return
  if (open) {
    host.setAttribute(HOST_ATTR, '')
    // 行内样式优先级高于样式表里的 :host { pointer-events: none }
    host.style.pointerEvents = 'auto'
  }
  else {
    host.removeAttribute(HOST_ATTR)
    host.style.removeProperty('pointer-events')
  }
}

/** 宿主是否处于「轨道显示、命中已打开」状态（真机复测 / e2e 断言用） */
export function isHostHitOpen(): boolean {
  const host = hostElRef ?? document.getElementById('bewly-video-page')
  return Boolean(host?.hasAttribute(HOST_ATTR))
}

/** 页面卸载 / 导航离开：把 DOM 上的痕迹全部撤掉 */
export function teardownRecommendRail(): void {
  document.documentElement.removeAttribute('data-bewly-rail-cover')
  document.documentElement.removeAttribute('data-bewly-rail-native-hidden')
  setHostHitOpen(false)
  updatePointerWatch()
  railState.dismissed = false
  railState.placement = null
  railState.cards = []
  clearRailSpace()
  releaseNativeTaken()
}

/** 轨道文案（给组件用的同一份 i18n，保留导出便于测试断言） */
export const railMessages = computed(() => t.value)
