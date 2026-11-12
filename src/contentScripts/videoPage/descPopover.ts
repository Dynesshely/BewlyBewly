import { getMessages } from './i18n'

/**
 * 简介收拢到工具栏 + 自绘 tooltip（第 32 轮，用户截图反馈）。
 *
 * 背景：左列里 `#v_desc` 是独立一行（真机 h=20），把「信息栏 + 播放器 + 工具栏 + 标签」
 * 这一整块撑得比右侧评论区高，用户看到的就是「播放器区与评论区不齐」。
 *
 * 做法：
 * 1. `#v_desc` **只 `display: none`**（CSS 在 `src/styles/adaptedStyles/pages/videoPage.scss`），
 *    DOM 保留 —— B 站用它做「展开 / 收起」的状态机，删掉会破坏原生交互；
 * 2. 从 `#v_desc` 的**克隆节点**里读完整简介文本（去掉「展开 / 收起」这类按钮文案，且不改原 DOM）；
 * 3. 在 `#arc_toolbar_report` 内、**分享按钮之后**注入一个原生 `<button class="bewly-desc-trigger">简介</button>`；
 * 4. hover 300ms / focus 显示自绘 tooltip（`role="tooltip"`，最大宽 420 / 最大高 320 / 内部滚动 /
 *    圆角 12 / `--bew-elevated` 底 + 阴影），跟随按钮、优先下方、越界翻上并横向夹紧；
 * 5. `Esc` / 点击外部关闭；按钮通过 `aria-describedby` 指向 tooltip，读屏可读完整简介；
 * 6. `#v_desc` 不存在或文本为空 → **不注入按钮**（不给假 UI）；
 * 7. 卸载时移除按钮、tooltip 与所有监听，`#v_desc` 原样保留（CSS 由调用方卸载时一并撤掉）。
 *
 * ⚠️ tooltip 渲染在**原生 DOM**（`document.body` 末尾）而不是 `#bewly-video-page` 的 shadow 里：
 * `aria-describedby` 是跨 shadow 边界无效的，按钮在原生 DOM 里，tooltip 必须在同一棵树内，
 * 读屏才能把简介念出来。所以样式写在页面级 `videoPage.scss`。
 *
 * ⚠️ 本文件**不被 index.ts 引用**（index.ts 由 video-page 独占）：
 * 调用点见文件末尾「接线说明」与汇报里的「Lead 接线项」。
 */

/** 注入的按钮 id / tooltip id */
const TRIGGER_ID = 'bewly-desc-trigger'
const TOOLTIP_ID = 'bewly-desc-tooltip'
/** hover 多久后显示（ms） */
const HOVER_DELAY = 300
/** 移出后延迟隐藏（ms）：给「从按钮移到 tooltip 上」留出时间 */
const HIDE_DELAY = 160
/** tooltip 与按钮之间的间距 */
const GAP = 8
/** 视口边缘留白 */
const EDGE = 8

let trigger: HTMLButtonElement | null = null
let tooltip: HTMLDivElement | null = null
let showTimer: number | null = null
let hideTimer: number | null = null
let open = false
let descText = ''
let outsideHandler: ((event: PointerEvent) => void) | null = null
let keyHandler: ((event: KeyboardEvent) => void) | null = null
let resizeHandler: (() => void) | null = null

/** 当前语言的文案（按钮文字与 aria-label） */
function messages() {
  return getMessages()
}

/**
 * 从 `#v_desc` 读完整简介文本。
 *
 * 用克隆节点读取：B 站会在 `#v_desc` 里放「展开 / 收起」按钮与折叠容器，
 * 直接取 textContent 会把「展开」二字混进简介；克隆后删掉按钮类节点再取文本，
 * 既不污染原文案，也不改动真实 DOM。
 */
function readDescText(): string {
  const desc = document.querySelector<HTMLElement>('#v_desc, .video-desc-container')
  if (!desc)
    return ''

  const clone = desc.cloneNode(true) as HTMLElement
  clone.querySelectorAll('button, a, [class*="toggle"], [class*="expand"], [class*="fold"], [class*="btn"]')
    .forEach(node => node.remove())

  return (clone.textContent ?? '')
    .replace(/\s+/g, ' ')
    .replace(/简介[:：]?\s*/, '')
    .trim()
}

