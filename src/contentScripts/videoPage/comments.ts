/**
 * 视频页评论区增强：排序快捷 / 只看 UP 主 / 长评论折叠。
 *
 * ⚠️ 真实评论区是 **Web Components + shadow DOM**（2026-11 实测）：
 *
 * ```
 * #commentapp
 *   └─ bili-comments (shadowRoot)
 *        ├─ bili-comments-header-renderer (shadowRoot)
 *        │    └─ #navbar → #title / #sort-actions → bili-text-button（最热 / 最新）
 *        └─ bili-comment-thread-renderer × N (shadowRoot)
 *             ├─ bili-comment-renderer (shadowRoot)
 *             │    ├─ #header → bili-comment-user-info (shadowRoot) → #user-name / #user-up
 *             │    ├─ #content
 *             │    └─ #footer
 *             └─ #replies ...
 * ```
 *
 * 因此页面级 CSS 选不到任何目标节点：隐藏 / 折叠样式必须**注入到对应 shadow root**
 * （`bili-comments` 的 shadow 管线程显隐；每个 `bili-comment-renderer` 的 shadow 管正文折叠），
 * 并且只靠我们打在宿主元素上的属性（`data-bewly-*`）生效，一旦还原属性 / 移除 style 就完全恢复原样。
 *
 * 增强 UI（工具条 / 展开按钮）仍在 videoPage 的 shadow 浮层里，按 #navbar / thread 的 rect 固定定位。
 */
import { showToast } from './actions'
import { getMessages } from './i18n'
import { ui } from './state'

export type CommentSortKind = 'hot' | 'latest'

const COMMENTS_HOST_SELECTOR = 'bili-comments'
const HEADER_EL_SELECTOR = 'bili-comments-header-renderer'
const THREAD_EL_SELECTOR = 'bili-comment-thread-renderer'
const RENDERER_EL_SELECTOR = 'bili-comment-renderer'
const USER_INFO_EL_SELECTOR = 'bili-comment-user-info'

const HOT_TEXT_RE = /最热|热门/
const LATEST_TEXT_RE = /最新/
const ACTIVE_TOKEN_RE = /(?:^|[-_])(?:active|selected|current|checked)(?:[-_]|$)/i

const ONLY_UP_ROOT_CLASS = 'bewly-comments-only-up'
const ONLY_UP_STORAGE_KEY = 'bewly-comments-only-up'
const ONLY_UP_HOST_ATTR = 'data-bewly-only-up'
const UP_ATTR = 'data-bewly-comment-up'
const CLAMPED_ATTR = 'data-bewly-comment-clamped'
const EXPANDED_ATTR = 'data-bewly-comment-expanded'
const FOLD_ID_ATTR = 'data-bewly-comment-fold-id'

const COMMENTS_STYLE_ID = 'bewly-comments-style'
/** 「只看 UP 主」按钮（第 36 轮并入原生排序行） */
const ONLY_UP_BUTTON_ID = 'bewly-comment-only-up'
const FILTER_STYLE_ID = 'bewly-comment-filter-style'
/** 未登录空态块（登录后查看 N 条评论 / 没有更多评论）的注入样式（第 39 轮） */
const NOTICE_STYLE_ID = 'bewly-comments-notice-style'
/** 头部登录胶囊（第 40 轮） */
const LOGIN_PILL_ID = 'bewly-comments-login-pill'
const LOGIN_STYLE_ID = 'bewly-comments-login-style'
const FOLD_STYLE_ID = 'bewly-comment-fold-style'
const TEXT_STYLE_ID = 'bewly-comment-text-style'

/** >400px 的长评论默认折叠 */
const FOLD_HEIGHT = 400
const FOLD_BUTTON_HEIGHT = 32
const FOLD_BUTTON_WIDTH = 88
const OBSERVE_THROTTLE = 300

/** 注入到 bili-comments shadow：只看 UP 时隐藏没有标记的线程 */
const COMMENTS_STYLE = `
:host([${ONLY_UP_HOST_ATTR}]) ${THREAD_EL_SELECTOR}:not([${UP_ATTR}="1"]) {
  display: none !important;
}

/*
 * 第 45 轮：评论 header 与 UP 卡左右边缘对齐。
 *
 * UP 卡是 .bewly-comment-column 的直接子元素（滚动容器外），宽度 = 列宽 − 24；
 * header 在 #commentapp 里，被纵向滚动条挤掉约 8px，右边缘比 UP 卡少约 10px。
 * 用 --bewly-comment-scrollbar（comments.ts 每拍实测 offsetWidth − clientWidth）把 header
 * 宿主向右补偿回来，并统一左右 padding 12px（= --bvp-space-3），
 * 使 header.left = col.left + 12、header.right = col.right − 12，与 UP 卡同轴。
 */
bili-comments-header-renderer {
  display: block;
  box-sizing: border-box;
  width: calc(100% + var(--bewly-comment-scrollbar, 0px));
  margin-right: calc(-1 * var(--bewly-comment-scrollbar, 0px));
  padding-inline: 12px;
  /* 第 47 轮：UP 卡底边到「评论 N」这一行的间距 = 13px（与卡片左右边距一致，对称） */
  padding-block-start: 13px;
}
`

/** 注入到每个 bili-comment-renderer shadow：折叠正文（用 mask 渐隐，不依赖颜色变量） */
const FOLD_STYLE = `
:host([${CLAMPED_ATTR}]) #content {
  max-height: ${FOLD_HEIGHT}px;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(to bottom, #000 62%, transparent);
  mask-image: linear-gradient(to bottom, #000 62%, transparent);
}
:host([${EXPANDED_ATTR}]) #content {
  max-height: none !important;
  overflow: visible !important;
  -webkit-mask-image: none !important;
  mask-image: none !important;
}
`

/**
 * 注入到 `bili-comments-header-renderer` shadow：让「只看 UP 主」与原生排序同排版。
 *
 * 第 36 轮用户要求：把「只看 UP 主」内化进评论区筛选行（最热 | 最新 | 只看 UP 主），
 * 去掉我们独立浮在评论区左上的工具条。按钮用和原生排序相同的 `bili-text-button` 标签，
 * 继承 B 站自己的按钮样式，这里只补间距、光标、激活 / 禁用态（高亮用 currentColor / --bew-brand，
 * 不新增颜色）。
 */
const FILTER_STYLE = `
#navbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  margin-inline: 0;
  padding-inline: 0;
}
#sort-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
#${ONLY_UP_BUTTON_ID} {
  cursor: pointer;
  font: inherit;
  font-size: inherit;
  line-height: inherit;
  color: inherit;
  background: none;
  border: 0;
}
#${ONLY_UP_BUTTON_ID}[aria-pressed="true"] {
  color: var(--bew-brand, currentColor);
  font-weight: 600;
}
#${ONLY_UP_BUTTON_ID}[aria-disabled="true"] {
  cursor: not-allowed;
  opacity: 0.55;
}
`

