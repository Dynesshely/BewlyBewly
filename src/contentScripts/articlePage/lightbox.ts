/**
 * 正文图片点击放大（lightbox）。
 *
 * 只在阅读增强找到的正文容器里生效：
 *   - 点击 <img> 时阻止原生的「在新标签页打开图片」行为，改为打开浮层；
 *   - 同文图片按文档顺序组成 ←/→ 序列；
 *   - 打开时锁页面滚动、记住 scrollY，关闭时恢复滚动位置；
 *   - Esc / 点击遮罩关闭（键盘在 shortcuts.ts 里统一处理）。
 *
 * 不做缩放 / 拖拽：需求只要求「至少 Esc、←/→、点遮罩、恢复滚动位置」，
 * 保持最小实现，避免和 B 站页面的滚动手势冲突。
 */
import { ROOT_CLASS_LIGHTBOX } from './constants'
import { getContentEl, getContentImages, getContentScope, getImageSrc } from './dom'
import { ui } from './state'

/** 点击图片时用来定位「同文图片」的正文容器 */
let clickHandler: ((event: MouseEvent) => void) | null = null

function handleContentImageClick(event: MouseEvent): void {
  if (ui.lightbox.open || event.defaultPrevented)
    return

  const target = event.target
  if (!(target instanceof Element))
    return

  const content = getContentEl()
  if (!content || !content.contains(target))
    return

  const img = target.closest('img')
  if (!(img instanceof HTMLImageElement))
    return

  const src = getImageSrc(img)
  if (!src)
    return

  // 图片常被 <a> 包住：点图是要放大，而不是跳转
  event.preventDefault()
  event.stopPropagation()
  openLightbox(content, src)
}

/** 绑定正文图片点击（捕获阶段，先于 B 站自身监听器） */
export function setupImageLightbox(): () => void {
  clickHandler = handleContentImageClick
  document.addEventListener('click', clickHandler, true)
  return () => {
    if (clickHandler)
      document.removeEventListener('click', clickHandler, true)
    clickHandler = null
  }
}

export function openLightbox(content: HTMLElement, src: string): void {
  // opus 的图可能挂在 .opus-detail 下而不是最内层正文容器里，按「文章范围」收集整组图
  const scope = getContentScope(content) ?? content
  const images = getContentImages(scope).map(getImageSrc)
  const index = images.indexOf(src)

  ui.lightbox.images = images.length > 0
    ? images
    : [src]
  ui.lightbox.index = index >= 0
    ? index
    : 0
  ui.lightbox.open = true
  ui.lightbox.scrollY = window.scrollY
  document.documentElement.classList.add(ROOT_CLASS_LIGHTBOX)
}

export function closeLightbox(): void {
  if (!ui.lightbox.open)
    return

  const { scrollY } = ui.lightbox
  ui.lightbox.open = false
  document.documentElement.classList.remove(ROOT_CLASS_LIGHTBOX)

  // overflow:hidden 去掉后浏览器会保留位置，这里只在本该恢复时校正一次
  if (Math.abs(window.scrollY - scrollY) > 1)
    window.scrollTo({ top: scrollY, behavior: 'auto' })
}

/** ←/→ 切换同文图片（到两端就停住，不循环） */
export function stepLightboxImage(delta: number): void {
  if (!ui.lightbox.open)
    return
  const next = Math.min(
    ui.lightbox.images.length - 1,
    Math.max(0, ui.lightbox.index + delta),
  )
  if (next !== ui.lightbox.index)
    ui.lightbox.index = next
}

/** 卸载 / 离开文章页时清理（不恢复滚动位置，页面状态已经不需要了） */
export function cleanupLightbox(): void {
  document.documentElement.classList.remove(ROOT_CLASS_LIGHTBOX)
  ui.lightbox.open = false
  ui.lightbox.images = []
  ui.lightbox.index = 0
  ui.lightbox.scrollY = 0
}
