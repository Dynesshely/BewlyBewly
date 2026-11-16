/**
 * 视频页「自绘 UP 卡」阶段 2b（第 79 轮）。
 *
 * 数据：page-world 桥的 `owner`（name / face / mid）→ 原生 DOM 兜底（头像 src / 昵称 / 签名）。
 * 渲染：`#bewly-up-card` 插进 `.up-panel-container` **内部**（容器本身是 commentColumn 搬进评论列的元素，
 * 不能隐藏；容器高度 = 自绘内容高度，评论列内部继续 flex 排布，dock 高度不变）。
 *
 * 关注 / 发消息**不自己调 API**：点击时找原生按钮并 `.click()`，避开 CSRF（bili_jct）与风控。
 * 读不到数据（桥没有 owner 且 DOM 也没有昵称）→ 不渲染、不隐藏原生。
 */
const UP_CARD_ID = 'bewly-up-card'
const PANEL_SELECTOR = '.up-panel-container'

interface OwnerData {
  name: string
  face: string
  mid: string | number | null
  /** 原生签名（桥 payload 没有；从 DOM 读，可能为空） */
  signature: string
  /** 是否已关注（从原生按钮文案推断） */
  followed: boolean
}

let bridgedOwner: { name: string, face: string, mid: string | number | null } | null = null
let bridgedBvid = ''
let bridgeListening = false
let lastSignature = ''

/** 原生关注按钮的候选选择器（B 站改版时尽量多兜一层） */
const FOLLOW_SELECTORS = [
  '.default-btn',
  '.attention-btn-ctnr button',
  '.attention-btn-ctnr .default-btn',
  'button[class*="attention"]',
  'button[class*="follow"]',
]
/** 原生发消息按钮候选 */
const MESSAGE_SELECTORS = [
  '.send-msg',
  '#messageBtn',
  'a[href*="message"]',
  '.up-info--right .send-msg',
]