/**
 * 评论内容宽度自适应规则（第 46 轮，与 native-style 的页面级 `@container bewly-comments` 配套）。
 *
 * 页面 CSS 只能约束到宿主容器，评论正文 / 头像 / 子评论缩进 / 多图网格都在 shadow 里，
 * 必须在「向评论 shadow 注入 style」通道里补等价规则：
 * - 头像固定 40（窄列 32），文字区 flex 1 1 auto + min-width 0；
 * - 正文保留第 34 轮的 420 行长上限，左对齐；
 * - 子评论缩进跟随头像宽 + gap；多图用 auto-fill 网格随列宽自动排。
 *
 * 容器是页面级 `.bewly-comment-column`（`container-name: bewly-comments`），跨 shadow 仍生效，
 * 所以拖拽分隔条调宽时这里的分支会实时切换。
 */
const COMMENTS_RESPONSIVE_STYLE_ID = 'bewly-comments-responsive-style'
const COMMENTS_RESPONSIVE_STYLE = `
.reply-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  min-width: 0;
}
.reply-item .root-reply-avatar,
.reply-item .sub-user-avatar {
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
}
.reply-item #content,
.reply-content {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 420px;
  overflow-wrap: anywhere;
}
.sub-reply-container {
  padding-left: 48px;
}
.reply-item img,
.reply-content img {
  max-width: 100%;
  height: auto;
}
.picture-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}
@container bewly-comments (max-width: 519px) {
  .reply-item .root-reply-avatar,
  .reply-item .sub-user-avatar {
    width: 32px;
    height: 32px;
  }
  .sub-reply-container {
    padding-left: 40px;
  }
  .picture-container {
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  }
}
@container bewly-comments (min-width: 901px) {
  .picture-container {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }
}
`

/**
 * 注入到每个 `bili-comment-renderer` shadow：评论正文排版（第 34 轮）。
 *
 * 为什么必须注入到这里：B 站评论正文在 `bili-comment-renderer` 的 **shadow root** 里，
 * 页面级 CSS 与 `bili-comments` 的样式都选不到它 —— native-style 在页面级写的
 * `max-width: 420px` 实际是不生效的（行长收口失败）。
 *
 * 只作用于正文容器 `#content`：header（UP 名）/ footer（时间戳、操作按钮）走 meta 档，不受影响。
 */
const TEXT_STYLE = `
#content {
  max-width: 420px;
}
/* 字号 / 行高必须 !important：B 站自己的样式表也在 renderer 的 shadow 里，
   且可能在我们的 <style> 之后插入（真机复测：max-width 生效但 font-size 仍是 15px）。 */
#content,
#content * {
  font-size: 14px !important;
  line-height: 1.65 !important;
}
`

/**
 * 注入到 `bili-comments` shadow：未登录空态块的低调样式（第 39 轮）。
 *
 * 真机结构（未登录时）：
 * - 「登录后查看 20 条评论」：div，B 站自己给了青色半透明底（oklab(...0.2)）+ 主色字，就是截图里那块；
 * - 「没有更多评论」：div.bottombar，高 120（原文案只有 13px，空白巨大）；
 * - 外层包裹 div 高 350，含大片空白。
 *
 * 样式全部走类名（由 `markCommentsNotice()` 打标记），因为 B 站类名带哈希、不能写死选择器。
 * 颜色只用现有变量（--bew-brand / --bew-text-3），不引入新颜色。
 */
const NOTICE_STYLE = `
.bewly-comments-notice {
  display: flex !important;
  flex-direction: column !important;
  gap: 8px !important;
  align-items: center !important;
  justify-content: center !important;
  box-sizing: border-box !important;
  width: 100% !important;
  height: auto !important;
  min-height: 0 !important;
  /* 高度预算：padding 12*2 + 胶囊 32 + gap 8 + 「没有更多」约 27 ≈ 91（目标 ≤100） */
  padding-block: 12px !important;
  margin: 0 !important;
  text-align: center !important;
  background: none !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

/* B 站占位 / 骨架块（真机里一个匿名 div 高 300）：
   去掉它的高度与内边距；确实空的（无文本、无子元素）直接不渲染。 */
.bewly-comments-notice > div:not(.bewly-comments-login):not(.bewly-comments-bottom):not(.bewly-comments-end) {
  height: auto !important;
  min-height: 0 !important;
  max-height: none !important;
  padding-block: 0 !important;
  margin-block: 0 !important;
  overflow: hidden !important;
}

.bewly-comments-notice > div:not(.bewly-comments-login):not(.bewly-comments-bottom):not(.bewly-comments-end):empty {
  display: none !important;
}

/* JS 判定为「无文本占位」的节点（:empty 判不出来、但没有任何可见文案） */
.bewly-comments-login-origin,
.bewly-comments-login-origin-block {
  display: none !important;
}

.bewly-comments-placeholder {
  display: none !important;
  height: 0 !important;
  min-height: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
}

/* 外层匿名包裹（真机 h=540、padding-top 14）：只压高度，不动其它视觉 */
.bewly-comments-notice-outer {
  height: auto !important;
  min-height: 0 !important;
  max-height: none !important;
  padding-block: 0 !important;
  margin-block: 0 !important;
}

.bewly-comments-login {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  box-sizing: border-box !important;
  width: auto !important;
  height: 32px !important;
  padding: 0 16px !important;
  font-size: 14px !important;
  font-weight: 500 !important;
  line-height: 1 !important;
  /* 深色主题下 B 站会把它设为白色（--text_white 一类变量），必须 !important + 明确主色变量。
     --bew-brand 在本仓库并不存在（上一版用了它 → 回退 currentColor → 白色），改用 --bew-theme-color。 */
  color: var(--bew-theme-color, var(--bew-bili-blue, currentColor)) !important;
  text-decoration: none !important;
  white-space: nowrap !important;
  cursor: pointer;
  background: transparent !important;
  border: 1px solid var(--bew-theme-color, var(--bew-bili-blue, currentColor)) !important;
  border-radius: 16px !important;
  transition: background-color 160ms ease, color 160ms ease;
}

.bewly-comments-login:hover,
.bewly-comments-login:focus-visible {
  background: color-mix(in oklab, var(--bew-theme-color, var(--bew-bili-blue, currentColor)) 12%, transparent) !important;
}

.bewly-comments-bottom {
  height: auto !important;
  min-height: 0 !important;
  max-height: none !important;
  /* 真机 120 → 4px 上下留白 + 一行 12.5px 文案 ≈ 27 */
  padding-block: 4px !important;
  margin: 0 !important;
}

.bewly-comments-end {
  margin: 0 !important;
  font-size: 12.5px !important;
  font-weight: 400 !important;
  line-height: 1.5 !important;
  color: var(--bew-text-3, currentColor) !important;
  white-space: nowrap !important;
}
`

/**
 * 注入到 `bili-comments-header-renderer` shadow：头部行右侧的登录胶囊（第 40 轮）。
 *
 * 用户要求把「登录后查看 N 条评论」的入口从评论底部挪到与「评论 N | 最热 | 最新 | 只看 UP 主」同一行的最右侧，
 * 样式复用第 39 轮的胶囊规范（h 32 / radius 16 / 主色描边 + 主色文字 / 透明底 / 14px）。
 *
 * 颜色只用仓库已定义的主色变量（`--bew-theme-color` → `--bew-bili-blue` 兜底），不引入新颜色。
 */
