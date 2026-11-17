/**
 * 视频页「自绘信息栏」阶段 1 试点（第 78 轮）。
 *
 * 目标：标题 + 播放量 / 弹幕 / 发布日期 / 版权 / 分P 入口，全部由我们渲染，
 * 只从 B 站页面读数据；渲染成功后把原生 `.video-info-title` 与 `.video-info-detail-list` 隐藏
 * （display: none，不删除，留着给后续功能兜底）。
 *
 * 为什么挂在 `#viewbox_report` 内部而不是 shadow 里：
 * `fixedLayout.ts` 的 `measureDockBlocks()` 是**实测左列直接子元素高度**反算播放器高度的，
 * 把自绘块放进 `#viewbox_report`（它的高度由 `--bvp-fixed-info` 固定为 70）内，
 * 子元素数量与既有的高度预算完全不变 —— 播放器高度不会因为自绘而算错。
 *
 * 数据来源（按可靠性排序）：
 * 1. 内联 `<script>` 里的 `window.__INITIAL_STATE__`（content script 在 isolated world，
 *    读不到页面 window 变量，只能从脚本文本里截 JSON）；
 * 2. 原生信息栏的已渲染文本（DOM 兜底，B 站改结构时至少还有文本）；
 * 3. 两者都失败 → **不隐藏原生、不渲染自绘块**，保持现状，绝不出现空白信息栏。
 */
import { getPlayerWrapEl, getVideoEl } from './dom'

const INFO_BAR_ID = 'bewly-info-bar'
/**
 * 原生信息栏里要隐藏的节点（真机结构）：
 * - `.video-info-title`：标题块，内部 overflow-panel 里还含一份 `.video-info-detail-list`；
 * - `.video-info-meta`：信息栏第二个子元素，含另一份 `.video-info-detail-list`；
 * - `.video-info-detail-list`：兜底（旧结构直接挂在 report 下）。
 * 全部 display:none，不删除 —— 后续阶段还可以从原生节点读兜底数据。
 */
const NATIVE_HIDE_SELECTORS = [
  '.video-info-title',
  '.video-info-meta',
  '.video-info-detail-list',
]

interface VideoInfoData {
  /** 数据所属视频（page-world 桥提供；DOM 兜底时为空） */
  bvid?: string
  title: string
  view: number | null
  /** 互动数（第 95 轮）：桥 stat 提供；DOM 兜底时为 null */
  like?: number | null
  coin?: number | null
  favorite?: number | null
  share?: number | null
  danmaku: number | null
  /** 秒级时间戳 */
  pubdate: number | null
  /** 1 = 自制，2 = 转载 */
  copyright: number | null
  pages: number | null
  /** 播放量 / 弹幕数的原始文本（DOM 兜底时 preserve，避免二次格式化失真） */
  viewText?: string
  danmakuText?: string
  /** 标签名（page-world 桥提供，阶段 2 渲染用；本阶段标签行仍用原生） */
  tags?: string[]
}

/** 上次解析出的数据与其 bvid：同一视频不重复解析大 JSON */
let cachedData: VideoInfoData | null = null
let cachedBvid = ''
/** page-world 桥（`bewly-video-data` 事件）推送的最新数据 */
let bridgedData: VideoInfoData | null = null
/** 是否已注册桥监听（避免重复注册） */
let bridgeListening = false
/** 第 95 轮：自绘信息栏是否已成功放到播放器下方（锁定标志，避免每拍来回迁移造成闪烁） */
let infoBarPlacedAfterPlayer = false
/** 被隐藏的原生节点的原始 display（卸载时恢复） */
const hiddenNatives = new Map<HTMLElement, string>()

function currentBvid(): string {
  const match = location.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/)
  return match?.[1] ?? ''
}

/** 从内联 script 文本里截出 `__INITIAL_STATE__` 的 JSON 对象（含括号平衡与字符串转义处理） */
function parseInitialState(): any | null {
  for (const script of Array.from(document.querySelectorAll('script:not([src])'))) {
    const text = script.textContent ?? ''
    if (!text.includes('__INITIAL_STATE__'))
      continue
    const keyAt = text.indexOf('__INITIAL_STATE__')
    const start = text.indexOf('{', keyAt)
    if (start < 0)
      continue
    let depth = 0
    let end = -1
    let inString = false
    let quote = ''
    let escaped = false
    for (let i = start; i < text.length; i++) {
      const ch = text[i]
      if (inString) {
        if (escaped) {
          escaped = false
          continue
        }
        if (ch === '\\') {
          escaped = true
          continue
        }
        if (ch === quote)
          inString = false
        continue
      }
      if (ch === '"' || ch === '\'') {
        inString = true
        quote = ch
        continue
      }
      if (ch === '{') {
        depth++
      }
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          end = i + 1
          break
        }
      }
    }
    if (end < 0)
      continue
    try {
      return JSON.parse(text.slice(start, end))
    }
    catch {
      continue
    }
  }
  return null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : null
}

