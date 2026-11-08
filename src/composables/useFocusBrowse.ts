import { onMounted, onUnmounted } from 'vue'
import emitter from '~/utils/mitt'

/**
 * 聚焦浏览模式（Cover Flow 式）。
 *
 * 进入后把当前页的视频卡片从网格重排为一条横向 3D 轨道：
 * - active 卡片固定在屏幕中央，左右各露出相邻卡片（带缩放/倾斜/景深）；
 * - 滚轮 / 左右方向键切换，轨道平滑滑动；
 * - 退出后恢复原网格布局。
 *
 * 实现方式：给卡片容器打 `data-bewly-focus` 标记，卡片用绝对定位 + transform 摆位，
 * 不改动原有 DOM 顺序，也不影响筛选/排序逻辑。
 */

const FOCUS_ATTR = 'data-bewly-focus'
const ACTIVE_ATTR = 'data-keyboard-active'
const FOCUS_CLASS = 'bewly-focus-browse'

const MAX_VISIBLE = 5

let rootEl: HTMLElement | null = null
let cardEls: HTMLElement[] = []
let activeIndex = 0
let activeUrl = ''
let rafId = 0
let resizeObserver: ResizeObserver | null = null
let cleanupObserver: (() => void) | null = null

function getScrollRoot(): HTMLElement | null {
  const root = document.querySelector('#bewly')?.shadowRoot
  return root?.querySelector<HTMLElement>('.bewly-scroll-container') ?? null
}

/** shadow 内的样式作用域根（main.scss 注入在 shadow 里，无法匹配外层 html 的类） */
function getWrapper(): HTMLElement | null {
  const root = document.querySelector('#bewly')?.shadowRoot
  return root?.querySelector<HTMLElement>('#bewly-wrapper') ?? null
}

function collectCards(): HTMLElement[] {
  const root = document.querySelector('#bewly')?.shadowRoot
  if (!root)
    return []
  return Array.from(root.querySelectorAll<HTMLElement>('[data-video-card]'))
}

/** 按 URL 找回 active 卡片索引（DOM 被重新渲染时使用） */
function findActiveIndex(cards: HTMLElement[]): number {
  if (activeUrl) {
    const idx = cards.findIndex(card => card.getAttribute('data-video-url') === activeUrl)
    if (idx >= 0)
      return idx
  }
  const byAttr = cards.findIndex(card => card.hasAttribute(ACTIVE_ATTR))
  if (byAttr >= 0)
    return byAttr
  return Math.min(activeIndex, Math.max(0, cards.length - 1))
}

/** 找到卡片所在的网格容器（把它的定位上下文变成聚焦模式的舞台） */
function resolveStage(cards: HTMLElement[]): HTMLElement | null {
  const first = cards[0]
  if (!first)
    return null
  let el: HTMLElement | null = first.parentElement
  while (el && el !== document.body) {
    if (el.children.length > 1 && el.querySelectorAll('[data-video-card]').length > 1)
      return el
    el = el.parentElement
  }
  return first.parentElement
}

let transitionsSettled = false