const LOGIN_PILL_STYLE = `
/* 只保证 header 是「一行 flex」，让 margin-left:auto 能把胶囊推到最右；
   不加 gap，避免改变 B 站原生「评论 N | 最热 | 最新」的间距。 */
#navbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

#${LOGIN_PILL_ID} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  height: 32px;
  margin-left: auto;
  margin-right: 0;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  color: var(--bew-theme-color, var(--bew-bili-blue, currentColor)) !important;
  background: transparent !important;
  border: 1px solid var(--bew-theme-color, var(--bew-bili-blue, currentColor)) !important;
  border-radius: 16px !important;
  transition: background-color 160ms ease;
}

#${LOGIN_PILL_ID}:hover,
#${LOGIN_PILL_ID}:focus-visible {
  background: color-mix(in oklab, var(--bew-theme-color, var(--bew-bili-blue, currentColor)) 12%, transparent) !important;
}
`

let observer: MutationObserver | null = null
let observeTimer: number | null = null
let rafId = 0
let nextFoldId = 1
/** 折叠按钮 id → 渲染器 / 线程宿主 */
const foldTargets = new Map<number, { renderer: HTMLElement, thread: HTMLElement }>()
/** 已注入样式 / 已打标记的节点，卸载时清理 */
const styledShadows = new Set<ShadowRoot>()
const touchedThreads = new Set<HTMLElement>()
const touchedRenderers = new Set<HTMLElement>()
/** 已经处理过的线程（命中 UP 标识 / 折叠判定的结果都落在属性上） */
const processedThreads = new WeakSet<HTMLElement>()
/** 当前仍连着 DOM 的 UP 线程；用来判断「只看 UP」是否可用 */
const upThreads = new Set<HTMLElement>()

// #region 增量处理（翻页 / 懒加载）
/** MutationObserver 收集到的、还没处理的新线程 */
const pendingThreads = new Set<HTMLElement>()
/** 需要全量重扫（容器被重建 / header 被替换 / shadow 换了） */
let pendingFullScan = false

function scheduleIncremental(): void {
  if (observeTimer !== null)
    window.clearTimeout(observeTimer)
  observeTimer = window.setTimeout(() => {
    observeTimer = null
    if (pendingFullScan) {
      pendingFullScan = false
      pendingThreads.clear()
      syncComments()
      return
    }

    const threads = Array.from(pendingThreads)
    pendingThreads.clear()
    if (!threads.length)
      return

    for (const thread of threads) {
      if (thread.isConnected)
        processThread(thread)
    }

    pruneDisconnected()
    ui.commentUpAvailable = upThreads.size > 0
    applyOnlyUpState()

    // 新线程可能伴随排序 / 布局变化：只做轻量刷新，不做全量扫描
    const buttons = getSortButtons()
    ui.commentSortAvailable = Boolean(buttons.hot && buttons.latest)
    const active = getActiveSort()
    if (ui.commentActiveSort !== active)
      ui.commentActiveSort = active

    updateToolbarPosition()
    refreshFoldPositions()
  }, OBSERVE_THROTTLE)
}
// #endregion
let styledCommentsShadow: ShadowRoot | null = null
let disposeListeners: (() => void) | null = null

function messages() {
  return getMessages()
}

// #region 探测（穿透 shadow DOM）
function getCommentsHost(): HTMLElement | null {
  const app = document.querySelector('#commentapp') ?? document.querySelector('#comment') ?? document
  return app.querySelector<HTMLElement>(COMMENTS_HOST_SELECTOR)
    ?? document.querySelector<HTMLElement>(COMMENTS_HOST_SELECTOR)
}

function getCommentsShadow(): ShadowRoot | null {
  return getCommentsHost()?.shadowRoot ?? null
}

function getHeaderEl(): HTMLElement | null {
  return getCommentsShadow()?.querySelector<HTMLElement>(HEADER_EL_SELECTOR) ?? null
}

function getHeaderShadow(): ShadowRoot | null {
  return getHeaderEl()?.shadowRoot ?? null
}

/** 评论区排序容器（#sort-actions，class 里带 hot / latest） */
function getSortActions(): HTMLElement | null {
  return getHeaderShadow()?.querySelector<HTMLElement>('#sort-actions') ?? null
}

function getSortButtonElements(): HTMLElement[] {
  const actions = getSortActions()
  if (!actions)
    return []

  return Array.from(actions.querySelectorAll<HTMLElement>('bili-text-button, button, [role="button"]'))
    .filter(el => (el.textContent?.trim() ?? '').length > 0)
}

function getThreads(): HTMLElement[] {
  const shadow = getCommentsShadow()
  if (!shadow)
    return []
  return Array.from(shadow.querySelectorAll<HTMLElement>(THREAD_EL_SELECTOR))
}

function getRenderer(thread: HTMLElement): HTMLElement | null {
  return thread.shadowRoot?.querySelector<HTMLElement>(RENDERER_EL_SELECTOR) ?? null
}

function getRendererContent(renderer: HTMLElement): HTMLElement | null {
  return renderer.shadowRoot?.querySelector<HTMLElement>('#content') ?? null
}

/** UP 主标识：#user-up 只存在于 UP 本人的评论（位于 bili-comment-user-info 的 shadow 内） */
function threadHasUpBadge(thread: HTMLElement): boolean {
  const renderer = getRenderer(thread)
  const userInfo = renderer?.shadowRoot?.querySelector<HTMLElement>(USER_INFO_EL_SELECTOR)
  return Boolean(userInfo?.shadowRoot?.querySelector('#user-up'))
}

function getNavbarEl(): HTMLElement | null {
  return getHeaderShadow()?.querySelector<HTMLElement>('#navbar') ?? null
}
// #endregion

// #region shadow 样式注入
function ensureStyleInShadow(shadow: ShadowRoot, id: string, css: string): void {
  if (shadow.getElementById(id) as HTMLElement | null)
    return
  const style = document.createElement('style')
  style.id = id
  style.textContent = css
  shadow.appendChild(style)
}

function removeStyleFromShadow(shadow: ShadowRoot, id: string): void {
  shadow.getElementById(id)?.remove()
}

/** 「只看 UP 主」按钮的激活 / 禁用状态同步（幂等，每拍调用） */
function syncOnlyUpButtonState(btn: HTMLElement): void {
  const label = messages().commentsOnlyUp
  if (btn.textContent !== label)
    btn.textContent = label

  const pressed = ui.commentsOnlyUp && ui.commentUpAvailable
    ? 'true'
    : 'false'
  if (btn.getAttribute('aria-pressed') !== pressed)
    btn.setAttribute('aria-pressed', pressed)

  const disabled = ui.commentUpAvailable ? 'false' : 'true'
  if (btn.getAttribute('aria-disabled') !== disabled)
    btn.setAttribute('aria-disabled', disabled)
  if (btn.tabIndex !== (ui.commentUpAvailable
    ? 0
    : -1)) {
    btn.tabIndex = ui.commentUpAvailable
      ? 0
      : -1
  }

  const title = ui.commentUpAvailable
    ? messages().commentsOnlyUp
    : messages().commentsUpUnavailable
  if (btn.getAttribute('title') !== title)
    btn.setAttribute('title', title)
}

/**
 * 在原生排序行（#sort-actions）之后注入「只看 UP 主」按钮（第 36 轮）。
 *
 * 幂等：按钮已在就只同步状态；B 站重建 header（切视频 / 切排序）后会重新注入。
 * 点击沿用 `toggleCommentsOnlyUp()`，键盘 Enter / Space 同样可触发。
 */
