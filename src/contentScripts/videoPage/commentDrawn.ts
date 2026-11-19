/**
 * 视频播放页「自绘评论区」的挂载层（第 110 轮）。
 *
 * # 为什么新增一层，而不是改 comments.ts
 *
 * `videoPage/comments.ts`（68.8KB）操作的全是 B 站**原生 Web Components**
 * （`bili-comments` 的 shadowRoot、`bili-comment-thread-renderer`、`bili-comment-renderer`
 * 的折叠），它是「增强原生」而不是「自绘」。本轮新增一套**完全自绘**的列表
 * （`drawn/comments/*`，数据来自 `/x/v2/reply`），comments.ts 一行不改：
 * 接管成功时它操作的是被隐藏的节点（只浪费一点性能），接管失败时它仍是原生路径。
 *
 * # 真机原生结构（探针 out-10.json，2026-11-19，BV1GJ411x7h7，未装扩展的干净浏览器）
 *
 * ```
 * #commentapp
 *   └ bili-comments.shadow
 *        ├ div#header                                 h≈100
 *        │    └ bili-comments-header-renderer.shadow
 *        │         ├ div#navbar          ← 「评论 241445 · 最热 · 最新」
 *        │         │    ├ div#title      ← 「评论 N」（与自绘 toolbar 重复）
 *        │         │    └ div#sort-actions ← 最热 / 最新（+ comments.ts 的「只看 UP 主」）
 *        │         ├ div#commentbox      ← 空壳（h=50）
 *        │         └ div.bili-comments-bottom-fixed-wrapper
 *        │              └ bili-comment-box.shadow   ← **评论输入框**（h≈82）
 *        ├ div#contents                  ← 线程列表（**要隐藏**）
 *        └ div#continuations             ← 「加载更多」占位（**要隐藏**）
 * ```
 *
 * 输入框在 `#header` 的**嵌套 shadow** 里（`bili-comment-box`），因此**绝不能隐藏 header**；
 * 隐藏原生列表只需对 `#contents` / `#continuations` 下手。
 * 这也顺便解决了上一版 `commentList.ts` 的问题：它直接给 `#commentapp` 写 `display:none`，
 * 连输入框一起藏了（用户再也发不了评论）。
 *
 * # 挂载 / 回退判定（每一道失败都**不接管**，页面保持原样）
 *
 * 1. 不是主文档 / 找不到 bvid → 不接管；
 * 2. 等 `#commentapp` 锚点（B 站懒加载，最多等 {@link ANCHOR_WAIT_MS}）→ 等不到不接管；
 * 3. 取 aid：优先页面数据桥（`bewly-video-data` 事件，零请求），否则 `/x/web-interface/view`；
 *    拿不到不接管。**这条同时保证 e2e 的假页面永远走原生**：BV1comment1 这类假 bvid
 *    在 view 接口必返回 -400，于是自绘层从不介入；
 * 4. 预取第一页评论（`/x/v2/reply`）：失败 / 0 条 → 不接管（原生空态还有「来抢沙发」引导）；
 * 5. 全部通过才：插入 `#bewly-comment-drawn` → 隐藏原生列表节点 → 挂 Vue。
 */
import type { App } from 'vue'
import type { CommentItem, CommentSort, VideoBrief } from './drawn/comments/types'
import { createApp } from 'vue'
import { setupApp } from '~/logic/common-setup'
import { injectCSS } from '~/utils/dom'
import CommentList from './drawn/comments/CommentList.vue'
import { briefFromBridge, clearCommentCaches, fetchComments, fetchVideoBrief, setCommentOwnerMid } from './drawn/comments/fetcher'

