/**
 * 播放器视频裁切（object-fit: cover）+ 播放器菜单开关（第 40 轮，内化自油猴脚本）。
 *
 * 做法：
 * 1. 给 `<body>` 加 `data-video-fit` 属性，配合注入的 CSS
 *    `body[data-video-fit] #bilibili-player video { object-fit: cover }`
 *    —— 用属性而不是直接改 video 的内联样式，方便一键还原、也不会和 B 站自己的样式打架；
 * 2. 在播放器「设置」菜单（`.bpx-player-ctrl-setting-menu-left`）里注入一个「视频裁切」开关项，
 *    与油猴脚本同款位置：点一下切换 `settings.siteTweaksVideoFit`，菜单不关。
 *
 * 菜单是 B 站动态渲染的，所以用 MutationObserver 观察，只在「菜单出现且还没注入过」时补。
 */

import { settings } from '~/logic'
import { injectCSS } from '~/utils/dom'

/** body 上的标记属性（CSS 与外部断言都用它） */
export const VIDEO_FIT_ATTR = 'data-video-fit'
/** 注入开关项的标记属性，避免重复注入 */
const MENU_ITEM_ATTR = 'data-bewly-video-fit-item'

const CSS = `
body[data-video-fit] #bilibili-player video,
body[data-video-fit] .bpx-player-video-wrap video {
  object-fit: cover !important;
}
`

let styleEl: HTMLStyleElement | null = null
let observer: MutationObserver | null = null

/** 当前开关是否开启（读 settings，兜底 false） */
function isEnabled(): boolean {
  return Boolean(settings.value.siteTweaksVideoFit)
}

/** 同步 body 属性（CSS 的唯一开关点） */
function syncBodyAttribute(): void {
  if (isEnabled())
    document.body?.setAttribute(VIDEO_FIT_ATTR, '')
  else
    document.body?.removeAttribute(VIDEO_FIT_ATTR)
}

/** 生成菜单项（结构与 B 站设置菜单里的其它项保持相近：一行 + 右侧开关） */
function createMenuItem(): HTMLElement {
  const item = document.createElement('li')
  item.className = 'bpx-player-ctrl-setting-menu-item bewly-video-fit-item'
  item.setAttribute(MENU_ITEM_ATTR, '')
  item.setAttribute('role', 'menuitemcheckbox')
  item.tabIndex = 0
  item.innerHTML = `
    <span class="bewly-video-fit-label">视频裁切</span>
    <span class="bewly-video-fit-switch" aria-hidden="true"></span>
  `
  return item
}

/** 同步菜单项的选中态（aria-checked + data-checked 给 CSS 用） */
function syncMenuItem(item: HTMLElement): void {
  const on = isEnabled()
  item.setAttribute('aria-checked', String(on))
  item.dataset.checked = on ? '1' : '0'
}

/** 点一下切换设置（不关闭菜单：阻止事件继续冒泡到 B 站的菜单逻辑） */
function onMenuItemClick(event: MouseEvent): void {
  const target = event.currentTarget
  if (!(target instanceof HTMLElement))
    return
  event.preventDefault()
  event.stopPropagation()
  settings.value.siteTweaksVideoFit = !isEnabled()
  syncBodyAttribute()
  syncMenuItem(target)
}

/** 键盘 Enter / Space 同样可切换 */
function onMenuItemKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ')
    return
  const target = event.currentTarget
  if (!(target instanceof HTMLElement))
    return
  event.preventDefault()
  settings.value.siteTweaksVideoFit = !isEnabled()
  syncBodyAttribute()
  syncMenuItem(target)
}

/** 把开关项补进设置菜单（幂等） */
function injectMenuItem(): void {
  const menu = document.querySelector<HTMLElement>('.bpx-player-ctrl-setting-menu-left')
  if (!menu || menu.querySelector(`[${MENU_ITEM_ATTR}]`))
    return

  const item = createMenuItem()
  syncMenuItem(item)
  item.addEventListener('click', onMenuItemClick)
  item.addEventListener('keydown', onMenuItemKeydown)
  menu.appendChild(item)
}

/** 开启：注入 CSS + body 属性 + 菜单观察 */
export function setupVideoFit(): void {
  if (!styleEl?.isConnected)
    styleEl = injectCSS(CSS)
  syncBodyAttribute()
  injectMenuItem()

  if (observer)
    return
  observer = new MutationObserver(() => injectMenuItem())
  observer.observe(document.documentElement, { childList: true, subtree: true })
}

/**
 * 每拍同步（由 syncSiteTweaks 调用）。
 *
 * 覆盖两种时序：设置页改了开关、B 站重建了播放器/菜单。
 */
export function syncVideoFit(): void {
  syncBodyAttribute()
  injectMenuItem()
  const item = document.querySelector<HTMLElement>(`[${MENU_ITEM_ATTR}]`)
  if (item)
    syncMenuItem(item)
}

/** 关闭：移除样式、body 属性、菜单项与观察器 */
export function teardownVideoFit(): void {
  observer?.disconnect()
  observer = null
  styleEl?.remove()
  styleEl = null
  document.body?.removeAttribute(VIDEO_FIT_ATTR)
  document.querySelectorAll<HTMLElement>(`[${MENU_ITEM_ATTR}]`).forEach((node) => {
    node.removeEventListener('click', onMenuItemClick)
    node.removeEventListener('keydown', onMenuItemKeydown)
    node.remove()
  })
}
