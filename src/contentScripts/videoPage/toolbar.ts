/**
 * 视频页「自绘工具栏」阶段 3（第 80 轮）。
 *
 * 视觉自绘 6 个按钮（点赞 / 投币 / 收藏 / 分享 / 举报 / 笔记），
 * **点击转发原生按钮**（同 UP 卡关注的做法，避开 CSRF 与风控）。
 * 数字用 page-world 桥的 `stat` 精确值格式化；状态（已赞/已投币/已收藏）从原生按钮 class 读。
 *
 * 位置：`#bewly-toolbar` 插进 `#arc_toolbar_report` 内部（容器高度仍由
 * `--bvp-toolbar-h` 固定 52，fixedLayout 的 `measureDockBlocks()` 量到的仍是同一个左列子元素）。
 * 原生 `.video-toolbar-left` / `.video-toolbar-right` 隐藏但保留（可程序化 click）。
 */
const TOOLBAR_ID = 'bewly-toolbar'
const TOOLBAR_HOST_SELECTOR = '#arc_toolbar_report'

interface StatData {
  view?: number
  danmaku?: number
  like?: number
  coin?: number
  favorite?: number
  share?: number
  reply?: number
}

let bridgedStat: StatData | null = null
let bridgedBvid = ''
let bridgeListening = false
let lastSignature = ''

const NATIVE_HIDE_SELECTORS = ['.video-toolbar-left', '.video-toolbar-right']
const hiddenNatives = new Map<HTMLElement, string>()

function onBridgeData(event: Event): void {
  const detail = (event as CustomEvent).detail as { bvid?: string, stat?: StatData } | null
  if (!detail || !detail.stat)
    return
  const changed = detail.bvid !== bridgedBvid
  bridgedBvid = detail.bvid ?? ''
  bridgedStat = detail.stat
  if (changed)
    lastSignature = ''
  syncToolbar()
}

function startBridge(): void {
  if (bridgeListening)
    return
  window.addEventListener('bewly-video-data', onBridgeData)
  bridgeListening = true
  window.dispatchEvent(new CustomEvent('bewly-video-data-request'))
}

function stopBridge(): void {
  if (!bridgeListening)
    return
  window.removeEventListener('bewly-video-data', onBridgeData)
  bridgeListening = false
}

/** 数字格式化（与 B 站一致：1.0万 / 1.2亿） */
export function formatStat(value: number | undefined | null): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0)
    return ''
  if (value >= 1e8)
    return `${(value / 1e8).toFixed(1)}亿`
  if (value >= 1e4)
    return `${(value / 1e4).toFixed(1)}万`
  return String(value)
}

function findNative(host: HTMLElement, selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const node = host.querySelector<HTMLElement>(selector)
    if (node)
      return node
  }
  return null
}

/** 按文案找原生按钮（举报 / 笔记这种没有稳定类名的） */
function findNativeByText(host: HTMLElement, re: RegExp): HTMLElement | null {
  for (const node of Array.from(host.querySelectorAll<HTMLElement>('div, button, a, span'))) {
    const text = (node.textContent ?? '').trim()
    if (!text || text.length > 8 || !re.test(text))
      continue
    // 只取最内层（避免命中包整行的大容器）
    if (Array.from(node.children).some(child => re.test((child.textContent ?? '').trim())))
      continue
    return node
  }
  return null
}

function isActive(node: HTMLElement | null): boolean {
  if (!node)
    return false
  return /(?:^|\s)(?:on|active|is-active|liked|selected)(?:\s|$)/.test(node.className)
}

const ICON_LIKE = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 10.5 11 4c1.4 0 2.4 1.1 2.2 2.5L12.8 9h5.1c1.2 0 2 1.2 1.7 2.3l-1.5 5.5A3 3 0 0 1 15.2 19H7" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><rect x="3.5" y="10" width="3.5" height="9" rx="1" stroke="currentColor" stroke-width="1.6"/></svg>'
const ICON_COIN = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="7.5" stroke="currentColor" stroke-width="1.6"/><path d="M12 8.5v7M9.5 11h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
const ICON_FAV = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 4.5 2.3 4.7 5.2.8-3.8 3.7.9 5.1-4.6-2.4-4.6 2.4.9-5.1L4.5 10l5.2-.8L12 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'
const ICON_SHARE = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 5.5 20 11l-6 5.5v-3.2c-4 0-6.6 1.2-8.5 3.7.4-4.8 3.1-7.6 8.5-7.9V5.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'
const ICON_REPORT = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4.5 21 20H3L12 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 10v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="17" r=".9" fill="currentColor"/></svg>'
const ICON_NOTE = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4.5" y="4.5" width="15" height="15" rx="2.5" stroke="currentColor" stroke-width="1.6"/><path d="M8 9h8M8 12.5h8M8 16h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'