function onBridgeData(event: Event): void {
  const detail = (event as CustomEvent).detail as { bvid?: string, owner?: { name?: string, face?: string, mid?: string | number } } | null
  if (!detail || !detail.owner || typeof detail.owner.name !== 'string')
    return
  const owner = {
    name: detail.owner.name,
    face: detail.owner.face ?? '',
    mid: detail.owner.mid ?? null,
  }
  const changed = detail.bvid !== bridgedBvid || owner.name !== bridgedOwner?.name || owner.face !== bridgedOwner?.face
  bridgedBvid = detail.bvid ?? ''
  bridgedOwner = owner
  if (changed)
    lastSignature = ''
  // 桥数据到达后**强制重渲染**一次：此前可能已用 DOM 兜底渲染过（首字），必须用精确 face 重建
  syncUpCard()
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

/** 从原生 DOM 读头像地址：img 的 src / srcset / data-src，或 .bili-avatar 的 background-image */
function readAvatarSrc(panel: HTMLElement): string {
  const imgSelectors = [
    '.up-avatar img',
    '.bili-avatar img',
    'img.bili-avatar-img',
    '[class*="avatar"] img',
    'img',
  ]
  for (const selector of imgSelectors) {
    const img = panel.querySelector<HTMLImageElement>(selector)
    if (!img)
      continue
    const src = img.getAttribute('src') || img.getAttribute('data-src') || ''
    if (src && !src.startsWith('data:'))
      return src
    const srcset = img.getAttribute('srcset') || ''
    const first = srcset.split(',')[0]?.trim().split(' ')[0]
    if (first)
      return first
  }
  // 兜底：background-image: url("...")
  for (const node of Array.from(panel.querySelectorAll<HTMLElement>('.bili-avatar, [class*="avatar"]'))) {
    const bg = window.getComputedStyle(node).backgroundImage
    const match = bg.match(/url\(["']?(.*?)["']?\)/)
    if (match?.[1] && !match[1].startsWith('data:'))
      return match[1]
  }
  return ''
}

function textOf(root: ParentNode, selectors: string[]): string {
  for (const selector of selectors) {
    const node = root.querySelector<HTMLElement>(selector)
    const text = node?.textContent?.trim()
    if (text)
      return text
  }
  return ''
}

function findNativeButton(panel: HTMLElement, selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const node = panel.querySelector<HTMLElement>(selector)
    if (node)
      return node
  }
  return null
}

/**
 * 汇总数据：**桥数据优先且只要 name / face / mid 任一有值就直接渲染**（第 79 轮第三次修复）。
 *
 * 之前加过「无桥数据且原生读不到头像就不渲染」的判定，但真机 UP 卡内部是
 * `.up-info-container`（name 在 `a.up-name` 里），判定用错了选择器 → 直接不渲染。
 * 现在：桥有 owner 就渲染；桥没有才回退读原生 DOM 的 name。
 */
function readOwner(panel: HTMLElement): OwnerData | null {
  const bridge = bridgedOwner
  const bridgeHasOwner = Boolean(bridge && (bridge.name || bridge.face || bridge.mid))
  const domName = textOf(panel, [
    '.up-name',
    '.up-info--name',
    '[class*="up-name"]',
    '.up-info-container a[href*="space.bilibili.com"]',
    'a[href*="space.bilibili.com"]',
  ])
  const name = bridge?.name?.trim() || domName
  if (!name && !bridgeHasOwner)
    return null
  // 头像兜底链（第 79 轮补充）：桥 face → 原生 img 的 src/srcset/data-src → .bili-avatar 的 background-image
  const face = bridgedOwner?.face
    || readAvatarSrc(panel)
    || ''
  // mid 兜底：桥 owner.mid → 原生头像链接 a.up-avatar 的 href（space.bilibili.com/<mid>）
  const hrefMid = panel.querySelector<HTMLAnchorElement>('a.up-avatar, a[href*="space.bilibili.com"]')
    ?.getAttribute('href')
    ?.match(/space\.bilibili\.com\/(\d+)/)?.[1]
  const mid = bridgedOwner?.mid ?? (hrefMid
    ? Number(hrefMid)
    : null)
  const signature = textOf(panel, ['.up-description', '.up-info--desc', '[class*="up-desc"]'])
  const followBtn = findNativeButton(panel, FOLLOW_SELECTORS)
  const followText = followBtn?.textContent?.trim() ?? ''
  return {
    name: name || 'UP 主',
    face,
    mid,
    signature,
    // 真机：`.default-btn.follow-btn.b-gz` 带 `not-follow` / `following` 状态类；文案也算兜底
    followed: Boolean(followBtn?.classList.contains('following'))
      || /已关注|互相关注/.test(followText),
  }
}

const hiddenChildren = new Map<HTMLElement, string>()

function hideNativeChildren(panel: HTMLElement, keep: HTMLElement): void {
  for (const child of Array.from(panel.children)) {
    if (!(child instanceof HTMLElement) || child === keep)
      continue
    if (!hiddenChildren.has(child))
      hiddenChildren.set(child, child.style.display)
    child.style.setProperty('display', 'none', 'important')
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

function buildButton(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  button.textContent = label
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onClick()
  })
  return button
}

function renderUpCard(panel: HTMLElement, data: OwnerData): void {
  let card = panel.querySelector<HTMLElement>(`#${UP_CARD_ID}`)
  if (!card) {
    card = document.createElement('div')
    card.id = UP_CARD_ID
    // 卡片级点击（头像 / 昵称）不开新页：原生整卡有跳转，自绘只做展示
    card.addEventListener('click', event => event.stopPropagation())
    panel.insertBefore(card, panel.firstChild)
  }

  // 诊断：把桥数据与最终 face 写进 dataset，便于真机定位「桥有值但渲染成首字」的问题
  card.dataset.bewlyBridgeFace = bridgedOwner?.face ? 'yes' : 'no'
  card.dataset.bewlyFace = data.face ? 'yes' : 'no'

  // 保险（第 79 轮）：桥数据可能晚于首次渲染到达，或 readOwner 的兜底链拿到空。
  // 每次渲染后都检查一次：卡内没有 img 而桥 face 有值就补上（幂等）。
  const bridgeFace = bridgedOwner?.face || ''
  const avatarEl = card.querySelector<HTMLAnchorElement>('.bvp-up__avatar')
  if (bridgeFace && avatarEl && !avatarEl.querySelector('img')) {
    avatarEl.textContent = ''
    const lateImg = document.createElement('img')
    lateImg.src = bridgeFace
    lateImg.alt = data.name
    lateImg.decoding = 'async'
    lateImg.referrerPolicy = 'no-referrer'
    avatarEl.appendChild(lateImg)
  }

  const signature = `${data.name}|${data.face}|${data.signature}|${data.followed}`
  if (lastSignature !== signature) {
    lastSignature = signature
    card.textContent = ''

    const avatar = document.createElement('a')
    avatar.className = 'bvp-up__avatar'
    if (data.mid)
      avatar.href = `https://space.bilibili.com/${data.mid}`
    avatar.target = '_blank'
    avatar.rel = 'noopener noreferrer'
    avatar.title = data.name
    if (data.face) {
      const img = document.createElement('img')
      img.src = data.face
      img.alt = data.name
      img.decoding = 'async'
      img.referrerPolicy = 'no-referrer'
      // 破图兜底：加载失败就退回昵称首字（避免空头像）
      img.addEventListener('error', () => {
        img.remove()
        if (!avatar.textContent)
          avatar.textContent = data.name.slice(0, 1)
      }, { once: true })
      avatar.appendChild(img)
    }
    else {
      avatar.textContent = data.name.slice(0, 1)
    }

    const info = document.createElement('div')
    info.className = 'bvp-up__info'
    const nameRow = document.createElement('div')
    nameRow.className = 'bvp-up__name-row'
    const name = document.createElement('a')
    name.className = 'bvp-up__name'
    name.textContent = data.name
    name.title = data.name
    if (data.mid)
      name.href = `https://space.bilibili.com/${data.mid}`
    name.target = '_blank'
    name.rel = 'noopener noreferrer'
    nameRow.appendChild(name)
    info.appendChild(nameRow)
    if (data.signature) {
      const desc = document.createElement('div')
      desc.className = 'bvp-up__desc'
      desc.textContent = data.signature
      desc.title = data.signature
      info.appendChild(desc)
    }

    const actions = document.createElement('div')
    actions.className = 'bvp-up__actions'
    const followLabel = data.followed ? '已关注' : '+ 关注'
    const follow = buildButton(followLabel, `bvp-up__btn bvp-up__btn--follow${data.followed ? ' is-followed' : ''}`, () => {
      // 转发给原生关注按钮：不自己调接口
      findNativeButton(panel, FOLLOW_SELECTORS)?.click()
      window.setTimeout(syncUpCard, 300)
    })
    const message = buildButton('发消息', 'bvp-up__btn bvp-up__btn--message', () => {
      findNativeButton(panel, MESSAGE_SELECTORS)?.click()
    })
    actions.append(follow, message)

    card.append(avatar, info, actions)
  }
  hideNativeChildren(panel, card)
}

/**
 * 临时撤掉自绘卡、恢复原生（**保留桥监听**）。
 *
 * 第 79 轮修复：之前 sync 失败时直接调 teardownUpCard()，而 teardown 会 removeEventListener，
 * 导致「首次 mount 时面板还没渲染 → 监听被摘 → 桥数据到了也没人接」→ 头像永远停在首字兜底。
 */
function resetUpCard(): void {
  document.getElementById(UP_CARD_ID)?.remove()
  restoreNativeChildren()
  lastSignature = ''
}

/** 首屏 / 切视频时调用；返回 false 表示本次未启用自绘 */
export function syncUpCard(): boolean {
  const panel = document.querySelector<HTMLElement>(PANEL_SELECTOR)
  if (!panel) {
    resetUpCard()
    return false
  }
  const data = readOwner(panel)
  if (!data) {
    resetUpCard()
    return false
  }
  renderUpCard(panel, data)
  return true
}

export function setupUpCard(): () => void {
  startBridge()
  syncUpCard()
  return teardownUpCard
}

/** 卸载：移除自绘卡、恢复原生子元素、清缓存 */
export function teardownUpCard(): void {
  stopBridge()
  resetUpCard()
  bridgedOwner = null
  bridgedBvid = ''
}