/** 自绘评论容器的 id（调试 / e2e / comments.ts 都按它定位） */
export const COMMENT_DRAWN_ID = 'bewly-comment-drawn'
/** 挂在 html 上的「自绘评论区已接管」标记 */
export const COMMENT_DRAWN_ACTIVE_CLASS = 'bewly-comment-drawn'
/** 注入到 bili-comments shadow 的「隐藏原生列表」样式 id（卸载时按它精确移除） */
const NATIVE_HIDE_STYLE_ID = 'bewly-comment-drawn-hide'
/** 注入到页面 head 的容器布局样式 id */
const LAYOUT_STYLE_ID = 'bewly-comment-drawn-layout'
/** 原生评论宿主（Web Components） */
const COMMENTS_HOST_SELECTOR = 'bili-comments'
/** 原生评论 App 根（锚点） */
const NATIVE_APP_SELECTOR = '#commentapp'
/** 上一版自绘列表（commentList.ts）的容器 id，接管成功后要清掉，避免两条列表 */
const LEGACY_LIST_ID = 'bewly-comment-list'
/** 等锚点的最长时间（毫秒） */
const ANCHOR_WAIT_MS = 20_000
/**
 * 等页面数据桥的时间（毫秒）。
 *
 * 桥由 page-world 在 DOMContentLoaded 后 200ms / 1200ms 各推一次（见 src/inject/index.js），
 * 通常几百毫秒内就到；这里等 1200ms 只是给「慢一拍」留余量，
 * 超时后立刻自己发 view 接口（两条路径并行，用户感知不到额外延迟）。
 */
const BRIDGE_WAIT_MS = 1_200
/** 骨架条数 */
const SKELETON_COUNT = 5

/**
 * 首屏最少条目数：低于它就**不接管**。
 *
 * 真机实测（探针 out-25 / out-26，未登录的新 profile）：
 * 未登录时 `/x/v2/reply?ps=20` 只返回 **3 条**，且 `sort=0` 直接返回 0 条
 * （登录态同样是 ps=20 会返回满 20 条）。这种「数据残缺但仍能拿到 aid」的情况下接管，
 * 用户会看到一个比原生更空的自绘列表 —— 不如把页面交回原生（原生未登录时还有登录引导）。
 */
const MIN_INITIAL_ITEMS = 8

/** 挂载判定状态 */
export type CommentDrawnState = 'idle' | 'pending' | 'active' | 'off'

/** CommentList 通过 defineExpose 暴露的操作面（comments.ts / 快捷键 / e2e 用） */
export interface CommentDrawnApi {
  setSort: (sort: CommentSort) => Promise<void>
  setOnlyUp: (on: boolean) => void
  isOnlyUp: () => boolean
  getSort: () => CommentSort
  hasUpComment: () => boolean
  getItems: () => CommentItem[]
  reload: () => Promise<void>
}

interface Mount {
  app: App
  container: HTMLElement
  host: HTMLElement
  nativeApp: HTMLElement
  /** 主 shadow 里的隐藏样式（可能为 null：宿主还没建好） */
  hideStyleEl: HTMLStyleElement | null
  /** header-renderer 嵌套 shadow 里的隐藏样式（可能为 null：header 晚一拍） */
  headerStyleEl: HTMLStyleElement | null
  /** 页面 head 里的容器布局样式 */
  layoutStyleEl: HTMLStyleElement
  /** 接管前 #commentapp 的行内 display（卸载时原样写回） */
  previousDisplay: string
  api: CommentDrawnApi | null
}

let state: CommentDrawnState = 'idle'
let mounted: Mount | null = null
let mounting: Promise<boolean> | null = null
let mountedBvid = ''
/** 页面数据桥推来的视频信息 */
let bridgeBrief: VideoBrief | null = null
let bridgeBound = false

function currentBvid(): string {
  return location.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/)?.[1] ?? ''
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

function onBridgeData(event: Event): void {
  const detail = (event as CustomEvent)?.detail as Parameters<typeof briefFromBridge>[0]
  const brief = briefFromBridge(detail)
  if (brief)
    bridgeBrief = { ...brief, ownerMid: brief.ownerMid || bridgeBrief?.ownerMid || '' }
}