/** 元素是否有实际尺寸（getBoundingClientRect 非 0） */
function isRendered(el: HTMLElement | null | undefined): boolean {
  if (!el?.isConnected)
    return false
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

/**
 * 在工具栏里找「可见」的插入目标（第 32 轮真机修复）。
 *
 * 真机现象：按钮被插进 `#arc_toolbar_report > .bar-right`，而这个容器在固定布局下是 **0×0**
 * （B 站把右侧操作区留空），按钮 computed 有 height:26px 但 rect 是 0，用户完全看不到。
 *
 * 选择顺序：
 * 1. 含「分享」文本 / class 含 share 的**可见**元素（插到它后面）；
 * 2. 其它任何可见的按钮 / `[role=button]` / 容器（插到它后面）；
 * 3. 都找不到 → 直接 append 到 `#arc_toolbar_report` 本身（它整体可见）。
 */
function findVisibleInsertTarget(bar: HTMLElement): HTMLElement | null {
  const preferred = Array.from(bar.querySelectorAll<HTMLElement>('button, [role="button"], .toolbar-left-item'))
    .find((el) => {
      const text = (el.textContent ?? '').trim()
      const cls = typeof el.className === 'string'
        ? el.className
        : ''
      return isRendered(el) && (/分享/.test(text) || /share/i.test(cls))
    })
  if (preferred)
    return preferred

  const visible = Array.from(bar.querySelectorAll<HTMLElement>('button, [role="button"], .toolbar-left-item'))
    .find(el => isRendered(el))
  if (visible)
    return visible

  return isRendered(bar)
    ? bar
    : null
}

/**
 * 兜底插入点：标签行（`.video-tag-container`）。
 *
 * 固定布局下工具栏可能被压得没有可用宽度（`.bar-right` 0×0、左侧按钮也挤满），
 * 这时把按钮放到标签行右端 —— 标签行是可见的，用户仍然能点到「简介」。
 */
function findTagRowFallback(): HTMLElement | null {
  const tags = document.querySelector<HTMLElement>('.video-tag-container')
  return isRendered(tags)
    ? tags
    : null
}

/** 确保 tooltip 节点存在（懒创建，挂在 body 末尾） */
function ensureTooltip(): HTMLDivElement {
  if (tooltip?.isConnected)
    return tooltip

  const el = document.createElement('div')
  el.id = TOOLTIP_ID
  el.className = 'bewly-desc-tooltip'
  el.setAttribute('role', 'tooltip')
  el.setAttribute('data-open', 'false')
  el.hidden = true
  document.body.appendChild(el)
  tooltip = el
  return el
}

/** 定位：优先按钮下方；下方放不下翻到上方；水平方向夹紧在视口内 */
function positionTooltip(): void {
  if (!trigger || !tooltip)
    return

  const rect = trigger.getBoundingClientRect()
  tooltip.style.maxWidth = `${Math.min(420, window.innerWidth - EDGE * 2)}px`
  tooltip.style.maxHeight = `${Math.min(320, window.innerHeight - EDGE * 2)}px`

  // 先摆到下方再量高度（高度受 max-height 限制，量出来的是实际占用高）
  tooltip.style.left = `${EDGE}px`
  tooltip.style.top = `${EDGE}px`
  const box = tooltip.getBoundingClientRect()
  const width = Math.min(box.width, window.innerWidth - EDGE * 2)
  const height = Math.min(box.height, window.innerHeight - EDGE * 2)

  const below = rect.bottom + GAP
  const above = rect.top - height - GAP
  const fitsBelow = below + height <= window.innerHeight - EDGE
  const top = fitsBelow
    ? below
    : Math.max(EDGE, above >= EDGE
        ? above
        : window.innerHeight - height - EDGE)

  const left = Math.min(
    Math.max(EDGE, rect.left),
    Math.max(EDGE, window.innerWidth - width - EDGE),
  )

  tooltip.style.left = `${Math.round(left)}px`
  tooltip.style.top = `${Math.round(top)}px`
}

function show(): void {
  if (!trigger || !descText)
    return
  const el = ensureTooltip()
  el.textContent = descText
  el.hidden = false
  el.setAttribute('data-open', 'true')
  positionTooltip()
  open = true
  trigger.setAttribute('aria-expanded', 'true')
}

function hide(): void {
  if (!open)
    return
  open = false
  if (tooltip) {
    tooltip.setAttribute('data-open', 'false')
    tooltip.hidden = true
  }
  trigger?.setAttribute('aria-expanded', 'false')
}

function cancelShow(): void {
  if (showTimer !== null) {
    window.clearTimeout(showTimer)
    showTimer = null
  }
}

function cancelHide(): void {
  if (hideTimer !== null) {
    window.clearTimeout(hideTimer)
    hideTimer = null
  }
}

/** hover 300ms 后显示 */
function scheduleShow(): void {
  cancelHide()
  cancelShow()
  showTimer = window.setTimeout(() => {
    showTimer = null
    show()
  }, HOVER_DELAY)
}

/** 移出后延迟隐藏（期间移到 tooltip 上会取消） */
function scheduleHide(): void {
  cancelShow()
  cancelHide()
  hideTimer = window.setTimeout(() => {
    hideTimer = null
    hide()
  }, HIDE_DELAY)
}

/** 创建按钮并注入（优先工具栏可见容器，其次标签行兜底） */
function createTrigger(): HTMLButtonElement | null {
  const bar = document.querySelector<HTMLElement>('#arc_toolbar_report')

  const button = document.createElement('button')
  button.id = TRIGGER_ID
  button.type = 'button'
  button.className = 'bewly-desc-trigger'
  button.textContent = messages().descTitle
  button.setAttribute('aria-describedby', TOOLTIP_ID)
  button.setAttribute('aria-expanded', 'false')

  const target = bar
    ? findVisibleInsertTarget(bar)
    : null
  if (target && bar) {
    if (target === bar)
      bar.appendChild(button)
    else
      target.insertAdjacentElement('afterend', button)
  }
  else {
    // 工具栏不存在 / 不可见：退到标签行右端
    const tagRow = findTagRowFallback()
    if (!tagRow)
      return null
    tagRow.appendChild(button)
    button.setAttribute('data-bewly-desc-fallback', 'tag-row')
  }

  // 交互：hover 300ms / focus 立即显示；移出 / blur 延迟隐藏
  button.addEventListener('mouseenter', scheduleShow)
  button.addEventListener('mouseleave', scheduleHide)
  button.addEventListener('focus', show)
  button.addEventListener('blur', scheduleHide)
  // 点击也直接显示（触屏 / 不想等 300ms 的用户）
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (open)
      hide()
    else
      show()
  })

  return button
}

