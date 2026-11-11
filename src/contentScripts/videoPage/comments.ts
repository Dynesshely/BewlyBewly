/**
 * 视频页评论区增强：排序快捷 / 只看 UP 主 / 长评论折叠。
 *
 * 设计原则：
 * - 不改 B 站评论 DOM 结构：只给评论打属性（`data-bewly-comment-up` / `-clamped` / `-expanded`），
 *   由页面级 CSS（`videoPage.scss`）负责隐藏 / 折叠；展开按钮在 shadow 浮层里（fixed 定位）。
 * - 排序只点原生 tab，不自己发请求；找不到原生排序标签时工具条隐藏该功能。
 * - 只看 UP 依赖原生 `.up-mark` 标识；整页都没有该标识时开关禁用并提示（不做假开关）。
 * - 与影院模式共存：影院模式压暗评论区时，增强 UI 由组件侧 `v-if="!ui.cinema"` 隐藏。
 */
import { showToast } from './actions'
import { getMessages } from './i18n'
import { ui } from './state'

export type CommentSortKind = 'hot' | 'latest'

const COMMENT_ROOT_SELECTORS = [
  '#comment',
  '#commentapp',
  '.comment-container',
  '#comment .comment-container',
]
const REPLY_LIST_SELECTORS = ['.reply-list', '[class*="reply-list"]']
const REPLY_ITEM_SELECTOR = '.reply-item'
const UP_MARK_SELECTORS = ['.up-mark', '[class*="up-mark"]', '[class*="upMark"]']
const SORT_CONTAINER_SELECTORS = [
  '.reply-sort',
  '.comment-sort',
  '[class*="reply-sort"]',
  '[class*="comment-sort"]',
]

const HOT_TEXT_RE = /最热|热门/
const LATEST_TEXT_RE = /最新/
const ACTIVE_TOKEN_RE = /(?:^|[-_])(?:active|selected|current|on)(?:[-_]|$)/i

const ONLY_UP_ROOT_CLASS = 'bewly-comments-only-up'
const ONLY_UP_STORAGE_KEY = 'bewly-comments-only-up'
/** 超过这个高度（px）的长评论默认折叠 */
const FOLD_HEIGHT = 400
const FOLD_BUTTON_HEIGHT = 32
const FOLD_BUTTON_WIDTH = 88

const ALL_ATTRS = [
  'data-bewly-comment-up',
  'data-bewly-comment-clamped',
  'data-bewly-comment-expanded',
  'data-bewly-comment-fold-id',
  'data-bewly-comment-fold-checked',
]

let resizeObserver: ResizeObserver | null = null
const observedItems = new Set<HTMLElement>()
const clampedItems = new Map<number, HTMLElement>()
let nextFoldId = 1
let rafId = 0
let disposeListeners: (() => void) | null = null

function messages() {
  return getMessages()
}

function firstMatch<T extends Element>(selectors: string[]): T | null {
  for (const selector of selectors) {
    const el = document.querySelector<T>(selector)
    if (el)
      return el
  }
  return null
}

export function findCommentRoot(): HTMLElement | null {
  return firstMatch<HTMLElement>(COMMENT_ROOT_SELECTORS)
}

function findReplyList(): HTMLElement | null {
  const root = findCommentRoot()
  if (root) {
    const inRoot = firstMatchWithin<HTMLElement>(root, REPLY_LIST_SELECTORS)
    if (inRoot)
      return inRoot
  }
  return firstMatch<HTMLElement>(REPLY_LIST_SELECTORS)
}

function firstMatchWithin<T extends Element>(root: HTMLElement, selectors: string[]): T | null {
  for (const selector of selectors) {
    const el = root.querySelector<T>(selector)
    if (el)
      return el
  }
  return null
}

