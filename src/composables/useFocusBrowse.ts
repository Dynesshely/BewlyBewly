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
/** 卡片之间的水平间隙（px） */
const CARD_GAP = 18
/** 侧卡绕 Y 轴的翻转角度（度）：恢复 Cover Flow / 3D Flip 的纵深观感 */
const FLIP_DEG = 20
/** 侧卡向屏幕内侧后退的距离（px），越远退得越多 */
const FLIP_DEPTH = 110
/** 侧卡自身的透视距离（px） */
const FLIP_PERSPECTIVE = 1600

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
/** 统一卡片高度（偶数）；0 表示需要重新测量 */
let cardHeight = 0

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
  // 舞台中心取整数像素：translate(-50%,-50%) 的基准必须是整数，否则仍是亚像素
  const centerX = Math.round(stageRect
    ? vw / 2 - stageRect.left
    : vw / 2)
  const centerY = Math.round(stageRect
    ? vh / 2 - stageRect.top - 6
    : vh / 2 - 6)

  cards.forEach((card, index) => {
    const offset = index - activeIndex
    const abs = Math.abs(offset)
    const isActive = offset === 0
    // 超出可见范围的卡片也要摆在轨道上的正确位置（只是不可见），
    // 否则它从文档流位置过渡到目标位置时会"飞"进来。
    const beyond = abs >= MAX_VISIBLE

    card.style.visibility = beyond
      ? 'hidden'
      : 'visible'
    card.style.pointerEvents = isActive && !beyond
      ? 'auto'
      : 'none'

    // 整行卡片同尺寸（scale 恒为 1）：不缩放，保证整行观感连续
    const scale = 1
    // 位移 = 卡片宽 + 间隙：卡片之间不重叠，形成一条真正的整行
    const translateX = offset * (mainW + CARD_GAP)
    // 3D Flip：侧卡朝屏幕中心翻转并向后退出纵深，主卡正对视线。
    // 主卡刻意不参与 3D 变换 —— 它是唯一需要看清文字的卡片，
    // 落在 3D 合成上下文里会被重采样而发虚。
    const rotateY = isActive
      ? 0
      : (offset > 0
          ? -FLIP_DEG
          : FLIP_DEG)
    const translateZ = isActive
      ? 0
      : -Math.min(abs, 3) * FLIP_DEPTH
    // 不透明度保持一致（避免侧卡"半透明"失去整行感），主次由压暗层区分
    const opacity = 1

    // ===== 唯一的位置来源：left/top 永远固定在舞台中心，位移全部走 transform =====
    // 这样切换时 left/top 不变，只有 transform 有过渡 → 纯水平翻页，不再抖动
    card.style.position = 'absolute'
    card.style.left = `${centerX}px`
    card.style.top = `${centerY}px`
    card.style.width = `${mainW}px`
    card.style.height = cardHeight
      ? `${cardHeight}px`
      : 'auto'
    card.style.margin = '0'
    card.style.boxSizing = 'border-box'
    card.style.padding = `${pad}px`
    card.style.borderRadius = '20px'
    card.style.background = 'var(--bew-elevated)'
    card.style.overflow = 'hidden'
    card.style.backdropFilter = 'none'
    card.style.filter = 'none'
    card.style.transformOrigin = 'center center'

    // 描边与阴影随 active 平滑变化
    card.style.outline = isActive
      ? '1.5px solid color-mix(in oklab, var(--bew-theme-color), transparent 72%)'
      : '0 solid transparent'
    card.style.outlineOffset = '0'
    card.style.boxShadow = isActive
      ? '0 24px 64px rgb(0 0 0 / 18%), 0 6px 16px rgb(0 0 0 / 8%)'
      : '0 12px 30px rgb(0 0 0 / 32%)'

    card.style.transform = isActive
      ? 'translate(-50%, -50%)'
      : `translate(-50%, -50%) translateX(${translateX}px) perspective(${FLIP_PERSPECTIVE}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`
    card.style.opacity = String(beyond
      ? 0
      : opacity)
    card.style.setProperty('--bew-focus-dim', String(isActive
      ? 0
      : Math.min(0.6, 0.28 + (abs - 1) * 0.16)))

    // 主卡不建立独立合成层，保证文字清晰；侧卡走合成层换取动画性能
    if (isActive) {
      card.style.willChange = 'auto'
      card.style.backfaceVisibility = 'visible'
    }
    else {
      card.style.willChange = 'transform, opacity'
      card.style.backfaceVisibility = 'hidden'
    }

    // 首次布局禁用过渡（避免从文档流位置"飞入"），之后才有平移动画
    card.style.transition = transitionsSettled
      ? 'transform 380ms cubic-bezier(.22,.61,.36,1), opacity 380ms ease, box-shadow 380ms ease, outline-color 380ms ease'
      : 'none'
    card.setAttribute('data-bewly-focus-ready', '')
  })

  // 排版尺度：以网格卡片宽度（约 357px）为 1.0 基准。
  // 刻意只做很温和的放大（最多 1.15 倍）——大封面配克制字号更精致，
  // 真正的视觉提升来自留白与间距，而不是把字撑大。
  const layoutScale = Math.min(1.15, Math.max(1, 0.85 + (mainW / 357) * 0.15))
  applyTypographyVars(layoutScale)

  // 所有卡片宽度已就位，此时测量高度才有意义
  normalizeCardHeights()
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
/**
 * 卡片高度规整。
 *
 * 所有卡片都用 translate(-50%, -50%) 居中，-50% 等于高度的一半。
 * 高度为奇数时这一半带 0.5px，文字会落在半像素上被重采样而发糊。
 * 这里统一把高度取成偶数，保证 translate 的偏移是整数像素。
 */