/** 全局关闭：Esc / 点击外部 / 窗口尺寸变化时重新定位 */
function bindGlobalHandlers(): void {
  outsideHandler = (event: PointerEvent) => {
    if (!open)
      return
    const target = event.target
    if (!(target instanceof Node))
      return
    if (trigger?.contains(target) || tooltip?.contains(target))
      return
    hide()
  }
  document.addEventListener('pointerdown', outsideHandler, true)

  keyHandler = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !open)
      return
    event.preventDefault()
    event.stopPropagation()
    hide()
    trigger?.focus({ preventScroll: true })
  }
  document.addEventListener('keydown', keyHandler, true)

  resizeHandler = () => {
    if (open)
      positionTooltip()
  }
  window.addEventListener('resize', resizeHandler, { passive: true })
  window.addEventListener('scroll', resizeHandler, { passive: true })
}

function unbindGlobalHandlers(): void {
  if (outsideHandler)
    document.removeEventListener('pointerdown', outsideHandler, true)
  if (keyHandler)
    document.removeEventListener('keydown', keyHandler, true)
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
    window.removeEventListener('scroll', resizeHandler)
  }
  outsideHandler = null
  keyHandler = null
  resizeHandler = null
}

/**
 * 启动：读简介 → 注入按钮。
 *
 * 幂等：重复调用不会插出第二个按钮。
 */