function applyTransforms() {
  // wrapper 可能被 Vue 重新渲染替换，每次都确保聚焦类存在（信息条隐藏等规则依赖它）
  getWrapper()?.classList.add(FOCUS_CLASS)
  // 卡片 DOM 可能被 Vue 重新渲染替换，每次都重新收集，避免操作 detached 节点
  const fresh = collectCards()
  if (!fresh.length)
    return
  if (fresh.length !== cardEls.length || fresh.some((card, i) => card !== cardEls[i])) {
    cardEls = fresh
    activeIndex = findActiveIndex(fresh)
  }
  const cards = cardEls
  const stage = rootEl
  const stageRect = stage?.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  // 主卡宽度：约占视口宽度的 46%，封面 16:9，信息区由卡片自身高度决定（不裁切）
  // 封面宽度取 16 的倍数：封面按 16:9 渲染，高度（w * 9 / 16）必为整数，
  // 卡片内所有信息行的 y 坐标都落在整数像素上，文字不会被亚像素重采样。
  const rawW = Math.min(vw * 0.4, 840)
  const coverW = Math.floor(rawW / 16) * 16
  // 卡片四周留白（封面、头像、文字都不再贴边）
  const pad = 16
  const mainW = coverW + pad * 2
  // 卡片绝对定位在舞台内，换算成视口中心坐标
  const centerX = (stageRect
    ? vw / 2 - stageRect.left
    : vw / 2)
  const centerY = (stageRect
    ? vh / 2 - stageRect.top - 6
    : vh / 2 - 6)

  cards.forEach((card, index) => {
    const offset = index - activeIndex
    // 关键：即使超出可见范围，也要把它摆在轨道上的正确位置（只是不可见），
    // 否则它从文档流默认位置过渡到目标位置时，会从屏幕底部"飞"到一侧。
    const beyond = Math.abs(offset) >= MAX_VISIBLE
    card.style.visibility = beyond
      ? 'hidden'
      : 'visible'
    card.style.pointerEvents = offset === 0 && !beyond
      ? 'auto'
      : 'none'

    const abs = Math.abs(offset)
    const isActive = offset === 0
    // 越远越小；主卡恒为 1，保证文字清晰
    const scale = isActive
      ? 1
      : Math.max(0.62, 1 - abs * 0.16)
    // 主卡两侧各露约半张，形成强烈的 cover flow 纵深
    const translateX = offset * (mainW * 0.86)
    // 主卡不做 Z 位移：perspective 下的 Z 位移会带来非整数倍放大，导致文字被重采样而变糊
    const translateZ = isActive
      ? 0
      : -abs * 60
    // 主卡不旋转，保持正对视线
    const rotateY = isActive
      ? 0
      : (offset > 0
          ? -30
          : 30)
    const opacity = isActive
      ? 1
      : Math.max(0.38, 1 - abs * 0.2)

    card.style.position = 'absolute'
    card.style.width = `${mainW}px`
    card.style.height = 'auto'
    card.style.margin = '0'
    card.style.padding = `${isActive ? pad : 0}px`
    card.style.boxSizing = 'border-box'
    card.style.borderRadius = isActive ? '20px' : 'var(--bew-radius)'
    card.style.background = isActive ? 'var(--bew-elevated)' : 'transparent'
    // 主卡浮起：柔和大阴影，与页面背景拉开层次
    card.style.outline = isActive ? '1.5px solid color-mix(in oklab, var(--bew-theme-color), transparent 72%)' : ''
    card.style.outlineOffset = '0'
    card.style.boxShadow = isActive
      ? '0 24px 64px rgb(0 0 0 / 18%), 0 6px 16px rgb(0 0 0 / 8%)'
      : '0 12px 30px rgb(0 0 0 / 32%)'
    // 主卡：整数像素定位（不用百分比 transform），文字落在像素网格上不产生亚像素模糊
    if (isActive) {
      card.style.left = `${Math.round(centerX - mainW / 2)}px`
      // 垂直位置在测量卡片高度后由 placeActiveCardVertically() 精确设置
      card.style.top = '0px'
      card.style.transform = 'none'
    }
    else {
      card.style.left = `${centerX}px`
      card.style.top = `${centerY}px`
    }
    card.style.zIndex = String(100 + (offset === 0
      ? 50
      : -abs))
    // 主卡：整数像素定位，无 3D 变换（文字最清晰）
    // 侧卡：保留 3D 透视，营造纵深
    if (!isActive) {
      card.style.transform = `translate(-50%, -50%) translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`
    }
    card.style.opacity = String(beyond
      ? 0
      : opacity)
    card.style.setProperty('--bew-focus-dim', String(isActive
      ? 0
      : Math.min(0.55, abs * 0.2)))
    // 主卡不加 will-change / backface-visibility：避免浏览器提前用低分辨率图层光栅化
    if (isActive) {
      card.style.willChange = 'auto'
      card.style.backfaceVisibility = 'visible'
    }
    else {
      card.style.willChange = 'transform, opacity'
      card.style.backfaceVisibility = 'hidden'
    }
    // 不使用模糊滤镜：侧卡靠压暗与缩放表达层次，避免离屏合成导致整体发虚
    card.style.filter = 'none'
    // 首次布局禁用过渡：卡片从文档流位置到轨道位置应瞬间就位，不产生"飞入"
    card.style.transition = transitionsSettled
      ? 'transform 320ms cubic-bezier(.22,.61,.36,1), opacity 320ms ease'
      : 'none'
    card.style.transformOrigin = 'center center'
    card.style.borderRadius = 'var(--bew-radius)'
    card.style.overflow = 'hidden'
    card.style.boxShadow = offset === 0
      ? '0 24px 60px rgb(0 0 0 / 45%)'
      : '0 12px 30px rgb(0 0 0 / 35%)'
    card.style.backdropFilter = 'none'
    card.setAttribute('data-bewly-focus-ready', '')
  })

  // 排版尺度：以网格卡片宽度（约 357px）为 1.0 基准。
  // 刻意只做很温和的放大（最多 1.15 倍）——大封面配克制字号更精致，
  // 真正的视觉提升来自留白与间距，而不是把字撑大。
  const layoutScale = Math.min(1.15, Math.max(1, 0.85 + (mainW / 357) * 0.15))
  applyTypographyVars(layoutScale)

  // 所有卡片宽度已就位，此时测量高度才有意义
  placeActiveCardVertically(stageRect?.top ?? 0)
}