/** 把 page-world 桥的 payload 转成内部数据（字段缺失自行降级） */
function parseBridgePayload(detail: unknown): VideoInfoData | null {
  const payload = detail as Record<string, any> | null
  if (!payload || typeof payload.title !== 'string' || !payload.title)
    return null
  const stat = (payload.stat ?? {}) as Record<string, unknown>
  return {
    bvid: typeof payload.bvid === 'string'
      ? payload.bvid
      : '',
    title: payload.title,
    view: num(stat.view),
    danmaku: num(stat.danmaku),
    like: num(stat.like),
    coin: num(stat.coin),
    favorite: num(stat.favorite),
    share: num(stat.share),
    pubdate: num(payload.pubdate) ?? num(payload.ctime),
    copyright: num(payload.copyright),
    pages: num(payload.pages),
    tags: Array.isArray(payload.tags)
      ? payload.tags.filter((tag: unknown) => typeof tag === 'string')
      : undefined,
  }
}

/**
 * `bewly-video-data` 事件处理（第 78 轮补充）。
 *
 * page-world 桥把 `__INITIAL_STATE__.videoData` 整理后推过来；isolated world 也能通过
 * `window.addEventListener` 收到（DOM 事件跨世界共享）。收到新数据立即清缓存并主动重渲染，
 * 不等 500ms 同步拍。
 */
function onBridgeVideoData(event: Event): void {
  const data = parseBridgePayload((event as CustomEvent).detail)
  if (!data)
    return
  const changed = !bridgedData || bridgedData.bvid !== data.bvid
  bridgedData = data
  if (changed) {
    cachedData = null
    cachedBvid = ''
  }
  syncInfoBar()
}

function startBridgeListening(): void {
  if (bridgeListening)
    return
  window.addEventListener('bewly-video-data', onBridgeVideoData)
  bridgeListening = true
  // 主动索要一次：桥会立即重推（没有数据时重新开始轮询）
  window.dispatchEvent(new CustomEvent('bewly-video-data-request'))
}

function stopBridgeListening(): void {
  if (!bridgeListening)
    return
  window.removeEventListener('bewly-video-data', onBridgeVideoData)
  bridgeListening = false
}

/** 从 `__INITIAL_STATE__.videoData` 读数据 */
function readFromInitialState(): VideoInfoData | null {
  const state = parseInitialState()
  const data = state?.videoData ?? state?.videoDataRes
  if (!data || typeof data.title !== 'string' || !data.title)
    return null
  const stat = data.stat ?? {}
  return {
    title: data.title,
    view: num(stat.view),
    danmaku: num(stat.danmaku),
    like: num(stat.like),
    coin: num(stat.coin),
    favorite: num(stat.favorite),
    share: num(stat.share),
    pubdate: num(data.pubdate) ?? num(data.ctime),
    copyright: num(data.copyright),
    pages: Array.isArray(data.pages)
      ? data.pages.length
      : num(data.pages),
  }
}

function textOf(selector: string): string {
  return document.querySelector<HTMLElement>(selector)?.textContent?.trim() ?? ''
}