/** 监听页面数据桥（幂等）；桥数据里已有 aid / owner.mid 时可以不发接口 */
function bindBridge(): void {
  if (bridgeBound)
    return
  window.addEventListener('bewly-video-data', onBridgeData)
  window.dispatchEvent(new CustomEvent('bewly-video-data-request'))
  bridgeBound = true
}

function unbindBridge(): void {
  if (!bridgeBound)
    return
  window.removeEventListener('bewly-video-data', onBridgeData)
  bridgeBound = false
}

/**
 * 取视频信息：桥优先（0 请求，还能拿到 owner.mid），其次 `/x/web-interface/view`。
 *
 * 两条路径**并行**：view 请求先发出去，同时等桥；谁先到用谁（桥到了就立刻收工，
 * 不再等接口）。都拿不到返回 null，调用方据此**不接管**。
 */
async function resolveBrief(bvid: string): Promise<VideoBrief | null> {
  bindBridge()
  if (bridgeBrief && bridgeBrief.aid && bridgeBrief.bvid === bvid)
    return bridgeBrief

  // view 接口先发出去（最坏情况下它就是唯一数据源）
  const apiTask = fetchVideoBrief(bvid)

  const deadline = Date.now() + BRIDGE_WAIT_MS
  while (Date.now() < deadline) {
    if (bridgeBrief && bridgeBrief.bvid === bvid)
      return bridgeBrief
    await sleep(150)
  }
  if (bridgeBrief && bridgeBrief.bvid === bvid)
    return bridgeBrief

  return apiTask
}

/** 等 #commentapp 出现（B 站懒加载；超时返回 null） */
async function waitForAnchor(): Promise<HTMLElement | null> {
  const deadline = Date.now() + ANCHOR_WAIT_MS
  for (;;) {
    const el = document.querySelector<HTMLElement>(NATIVE_APP_SELECTOR)
    if (el)
      return el
    if (Date.now() >= deadline)
      return null
    await sleep(250)
  }
}

/**
 * 把「隐藏原生评论**列表**」的样式注入两层 shadow。
 *
 * # 真机结构（探针 out-10.json，2026-11-19）
 *
 * ```
 * bili-comments.shadow
 *   ├ div#header                         ← 头部（保留）
 *   │    └ bili-comments-header-renderer.shadow
 *   │         ├ div#navbar               ← 「评论 241445 · 最热 · 最新」（与自绘 tab 重复）
 *   │         │    ├ div#title           ← 「评论 N」
 *   │         │    └ div#sort-actions    ← 最热 / 最新（+ comments.ts 注入的「只看 UP 主」）
 *   │         ├ div#commentbox           ← 空壳
 *   │         └ div.bili-comments-bottom-fixed-wrapper > bili-comment-box.shadow   ← **输入框**
 *   ├ div#contents                       ← 线程列表（隐藏）
 *   └ div#continuations                  ← 加载更多占位（隐藏）
 * ```
 *
 * # 隐藏策略（务必保留输入框）
 *
 * - 主 shadow：隐藏 `#contents` / `#continuations`（列表本体）；
 * - header-renderer shadow：隐藏 `#title` 与 `#sort-actions > bili-text-button`（原生排序按钮）
 *   及分隔条 `.sort-div`，**保留 `#sort-actions` 容器本身** —— comments.ts 把
 *   「只看 UP 主」按钮插在这个容器里，保留它才能继续用只看 UP；
 * - **绝不隐藏 `#header` / `bili-comment-box`**：那是用户唯一的发评论入口。
 *
 * 拿不到 shadow（宿主还没建好 / B 站改版）时返回 null；调用方会在每拍同步里重试。
 */