interface ActionSpec {
  key: string
  label: string
  icon: string
  count?: string
  active?: boolean
  /** 原生按钮候选选择器 */
  nativeSelectors: string[]
  /** 原生按钮文案正则（选择器找不到时兜底） */
  nativeTextRe?: RegExp
}

function buildActions(host: HTMLElement): ActionSpec[] {
  const stat = bridgedStat ?? {}
  const likeBtn = findNative(host, ['.video-like'])
  const coinBtn = findNative(host, ['.video-coin'])
  const favBtn = findNative(host, ['.video-fav'])
  return [
    {
      key: 'like',
      label: '点赞',
      icon: ICON_LIKE,
      count: formatStat(stat.like),
      active: isActive(likeBtn),
      nativeSelectors: ['.video-like'],
      nativeTextRe: /点赞/,
    },
    {
      key: 'coin',
      label: '投币',
      icon: ICON_COIN,
      count: formatStat(stat.coin),
      active: isActive(coinBtn),
      nativeSelectors: ['.video-coin'],
      nativeTextRe: /投币/,
    },
    {
      key: 'fav',
      label: '收藏',
      icon: ICON_FAV,
      count: formatStat(stat.favorite),
      active: isActive(favBtn),
      nativeSelectors: ['.video-fav'],
      nativeTextRe: /收藏/,
    },
    {
      key: 'share',
      label: '分享',
      icon: ICON_SHARE,
      count: formatStat(stat.share),
      nativeSelectors: ['.video-share', '.video-share-wrap'],
      nativeTextRe: /分享/,
    },
    {
      key: 'report',
      label: '举报',
      icon: ICON_REPORT,
      nativeSelectors: ['.video-report', '.video-toolbar-right .report'],
      nativeTextRe: /举报/,
    },
    {
      key: 'note',
      label: '笔记',
      icon: ICON_NOTE,
      nativeSelectors: ['.video-note', '.video-toolbar-right .note'],
      nativeTextRe: /笔记/,
    },
  ]
}

function forwardToNative(host: HTMLElement, spec: ActionSpec): void {
  const target = findNative(host, spec.nativeSelectors)
    ?? (spec.nativeTextRe
      ? findNativeByText(host, spec.nativeTextRe)
      : null)
  target?.click()
}

function renderToolbar(host: HTMLElement): void {
  let bar = host.querySelector<HTMLElement>(`#${TOOLBAR_ID}`)
  if (!bar) {
    bar = document.createElement('div')
    bar.id = TOOLBAR_ID
    host.insertBefore(bar, host.firstChild)
  }
  const actions = buildActions(host)
  const signature = actions.map(action => `${action.key}:${action.count ?? ''}:${action.active ? 1 : 0}`).join('|')
  if (signature !== lastSignature) {
    lastSignature = signature
    bar.textContent = ''
    for (const action of actions) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `bvp-toolbar__btn${action.active ? ' is-active' : ''}`
      button.dataset.action = action.key
      button.title = action.label
      button.innerHTML = `${action.icon}<span class="bvp-toolbar__label">${action.label}</span>${action.count
        ? `<span class="bvp-toolbar__count">${action.count}</span>`
        : ''}`
      button.addEventListener('click', (event) => {
        event.stopPropagation()
        forwardToNative(host, action)
        // 原生按钮状态稍后变化，延迟同步一次
        window.setTimeout(() => {
          lastSignature = ''
          syncToolbar()
        }, 400)
      })
      bar.appendChild(button)
    }
  }
  // 渲染成功后隐藏原生左右两组（保留节点可 click）
  for (const selector of NATIVE_HIDE_SELECTORS) {
    for (const node of Array.from(host.querySelectorAll<HTMLElement>(selector))) {
      if (!hiddenNatives.has(node))
        hiddenNatives.set(node, node.style.display)
      node.style.setProperty('display', 'none', 'important')
    }
  }
}

function restoreNatives(): void {
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

/** 首屏 / 切视频时调用；返回 false 表示本次未启用自绘 */
export function syncToolbar(): boolean {
  const host = document.querySelector<HTMLElement>(TOOLBAR_HOST_SELECTOR)
  if (!host) {
    resetToolbar()
    return false
  }
  renderToolbar(host)
  return true
}

function resetToolbar(): void {
  document.getElementById(TOOLBAR_ID)?.remove()
  restoreNatives()
  lastSignature = ''
}

export function setupToolbar(): () => void {
  startBridge()
  syncToolbar()
  return teardownToolbar
}

export function teardownToolbar(): void {
  stopBridge()
  resetToolbar()
  bridgedStat = null
  bridgedBvid = ''
}