/** 顶层评论（排除楼中楼里的 .reply-item） */
function getReplyItems(): HTMLElement[] {
  const list = findReplyList()
  if (!list)
    return []

  const direct = Array.from(list.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && el.classList.contains('reply-item'),
  )
  if (direct.length)
    return direct

  return Array.from(list.querySelectorAll<HTMLElement>(REPLY_ITEM_SELECTOR))
    .filter(el => !el.parentElement?.closest(REPLY_ITEM_SELECTOR))
}

function findUpMark(item: HTMLElement): HTMLElement | null {
  return firstMatchWithin<HTMLElement>(item, UP_MARK_SELECTORS)
}

// #region 排序
function findSortContainer(): HTMLElement | null {
  return firstMatch<HTMLElement>(SORT_CONTAINER_SELECTORS)
}

function isActiveTab(el: HTMLElement): boolean {
  const candidates: (HTMLElement | null)[] = [
    el,
    el.closest<HTMLElement>('li, button, a, [role="tab"]'),
  ]
  return candidates.some((node) => {
    if (!node)
      return false
    if (node.getAttribute('aria-selected') === 'true' || node.getAttribute('aria-current'))
      return true
    return node.className
      .split(/\s+/)
      .some(token => ACTIVE_TOKEN_RE.test(token))
  })
}

/** 原生排序 tab（最热 / 最新）；两个都找不到时该功能隐藏 */
export function getSortTabs(): { hot: HTMLElement | null, latest: HTMLElement | null } {
  const container = findSortContainer()
  if (!container)
    return { hot: null, latest: null }

  const candidates = Array.from(
    container.querySelectorAll<HTMLElement>('li, button, a, [role="tab"], span, div'),
  )

  // 只取「文字命中且没有同样命中的子元素」的最内层节点，避免点到外层整块
  const innermost = candidates.filter((el) => {
    const text = el.textContent?.trim() ?? ''
    if (!HOT_TEXT_RE.test(text) && !LATEST_TEXT_RE.test(text))
      return false
    return !Array.from(el.children).some((child) => {
      const childText = child.textContent?.trim() ?? ''
      return HOT_TEXT_RE.test(childText) || LATEST_TEXT_RE.test(childText)
    })
  })

  const pick = (re: RegExp) => innermost.find(el => re.test(el.textContent?.trim() ?? '')) ?? null
  return {
    hot: pick(HOT_TEXT_RE),
    latest: pick(LATEST_TEXT_RE),
  }
}

export function getActiveSort(): '' | CommentSortKind {
  const { hot, latest } = getSortTabs()
  if (latest && isActiveTab(latest))
    return 'latest'
  if (hot && isActiveTab(hot))
    return 'hot'
  return ''
}

/** 点原生排序 tab（不自己发请求） */
export function clickCommentSort(kind: CommentSortKind): void {
  const tab = getSortTabs()[kind]
  if (!tab) {
    showToast(messages().commentsSortUnavailable)
    return
  }

  const clickable = tab.closest<HTMLElement>('li, button, a, [role="tab"]') ?? tab
  clickable.click()

  // 乐观更新，下一拍 sync 会用原生高亮校正
  ui.commentActiveSort = kind
  showToast(kind === 'hot'
    ? messages().commentSortHotToast
    : messages().commentSortLatestToast)
}
// #endregion

// #region 只看 UP
function readStoredOnlyUp(): boolean {
  try {
    return sessionStorage.getItem(ONLY_UP_STORAGE_KEY) === '1'
  }
  catch {
    return false
  }
}

function storeOnlyUp(on: boolean): void {
  try {
    sessionStorage.setItem(ONLY_UP_STORAGE_KEY, on ? '1' : '0')
  }
  catch {
    // sessionStorage 被禁用时忽略
  }
}

/** 真正决定是否隐藏的类：必须「开关打开 + 页面上确实有 UP 标识」才生效 */
function applyOnlyUpState(): void {
  document.documentElement.classList.toggle(
    ONLY_UP_ROOT_CLASS,
    ui.commentsOnlyUp && ui.commentUpAvailable,
  )
}

