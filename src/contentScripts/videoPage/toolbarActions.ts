import { settings } from '~/logic'

import { toggleSelectionPanel, toggleShortcutsHelp } from './actions'
import { getMessages } from './i18n'
import { ui } from './state'

/**
 * 把「选集」「快捷键」两个按钮移到原生工具栏（第 33 轮，用户明确要求）。
 *
 * 之前这两个按钮在 `components/FloatingControls.vue` —— 我们自己的浮层（页面右下角 fixed）。
 * 用户要求把它们放进 B 站原生工具栏，**紧跟「简介」按钮之后**（简介按钮由 descPopover.ts 注入）。
 *
 * 定位策略（复用 descPopover 趟过的坑）：
 * 1. 首选 `#bewly-desc-trigger`（简介按钮）之后 —— 用户要求的顺序；
 * 2. 没有简介按钮（`#v_desc` 为空时简介按钮不会注入）→ 退化为工具栏里第一个**可见**容器之后；
 * 3. 工具栏本身不可见 → 退到标签行（`.video-tag-container`）末尾；
 * 4. 都不行 → 不渲染（不给假 UI）。
 *
 * 可见性 / 文案 / aria 由 `refreshToolbarActions()` 每拍（500ms sync）同步：
 * - 选集按钮：`ui.selectionNav` 为真才显示；文案随 `ui.selectionKind` 变（分P / 合集 / 播放列表）；
 *   `aria-pressed` 跟随 `ui.selectionPanelOpen`；
 * - 快捷键按钮：`settings.videoPageShortcuts` 为真才显示；`aria-pressed` 跟随 `ui.helpOpen`；
 * - 按钮被 B 站重渲染弄丢（工具栏整块重建）→ 自动重建。
 *
 * ⚠️ 本文件**不被 index.ts 引用**（index.ts 由 video-page 独占）：调用点见文件末尾注释与汇报。
 */

/** 两个按钮的 id / class（真机与 e2e 都靠这些特征定位） */
const SELECTION_ID = 'bewly-toolbar-selection'
const HELP_ID = 'bewly-toolbar-shortcuts'
const ACTION_CLASS = 'bewly-toolbar-action'
/** 简介按钮 id（descPopover.ts 注入） */
const DESC_TRIGGER_ID = 'bewly-desc-trigger'
/**
 * 三个按钮的包裹层 id（第 33 轮真机修复）。
 *
 * 真机现象：三个按钮虽然顺序正确、都在工具栏里，但彼此被拉开 ~104px / 92px ——
 * 父容器 `.video-toolbar-left` 用 space-between 之类分布，剩余空间摊到子元素之间，
 * 单个按钮的 `margin-left: 6px` 挡不住。
 *
 * 修法：把「简介 + 选集 + 快捷键」包进一个 `flex: 0 0 auto` 的 wrapper，
 * 三个按钮作为整体参与父容器分布，内部用 `gap: 8px` 稳定间距。
 */
const WRAPPER_ID = 'bewly-toolbar-actions'
/** 标签行（兜底插入点） */
const TAG_ROW_SELECTOR = '.video-tag-container'
/** tooltip / 按钮的宿主工具栏 */
const TOOLBAR_SELECTOR = '#arc_toolbar_report'

let selectionBtn: HTMLButtonElement | null = null
let helpBtn: HTMLButtonElement | null = null

function messages() {
  return getMessages()
}