/** 记录被隐藏的非卡片元素，退出时恢复 */
let hiddenElements: HTMLElement[] = []

/**
 * 舞台里除了视频卡片，还可能有 banner、直播、活动等模块。
 * 这些元素不在轨道上，会按普通文档流撑满宽度，看起来像"巨大的卡片"。
 * 这里保留卡片祖先链，其余分支全部隐藏，退出时恢复。
 */
function hideNonCardBranches(stage: HTMLElement, cards: HTMLElement[]) {
  const keep = new Set<Element>()
  for (const card of cards) {
    let el: Element | null = card
    while (el && el !== stage) {
      keep.add(el)
      el = el.parentElement
    }
  }

  const walk = (parent: Element) => {
    for (const child of Array.from(parent.children)) {
      // 卡片本身保留，且绝不进入卡片内部（否则卡片内容会被隐藏、高度塌陷）
      if (child.hasAttribute('data-video-card'))
        continue
      if (keep.has(child)) {
        walk(child)
        continue
      }
      const el = child as HTMLElement
      if (el.dataset.bewlyFocusHidden === undefined) {
        el.dataset.bewlyFocusHidden = el.style.display || ''
        hiddenElements.push(el)
      }
      el.style.display = 'none'
    }
  }
  walk(stage)
}

function restoreHiddenBranches() {
  for (const el of hiddenElements) {
    el.style.display = el.dataset.bewlyFocusHidden || ''
    delete el.dataset.bewlyFocusHidden
  }
  hiddenElements = []
}

/**
 * 聚焦模式下的排版尺度。
 *
 * 主卡宽度是网格卡片的 2 倍多，如果字号/间距不变，信息区会显得又小又挤、紧贴左边缘。
 * 这里按主卡宽度做亚线性放大，并把结果写进 CSS 变量供 main.scss 使用。
 */
function applyTypographyVars(scale: number) {
  const el = document.documentElement
  el.style.setProperty('--bew-focus-scale', scale.toFixed(3))
  // 标题：16 → 18px（上限克制，避免标题换行挤压右侧信息）
  el.style.setProperty('--bew-focus-title', `${Math.round(16 * scale)}px`)
  // 次要信息（UP 名、播放量）：14px 保持
  el.style.setProperty('--bew-focus-sm', '14px')
  // 胶囊标签
  el.style.setProperty('--bew-focus-xs', '12px')
  // 信息区左右内边距
  el.style.setProperty('--bew-focus-pad', '20px')
  // 信息区与封面的间距
  el.style.setProperty('--bew-focus-gap', '18px')
  // 头像尺寸：34 → 39px（与 18px 标题比例更协调）
  el.style.setProperty('--bew-focus-avatar', `${Math.round(34 * (scale + 0.25))}px`)
}