function hideNativeList(host: HTMLElement | null): HTMLStyleElement | null {
  const shadow = host?.shadowRoot
  if (!shadow)
    return null

  const existing = shadow.getElementById(NATIVE_HIDE_STYLE_ID)
  if (existing)
    return existing as HTMLStyleElement

  const styleEl = document.createElement('style')
  styleEl.id = NATIVE_HIDE_STYLE_ID
  styleEl.textContent = [
    'div#contents { display: none !important; }',
    'div#continuations { display: none !important; }',
  ].join('\n')
  shadow.appendChild(styleEl)
  return styleEl
}

/**
 * 隐藏 header-renderer 里的「重复标题 + 原生排序按钮」，保留输入框与只看 UP 容器。
 *
 * 这一层是**嵌套 shadow**，主 shadow 的 style 穿不进去，必须单独注入。
 * header 比宿主晚一拍建好，拿不到时返回 null（每拍同步会重试）。
 */
function hideNativeHeaderRow(host: HTMLElement | null): HTMLStyleElement | null {
  const headerRenderer = host?.shadowRoot?.querySelector<HTMLElement>('bili-comments-header-renderer')
  const shadow = headerRenderer?.shadowRoot
  if (!shadow)
    return null

  const existing = shadow.getElementById(NATIVE_HIDE_STYLE_ID)
  if (existing)
    return existing as HTMLStyleElement

  const styleEl = document.createElement('style')
  styleEl.id = NATIVE_HIDE_STYLE_ID
  // 只藏自绘已提供的部分：#title（「评论 N」）与 #sort-actions 里的原生排序按钮 / 分隔条
  styleEl.textContent = [
    'div#title { display: none !important; }',
    'div#sort-actions > bili-text-button { display: none !important; }',
    'div#sort-actions > .sort-div { display: none !important; }',
  ].join('\n')
  shadow.appendChild(styleEl)
  return styleEl
}

/** 移除注入到两层 shadow 的隐藏样式（只动本模块自己的 style 节点） */
function restoreNativeList(): void {
  const host = document.querySelector<HTMLElement>(COMMENTS_HOST_SELECTOR)
  host?.shadowRoot?.getElementById(NATIVE_HIDE_STYLE_ID)?.remove()
  host?.shadowRoot
    ?.querySelector('bili-comments-header-renderer')
    ?.shadowRoot
    ?.getElementById(NATIVE_HIDE_STYLE_ID)
    ?.remove()
}

/** 布局样式：让 #commentapp 变成纵向 flex，自绘列表占满剩余高度并内部滚动 */
function ensureLayoutStyle(): HTMLStyleElement {
  const existing = document.getElementById(LAYOUT_STYLE_ID) as HTMLStyleElement | null
  if (existing)
    return existing
  const css = [
    `${NATIVE_APP_SELECTOR} { display: flex !important; flex-direction: column; }`,
    `#${COMMENT_DRAWN_ID} { display: flex; flex: 1 1 auto; flex-direction: column; width: 100%; min-height: 0; }`,
  ].join('\n')
  return injectCSS(css, document.head)
}

/** 移除上一版自绘列表（commentList.ts 的 #bewly-comment-list）留下的痕迹 */
function clearLegacyDrawnList(nativeApp: HTMLElement): void {
  document.getElementById(LEGACY_LIST_ID)?.remove()
  // commentList.ts 用行内 display:none 隐藏整个 #commentapp；我们保留输入框，必须清掉
  if (nativeApp.style.getPropertyValue('display') === 'none')
    nativeApp.style.removeProperty('display')
}

/**
 * 把「为什么接管 / 为什么不接管」写进 `<html data-bewly-comment-drawn>`。
 *
 * 第 125 轮：content script 的 `console.warn` 用户抓不到（isolated world），
 * 但 DOM 属性任何环境都能读 —— 出问题时让用户在控制台跑
 *   document.documentElement.dataset.bewlyCommentDrawn
 * 就能直接看到卡在哪道闸门。
 */