function ensureOnlyUpButton(): void {
  const shadow = getHeaderShadow()
  const actions = getSortActions()
  if (!shadow || !actions)
    return

  ensureStyleInShadow(shadow, FILTER_STYLE_ID, FILTER_STYLE)

  let btn = shadow.getElementById(ONLY_UP_BUTTON_ID) as HTMLElement | null
  if (!btn || !btn.isConnected) {
    btn = document.createElement('bili-text-button')
    btn.id = ONLY_UP_BUTTON_ID
    btn.setAttribute('role', 'button')
    btn.tabIndex = 0
    btn.addEventListener('click', () => toggleCommentsOnlyUp())
    btn.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ')
        return
      event.preventDefault()
      toggleCommentsOnlyUp()
    })
    // 追加在原生「最热 / 最新」之后
    actions.appendChild(btn)
  }

  // B 站重建 #sort-actions 后按钮可能被挤到别处：拉回排序行末尾
  if (btn.parentElement !== actions)
    actions.appendChild(btn)

  syncOnlyUpButtonState(btn)
}

/** 未登录空态文案匹配 */
const LOGIN_NOTICE_RE = /登录后查看/
const END_NOTICE_RE = /没有更多评论/

/** 在 bili-comments（含直接子组件的 shadow）里找原始登录入口 */
function findLoginOrigin(): { el: HTMLElement, text: string } | null {
  const roots: ShadowRoot[] = []
  const shell = getCommentsShadow()
  if (shell) {
    roots.push(shell)
    for (const child of Array.from(shell.children)) {
      const shadow = (child as HTMLElement).shadowRoot
      if (shadow)
        roots.push(shadow)
    }
  }
  for (const root of roots) {
    const found = findNoticeText(root, LOGIN_NOTICE_RE)
    if (!found)
      continue
    const el = found.closest<HTMLElement>('a, button') ?? found
    return {
      el,
      text: (found.textContent ?? '').replace(/\s+/g, ' ').trim(),
    }
  }
  return null
}

/**
 * 把登录入口挪到评论头部行最右侧（第 40 轮）。
 *
 * - 未登录：在 `#navbar`（含「评论 N」+ `#sort-actions` 的那一行）末尾插入胶囊，`margin-left: auto` 推到最右；
 * - 已登录：找不到登录文案 → 移除胶囊；
 * - 点击 = 触发 B 站原有登录入口（`.click()`），**不自己拼登录 URL**；
 * - 每拍幂等：header 被 B 站重建后重新插入。
 */
function ensureHeaderLoginPill(): void {
  const headerShadow = getHeaderShadow()
  if (!headerShadow)
    return

  const origin = findLoginOrigin()
  const existing = headerShadow.getElementById(LOGIN_PILL_ID) as HTMLElement | null

  // 已登录 / 找不到入口：移除胶囊
  if (!origin) {
    existing?.remove()
    return
  }

  const navbar = headerShadow.querySelector<HTMLElement>('#navbar')
    ?? getSortActions()?.parentElement
    ?? null
  if (!navbar)
    return

  ensureStyleInShadow(headerShadow, LOGIN_STYLE_ID, LOGIN_PILL_STYLE)

  let pill = existing
  if (!pill || !pill.isConnected) {
    pill = document.createElement('button')
    pill.id = LOGIN_PILL_ID
    pill.setAttribute('type', 'button')
    // 只显示「登录」，完整文案放 title / aria-label（胶囊太长会破坏 header 行）
    pill.textContent = '登录'
    pill.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      // 触发 B 站自己的登录入口，不自己拼 URL
      findLoginOrigin()?.el.click()
    })
    navbar.appendChild(pill)
  }

  // header 被重建后胶囊可能被挤走：拉回行尾
  if (pill.parentElement !== navbar)
    navbar.appendChild(pill)

  const title = origin.text
  if (pill.getAttribute('title') !== title)
    pill.setAttribute('title', title)
  if (pill.getAttribute('aria-label') !== title)
    pill.setAttribute('aria-label', title)
}

/** 在 shadow 里找「只包含这段文案」的最内层元素 */
function findNoticeText(shadow: ShadowRoot, re: RegExp): HTMLElement | null {
  const candidates = shadow.querySelectorAll<HTMLElement>('div, a, p, span, button')
  for (const el of Array.from(candidates)) {
    const text = (el.textContent ?? '').trim()
    if (!text || !re.test(text))
      continue
    // 跳过「子元素里也含这段文案」的父级
    const nested = Array.from(el.children)
      .some(child => re.test((child.textContent ?? '').trim()))
    if (nested)
      continue
    return el
  }
  return null
}

/**
 * 给未登录空态块打标记（第 39 轮）。
 *
 * 幂等：每拍扫一次，B 站登录态变化 / 评论数量变化后自动重新标记。
 * 注意只标记「不含评论线程」的容器，避免误伤整个评论区。
 */