/** 元素是否有实际尺寸（0×0 的元素不能当插入点，第 32 轮 .bar-right 踩过） */
function isRendered(el: Element | null | undefined): el is HTMLElement {
  if (!(el instanceof HTMLElement) || !el.isConnected)
    return false
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

/** 选集按钮文案：分P / 合集 / 播放列表（与 FloatingControls 的 selectionLabel 同一套逻辑） */
function selectionLabel(): string {
  const t = messages()
  if (ui.selectionKind === 'parts')
    return t.partsPanel
  if (ui.selectionKind === 'collection')
    return t.collectionPanel
  return t.playlistPanel
}

/**
 * 找插入点：简介按钮之后 → 工具栏第一个可见容器之后 → 工具栏本身 → 标签行。
 *
 * @returns 目标容器与「插在它后面」还是「追加到它内部」
 */
function findInsertTarget(): { container: HTMLElement, mode: 'after' | 'append' } | null {
  const desc = document.getElementById(DESC_TRIGGER_ID)
  if (isRendered(desc) && desc.parentElement)
    return { container: desc, mode: 'after' }

  const bar = document.querySelector<HTMLElement>(TOOLBAR_SELECTOR)
  if (bar) {
    const visible = Array.from(bar.querySelectorAll<HTMLElement>('button, [role="button"], .toolbar-left-item'))
      .find(el => isRendered(el))
    if (visible?.parentElement)
      return { container: visible, mode: 'after' }
    if (isRendered(bar))
      return { container: bar, mode: 'append' }
  }

  const tagRow = document.querySelector<HTMLElement>(TAG_ROW_SELECTOR)
  if (isRendered(tagRow))
    return { container: tagRow, mode: 'append' }

  return null
}

function createButton(id: string, action: string): HTMLButtonElement {
  const button = document.createElement('button')
  button.id = id
  button.type = 'button'
  button.className = ACTION_CLASS
  button.dataset.bvpAction = action
  button.setAttribute('aria-pressed', 'false')
  return button
}

/** wrapper 上的委托监听是否已挂（wrapper 可能在重建后是新节点，用 WeakSet 记录） */
const boundWrappers = new WeakSet<HTMLElement>()
/** 上一次已被处理的指针交互时间戳（click 与 pointerup 去重，200ms 内只生效一次） */
let lastPointerHandledAt = 0

/** 从事件目标里找我们的动作按钮（composedPath 兼容 shadow 外的原生树即可） */
function actionFromEvent(event: Event): string | null {
  const path = typeof event.composedPath === 'function'
    ? event.composedPath()
    : []
  for (const node of path) {
    if (!(node instanceof HTMLElement))
      continue
    const action = node.dataset?.bvpAction
    if (action && node.classList.contains(ACTION_CLASS))
      return action
  }
  return null
}

/**
 * 委托点击处理（第 33 轮 e2e 修复）。
 *
 * 之前是给每个按钮单独 `addEventListener`：一旦 refresh 替换了节点（或 wrapper 重建），
 * 监听就跟着丢失 —— 真机表现是「点了没反应、aria-pressed 不变」。
 * 现在把监听从按钮移到 **wrapper 上，一次性**挂载：
 * - 用 `closest`/`composedPath` 判断命中的是不是我们的动作按钮；
 * - 命中就 `preventDefault + stopPropagation`（挡掉 B 站可能存在的 document 委托）；
 * - 键盘 Enter / Space 同样走这里（按钮是原生 button，Enter/Space 会合成 click，无需额外处理）。
 */
function onDelegatedClick(event: Event): void {
  const action = actionFromEvent(event)
  if (!action)
    return
  // 同一次交互里 pointerup 已经处理过就不再重复切换状态
  const now = performance.now()
  if (now - lastPointerHandledAt < 200)
    return
  lastPointerHandledAt = now
  event.preventDefault()
  event.stopPropagation()
  if (action === 'selection') {
    toggleSelectionPanel()
    return
  }
  if (action === 'help')
    toggleShortcutsHelp()
}

/** 在 wrapper 上挂一次委托监听（幂等，按节点记录） */
function bindWrapperDelegation(wrapper: HTMLElement | null): void {
  if (!wrapper || boundWrappers.has(wrapper))
    return
  // capture 阶段处理：B 站可能在 document 上挂了捕获委托，我们在自己的 wrapper 上更早拿到事件；
  // 处理完 stopPropagation，事件不会再跑到 document 的委托里（也就不会触发 B 站的跳转/其它行为）
  wrapper.addEventListener('click', onDelegatedClick, true)
  // 兜底：某些环境下 click 会被合成前的 preventDefault 取消，pointerup 再补一次；
  // 用时间戳去重，避免同一次点击触发两次（展开后立刻又被收起）
  wrapper.addEventListener('pointerup', onDelegatedPointerUp)
  wrapper.addEventListener('keydown', onDelegatedKeydown)
  boundWrappers.add(wrapper)
}

/** pointerup 兜底（与 click 去重，200ms 内只处理一次） */
function onDelegatedPointerUp(event: Event): void {
  if (!(event instanceof PointerEvent) || event.button !== 0)
    return
  const action = actionFromEvent(event)
  if (!action)
    return
  const now = performance.now()
  if (now - lastPointerHandledAt < 200)
    return
  lastPointerHandledAt = now
  event.preventDefault()
  event.stopPropagation()
  if (action === 'selection')
    toggleSelectionPanel()
  else if (action === 'help')
    toggleShortcutsHelp()
}

/** 键盘 Enter / Space（原生 button 会合成 click，这里对非 button 元素兜底） */
function onDelegatedKeydown(event: Event): void {
  if (!(event instanceof KeyboardEvent) || (event.key !== 'Enter' && event.key !== ' '))
    return
  const action = actionFromEvent(event)
  if (!action)
    return
  event.preventDefault()
  event.stopPropagation()
  if (action === 'selection')
    toggleSelectionPanel()
  else if (action === 'help')
    toggleShortcutsHelp()
}

/** 有没有可用的插入点（工具栏或标签行可见） */
function hasUsableTarget(): boolean {
  return Boolean(document.querySelector<HTMLElement>(TOOLBAR_SELECTOR) && isRendered(document.querySelector<HTMLElement>(TOOLBAR_SELECTOR)))
    || Boolean(document.querySelector<HTMLElement>(TAG_ROW_SELECTOR) && isRendered(document.querySelector<HTMLElement>(TAG_ROW_SELECTOR)))
}

/** 两个动作当前是否「可用」（能力 / 设置允许） */
function wantsSelection(): boolean {
  return Boolean(ui.selectionNav)
}

function wantsHelp(): boolean {
  return Boolean(settings.value.videoPageShortcuts)
}

/** 更新按钮语义（只对已存在的按钮调用；不负责插入/移除） */
function syncButtonContent(): void {
  const t = messages()

  if (selectionBtn?.isConnected && wantsSelection()) {
    const label = selectionLabel()
    if (selectionBtn.textContent !== label)
      selectionBtn.textContent = label
    selectionBtn.title = `${label} · ${t.close}（Esc）`
    selectionBtn.setAttribute('aria-pressed', String(ui.selectionPanelOpen))
    selectionBtn.dataset.state = ui.selectionPanelOpen ? 'open' : 'closed'
  }

  if (helpBtn?.isConnected && wantsHelp()) {
    const label = t.shortcuts
    if (helpBtn.textContent !== label)
      helpBtn.textContent = label
    helpBtn.title = `${label}（?）`
    helpBtn.setAttribute('aria-pressed', String(ui.helpOpen))
    helpBtn.dataset.state = ui.helpOpen ? 'open' : 'closed'
  }
}

/**
 * 让 DOM 与「当前能力」一致（第 33 轮 e2e 修复）。
 *
 * 之前是「先插入、再 hidden」——能力不可用时 `[data-bvp-action="selection"]` 仍留在 DOM 里，
 * e2e 的 `toHaveCount(0)` 因此失败。现在改成：**能力不满足就不插入**，已存在的直接移除。
 */
function reconcilePresence(): void {
  // 注意：监听挂在 wrapper 上（事件委托），移除按钮本身不需要解绑；
  // 下次能力恢复时新按钮一插入就自动可用（第 33 轮「点了没反应」的根因就是 per-button 监听丢失）。
  if (!wantsSelection() && selectionBtn?.isConnected)
    selectionBtn.remove()
  if (!wantsHelp() && helpBtn?.isConnected)
    helpBtn.remove()
}

/** wrapper 元素（三个按钮的共同父级） */
function findWrapper(): HTMLElement | null {
  const el = document.getElementById(WRAPPER_ID)
  return el instanceof HTMLElement
    ? el
    : null
}

/** 简介按钮（descPopover 注入） */
function findDescTrigger(): HTMLElement | null {
  const el = document.getElementById(DESC_TRIGGER_ID)
  return el instanceof HTMLElement
    ? el
    : null
}

/**
 * 确保 wrapper 存在，并把「简介」按钮收进 wrapper 的第一位。
 *
 * @returns wrapper（把 desc 收进去之后的父级），失败返回 null
 */
function ensureWrapper(): HTMLElement | null {
  const existing = findWrapper()
  const desc = findDescTrigger()

  if (existing?.isConnected) {
    // desc 被 descPopover 重建过：重新收进 wrapper 首位
    if (desc && desc.parentElement !== existing)
      existing.insertBefore(desc, existing.firstElementChild)
    return existing
  }

  // 没有 wrapper：优先按「简介按钮原位」建 wrapper（替换 desc 的位置）
  if (desc?.parentElement) {
    const wrapper = document.createElement('span')
    wrapper.id = WRAPPER_ID
    wrapper.className = 'bewly-toolbar-actions'
    desc.insertAdjacentElement('beforebegin', wrapper)
    wrapper.appendChild(desc)
    return wrapper
  }

  // 没有简介按钮：退化为「工具栏第一个可见容器之后 / 工具栏本身 / 标签行」
  const target = findInsertTarget()
  if (!target)
    return null

  const wrapper = document.createElement('span')
  wrapper.id = WRAPPER_ID
  wrapper.className = 'bewly-toolbar-actions'
  if (target.mode === 'after')
    target.container.insertAdjacentElement('afterend', wrapper)
  else
    target.container.appendChild(wrapper)
  return wrapper
}

/**
 * 启动：把「简介」+「选集」+「快捷键」收进同一个 wrapper。
 *
 * 幂等：重复调用不会插出第二个 wrapper / 第二组按钮。
 */
export function setupToolbarActions(): void {
  const needSelection = wantsSelection()
  const needHelp = wantsHelp()

  // 两个动作都不可用：不建 wrapper（简介按钮保持 descPopover 自己的位置，不额外包裹）
  if (!needSelection && !needHelp) {
    reconcilePresence()
    // 已有 wrapper 里如果只剩 desc，就把它拆掉（desc 放回原位）
    const stale = findWrapper()
    if (stale) {
      const desc = findDescTrigger()
      if (desc?.parentElement === stale && stale.parentElement)
        stale.parentElement.insertBefore(desc, stale)
      stale.remove()
    }
    return
  }

  const wrapper = ensureWrapper()
  if (!wrapper)
    return

  if (needSelection && !selectionBtn)
    selectionBtn = createButton(SELECTION_ID, 'selection')
  if (needHelp && !helpBtn)
    helpBtn = createButton(HELP_ID, 'help')

  // 按需插入（不需要的绝不入 DOM）
  if (needSelection && selectionBtn && selectionBtn.parentElement !== wrapper)
    wrapper.appendChild(selectionBtn)
  if (needHelp && helpBtn && helpBtn.parentElement !== wrapper)
    wrapper.appendChild(helpBtn)

  // 顺序守卫：选集必须在快捷键之前（只在两者都存在时才有意义）
  if (needSelection && needHelp && selectionBtn && helpBtn && selectionBtn.nextElementSibling !== helpBtn)
    wrapper.appendChild(helpBtn)

  // 委托监听：挂在 wrapper 上一次，之后按钮增删都不影响（关键修复）
  bindWrapperDelegation(wrapper)
  syncButtonContent()
}

/**
 * 每拍同步（由 sync 的 500ms 节拍调用）：
 * 1. 按钮丢了（工具栏被 B 站重建）→ 重建；
 * 2. 文案 / aria / 可见性变了 → 更新；
 * 3. 页面里暂时没有可用插入点 → 只隐藏不重建（避免反复拆建）。
 */
export function refreshToolbarActions(): void {
  const needSelection = wantsSelection()
  const needHelp = wantsHelp()

  // 1) 能力变化：先把不该存在的按钮从 DOM 里拿掉（e2e 断言 toHaveCount(0) 依赖这一点）
  reconcilePresence()

  // 2) 两个动作都需要/都不需要时的 wrapper 处理
  if (!needSelection && !needHelp) {
    const stale = findWrapper()
    if (stale) {
      const desc = findDescTrigger()
      if (desc?.parentElement === stale && stale.parentElement)
        stale.parentElement.insertBefore(desc, stale)
      stale.remove()
    }
    return
  }

  const wrapper = findWrapper()
  const desc = findDescTrigger()

  // 3) wrapper 丢了（工具栏整块重建 / 被外部移除）：有锚点就重建
  if (!wrapper?.isConnected) {
    if (selectionBtn?.isConnected)
      selectionBtn.remove()
    if (helpBtn?.isConnected)
      helpBtn.remove()
    if (hasUsableTarget() || desc)
      setupToolbarActions()
    return
  }

  // 4) desc 被 descPopover 重建过（新的 #bewly-desc-trigger 插在别处）：收回 wrapper 首位
  if (desc && desc.parentElement !== wrapper)
    wrapper.insertBefore(desc, wrapper.firstElementChild)

  // 5) 需要的按钮丢了 / 被挤出 wrapper：插入或拉回
  if (needSelection) {
    if (!selectionBtn)
      selectionBtn = createButton(SELECTION_ID, 'selection')
    if (selectionBtn.parentElement !== wrapper)
      wrapper.appendChild(selectionBtn)
    if (needHelp && helpBtn && selectionBtn.nextElementSibling !== helpBtn)
      wrapper.appendChild(helpBtn)
  }
  if (needHelp) {
    if (!helpBtn)
      helpBtn = createButton(HELP_ID, 'help')
    if (helpBtn.parentElement !== wrapper)
      wrapper.appendChild(helpBtn)
  }

  // 6) 可见性自检：需要的按钮却 0×0 且页面有可用容器 → 换位置重建
  const rendered = [
    needSelection ? selectionBtn : null,
    needHelp ? helpBtn : null,
  ]
    .some(button => isRendered(button))
  if (!rendered && hasUsableTarget()) {
    teardownToolbarActions()
    setupToolbarActions()
    return
  }

  bindWrapperDelegation(wrapper)
  syncButtonContent()
}

/**
 * 卸载：移除按钮与监听（原生工具栏恢复原样）。
 *
 * 「简介」按钮属于 descPopover，**不能删**：如果它此刻在 wrapper 里，
 * 先把它放回 wrapper 的位置（原父容器、原下一个兄弟之前），再移除 wrapper。
 */
export function teardownToolbarActions(): void {
  // wrapper 里可能只剩简介按钮（两个动作都不可用时我们不会建 wrapper，
  // 但运行中能力变化过的话可能留下只有 desc 的 wrapper）：先把 desc 放回原位再拆 wrapper
  const wrapper = findWrapper()
  const desc = findDescTrigger()
  if (wrapper && desc && desc.parentElement === wrapper && wrapper.parentElement) {
    wrapper.parentElement.insertBefore(desc, wrapper)
  }

  selectionBtn?.remove()
  helpBtn?.remove()
  wrapper?.remove()
  selectionBtn = null
  helpBtn = null
}

// #region 接线说明（index.ts 由 video-page 独占，本文件不自行接线）
//
// 在 src/contentScripts/videoPage/index.ts：
//   import { refreshToolbarActions, setupToolbarActions, teardownToolbarActions } from './toolbarActions'
//   mount():   setupToolbarActions()      // 放在 setupDescPopover() 之后（要排在简介按钮后面）
//   sync():    refreshToolbarActions()    // 每 500ms 拍
//   unmount(): teardownToolbarActions()   // 放在 teardownDescPopover() 之前
//
// 同时 video-page 需要把 FloatingControls.vue 里的这两个按钮移除（本文件不碰该组件）。
// #endregion
