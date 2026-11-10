/**
 * 原生页面增强层的通用外壳。
 *
 * 原生页（播放页、通知页、搜索页、用户空间……）不能替换 B 站 DOM，只能在上面叠加
 * 一个独立 shadow root 的浮层。这里把「建容器 → 挂样式 → 挂 Vue 应用 → 卸载清理」
 * 收敛成一处，避免每个页面模块重复一遍。
 */
import type { App } from 'vue'
import { createApp } from 'vue'

export interface NativeOverlayOptions {
  /** 容器 id（同时用于幂等判断） */
  hostId: string
  /** 浮层组件 */
  component: any
  /** 需要随组件一起注入 shadow root 的样式文本（scss?inline 或普通字符串） */
  css: string
  /** 附加到 host 上的属性（可选） */
  hostAttributes?: Record<string, string>
}

export interface NativeOverlayHandle {
  host: HTMLElement
  app: App
  /** 挂载点（Vue 组件挂在这个 div 下） */
  mountPoint: HTMLElement
  /** 卸载并移除 DOM */
  destroy: () => void
}

const mounted = new Map<string, NativeOverlayHandle>()

/** 挂载一个原生页浮层；同一个 hostId 重复调用返回既有实例 */
export function mountNativeOverlay(options: NativeOverlayOptions): NativeOverlayHandle {
  const existing = mounted.get(options.hostId)
  if (existing)
    return existing

  const host = document.createElement('div')
  host.id = options.hostId
  host.setAttribute('data-bewly-native-overlay', '')
  for (const [key, value] of Object.entries(options.hostAttributes ?? {}))
    host.setAttribute(key, value)

  const shadow = host.attachShadow({ mode: 'open' })
  if (options.css) {
    const styleEl = document.createElement('style')
    styleEl.textContent = options.css
    shadow.appendChild(styleEl)
  }

  const mountPoint = document.createElement('div')
  shadow.appendChild(mountPoint)
  document.body.appendChild(host)

  const app = createApp(options.component)
  app.mount(mountPoint)

  const handle: NativeOverlayHandle = {
    host,
    app,
    mountPoint,
    destroy: () => {
      mounted.delete(options.hostId)
      try {
        app.unmount()
      }
      catch {
        // 组件已卸载时忽略
      }
      host.remove()
    },
  }
  mounted.set(options.hostId, handle)
  return handle
}

/** 卸载指定浮层 */
export function unmountNativeOverlay(hostId: string): void {
  mounted.get(hostId)?.destroy()
}

/** 当前是否已挂载 */
export function hasNativeOverlay(hostId: string): boolean {
  return mounted.has(hostId)
}