function markCommentsNoticeInRoot(root: ShadowRoot): void {
  ensureStyleInShadow(root, NOTICE_STYLE_ID, NOTICE_STYLE)

  const loginText = findNoticeText(root, LOGIN_NOTICE_RE)
  const endText = findNoticeText(root, END_NOTICE_RE)
  if (!loginText && !endText)
    return

  const loginEl = loginText
    ? (loginText.closest<HTMLElement>('a') ?? loginText)
    : null
  if (loginEl) {
    // 第 40 轮：登录入口已挪到评论头部行右侧，底部这份隐藏掉（保留节点给胶囊做 click 目标）
    loginEl.classList.add('bewly-comments-login-origin')
    const originBlock = loginEl.parentElement
    if (originBlock && !originBlock.querySelector(THREAD_EL_SELECTOR))
      originBlock.classList.add('bewly-comments-login-origin-block')
  }

  // B 站把「青蓝底」画在按钮外面的一层容器上（真机 div h=50 w=698 bg=oklab(...0.2)），
  // 只清按钮自己的背景不够：把按钮 / 文案的父级也按空态容器处理（最多两层，且不含评论线程）。
  for (const anchorEl of [loginEl, endText]) {
    let parent = anchorEl?.parentElement ?? null
    for (let depth = 0; depth < 2 && parent; depth++) {
      if (parent.querySelector(THREAD_EL_SELECTOR))
        break
      parent.classList.add('bewly-comments-notice')
      parent = parent.parentElement
    }
  }

  let bottomEl: HTMLElement | null = null
  if (endText) {
    bottomEl = endText.closest<HTMLElement>('.bottombar') ?? endText
    bottomEl.classList.add('bewly-comments-bottom')
    endText.classList.add('bewly-comments-end')
  }

  // 外层包裹（真机 h=350 的大片空白）：登录 / 结束的公共祖先里，
  // 向上找「不含评论线程」的最外层容器（最多 4 层，避免把整个评论区标进去）
  const blocks = [loginEl, bottomEl].filter((el): el is HTMLElement => Boolean(el))
  if (!blocks.length)
    return
  let common: HTMLElement | null = blocks[0]
  while (common && blocks.some(block => !common!.contains(block)))
    common = common.parentElement
  if (!common)
    return

  let notice: HTMLElement | null = common
  let cursor: HTMLElement | null = common
  for (let depth = 0; depth < 4 && cursor; depth++) {
    if (cursor.querySelector(THREAD_EL_SELECTOR))
      break
    notice = cursor
    cursor = cursor.parentElement
  }
  if (notice && !notice.querySelector(THREAD_EL_SELECTOR))
    notice.classList.add('bewly-comments-notice')

  // 逐个检查 notice 的直接子节点：B 站会塞一个匿名占位 / 骨架 div（真机 h=300），
  // 它没有任何可见文本，:empty 判不出来 —— 主动标记后隐藏，让空态块高度回到 ~100 以内。
  if (notice) {
    for (const child of Array.from(notice.children)) {
      if (!(child instanceof HTMLElement))
        continue
      if (child.classList.contains('bewly-comments-login')
        || child.classList.contains('bewly-comments-bottom')
        || child.classList.contains('bewly-comments-end')) {
        continue
      }
      const text = (child.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (!text)
        child.classList.add('bewly-comments-placeholder')
    }

    // 外层匿名包裹（真机 h=540、padding-top 14）：只压高度，不动视觉。
    const outer = notice.parentElement
    if (outer && !outer.querySelector(THREAD_EL_SELECTOR))
      outer.classList.add('bewly-comments-notice-outer')
  }
}

/**
 * 给未登录空态块打标记（第 39 轮）。
 *
 * 幂等：每拍扫一次，B 站登录态变化 / 评论数量变化后自动重新标记。
 * 除了 bili-comments 自身的 shadow，也会扫它直接子组件的 shadow（B 站可能把
 * 登录提示放进 `bili-comments-footer` 之类的嵌套 Web Component）。
 */
function markCommentsNotice(): void {
  const shadow = getCommentsShadow()
  if (!shadow)
    return

  markCommentsNoticeInRoot(shadow)
  for (const child of Array.from(shadow.children)) {
    const childShadow = (child as HTMLElement).shadowRoot
    if (childShadow)
      markCommentsNoticeInRoot(childShadow)
  }
}

/** 第 45 轮：评论 header 的右边缘补偿量 = #commentapp 的纵向滚动条宽 */
const COMMENTS_SCROLLBAR_VAR = '--bewly-comment-scrollbar'

/**
 * 实测 `#commentapp` 的滚动条宽度并写到评论列（CSS 变量会继承进 bili-comments 的 shadow），
 * 供 header 宿主做宽度补偿，让它的右边缘与 UP 卡对齐。
 *
 * - 没有滚动条时写 0px，header 不补偿（短列表也正确）；
 * - 值不变不写，避免每拍触发样式重算。
 */
function syncCommentsScrollbarVar(): void {
  const app = document.querySelector<HTMLElement>('#commentapp')
  const column = document.querySelector<HTMLElement>('[data-bewly-comment-column], #bewly-comment-column')
  const target = column ?? app
  if (!app || !target)
    return

  const scrollbarWidth = Math.max(0, app.offsetWidth - app.clientWidth)
  const value = `${scrollbarWidth}px`
  if (target.style.getPropertyValue(COMMENTS_SCROLLBAR_VAR) !== value)
    target.style.setProperty(COMMENTS_SCROLLBAR_VAR, value)
}

/** 评论区骨架 / 空态（第 50 轮） */
const SKELETON_ID = 'bewly-comment-skeleton'
const EMPTY_ID = 'bewly-comment-empty'
/** 骨架最多显示多久（之后仍无线程 → 切空态） */
const SKELETON_HOLD_MS = 4000
/** 骨架开始显示的时间戳；null 表示当前没有骨架 */
let skeletonMountedAt: number | null = null

/** 评论列容器（不搬列时回退到 #commentapp 的父级） */
function getCommentColumnContainer(): HTMLElement | null {
  const column = document.querySelector<HTMLElement>('[data-bewly-comment-column], #bewly-comment-column')
  if (column)
    return column
  const app = document.getElementById('commentapp')
  return app?.parentElement instanceof HTMLElement
    ? app.parentElement
    : null
}

function removeCommentPlaceholder(): void {
  document.getElementById(SKELETON_ID)?.remove()
  document.getElementById(EMPTY_ID)?.remove()
  skeletonMountedAt = null
}

function buildSkeleton(): HTMLElement {
  const root = document.createElement('div')
  root.id = SKELETON_ID
  root.setAttribute('aria-hidden', 'true')
  for (let i = 0; i < 3; i++) {
    const row = document.createElement('div')
    row.className = 'bewly-comment-skeleton__row'
    const avatar = document.createElement('div')
    avatar.className = 'bewly-comment-skeleton__avatar'
    const lines = document.createElement('div')
    lines.className = 'bewly-comment-skeleton__lines'
    const title = document.createElement('div')
    title.className = 'bewly-comment-skeleton__line bewly-comment-skeleton__line--title'
    const body = document.createElement('div')
    body.className = 'bewly-comment-skeleton__line bewly-comment-skeleton__line--body'
    lines.append(title, body)
    row.append(avatar, lines)
    root.appendChild(row)
  }
  return root
}

function buildEmpty(): HTMLElement {
  const root = document.createElement('div')
  root.id = EMPTY_ID
  root.setAttribute('role', 'status')
  root.innerHTML = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-5 4V5.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>
  <span>还没有评论</span>`
  return root
}

/**
 * 评论区骨架 / 空态（第 50 轮）。
 *
 * 数据源是「当前线程数」，每拍调用：
 * - 有线 lookup → 立刻移除骨架与空态；
 * - 线程数 0 且未登录提示不存在 → 先显示 3 条骨架（1200ms 呼吸）；
 * - 骨架显示超过 4s 仍无线程 → 换成「还没有评论」空态（图标 + 12.5px 次要色）；
 * - 未登录（B 站自己的「登录后查看」提示存在）→ 两者都不加，避免和它抢位置。
 *
 * 值不变不写：骨架 / 空态节点存在与否就是状态，不做无意义 DOM 操作。
 */
function syncCommentPlaceholder(threadCount: number): void {
  const host = getCommentsHost()
  const app = document.getElementById('commentapp')
  const column = getCommentColumnContainer()
  if (!host || !app || !column || column.offsetWidth === 0 || column.offsetHeight === 0) {
    removeCommentPlaceholder()
    return
  }

  if (threadCount > 0 || findLoginOrigin()) {
    removeCommentPlaceholder()
    return
  }

  if (skeletonMountedAt === null) {
    if (!document.getElementById(SKELETON_ID)) {
      const skeleton = buildSkeleton()
      if (app.parentElement === column)
        column.insertBefore(skeleton, app)
      else
        column.appendChild(skeleton)
    }
    skeletonMountedAt = Date.now()
    document.getElementById(EMPTY_ID)?.remove()
    return
  }

  if (Date.now() - skeletonMountedAt >= SKELETON_HOLD_MS) {
    document.getElementById(SKELETON_ID)?.remove()
    if (!document.getElementById(EMPTY_ID) && app.parentElement === column)
      column.insertBefore(buildEmpty(), app)
  }
}

function ensureCommentsStyle(): void {
  const shadow = getCommentsShadow()
  if (!shadow)
    return
  ensureStyleInShadow(shadow, COMMENTS_STYLE_ID, COMMENTS_STYLE)
  ensureStyleInShadow(shadow, COMMENTS_RESPONSIVE_STYLE_ID, COMMENTS_RESPONSIVE_STYLE)
  styledCommentsShadow = shadow
}

/**
 * 给 renderer 的 shadow 注入样式：折叠（按需生效）+ 正文排版（常驻）。
 *
 * 两者共用同一个 style 注入通道（`ensureStyleInShadow`），在 `processThread` 里
 * 每个 renderer 都会走一次，因此懒加载 / 翻页 / 容器重建后的新线程也会被覆盖。
 */
function ensureRendererStyle(renderer: HTMLElement): void {
  const shadow = renderer.shadowRoot
  if (!shadow)
    return
  // 不要用「集合里已有 shadow 就跳过」：真机复测发现 renderer 的 shadow 里一个 style 都没有，
  // 说明这条路径当时根本没被走到。改成按 style id 判重（ensureStyleInShadow 内部判），
  // 幂等且能自愈「样式被外部移除 / shadow 被重建」。
  ensureStyleInShadow(shadow, FOLD_STYLE_ID, FOLD_STYLE)
  ensureStyleInShadow(shadow, TEXT_STYLE_ID, TEXT_STYLE)
  ensureStyleInShadow(shadow, COMMENTS_RESPONSIVE_STYLE_ID, COMMENTS_RESPONSIVE_STYLE)
  // B 站可能在我们的 style 之后又插入 <style>（同特异性后写胜）——把我们的挪到最后，
  // 每次调用都是幂等的，移动成本可以忽略（只是 appendChild 已有节点）。
  for (const id of [FOLD_STYLE_ID, TEXT_STYLE_ID]) {
    const el = shadow.getElementById(id)
    if (el && el !== shadow.lastElementChild)
      shadow.appendChild(el)
  }
  styledShadows.add(shadow)
}
// #endregion

// #region 排序
function isActiveButton(el: HTMLElement): boolean {
  if (el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-pressed') === 'true')
    return true
  return el.className
    .split(/\s+/)
    .some(token => ACTIVE_TOKEN_RE.test(token))
}

/** 原生排序按钮（最热 / 最新），按文本匹配 bili-text-button */
export function getSortButtons(): { hot: HTMLElement | null, latest: HTMLElement | null } {
  const buttons = getSortButtonElements()
  const pick = (re: RegExp) => buttons.find(el => re.test(el.textContent?.trim() ?? '')) ?? null
  return {
    hot: pick(HOT_TEXT_RE),
    latest: pick(LATEST_TEXT_RE),
  }
}

/** 当前排序：#sort-actions 的 class（真机是 .hot / .latest）优先，其次按钮 active 态 */
export function getActiveSort(): '' | CommentSortKind {
  const actions = getSortActions()
  if (actions) {
    const className = actions.className
    if (/latest|newest|new/i.test(className))
      return 'latest'
    if (/hot|popular|default/i.test(className))
      return 'hot'
  }

  const { hot, latest } = getSortButtons()
  if (latest && isActiveButton(latest))
    return 'latest'
  if (hot && isActiveButton(hot))
    return 'hot'
  return ''
}

/** 点原生排序按钮（bili-text-button），不自己发请求 */
export function clickCommentSort(kind: CommentSortKind): void {
  const button = getSortButtons()[kind]
  if (!button) {
    showToast(messages().commentsSortUnavailable)
    return
  }

  button.click()

  // 乐观更新，下一拍 sync 会用原生状态校正
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

/** 真正的显隐由注入到 bili-comments shadow 的样式 + 宿主属性决定 */
function applyOnlyUpState(): void {
  const host = getCommentsHost()
  const on = ui.commentsOnlyUp && ui.commentUpAvailable
  if (host)
    host.toggleAttribute(ONLY_UP_HOST_ATTR, on)
  document.documentElement.classList.toggle(ONLY_UP_ROOT_CLASS, on)
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
function setClamped(renderer: HTMLElement, thread: HTMLElement): number {
  ensureRendererStyle(renderer)
  renderer.setAttribute(CLAMPED_ATTR, '')
  touchedRenderers.add(renderer)

  const existing = Number(thread.getAttribute(FOLD_ID_ATTR) ?? '')
  if (existing && foldTargets.has(existing)) {
    foldTargets.set(existing, { renderer, thread })
    return existing
  }

  const id = nextFoldId++
  thread.setAttribute(FOLD_ID_ATTR, String(id))
  touchedThreads.add(thread)
  foldTargets.set(id, { renderer, thread })
  return id
}

function clearFold(renderer: HTMLElement, thread: HTMLElement): void {
  const id = Number(thread.getAttribute(FOLD_ID_ATTR) ?? '')
  renderer.removeAttribute(CLAMPED_ATTR)
  thread.removeAttribute(FOLD_ID_ATTR)
  if (id)
    foldTargets.delete(id)
}

/** 单条评论的折叠判定：正文 > 400px 且没有展开 */
function evaluateFold(thread: HTMLElement, renderer: HTMLElement): void {
  const content = getRendererContent(renderer)
  if (!content)
    return

  if (renderer.hasAttribute(EXPANDED_ATTR))
    return

  // 必须用 scrollHeight：折叠后 #content 的 rect 高度只有 400，用它判断会在
  // 「折叠 → 高度 <=400 → 取消折叠 → 高度恢复」之间每拍抖动
  const height = content.scrollHeight > 0
    ? content.scrollHeight
    : content.getBoundingClientRect().height
  if (height > FOLD_HEIGHT) {
    setClamped(renderer, thread)
  }
  else if (renderer.hasAttribute(CLAMPED_ATTR)) {
    clearFold(renderer, thread)
  }
}

/** 展开按钮 fixed 定位：按 thread 矩形算，只保留视口内的 */
function refreshFoldPositions(): void {
  // 第 37 轮：网页全屏 / 宽屏时评论列被 display:none，线程 rect 全为 0，
  // 继续计算会把展开按钮摆到视口左上角 —— 直接清空。
  const columnEl = document.querySelector<HTMLElement>('[data-bewly-comment-column], #bewly-comment-column')
  if (columnEl && (columnEl.offsetWidth === 0 || columnEl.offsetHeight === 0)) {
    if (ui.commentFoldButtons.length)
      ui.commentFoldButtons = []
    return
  }

  const next: { id: number, top: number, left: number }[] = []
  for (const [id, { thread }] of foldTargets) {
    if (!thread.isConnected) {
      foldTargets.delete(id)
      continue
    }

    const rect = thread.getBoundingClientRect()
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
    || next.some((button, index) => {
      const prev = ui.commentFoldButtons[index]
      return !prev
        || prev.id !== button.id
        || Math.abs(prev.top - button.top) > 0.5
        || Math.abs(prev.left - button.left) > 0.5
    })
  if (changed)
    ui.commentFoldButtons = next
}

export function expandComment(id: number): void {
  const target = foldTargets.get(id)
  if (!target)
    return

  target.renderer.setAttribute(EXPANDED_ATTR, '')
  target.renderer.removeAttribute(CLAMPED_ATTR)
  target.thread.removeAttribute(FOLD_ID_ATTR)
  touchedRenderers.add(target.renderer)
  foldTargets.delete(id)
  refreshFoldPositions()
}
// #endregion

// #region 同步 / 生命周期
/**
 * 评论工具条定位。
 *
 * 第 29 轮修正：**锚定评论列容器**（`[data-bewly-comment-column]`）而不是视口里的 #navbar。
 *
 * 为什么改：评论区搬到右列后是独立滚动容器，内部 #navbar 会随评论列表滚动而移动，
 * 按它算 top 会让工具条（连同「只看 UP 主」按钮）跟着上下滑动，看起来像在「鬼畜」。
 * 锚定容器后，工具条固定在评论列顶部，只有评论列本身改变位置时才会移动。
 *
 * 工具条本身是 fixed 浮层，写它的 top 不会回流到页面布局，因此不存在反馈环；
 * 这里仍对 top / left 做 0.5px 内的抖动抑制，避免亚像素误差导致每拍重渲染。
 */
function getCommentColumnEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-bewly-comment-column]')
    ?? document.querySelector<HTMLElement>('#bewly-comment-column')
}

function updateToolbarPosition(): void {
  const column = getCommentColumnEl()
  const navbar = getNavbarEl()
  const anchor = column ?? navbar
  if (!anchor) {
    ui.commentToolbarVisible = false
    return
  }

  const rect = anchor.getBoundingClientRect()
  const inView = rect.bottom > 0 && rect.top < window.innerHeight - 40
  ui.commentToolbarVisible = inView
  if (!inView)
    return

  // 贴评论列左上角（原生排序 tab 在上方，不遮挡）。
  // 第 30 轮：评论列宽度随播放器宽度变化（空出的宽度补给评论区），这里始终用容器自身的
  // rect.left，因此左对齐会自动跟着右列左边缘走，不会停留在原来的 350px 列位置。
  const top = Math.max(8, Math.min(Math.round(rect.top) + 8, window.innerHeight - 56))
  const left = Math.max(8, Math.round(rect.left) + 8)

  if (Math.abs(ui.commentToolbarTop - top) > 0.5)
    ui.commentToolbarTop = top
  if (Math.abs(ui.commentToolbarLeft - left) > 0.5)
    ui.commentToolbarLeft = left
}

/**
 * 处理单个线程：标记 UP、判定长评论折叠。
 *
 * 全量扫描与增量路径都调用它，因此「翻页 / 加载更多 / 容器重建」后新线程会被自动
 * 套用用户已有的选择（只看 UP 通过宿主属性 + 注入样式生效，折叠通过 renderer 属性生效）。
 */
function processThread(thread: HTMLElement): void {
  touchedThreads.add(thread)

  if (threadHasUpBadge(thread)) {
    if (thread.getAttribute(UP_ATTR) !== '1')
      thread.setAttribute(UP_ATTR, '1')
    upThreads.add(thread)
  }
  else {
    if (thread.hasAttribute(UP_ATTR))
      thread.removeAttribute(UP_ATTR)
    upThreads.delete(thread)
  }

  const renderer = getRenderer(thread)
  if (renderer) {
    // 正文排版（14px / 1.65 / max-width 420）必须**无条件**注入到每个 renderer 的 shadow：
    // 之前只在 setClamped()（长评论折叠）里注入，短评论根本没有 style（第 34 轮真机复测根因）。
    ensureRendererStyle(renderer)
    evaluateFold(thread, renderer)
  }

  processedThreads.add(thread)
}

/**
 * 清掉已经从 DOM 移除的节点引用。
 *
 * 切换排序 / 翻页会整段替换线程：不清的话 WeakSet 无所谓，但 Set 会一直增长，
 * 而且「只看 UP」的可用性会依赖已移除的线程。
 */
function pruneDisconnected(): void {
  for (const thread of Array.from(upThreads)) {
    if (!thread.isConnected)
      upThreads.delete(thread)
  }
  for (const thread of Array.from(touchedThreads)) {
    if (!thread.isConnected)
      touchedThreads.delete(thread)
  }
  for (const [id, target] of Array.from(foldTargets)) {
    if (!target.thread.isConnected)
      foldTargets.delete(id)
  }
  for (const shadow of Array.from(styledShadows)) {
    if (!shadow.host.isConnected)
      styledShadows.delete(shadow)
  }
}

/**
 * 诊断：当前有多少 renderer、多少个已注入正文排版样式（真机排查用）。
 *
 * 控制台可直接调 `window.__bewlyCommentsStyleStat()`（index.ts 里挂到 window 上）。
 */
export function getCommentStyleStat(): { renderers: number, styled: number, sampleFontSize: string } {
  const threads = getThreads()
  let renderers = 0
  let styled = 0
  let sampleFontSize = ''
  for (const thread of threads) {
    const renderer = getRenderer(thread)
    const shadow = renderer?.shadowRoot
    if (!renderer || !shadow)
      continue
    renderers += 1
    if (shadow.getElementById(TEXT_STYLE_ID))
      styled += 1
    if (!sampleFontSize) {
      const content = getRendererContent(renderer)
      if (content)
        sampleFontSize = window.getComputedStyle(content).fontSize
    }
  }
  return { renderers, styled, sampleFontSize }
}

/** 诊断属性名：页面控制台可直接读 document.documentElement.dataset.bewlyCommentsStyle */
const STYLE_STAT_ATTR = 'data-bewly-comments-style'

/**
 * 把「注入统计」写到 <html> 的属性上。
 *
 * 为什么不只挂 window：content script 运行在 **isolated world**，它给 `window` 赋的值
 * 在页面主世界的控制台里是 `undefined`（真机复测确认）。DOM 属性两个世界共享，可靠。
 */
function publishStyleStat(): void {
  const stat = getCommentStyleStat()
  const value = `${stat.styled}/${stat.renderers};fs=${stat.sampleFontSize || '-'}`
  if (document.documentElement.getAttribute(STYLE_STAT_ATTR) !== value)
    document.documentElement.setAttribute(STYLE_STAT_ATTR, value)
}

/** 每个 500ms 同步拍 + MutationObserver 都会调用 */
export function syncComments(): void {
  const host = getCommentsHost()
  ui.commentFound = Boolean(host)
  if (!host) {
    ui.commentSortAvailable = false
    ui.commentToolbarVisible = false
    ui.commentUpAvailable = false
    if (ui.commentFoldButtons.length)
      ui.commentFoldButtons = []
    foldTargets.clear()
    applyOnlyUpState()
    return
  }

  ensureCommentsStyle()
  // 第 45 轮：实测滚动条宽 → 供 header 做右边缘补偿（值不变不写）
  syncCommentsScrollbarVar()
  // 未登录空态块美化（第 39 轮）：每拍幂等标记，登录态变化时自动生效 / 失效
  markCommentsNotice()
  // 登录入口挪到评论头部行右侧（第 40 轮）：每拍幂等插入，登录后自动移除
  ensureHeaderLoginPill()
  observeCommentsShadow()

  const threads = getThreads()
  // 第 50 轮：评论区骨架 / 空态（0 线程显示骨架，4s 后仍空则空态；有线程立即移除）
  syncCommentPlaceholder(threads.length)
  for (const thread of threads)
    processThread(thread)

  // 保底注入（第 34 轮复测修复）：即使某个线程走增量路径 / 被提前跳过，
  // 每 500ms 拍也保证当前所有 renderer 的 shadow 里都有正文排版样式（按 id 判重，成本可忽略）。
  for (const thread of threads) {
    const renderer = getRenderer(thread)
    if (renderer)
      ensureRendererStyle(renderer)
  }

  publishStyleStat()

  // 真机诊断（第 36 轮）：bili-comments 是否存在 / 线程数 / 评论列高度
  {
    const host = getCommentsHost()
    const column = document.querySelector<HTMLElement>('[data-bewly-comment-column]')
    const state = [
      `mounted=${host ? 1 : 0}`,
      `threads=${threads.length}`,
      `col=${column
        ? Math.round(column.getBoundingClientRect().height)
        : 0}`,
    ].join(';')
    if (document.documentElement.getAttribute('data-bewly-comments-state') !== state)
      document.documentElement.setAttribute('data-bewly-comments-state', state)
  }

  pruneDisconnected()
  ui.commentUpAvailable = upThreads.size > 0
  applyOnlyUpState()

  const buttons = getSortButtons()
  ui.commentSortAvailable = Boolean(buttons.hot && buttons.latest)
  const active = getActiveSort()
  if (ui.commentActiveSort !== active)
    ui.commentActiveSort = active

  // 第 36 轮：「只看 UP 主」并入原生筛选行（最热 | 最新 | 只看 UP 主），
  // 不再渲染独立浮动工具条。每拍幂等同步（B 站重建 header 后会重新注入）。
  ensureOnlyUpButton()

  refreshFoldPositions()

  // 全量扫描完成：之前收集的增量信息已经被覆盖，清掉避免下拍重复处理
  pendingFullScan = false
  pendingThreads.clear()
}

function schedulePositionUpdate(): void {
  if (rafId)
    return
  rafId = window.requestAnimationFrame(() => {
    rafId = 0
    updateToolbarPosition()
    refreshFoldPositions()
  })
}

/**
 * 观察回调：只收集「新出现的线程」，不再 300ms 后做全量扫描。
 *
 * - 线程级变更（加载更多 / 翻页追加）→ 增量处理新增线程；
 * - 结构性变更（header 被替换、评论区从无到有）→ 标记全量重扫。
 */
function handleMutations(records: MutationRecord[]): void {
  for (const record of records) {
    for (const node of Array.from(record.addedNodes)) {
      if (!(node instanceof HTMLElement))
        continue

      if (node.matches(THREAD_EL_SELECTOR)) {
        pendingThreads.add(node)
        continue
      }
      if (node.matches(HEADER_EL_SELECTOR) || node.matches(COMMENTS_HOST_SELECTOR) || node.querySelector(HEADER_EL_SELECTOR))
        pendingFullScan = true

      const nested = node.querySelectorAll<HTMLElement>(THREAD_EL_SELECTOR)
      for (const thread of Array.from(nested))
        pendingThreads.add(thread)
    }

    // 只有「线程 / header / 评论区宿主」被移除才算结构性变更（切排序整段替换）；
    // 分页时被替换掉的 loading 占位符不算，避免每次翻页都升级成全量扫描
    for (const node of Array.from(record.removedNodes)) {
      if (!(node instanceof HTMLElement))
        continue
      if (node.matches(THREAD_EL_SELECTOR) || node.matches(HEADER_EL_SELECTOR)
        || node.querySelector(THREAD_EL_SELECTOR) || node.querySelector(HEADER_EL_SELECTOR)) {
        pendingFullScan = true
      }
    }
  }

  if (pendingFullScan || pendingThreads.size)
    scheduleIncremental()
}

let observedShadow: ShadowRoot | null = null

function observeCommentsShadow(): void {
  const shadow = getCommentsShadow()
  if (!shadow)
    return
  // 评论区可能比浮层晚挂载 / 被整段替换：shadow 变了就重新观察
  if (observer && observedShadow === shadow)
    return

  observer?.disconnect()
  observer = new MutationObserver(handleMutations)
  observer.observe(shadow, { childList: true, subtree: true })
  observedShadow = shadow
  // 换了 shadow：之前收集的增量作废，做一次全量
  pendingThreads.clear()
  pendingFullScan = true
}

/** 评论区可能异步挂载（懒加载）：没找到时下一拍 setup 之外的 sync 会重试 */
export function setupComments(): () => void {
  ui.commentsOnlyUp = readStoredOnlyUp()
  applyOnlyUpState()

  window.addEventListener('scroll', schedulePositionUpdate, { passive: true })
  window.addEventListener('resize', schedulePositionUpdate, { passive: true })
  syncComments()
  observeCommentsShadow()

  disposeListeners = () => {
    window.removeEventListener('scroll', schedulePositionUpdate)
    window.removeEventListener('resize', schedulePositionUpdate)

    if (rafId) {
      window.cancelAnimationFrame(rafId)
      rafId = 0
    }
    if (observeTimer !== null) {
      window.clearTimeout(observeTimer)
      observeTimer = null
    }
    observer?.disconnect()
    observer = null
    observedShadow = null

    // 移除注入到 header shadow 的筛选按钮与样式（第 36 轮）
    const headerShadow = getHeaderShadow()
    if (headerShadow) {
      headerShadow.getElementById(ONLY_UP_BUTTON_ID)?.remove()
      headerShadow.getElementById(LOGIN_PILL_ID)?.remove()
      removeStyleFromShadow(headerShadow, LOGIN_STYLE_ID)
      removeStyleFromShadow(headerShadow, FILTER_STYLE_ID)
    }

    // 清掉注入的样式
    if (styledCommentsShadow) {
      removeStyleFromShadow(styledCommentsShadow, COMMENTS_STYLE_ID)
      removeStyleFromShadow(styledCommentsShadow, NOTICE_STYLE_ID)
      removeStyleFromShadow(styledCommentsShadow, COMMENTS_RESPONSIVE_STYLE_ID)
      styledCommentsShadow = null
    }
    for (const shadow of styledShadows) {
      removeStyleFromShadow(shadow, FOLD_STYLE_ID)
      removeStyleFromShadow(shadow, TEXT_STYLE_ID)
      removeStyleFromShadow(shadow, COMMENTS_RESPONSIVE_STYLE_ID)
    }
    styledShadows.clear()

    // 清掉所有标记
    for (const thread of touchedThreads) {
      thread.removeAttribute(UP_ATTR)
      thread.removeAttribute(FOLD_ID_ATTR)
    }
    touchedThreads.clear()
    for (const renderer of touchedRenderers) {
      renderer.removeAttribute(CLAMPED_ATTR)
      renderer.removeAttribute(EXPANDED_ATTR)
    }
    touchedRenderers.clear()
    foldTargets.clear()
    upThreads.clear()
    pendingThreads.clear()
    pendingFullScan = false

    getCommentsHost()?.removeAttribute(ONLY_UP_HOST_ATTR)
    document.documentElement.classList.remove(ONLY_UP_ROOT_CLASS)
    document.documentElement.removeAttribute(STYLE_STAT_ATTR)
    removeCommentPlaceholder()
    document.documentElement.removeAttribute('data-bewly-comments-state')
    document.querySelector<HTMLElement>('[data-bewly-comment-column], #bewly-comment-column')
      ?.style
      .removeProperty(COMMENTS_SCROLLBAR_VAR)

    ui.commentsOnlyUp = false
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