export function toggleCommentsOnlyUp(): void {
  if (ui.commentsOnlyUp) {
    setCommentsOnlyUp(false)
    return
  }
  if (!ui.commentUpAvailable) {
    showToast(messages().commentsUpUnavailable)
    return
  }
  setCommentsOnlyUp(true)
}

function setCommentsOnlyUp(on: boolean): void {
  ui.commentsOnlyUp = on
  storeOnlyUp(on)
  applyOnlyUpState()
  showToast(on
    ? messages().commentsOnlyUpOn
    : messages().commentsOnlyUpOff)
}
// #endregion

// #region 长评论折叠
function ensureFoldObserver(): void {
  if (resizeObserver)
    return

  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const el = entry.target
      if (el instanceof HTMLElement)
        evaluateFold(el)
    }
    refreshFoldPositions()
  })
}

function observeItem(item: HTMLElement): void {
  if (observedItems.has(item))
    return
  ensureFoldObserver()
  observedItems.add(item)
  resizeObserver?.observe(item)
}

function ensureFoldId(el: HTMLElement): number {
  const existing = Number(el.getAttribute('data-bewly-comment-fold-id') ?? '')
  if (existing) {
    clampedItems.set(existing, el)
    return existing
  }
  const id = nextFoldId++
  el.setAttribute('data-bewly-comment-fold-id', String(id))
  clampedItems.set(id, el)
  return id
}

function clearClamp(el: HTMLElement): void {
  const id = Number(el.getAttribute('data-bewly-comment-fold-id') ?? '')
  el.removeAttribute('data-bewly-comment-clamped')
  el.removeAttribute('data-bewly-comment-fold-id')
  if (id)
    clampedItems.delete(id)
}

/** 单条评论的折叠判定：高度 > 400px 且没有展开时折叠 */
function evaluateFold(el: HTMLElement): void {
  if (!el.isConnected) {
    clearClamp(el)
    return
  }

  if (el.hasAttribute('data-bewly-comment-expanded'))
    return

  const tooTall = el.scrollHeight > FOLD_HEIGHT || el.getBoundingClientRect().height > FOLD_HEIGHT
  if (tooTall) {
    if (!el.hasAttribute('data-bewly-comment-clamped'))
      el.setAttribute('data-bewly-comment-clamped', '')
    ensureFoldId(el)
  }
  else {
    clearClamp(el)
  }
}

/** 展开按钮是 fixed 定位，需要随滚动 / 尺寸变化重算（只保留视口内的） */
function refreshFoldPositions(): void {
  if (ui.cinema) {
    if (ui.commentFoldButtons.length)
      ui.commentFoldButtons = []
    return
  }

  const next: { id: number, top: number, left: number }[] = []
  for (const [id, el] of clampedItems) {
    if (!el.isConnected || el.hasAttribute('data-bewly-comment-expanded')) {
      clampedItems.delete(id)
      continue
    }

    const rect = el.getBoundingClientRect()
    if (rect.bottom < 0 || rect.top > window.innerHeight)
      continue

    next.push({
      id,
      top: Math.min(
        Math.max(rect.bottom - FOLD_BUTTON_HEIGHT - 8, 8),
        window.innerHeight - FOLD_BUTTON_HEIGHT - 8,
      ),
      left: Math.min(
        Math.max(rect.right - FOLD_BUTTON_WIDTH, 8),
        window.innerWidth - FOLD_BUTTON_WIDTH - 8,
      ),
    })
  }

  const changed = next.length !== ui.commentFoldButtons.length
    || next.some((btn, index) => {
      const prev = ui.commentFoldButtons[index]
      return !prev
        || prev.id !== btn.id
        || Math.abs(prev.top - btn.top) > 0.5
        || Math.abs(prev.left - btn.left) > 0.5
    })
  if (changed)
    ui.commentFoldButtons = next
}

export function expandComment(id: number): void {
  const el = clampedItems.get(id)
  if (!el)
    return

  el.setAttribute('data-bewly-comment-expanded', '')
  clearClamp(el)
  refreshFoldPositions()
}
// #endregion