/** 退出时清理排版变量 */
function clearTypographyVars() {
  const el = document.documentElement
  for (const name of [
    '--bew-focus-scale',
    '--bew-focus-title',
    '--bew-focus-sm',
    '--bew-focus-xs',
    '--bew-focus-pad',
    '--bew-focus-gap',
    '--bew-focus-avatar',
  ]) {
    el.style.removeProperty(name)
  }
}

/**
 * 主卡垂直方向精确居中。
 * 卡片高度是 auto，用 translateY(-50%) 会得到小数像素坐标，文字被重采样而发糊。
 * 这里实测高度后直接用整数 top 定位，保证落在像素网格上。
 */
function placeActiveCardVertically(stageTop: number) {
  const card = cardEls[activeIndex]
  if (!card)
    return
  // 高度取整：卡片内部信息行的起点也落在整数像素，避免文字亚像素模糊
  const height = Math.ceil(card.offsetHeight)
  if (!height)
    return
  card.style.height = `${height}px`
  // 目标：卡片在视口中垂直居中，且**最终视口坐标**落在整数像素上。
  // 舞台自身 top 可能带小数，因此这里把它的分数部分一并抵消。
  const targetY = Math.round((window.innerHeight - height) / 2)
  card.style.top = `${targetY - stageTop}px`
}

function applyStageStyle(stage: HTMLElement) {
  stage.setAttribute(FOCUS_ATTR, '')
  stage.style.position = 'relative'
  stage.style.height = '100vh'
  stage.style.minHeight = '100vh'
  stage.style.perspective = '1600px'
  stage.style.perspectiveOrigin = '50% 50%'
  // 刻意不使用 preserve-3d：那会把主卡也拖进 3D 合成上下文，导致文字被低分辨率光栅化
  stage.style.transformStyle = 'flat'
  stage.style.overflow = 'visible'
  stage.style.display = 'block'
}

function resetStage(stage: HTMLElement | null) {
  if (!stage)
    return
  stage.removeAttribute(FOCUS_ATTR)
  stage.style.cssText = ''
}

function resetCards() {
  cardEls.forEach((card) => {
    card.style.cssText = ''
    card.removeAttribute('data-bewly-focus-ready')
  })
  // 兜底：把所有残留卡片（含被替换后未跟踪的）都清理
  document.querySelector('#bewly')?.shadowRoot?.querySelectorAll('[data-bewly-focus-ready]').forEach(card => card.removeAttribute('data-bewly-focus-ready'))
}

/** 进入聚焦模式 */
export function enterFocusBrowse() {
  if (document.documentElement.classList.contains(FOCUS_CLASS))
    return
  const scrollRoot = getScrollRoot()
  cardEls = collectCards()
  if (!cardEls.length)
    return
  rootEl = resolveStage(cardEls)
  if (!rootEl)
    return

  // 记录 active
  activeIndex = Math.max(0, cardEls.findIndex(card => card.hasAttribute(ACTIVE_ATTR)))
  activeUrl = cardEls[activeIndex]?.getAttribute('data-video-url') || ''
  document.documentElement.classList.add(FOCUS_CLASS)
  getWrapper()?.classList.add(FOCUS_CLASS)
  scrollRoot?.style.setProperty('overflow', 'hidden')
  applyStageStyle(rootEl)
  hideNonCardBranches(rootEl, cardEls)
  transitionsSettled = false
  applyTransforms()
  // 下一帧开启过渡，之后的切换才有动画
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      transitionsSettled = true
    })
  })
  emitter.emit('focus-browse-change', { active: true, index: activeIndex })

  resizeObserver = new ResizeObserver(() => {
    cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => applyTransforms())
  })
  resizeObserver.observe(document.documentElement)

  // 卡片被替换或追加时重新应用（Vue 重渲染会换掉 DOM 节点）
  let pending = false
  const mutationObserver = new MutationObserver(() => {
    if (pending)
      return
    pending = true
    requestAnimationFrame(() => {
      pending = false
      if (!rootEl || !document.documentElement.classList.contains(FOCUS_CLASS))
        return
      const next = collectCards()
      if (!next.length)
        return
      hideNonCardBranches(rootEl, next)
      applyTransforms()
    })
  })
  mutationObserver.observe(rootEl, { childList: true, subtree: true })
  cleanupObserver = () => mutationObserver.disconnect()
}