function markDrawn(reason: string): void {
  document.documentElement.dataset.bewlyCommentDrawn = reason
}

async function doSetup(): Promise<boolean> {
  const bvid = currentBvid()
  if (!bvid) {
    markDrawn('skip:no-bvid')
    return false
  }

  const nativeApp = await waitForAnchor()
  if (!nativeApp) {
    markDrawn('skip:no-commentapp')
    console.warn('[bewly] comment drawn: #commentapp not found, fallback to native')
    return false
  }

  const brief = await resolveBrief(bvid)
  if (!brief || !brief.aid) {
    markDrawn('skip:no-aid')
    console.warn('[bewly] comment drawn: aid unavailable, fallback to native')
    return false
  }

  // 先把 UP 主 mid 交给 fetcher：它归一化时会据此打「UP 主」标记（主评论与楼中楼一致）
  setCommentOwnerMid(brief.ownerMid)

  // 预取第一页：既是首屏数据，也是「接口是否可用」的探测
  let initialItems: CommentItem[] = []
  let initialTotal: number | null = null
  let initialHasMore = true
  try {
    const page = await fetchComments(brief.aid, { sort: 'hot', page: 1 })
    initialItems = page.items
    initialTotal = page.total
    initialHasMore = page.hasMore
  }
  catch (error) {
    markDrawn('skip:prefetch-failed')
    console.warn('[bewly] comment drawn: prefetch failed, fallback to native', error)
    return false
  }

  // 接口成功但条目太少：交给原生（未登录时接口只给 3 条，接管了反而比原生更空）
  if (initialItems.length < MIN_INITIAL_ITEMS) {
    markDrawn(`skip:too-few-items(${initialItems.length})`)
    console.warn(
      `[bewly] comment drawn: only ${initialItems.length} items on first page (need ${MIN_INITIAL_ITEMS}), fallback to native`,
    )
    return false
  }

  // 预取期间用户可能切了视频 → 放弃
  if (currentBvid() !== bvid) {
    markDrawn('skip:bvid-changed')
    return false
  }

  // —— 到这里才开始动 DOM ——
  clearLegacyDrawnList(nativeApp)
  const previousDisplay = nativeApp.style.getPropertyValue('display')

  const container = document.createElement('div')
  container.id = COMMENT_DRAWN_ID
  container.className = 'bcd-root'
  // 挂进 #commentapp：跟随 commentColumn.ts 的搬运，天然位于评论列内
  nativeApp.appendChild(container)

  const host = document.createElement('div')
  container.appendChild(host)

  const layoutStyleEl = ensureLayoutStyle()

  const app = createApp(CommentList, {
    aid: brief.aid,
    initialItems,
    initialTotal,
    initialHasMore,
    initialSort: 'hot',
    skeletonCount: SKELETON_COUNT,
  })
  void setupApp(app)
  app.mount(host)

  // defineExpose 的公开方法挂在组件实例的 proxy 上
  const proxy = (app as unknown as { _instance?: { proxy?: CommentDrawnApi } })._instance?.proxy ?? null

  const commentsHost = document.querySelector<HTMLElement>(COMMENTS_HOST_SELECTOR)
  const hideStyleEl = hideNativeList(commentsHost)
  const headerStyleEl = hideNativeHeaderRow(commentsHost)

  document.documentElement.classList.add(COMMENT_DRAWN_ACTIVE_CLASS)
  markDrawn(`ok(items=${initialItems.length},total=${initialTotal ?? '?'})`)

  mounted = {
    app,
    container,
    host,
    nativeApp,
    hideStyleEl,
    headerStyleEl,
    layoutStyleEl,
    previousDisplay,
    api: proxy,
  }
  mountedBvid = bvid
  state = 'active'
  return true
}