/**
 * 统一所有卡片的高度。
 *
 * 每次布局都按当前内容重新测量：标题行数、发布时间胶囊等会让不同卡片的内容高度不同，
 * 一旦沿用第一次缓存的高度，内容更高的卡片就会被裁切（胶囊溢出到卡片外）。
 * 取所有卡片的最大自然高度可以保证任何一张卡都不会被裁切，
 * 同时统一高度让切换时不会出现高度突跳。
 */
function normalizeCardHeights() {
  if (cardHeight) {
    for (const card of cardEls)
      card.style.height = `${cardHeight}px`
    return
  }
  // 两阶段测量：先把所有卡片恢复 auto（写入），再统一读取（一次重排），
  // 避免逐张卡片写-读交替触发 N 次强制同步布局。
  for (const card of cardEls)
    card.style.height = 'auto'
  let maxHeight = 0
  for (const card of cardEls) {
    const height = card.offsetHeight
    if (height > maxHeight)
      maxHeight = height
  }
  if (!maxHeight)
    return
  // 偶数高度保证 translate(-50%, -50%) 的偏移是整数像素，文字不糊
  cardHeight = Math.ceil(maxHeight / 2) * 2
  for (const card of cardEls)
    card.style.height = `${cardHeight}px`
}

function applyStageStyle(stage: HTMLElement) {
  stage.setAttribute(FOCUS_ATTR, '')
  stage.style.position = 'relative'
  stage.style.height = '100vh'
  stage.style.minHeight = '100vh'
  // 纯二维轨道：不使用 perspective / preserve-3d，
  // 既避免主卡被拖进 3D 合成上下文而发糊，也让滑动画面上没有透视变形
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
  cardHeight = 0

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
    // 视口变化会改变卡片宽度 → 内容换行与高度都会变，必须重新量高度
    cardHeight = 0
    cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => applyTransforms())
  })
  resizeObserver.observe(document.documentElement)

  // 卡片被替换或追加时重新应用（Vue 重渲染会换掉 DOM 节点）
  let pending = false
  let lastCount = cardEls.length
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
      // 只在卡片数量真的变化时才禁用过渡；否则每次 DOM 变动都重置会造成视觉"跳一下"
      if (next.length !== lastCount) {
        lastCount = next.length
        transitionsSettled = false
        // 卡片数量变化意味着内容整体变化，旧的统一高度不再可靠
        cardHeight = 0
        applyTransforms()
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            transitionsSettled = true
          })
        })
      }
      else {
        // 内容异步补全（标题换行、封面信息）后可能撑破统一高度：
        // 一旦检测到裁切就重新量高度，避免发布时间胶囊再次溢出卡片
        if (cardHeight && next.some(card => card.scrollHeight > card.clientHeight + 1))
          cardHeight = 0
        applyTransforms()
      }
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
  cardHeight = 0
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

/** 浮层（命令面板 / 快捷键帮助 / 对话框）打开时不接管按键 */
function hasOpenOverlay(): boolean {
  const root = document.querySelector('#bewly')?.shadowRoot
  return !!root?.querySelector('.command-palette-mask, .keyboard-help-mask, .dialog, .bewly-iframe-drawer')
}

/** 事件真实目标是否是可编辑元素（shadow DOM 会把 target 重定向到宿主） */
function isEditableEvent(event: KeyboardEvent): boolean {
  const path = event.composedPath?.() ?? []
  const el = (path[0] ?? event.target) as HTMLElement | null
  if (!el || el.nodeType !== 1)
    return false
  if ((el as HTMLElement).isContentEditable)
    return true
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
    return true
  return !!el.closest?.('input, textarea, select, [contenteditable="true"]')
}

/** 取当前 active 卡片的视频地址 */
function getActiveCardUrl(): string {
  const card = cardEls[activeIndex]
  return activeUrl
    || card?.getAttribute('data-video-url')
    || card?.querySelector<HTMLAnchorElement>('a[href*="/video/"]')?.getAttribute('href')
    || ''
}

/**
 * 在当前页打开内嵌预览（iframe 抽屉）。
 * 与网格模式下点击卡片、或设置里「抽屉打开」一致，不改变地址栏 URL。
 */
export function openFocusActiveCardPreview() {
  if (!isFocusBrowseActive())
    return
  const url = getActiveCardUrl()
  if (!url)
    return
  emitter.emit('open-video-preview', url)
}

/** 打开当前 active 卡片 */
export function openFocusActiveCard(target: '_blank' | '_self') {
  if (!isFocusBrowseActive())
    return
  const url = getActiveCardUrl()
  if (!url)
    return
  window.open(url, target)
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
    // 命令面板等浮层打开时，按键交给浮层自己处理（否则 Esc 会同时退出聚焦模式）
    if (hasOpenOverlay() || event.defaultPrevented || event.isComposing)
      return
    // 输入框内打字时不接管方向键与空格
    if (isEditableEvent(event))
      return
    if (event.key === 'Escape') {
      event.preventDefault()
      exitFocusBrowse()
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      openFocusActiveCard('_blank')
      return
    }
    if (event.key === ' ') {
      event.preventDefault()
      openFocusActiveCardPreview()
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
    if (!isFocusBrowseActive() || hasOpenOverlay())
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
