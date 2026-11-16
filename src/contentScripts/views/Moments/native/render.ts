import type { DrawnActionType, DrawnMoment } from './types'

/**
 * 自绘卡片的渲染桥：每个原生列表项挂一个 Vue 渲染容器。
 *
 * 不用 `createApp`（一条动态一个 app 太重），而是用 `render(vnode, container)`
 * 直接挂载 / 补丁同一个组件实例；`signature` 用于跳过无变化的重复渲染。
 */
import { h, render } from 'vue'
import DrawnMomentCard from './components/DrawnMomentCard.vue'

export const DRAWN_SLOT_CLASS = 'bewly-moment-slot'

interface RenderedEntry {
  container: HTMLDivElement
  signature: string
}

const rendered = new WeakMap<Element, RenderedEntry>()

/** 数据指纹：真实变化（点赞数回写、加载更多后重解析）才重新渲染 */
export function momentSignature(moment: DrawnMoment): string {
  return JSON.stringify(moment)
}

export function getRenderedSignature(wrapper: Element): string {
  return rendered.get(wrapper)?.signature ?? ''
}

export function renderMoment(
  wrapper: HTMLElement,
  moment: DrawnMoment,
  signature: string,
  onAction: (type: DrawnActionType) => void,
): void {
  let entry = rendered.get(wrapper)
  if (!entry) {
    const container = document.createElement('div')
    container.className = DRAWN_SLOT_CLASS
    wrapper.appendChild(container)
    entry = { container, signature: '' }
    rendered.set(wrapper, entry)
  }

  entry.signature = signature
  render(h(DrawnMomentCard, { moment, onAction }), entry.container)
}

export function removeRenderedMoment(wrapper: Element): void {
  const entry = rendered.get(wrapper)
  if (!entry)
    return
  render(null, entry.container)
  entry.container.remove()
  rendered.delete(wrapper)
}