/**
 * 尝试接管自绘评论区。
 *
 * 返回值语义：`true` = 已接管（页面上有 `#bewly-comment-drawn`）；
 * `false` = **一个字节都没改**，原生评论区（以及 commentList.ts 的旧自绘）照旧生效。
 *
 * 幂等：已接管时直接返回 true；并发调用共用同一个挂载流程。
 */
export async function setupCommentDrawn(): Promise<boolean> {
  if (state === 'active')
    return true
  if (mounting)
    return mounting

  state = 'pending'
  mounting = doSetup()
  try {
    const ok = await mounting
    if (!ok && state === 'pending')
      state = 'off'
    return ok
  }
  finally {
    mounting = null
  }
}

/**
 * 每拍同步（index.ts 的 500ms 循环调用）。
 *
 * - 换视频 / 锚点被 B 站替换 → 拆掉自绘层，回到 `idle`（下一拍会重新尝试挂载）；
 * - shadow 被重建导致隐藏样式丢失 → 补注入。
 */
export function syncCommentDrawn(): CommentDrawnState {
  if (!mounted)
    return state
  const bvid = currentBvid()
  if (bvid !== mountedBvid || !mounted.nativeApp.isConnected) {
    teardownCommentDrawn()
    state = 'idle'
    // 换视频 / 宿主被整段重建：下一拍重新走一遍「预取成功才接管」的流程。
    // 失败会落到 'off'，页面交回原生（与首次挂载完全一致）。
    void setupCommentDrawn()
    return state
  }

  const commentsHost = document.querySelector<HTMLElement>(COMMENTS_HOST_SELECTOR)
  if (!mounted.hideStyleEl || !mounted.hideStyleEl.isConnected)
    mounted.hideStyleEl = hideNativeList(commentsHost)
  // header 的 shadow 比宿主晚建 / 会被整段替换：没注入上就补一次
  if (!mounted.headerStyleEl || !mounted.headerStyleEl.isConnected)
    mounted.headerStyleEl = hideNativeHeaderRow(commentsHost)

  // 上一版自绘列表（commentList.ts）的 sync 是每拍跑的：只要我们在，
  // 就把它插回来的容器和它写下的行内 display:none 一起清掉（两者都是它挂载时做的）。
  document.getElementById(LEGACY_LIST_ID)?.remove()
  if (mounted.nativeApp.style.getPropertyValue('display') === 'none')
    mounted.nativeApp.style.removeProperty('display')
  return state
}

/** 当前是否已接管（index.ts 据此决定要不要启动 commentList.ts 的旧自绘） */
export function isCommentDrawnActive(): boolean {
  return state === 'active' && Boolean(mounted)
}

/** 是否已判定「不接管」（index.ts 据此恢复旧自绘路径） */
export function isCommentDrawnOff(): boolean {
  return state === 'off'
}

/** 当前判定状态（调试 / e2e） */
export function getCommentDrawnState(): CommentDrawnState {
  return state
}

/** 自绘列表的操作面（未接管时为 null） */
export function getCommentDrawnApi(): CommentDrawnApi | null {
  return mounted?.api ?? null
}

/** 卸载并完全还原原生评论区（幂等；未接管时是空操作） */
export function teardownCommentDrawn(): void {
  const current = mounted
  mounted = null
  mounting = null
  mountedBvid = ''
  if (!current)
    return

  try {
    current.app.unmount()
  }
  catch {
    // 组件已卸载时忽略
  }
  current.container.remove()
  current.layoutStyleEl.remove()
  restoreNativeList()
  document.documentElement.classList.remove(COMMENT_DRAWN_ACTIVE_CLASS)

  // 还原 #commentapp 的 display（只写回我们接管前读到的值）
  if (current.nativeApp.isConnected) {
    if (current.previousDisplay)
      current.nativeApp.style.setProperty('display', current.previousDisplay)
    else
      current.nativeApp.style.removeProperty('display')
  }
  clearCommentCaches()
  unbindBridge()
  bridgeBrief = null
  state = 'idle'
}