// #region 同步 / 生命周期
function updateToolbarPosition(root: HTMLElement): void {
  const rect = root.getBoundingClientRect()
  const visible = rect.bottom > 0 && rect.top < window.innerHeight - 40
  ui.commentToolbarVisible = visible
  if (!visible)
    return

  ui.commentToolbarTop = Math.max(8, Math.min(rect.top + 8, window.innerHeight - 56))
  ui.commentToolbarLeft = Math.max(8, Math.min(rect.left + 8, window.innerWidth - 340))
}

function markUpComments(items: HTMLElement[]): void {
  let upCount = 0
  for (const item of items) {
    const isUp = Boolean(findUpMark(item))
    if (isUp) {
      upCount++
      if (!item.hasAttribute('data-bewly-comment-up'))
        item.setAttribute('data-bewly-comment-up', '')
    }
    else if (item.hasAttribute('data-bewly-comment-up')) {
      item.removeAttribute('data-bewly-comment-up')
    }
  }
  ui.commentUpAvailable = upCount > 0
  applyOnlyUpState()
}

/** 每个 500ms 同步拍调用一次；DOM 变化时也能靠它收敛 */
export function syncComments(): void {
  const root = findCommentRoot()
  ui.commentFound = Boolean(root)

  if (!root) {
    ui.commentSortAvailable = false
    ui.commentToolbarVisible = false
    ui.commentUpAvailable = false
    if (ui.commentFoldButtons.length)
      ui.commentFoldButtons = []
    clampedItems.clear()
    applyOnlyUpState()
    return
  }

  const items = getReplyItems()
  markUpComments(items)

  // 分页 / 切排序后旧评论会从 DOM 移除：顺手停掉观察，避免 ResizeObserver 长期持有旧节点
  for (const observed of Array.from(observedItems)) {
    if (observed.isConnected)
      continue
    resizeObserver?.unobserve(observed)
    observedItems.delete(observed)
  }

  const tabs = getSortTabs()
  ui.commentSortAvailable = Boolean(tabs.hot && tabs.latest)
  const active = getActiveSort()
  if (ui.commentActiveSort !== active)
    ui.commentActiveSort = active

  for (const item of items) {
    observeItem(item)
    if (!item.hasAttribute('data-bewly-comment-fold-checked')) {
      evaluateFold(item)
      item.setAttribute('data-bewly-comment-fold-checked', '')
    }
  }

  updateToolbarPosition(root)
  refreshFoldPositions()
}

/** 滚动 / 尺寸变化时只更新 fixed 按钮与工具条坐标 */
function schedulePositionUpdate(): void {
  if (rafId)
    return
  rafId = window.requestAnimationFrame(() => {
    rafId = 0
    const root = findCommentRoot()
    if (root)
      updateToolbarPosition(root)
    refreshFoldPositions()
  })
}

export function setupComments(): () => void {
  ui.commentsOnlyUp = readStoredOnlyUp()
  applyOnlyUpState()

  window.addEventListener('scroll', schedulePositionUpdate, { passive: true })
  window.addEventListener('resize', schedulePositionUpdate, { passive: true })
  syncComments()

  disposeListeners = () => {
    window.removeEventListener('scroll', schedulePositionUpdate)
    window.removeEventListener('resize', schedulePositionUpdate)
    if (rafId) {
      window.cancelAnimationFrame(rafId)
      rafId = 0
    }
    resizeObserver?.disconnect()
    resizeObserver = null
    observedItems.clear()
    clampedItems.clear()
    ui.commentsOnlyUp = false
    applyOnlyUpState()
    for (const attr of ALL_ATTRS)
      document.querySelectorAll<HTMLElement>(`[${attr}]`).forEach(node => node.removeAttribute(attr))
    ui.commentFoldButtons = []
    ui.commentToolbarVisible = false
    ui.commentFound = false
  }
  return disposeListeners
}

export function teardownComments(): void {
  disposeListeners?.()
  disposeListeners = null
}
// #endregion
