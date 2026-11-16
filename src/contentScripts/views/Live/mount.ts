/**
 * 自绘直播页的挂载外壳。
 *
 * 直播站（live.bilibili.com）上 Bewly 的 SPA 并不运行，所有自绘内容都需要模块自己
 * 建容器 + 挂 Vue 应用 + 注入样式。这里把「建 shadow host → 挂样式 → 挂组件 → 卸载」
 * 收敛成一处，供首页 / 直播间信息栏 / 侧栏推荐三处复用。
 */
import type { App, Component } from 'vue'
import { createApp, h } from 'vue'

export interface ShadowMountOptions {
  /** 容器 id，同时用于幂等 */
  id: string
  /** 挂到哪个父节点下（null = document.body） */
  parent: HTMLElement | null
  /** 组件 */
  component: Component
  /** 传给组件的 props */
  props?: Record<string, unknown>
  /** 注入 shadow root 的样式文本（scss?inline） */
  css: string
  /** host 自身的定位样式（内联，页面级，不受 shadow 限制） */
  hostStyle?: Partial<CSSStyleDeclaration>
  /** 附加到 host 的属性 */
  attributes?: Record<string, string>
}

export interface ShadowMountHandle {
  id: string
  host: HTMLElement
  app: App
  /** 容器是否还在文档里（被 Vue 重渲染摘掉时需要重新 append） */
  isConnected: () => boolean
  /** 重新挂到父节点末尾（父节点没变时直接 appendChild） */
  reattach: () => void
  destroy: () => void
}

const mounted = new Map<string, ShadowMountHandle>()

/** 挂载一个 shadow 容器；同 id 重复调用返回既有实例 */
export function mountShadow(options: ShadowMountOptions): ShadowMountHandle {
  const existing = mounted.get(options.id)
  if (existing)
    return existing

  const host = document.createElement('div')
  host.id = options.id
  host.setAttribute('data-bewly-live-drawn', '')
  for (const [key, value] of Object.entries(options.attributes ?? {}))
    host.setAttribute(key, value)
  if (options.hostStyle)
    Object.assign(host.style, options.hostStyle)

  const shadow = host.attachShadow({ mode: 'open' })
  if (options.css) {
    const style = document.createElement('style')
    style.textContent = options.css
    shadow.appendChild(style)
  }

  const mountPoint = document.createElement('div')
  mountPoint.className = 'bew-live-mount-point'
  shadow.appendChild(mountPoint)

  const parent = options.parent ?? document.body
  parent.appendChild(host)

  const app = createApp({
    render: () => h(options.component as Component, options.props ?? {}),
  })
  app.mount(mountPoint)

  const handle: ShadowMountHandle = {
    id: options.id,
    host,
    app,
    isConnected: () => host.isConnected,
    reattach: () => {
      const target = options.parent ?? document.body
      if (host.parentElement !== target)
        target.appendChild(host)
    },
    destroy: () => {
      mounted.delete(options.id)
      try {
        app.unmount()
      }
      catch {
        // 已卸载时忽略
      }
      host.remove()
    },
  }
  mounted.set(options.id, handle)
  return handle
}

/** 取已挂载的容器 */
export function getShadowMount(id: string): ShadowMountHandle | null {
  return mounted.get(id) ?? null
}

/** 卸载指定容器 */
export function unmountShadow(id: string): void {
  mounted.get(id)?.destroy()
}

/** 卸载全部容器 */
export function unmountAllShadow(): void {
  for (const handle of [
    ...mounted.values(),
  ])
    handle.destroy()
}
