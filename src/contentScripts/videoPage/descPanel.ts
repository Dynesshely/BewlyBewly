/**
 * 视频页「自绘简介」阶段 3（第 80 轮）。
 *
 * 数据：page-world 桥的 `desc`（完整简介）→ 原生 `#v_desc` 文本兜底。
 * 渲染：`#bewly-desc` 插进 `#v_desc` 容器内部（容器仍是左列直接子元素 → 高度预算不变），
 * 原生 `.basic-desc-info` 隐藏。默认两行摘要 + 「展开」；展开后内容 max-height 受限、内部滚动，
 * 避免撑高 dock 导致播放器跳动。
 */
const DESC_ID = 'bewly-desc'
const DESC_HOST_SELECTOR = '#v_desc'
const NATIVE_DESC_SELECTORS = ['.basic-desc-info', '.desc-info']

let bridgedDesc = ''
let bridgeListening = false
let lastSignature = ''
let expanded = false

const hiddenNatives = new Map<HTMLElement, string>()

function onBridgeData(event: Event): void {
  const detail = (event as CustomEvent).detail as { desc?: string, bvid?: string } | null
  if (!detail)
    return
  const desc = typeof detail.desc === 'string'
    ? detail.desc
    : ''
  if (desc === bridgedDesc)
    return
  bridgedDesc = desc
  lastSignature = ''
  syncDescPanel()
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

function readDescFromDom(host: HTMLElement): string {
  for (const selector of NATIVE_DESC_SELECTORS) {
    const node = host.querySelector<HTMLElement>(selector)
    const text = node?.textContent?.trim()
    if (text)
      return text
  }
  return host.textContent?.trim() ?? ''
}

function hideNatives(host: HTMLElement): void {
  for (const selector of NATIVE_DESC_SELECTORS) {
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

function renderDesc(host: HTMLElement, desc: string): void {
  let box = host.querySelector<HTMLElement>(`#${DESC_ID}`)
  if (!box) {
    box = document.createElement('div')
    box.id = DESC_ID
    host.insertBefore(box, host.firstChild)
  }
  const signature = `${desc}|${expanded ? 1 : 0}`
  if (signature === lastSignature) {
    hideNatives(host)
    return
  }
  lastSignature = signature
  box.textContent = ''

  const text = document.createElement('div')
  text.className = `bvp-desc__text${expanded ? ' is-expanded' : ''}`
  // 保留换行（简介里常用换行分段）
  text.textContent = desc
  box.appendChild(text)

  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.className = 'bvp-desc__toggle'
  toggle.textContent = expanded ? '收起' : '展开简介'
  toggle.addEventListener('click', (event) => {
    event.stopPropagation()
    expanded = !expanded
    lastSignature = ''
    syncDescPanel()
  })
  box.appendChild(toggle)

  hideNatives(host)
}

/** 首屏 / 切视频时调用；返回 false 表示本次未启用自绘 */
export function syncDescPanel(): boolean {
  const host = document.querySelector<HTMLElement>(DESC_HOST_SELECTOR)
  if (!host) {
    resetDescPanel()
    return false
  }
  const desc = bridgedDesc || readDescFromDom(host)
  if (!desc) {
    resetDescPanel()
    return false
  }
  renderDesc(host, desc)
  return true
}

function resetDescPanel(): void {
  document.getElementById(DESC_ID)?.remove()
  restoreNatives()
  lastSignature = ''
}

export function setupDescPanel(): () => void {
  startBridge()
  syncDescPanel()
  return teardownDescPanel
}

export function teardownDescPanel(): void {
  stopBridge()
  resetDescPanel()
  bridgedDesc = ''
  expanded = false
}