/** DOM 兜底：直接读原生信息栏已渲染的文本（B 站改结构时至少还有标题与数字） */
function readFromDom(): VideoInfoData | null {
  const titleNode = document.querySelector<HTMLElement>('#viewbox_report .video-title')
  const title = titleNode?.getAttribute('title')?.trim()
    || titleNode?.textContent?.trim()
    || textOf('#viewbox_report h1')
    || document.title.replace(/_哔哩哔哩.*$/, '').trim()
  if (!title)
    return null
  const viewText = textOf('#viewbox_report .view-text') || undefined
  const danmakuText = textOf('#viewbox_report .dm-text') || undefined
  const dateText = textOf('#viewbox_report .pubdate-ip-text')
  // 真机是 "2026-11-10 11:22:46"，只取日期段
  const dateMatch = dateText.match(/(\d{4})-(\d{2})-(\d{2})/)
  const pubdate = dateMatch
    ? Math.floor(new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T00:00:00`).getTime() / 1000)
    : null
  return {
    title,
    view: null,
    danmaku: null,
    pubdate,
    copyright: null,
    pages: null,
    viewText,
    danmakuText,
  }
}

/** 统一取数据：同一 bvid 用缓存；bvid 变化才重新解析 */
function readVideoData(): VideoInfoData | null {
  const bvid = currentBvid()
  // 优先级 1：page-world 桥推送的数据（精确 stat / pages / tags）
  if (bridgedData && (!bvid || !bridgedData.bvid || bridgedData.bvid === bvid))
    return bridgedData
  // 优先级 2/3：内联 script 解析 → DOM 文本（同一 bvid 不重复解析）
  if (cachedData && cachedBvid === bvid)
    return cachedData
  const data = readFromInitialState() ?? readFromDom()
  if (!data)
    return null
  cachedData = data
  cachedBvid = bvid
  return data
}

/** 播放量格式化：与 B 站一致（1.0万 / 1.2亿，保留一位小数） */
export function formatCount(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0)
    return '-'
  if (value >= 1e8)
    return `${(value / 1e8).toFixed(1)}亿`
  if (value >= 1e4)
    return `${(value / 1e4).toFixed(1)}万`
  return String(value)
}

function formatDate(pubdate: number | null): string {
  if (!pubdate)
    return ''
  const date = new Date(pubdate * 1000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function copyrightText(data: VideoInfoData): string {
  if (data.copyright === 1)
    return '自制'
  if (data.copyright === 2)
    return '未经作者授权，禁止转载'
  return textOf('#viewbox_report .copyright-text')
}

const ICON_VIEW = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 12s3.6-6 9-6 9 6 9 6-3.6 6-9 6-9-6-9-6Z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.5" stroke="currentColor" stroke-width="1.6"/></svg>'
const ICON_DANMAKU = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
const ICON_DATE = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2.5" stroke="currentColor" stroke-width="1.6"/><path d="M4 9.5h16M8.5 3v3.5M15.5 3v3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
const ICON_PAGES = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="6" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M7 3.5h13.5V16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
const ICON_LIKE = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 10.5 11 4c1.4 0 2.4 1.1 2.2 2.5L12.8 9h5.1c1.2 0 2 1.2 1.7 2.3l-1.5 5.5A3 3 0 0 1 15.2 19H7" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><rect x="3.5" y="10" width="3.5" height="9" rx="1" stroke="currentColor" stroke-width="1.6"/></svg>'
const ICON_COIN = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="7.5" stroke="currentColor" stroke-width="1.6"/><path d="M12 8.5v7M9.5 11h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
const ICON_FAV = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 4.5 2.3 4.7 5.2.8-3.8 3.7.9 5.1-4.6-2.4-4.6 2.4.9-5.1L4.5 10l5.2-.8L12 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'
const ICON_SHARE = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 5.5 20 11l-6 5.5v-3.2c-4 0-6.6 1.2-8.5 3.7.4-4.8 3.1-7.6 8.5-7.9V5.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'
const ICON_COPYRIGHT = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6"/><path d="M14.4 10.3a2.9 2.9 0 1 0 0 3.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'

function makeItem(icon: string, label: string, title: string): HTMLElement {
  const item = document.createElement('span')
  item.className = 'bvp-info__item'
  item.title = title
  item.innerHTML = `${icon}<span>${label}</span>`
  return item
}

/** 隐藏原生标题 / 详情列表（记录原 inline display，便于恢复） */
function hideNativeNodes(report: HTMLElement): void {
  for (const selector of NATIVE_HIDE_SELECTORS) {
    for (const node of Array.from(report.querySelectorAll<HTMLElement>(selector))) {
      if (!hiddenNatives.has(node))
        hiddenNatives.set(node, node.style.display)
      node.style.setProperty('display', 'none', 'important')
    }
  }
}

function restoreNativeNodes(): void {
  for (const [node, display] of hiddenNatives) {
    if (!node.isConnected) {
      hiddenNatives.delete(node)
      continue
    }
    if (display)
      node.style.display = display
    else
      node.style.removeProperty('display')
  }
  hiddenNatives.clear()
}

/** 渲染 / 更新自绘信息栏（内容不变就不写 DOM） */
function renderInfoBar(report: HTMLElement, data: VideoInfoData): void {
  let bar = report.querySelector<HTMLElement>(`#${INFO_BAR_ID}`)
  if (!bar) {
    bar = document.createElement('div')
    bar.id = INFO_BAR_ID
    report.insertBefore(bar, report.firstChild)
  }

  const titleText = data.title
  const meta = [
    makeItem(ICON_VIEW, data.viewText ?? formatCount(data.view), '播放量'),
  ]
  // 第 95 轮：5 项指标 = 播放量 + 点赞 / 投币 / 收藏 / 分享（桥 stat 精确值）
  if (data.like)
    meta.push(makeItem(ICON_LIKE, formatCount(data.like), '点赞量'))
  if (data.coin)
    meta.push(makeItem(ICON_COIN, formatCount(data.coin), '投币量'))
  if (data.favorite)
    meta.push(makeItem(ICON_FAV, formatCount(data.favorite), '收藏量'))
  if (data.share)
    meta.push(makeItem(ICON_SHARE, formatCount(data.share), '分享量'))
  if (data.danmaku)
    meta.push(makeItem(ICON_DANMAKU, data.danmakuText ?? formatCount(data.danmaku), '弹幕数'))
  const date = formatDate(data.pubdate)
  if (date)
    meta.push(makeItem(ICON_DATE, date, '发布日期'))
  const copyright = copyrightText(data)
  if (copyright)
    meta.push(makeItem(ICON_COPYRIGHT, copyright, '版权声明'))
  if (data.pages && data.pages > 1)
    meta.push(makeItem(ICON_PAGES, `共 ${data.pages} P`, '分P / 合集入口（占位）'))

  const signature = `${titleText}||${meta.map(item => item.textContent).join('|')}`
  if (bar.dataset.signature !== signature) {
    bar.dataset.signature = signature
    bar.textContent = ''
    const title = document.createElement('h1')
    title.className = 'bvp-info__title'
    title.textContent = titleText
    title.title = titleText
    const metaRow = document.createElement('div')
    metaRow.className = 'bvp-info__meta'
    metaRow.append(...meta)
    bar.append(title, metaRow)
  }
  // 原生节点隐藏放在渲染成功之后：读不到数据时不会出现空白
  hideNativeNodes(report)

  // 第 95 轮：标题 + 信息默认放到播放器下方。
  //
  // ⚠️ 第 96 轮二次尝试仍失败，暂时禁用「信息栏放到播放器下方」。
  //
  // 两轮实测结论：
  // ① 不加 fixedLayout 兜底 → mirror grid 第一列锁死 0px，整页 0×0；
  // ② 加兜底（视口宽算 totalWidth）→ CSS 变量算对了
  //    （--bvp-fixed-content-width: 1968px、--bvp-fixed-player-width: 1118px、metrics player=629x1118），
  //    但 **DOM 实际 clientWidth 仍是 0** —— 说明 #mirror-vdcon 的宽度不由这个变量驱动，
  //    而是由更上层容器决定；report 让位后整条链没有东西撑宽。
  // 结论：要安全下移，必须先让 .left-container / #mirror-vdcon 有独立的宽度来源（不依赖 report），
  // 这是一次结构性改动，不适合夹在其它修复里做。
  const playerWrap = getPlayerWrapEl()
  const canPlaceBelowPlayer = false
  if (canPlaceBelowPlayer && playerWrap) {
    if (!infoBarPlacedAfterPlayer || bar.previousElementSibling !== playerWrap)
      playerWrap.insertAdjacentElement('afterend', bar)
    infoBarPlacedAfterPlayer = true
    report.dataset.bewlyInfoMoved = '1'
  }
}

/** 首屏 / 切视频时调用；返回 false 表示本次未启用自绘（调用方无需额外处理） */
export function syncInfoBar(): boolean {
  const report = document.querySelector<HTMLElement>('#viewbox_report')
  if (!report || !getVideoEl()) {
    teardownInfoBar()
    return false
  }
  const data = readVideoData()
  if (!data) {
    // 读不到数据：撤掉自绘、恢复原生，绝不出现空白信息栏
    teardownInfoBar()
    return false
  }
  renderInfoBar(report, data)
  return true
}

/** 挂载（阶段 1 试点开关在 index.ts 里控制；iframe 降级不调用） */
export function setupInfoBar(): () => void {
  // 第 78 轮补充：先接 page-world 数据桥（精确数字），再渲染
  startBridgeListening()
  syncInfoBar()
  return teardownInfoBar
}

/** 卸载：移除自绘块、恢复原生节点显示、清缓存 */
export function teardownInfoBar(): void {
  stopBridgeListening()
  document.getElementById(INFO_BAR_ID)?.remove()
  infoBarPlacedAfterPlayer = false
  const reportEl = document.querySelector<HTMLElement>('#viewbox_report')
  if (reportEl)
    delete reportEl.dataset.bewlyInfoMoved
  restoreNativeNodes()
  cachedData = null
  cachedBvid = ''
}