export function setupDescPopover(): void {
  if (trigger?.isConnected)
    return

  descText = readDescText()
  // 简介为空 / 不存在：不注入按钮（不给假 UI）
  if (!descText)
    return

  trigger = createTrigger()
  if (!trigger) {
    descText = ''
    return
  }

  bindGlobalHandlers()
  // 提前建好 tooltip 并写入文本：aria-describedby 指向的节点必须真实存在且**有内容**，
  // 否则读屏只会读到「引用缺失」或空描述（隐藏状态不影响读屏取文本）
  const el = ensureTooltip()
  el.textContent = descText
}

/**
 * 切视频 / 分 P 后 B 站会重建 `#v_desc`：重新读文本 + **校验按钮是否真的可见**。
 *
 * 真机踩过：按钮插进了 0×0 的 `.bar-right` 里，DOM 存在、computed 正常，但 rect 全 0，
 * 用户完全看不到。所以每拍（500ms sync）都检查一次：
 * 1. 按钮不可见（rect 宽或高为 0）→ 先尝试迁移到标签行右端（`data-bewly-desc-fallback`），
 *    仍然不可见就拆掉触发一次完整重建（下一拍 `setupDescPopover()` 会重新选可见容器）；
 * 2. 文本变空 → 整体撤掉（不给假 UI）。
 */
export function refreshDescPopover(): void {
  if (!trigger?.isConnected) {
    setupDescPopover()
    return
  }

  // 文本更新（优先于可见性，避免文案过期）
  const next = readDescText()
  if (!next) {
    teardownDescPopover()
    return
  }
  descText = next
  if (tooltip && open) {
    tooltip.textContent = descText
    positionTooltip()
  }

  // 可见性自检：不可见就迁移 / 重建
  if (isRendered(trigger))
    return

  const tagRow = findTagRowFallback()
  if (tagRow && trigger.parentElement !== tagRow && !trigger.hasAttribute('data-bewly-desc-fallback')) {
    // 第一阶段：迁移到标签行右端（最稳的可见位置）
    tagRow.appendChild(trigger)
    trigger.setAttribute('data-bewly-desc-fallback', 'tag-row')
    if (isRendered(trigger))
      return
  }

  // 第二阶段：仍然不可见时，只有「页面里确实存在可用容器」才重建，
  // 避免在影院 / 全屏 / 标签页切走等「整块都不可见」的状态下每 500ms 反复拆建
  const bar = document.querySelector<HTMLElement>('#arc_toolbar_report')
  const hasUsableTarget = Boolean((bar && isRendered(bar)) || tagRow)
  if (!hasUsableTarget)
    return

  teardownDescPopover()
  setupDescPopover()
}

/** 卸载：移除按钮 / tooltip / 监听，恢复原样 */
export function teardownDescPopover(): void {
  cancelShow()
  cancelHide()
  hide()
  unbindGlobalHandlers()

  trigger?.removeEventListener('mouseenter', scheduleShow)
  trigger?.removeEventListener('mouseleave', scheduleHide)
  trigger?.remove()
  trigger = null

  tooltip?.remove()
  tooltip = null

  descText = ''
  open = false
}

// #region 接线说明（index.ts 由 video-page 独占，本文件不自行接线）
//
// 在 src/contentScripts/videoPage/index.ts：
//   import { refreshDescPopover, setupDescPopover, teardownDescPopover } from './descPopover'
//   mount():   setupDescPopover()      // 放在 setupComments() 之后
//   sync():    refreshDescPopover()    // 每 500ms 拍里调用（内部会判空，开销只有一次 textContent 读取）
//   unmount(): teardownDescPopover()   // 放在 disposeComments 之后
//
// #v_desc 的 display:none 由页面级样式负责（src/styles/adaptedStyles/pages/videoPage.scss
// 的第 32 轮区块），随页面卸载自动失效，无需 JS 还原。
// #endregion
