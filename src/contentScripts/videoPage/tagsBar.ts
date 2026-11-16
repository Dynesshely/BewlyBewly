/**
 * 视频页「自绘标签行」阶段 2a（第 79 轮）。
 *
 * 数据：page-world 桥的 `bewly-video-data.tags`（精确标签名）→ 原生 DOM 文本兜底。
 * 渲染：`#bewly-tags-bar` 插进 `.video-tag-container` 内部（容器高度仍由既有 CSS 固定 28px，
 * fixedLayout 的 `measureDockBlocks()` 量到的仍是这一个左列子元素 → 高度预算不变）。
 * 原生标签子元素在渲染成功后 `display:none`（可恢复）；读不到数据就完全不隐藏。
 */
const TAGS_BAR_ID = 'bewly-tags-bar'
/**
 * 真机结构（CDP 核对）：`.video-tag-container > .tag-panel > (.tag.not-btn-tag 话题 + a.tag-link 标签)`。
 * 我们只接管 **标签**（`a.tag-link`），话题入口保留原生 —— 所以自绘条挂到 `.tag-panel` 末尾，
 * 只隐藏 `a.tag-link`，话题照常显示。
 */
const TAG_PANEL_SELECTOR = '.tag-panel'
const TAG_CONTAINER_FALLBACK = '.video-tag-container'
const NATIVE_TAG_LINK_SELECTOR = 'a.tag-link'

/** page-world 桥推送的标签（bvid 感知） */
let bridgedTags: string[] = []
let bridgedBvid = ''
let bridgeListening = false
let lastSignature = ''

function onBridgeData(event: Event): void {
  const detail = (event as CustomEvent).detail as { bvid?: string, tags?: unknown } | null
  if (!detail || !Array.isArray(detail.tags))
    return
  const tags = detail.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
  const changed = detail.bvid !== bridgedBvid || tags.join('|') !== bridgedTags.join('|')
  bridgedBvid = detail.bvid ?? ''
  bridgedTags = tags
  if (changed)
    syncTagsBar()
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

/** DOM 兜底：从原生标签链接读标签文本（桥还没数据时） */
function readTagsFromDom(container: HTMLElement): string[] {
  const nodes = container.querySelectorAll<HTMLElement>('a.tag-link, a[href*="search.bilibili.com"], .tag-item')
  const tags: string[] = []
  for (const node of Array.from(nodes)) {
    const text = (node.textContent ?? '').trim()
    if (text && !tags.includes(text))
      tags.push(text)
  }
  return tags
}

/** 隐藏原生标签链接（只隐藏 a.tag-link，话题 .tag 保留；记录原 display 便于恢复） */
const hiddenChildren = new Map<HTMLElement, string>()

function hideNativeTagLinks(panel: HTMLElement): void {
  for (const node of Array.from(panel.querySelectorAll<HTMLElement>(NATIVE_TAG_LINK_SELECTOR))) {
    if (!hiddenChildren.has(node))
      hiddenChildren.set(node, node.style.display)
    node.style.setProperty('display', 'none', 'important')
  }
}

function restoreNativeChildren(): void {
  for (const [node, display] of hiddenChildren) {
    if (!node.isConnected) {
      hiddenChildren.delete(node)
      continue
    }
    if (display)
      node.style.display = display
    else
      node.style.removeProperty('display')
  }
  hiddenChildren.clear()
}

function renderTags(container: HTMLElement, tags: string[]): void {
  let bar = container.querySelector<HTMLElement>(`#${TAGS_BAR_ID}`)
  if (!bar) {
    bar = document.createElement('div')
    bar.id = TAGS_BAR_ID
    // 追加在 .tag-panel 末尾：话题（.tag）在前，我们的标签在后
    container.appendChild(bar)
  }
  const signature = tags.join('|')
  if (lastSignature !== signature) {
    lastSignature = signature
    bar.textContent = ''
    for (const tag of tags) {
      const link = document.createElement('a')
      link.className = 'bvp-tag'
      link.href = `https://search.bilibili.com/all?keyword=${encodeURIComponent(tag)}&from_source=video_tag`
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.title = tag
      link.textContent = tag
      bar.appendChild(link)
    }
  }
  hideNativeTagLinks(container)
}

/** 首屏 / 切视频时调用；返回 false 表示本次未启用自绘 */
export function syncTagsBar(): boolean {
  const container = document.querySelector<HTMLElement>(TAG_PANEL_SELECTOR)
    ?? document.querySelector<HTMLElement>(TAG_CONTAINER_FALLBACK)
  if (!container) {
    teardownTagsBar()
    return false
  }
  const tags = bridgedTags.length
    ? bridgedTags
    : readTagsFromDom(container)
  if (!tags.length) {
    teardownTagsBar()
    return false
  }
  renderTags(container, tags)
  return true
}

export function setupTagsBar(): () => void {
  startBridge()
  syncTagsBar()
  return teardownTagsBar
}

/** 卸载：移除自绘标签、恢复原生子元素、清缓存 */
export function teardownTagsBar(): void {
  stopBridge()
  document.getElementById(TAGS_BAR_ID)?.remove()
  restoreNativeChildren()
  bridgedTags = []
  bridgedBvid = ''
  lastSignature = ''
}