/** 退出聚焦模式 */
export function exitFocusBrowse() {
  if (!document.documentElement.classList.contains(FOCUS_CLASS))
    return
  const scrollRoot = getScrollRoot()
  document.documentElement.classList.remove(FOCUS_CLASS)
  // 清理所有可能残留聚焦类的元素（wrapper 可能已被替换）
  document.querySelector('#bewly')?.shadowRoot?.querySelectorAll(`.${FOCUS_CLASS}`).forEach(el => el.classList.remove(FOCUS_CLASS))
  transitionsSettled = false
  clearTypographyVars()
  restoreHiddenBranches()
  resetStage(rootEl)
  resetCards()
  scrollRoot?.style.removeProperty('overflow')
  resizeObserver?.disconnect()
  resizeObserver = null
  cleanupObserver?.()
  cleanupObserver = null
  rootEl = null
  cardEls = []
  emitter.emit('focus-browse-change', { active: false })
}

/** 切换 active（聚焦模式下由键盘/滚轮调用） */
export function focusMove(delta: number) {
  if (!document.documentElement.classList.contains(FOCUS_CLASS))
    return
  const next = Math.max(0, Math.min(cardEls.length - 1, activeIndex + delta))
  if (next === activeIndex)
    return
  cardEls[activeIndex]?.removeAttribute(ACTIVE_ATTR)
  activeIndex = next
  const card = cardEls[activeIndex]
  activeUrl = card?.getAttribute('data-video-url') || ''
  card?.setAttribute(ACTIVE_ATTR, '')
  applyTransforms()
  emitter.emit('keyboard-active-card', {
    title: card?.getAttribute('data-video-title') || '',
    meta: '',
    url: card?.getAttribute('data-video-url') || '',
    author: card?.getAttribute('data-video-author') || '',
    view: card?.getAttribute('data-video-view') || '',
    duration: card?.getAttribute('data-video-duration') || '',
  })
  emitter.emit('focus-browse-change', { active: true, index: activeIndex })
}

export function isFocusBrowseActive(): boolean {
  return document.documentElement.classList.contains(FOCUS_CLASS)
}

export function getFocusIndex(): number {
  return activeIndex
}

/** 在 App 层安装：监听开关、快捷键与尺寸变化 */
export function useFocusBrowse() {
  function onKeydown(event: KeyboardEvent) {
    if (!isFocusBrowseActive())
      return
    if (event.key === 'Escape') {
      event.preventDefault()
      exitFocusBrowse()
      return
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      focusMove(1)
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      focusMove(-1)
    }
  }

  function onWheel(event: WheelEvent) {
    if (!isFocusBrowseActive())
      return
    event.preventDefault()
    event.stopPropagation()
    if (Math.abs(event.deltaY) < 25)
      return
    focusMove(event.deltaY > 0
      ? 1
      : -1)
  }

  emitter.on('command-toggle-focus-browse', () => {
    if (isFocusBrowseActive())
      exitFocusBrowse()
    else
      enterFocusBrowse()
  })

  onMounted(() => {
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('wheel', onWheel, { capture: true, passive: false })
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
    window.removeEventListener('wheel', onWheel, { capture: true })
    emitter.off('command-toggle-focus-browse')
    exitFocusBrowse()
  })
}
