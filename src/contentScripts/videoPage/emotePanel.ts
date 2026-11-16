/**
 * 评论表情面板（第 83 轮）。
 *
 * 数据：`GET /x/emote/user/panel/web?business=reply` → `data.packages[].emote[]`（`text` 如「[微笑]」+ `url`）。
 * 真机实测：未登录返回 `code 0` 但 `packages` 为空；登录后才有数据 —— 所以面板要有「暂无表情」空态。
 * 点击表情 → 把 `text` 插入输入框；Esc / 点击空白关闭。
 */
const PANEL_ID = 'bewly-emote-panel'

export interface EmoteItem {
  text: string
  url: string
}

export interface EmotePackage {
  name: string
  items: EmoteItem[]
}

let cachedPackages: EmotePackage[] | null = null
let loadPromise: Promise<EmotePackage[]> | null = null

/** 拉取表情包（缓存一次） */
export async function loadEmotePackages(): Promise<EmotePackage[]> {
  if (cachedPackages)
    return cachedPackages
  if (loadPromise)
    return loadPromise
  loadPromise = (async () => {
    try {
      const response = await fetch('https://api.bilibili.com/x/emote/user/panel/web?business=reply', { credentials: 'include' })
      const json = await response.json() as {
        code: number
        data?: { packages?: Array<{ text?: string, name?: string, emote?: Array<{ text?: string, url?: string }> }> }
      }
      if (json.code !== 0 || !json.data?.packages) {
        cachedPackages = []
        return cachedPackages
      }
      cachedPackages = json.data.packages
        .map(pkg => ({
          name: pkg.text || pkg.name || '表情',
          items: (pkg.emote ?? [])
            .filter(item => item.text && item.url)
            .map(item => ({ text: item.text as string, url: item.url as string })),
        }))
        .filter(pkg => pkg.items.length > 0)
      return cachedPackages
    }
    catch {
      cachedPackages = []
      return cachedPackages
    }
    finally {
      loadPromise = null
    }
  })()
  return loadPromise
}

/** 把 emote 文本插入 textarea 光标处 */
export function insertAtCursor(textarea: HTMLTextAreaElement, text: string): void {
  const start = textarea.selectionStart ?? textarea.value.length
  const end = textarea.selectionEnd ?? textarea.value.length
  textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end)
  const caret = start + text.length
  textarea.selectionStart = caret
  textarea.selectionEnd = caret
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
  textarea.focus()
}

let panelRoot: HTMLElement | null = null
let activePackage = 0

function close(): void {
  panelRoot?.remove()
  panelRoot = null
  document.removeEventListener('keydown', onKeyDown, true)
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    close()
    event.stopPropagation()
  }
}

function renderBody(packages: EmotePackage[], onPick: (text: string) => void): void {
  if (!panelRoot)
    return
  const body = panelRoot.querySelector<HTMLElement>('.bvp-emote__body')
  if (!body)
    return
  if (!packages.length) {
    body.innerHTML = '<div class="bvp-emote__empty">暂无表情（登录后可用）</div>'
    return
  }
  const pkg = packages[Math.min(activePackage, packages.length - 1)]
  body.innerHTML = pkg.items
    .map(item => `<button type="button" class="bvp-emote__item" data-emote="${encodeURIComponent(item.text)}" title="${item.text}"><img src="${item.url}" alt="${item.text}" loading="lazy" referrerpolicy="no-referrer"></button>`)
    .join('')
  body.querySelectorAll<HTMLElement>('.bvp-emote__item').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.stopPropagation()
      onPick(decodeURIComponent(node.dataset.emote ?? ''))
    })
  })
  const tabs = panelRoot.querySelector<HTMLElement>('.bvp-emote__tabs')
  if (tabs) {
    tabs.innerHTML = packages
      .map((entry, index) => `<button type="button" class="bvp-emote__tab${index === activePackage
        ? ' is-active'
        : ''}" data-pkg="${index}">${entry.name}</button>`)
      .join('')
    tabs.querySelectorAll<HTMLElement>('.bvp-emote__tab').forEach((node) => {
      node.addEventListener('click', (event) => {
        event.stopPropagation()
        activePackage = Number(node.dataset.pkg ?? 0)
        renderBody(packages, onPick)
      })
    })
  }
}

/** 在 anchor 上方打开表情面板；选中的表情回调给 onPick */
export async function openEmotePanel(anchor: HTMLElement, onPick: (text: string) => void): Promise<void> {
  close()
  panelRoot = document.createElement('div')
  panelRoot.className = 'bvp-emote'
  panelRoot.id = PANEL_ID
  panelRoot.innerHTML = `<div class="bvp-emote__tabs"></div><div class="bvp-emote__body"><div class="bvp-emote__loading">加载中…</div></div>`
  document.body.appendChild(panelRoot)
  // 定位到按钮上方（右对齐），并限制在视口内
  const rect = anchor.getBoundingClientRect()
  const panelWidth = 336
  const left = Math.max(8, Math.min(window.innerWidth - panelWidth - 8, rect.right - panelWidth))
  const estimatedHeight = 280
  const top = rect.top > estimatedHeight + 12
    ? rect.top - estimatedHeight - 8
    : rect.bottom + 8
  panelRoot.style.left = `${left}px`
  panelRoot.style.top = `${top}px`

  panelRoot.addEventListener('click', (event) => {
    if (event.target === panelRoot)
      close()
    else if ((event.target as HTMLElement).closest('[data-emote]'))
      close()
  })
  document.addEventListener('keydown', onKeyDown, true)
  // 点页面其它地方关闭
  const onDocClick = (event: MouseEvent) => {
    if (!panelRoot)
      return
    if (!panelRoot.contains(event.target as Node) && !anchor.contains(event.target as Node))
      close()
  }
  window.setTimeout(() => document.addEventListener('click', onDocClick, true), 0)

  const packages = await loadEmotePackages()
  if (!panelRoot)
    return
  renderBody(packages, (text) => {
    onPick(text)
    close()
  })
}

export function closeEmotePanel(): void {
  close()
}

export function resetEmoteCache(): void {
  cachedPackages = null
  loadPromise = null
  activePackage = 0
}
