import type { App } from 'vue'

import { createPinia } from 'pinia'
import Toast, { POSITION } from 'vue-toastification'
import components from '~/components'

import { i18n } from '~/utils/i18n'
import 'vue-toastification/dist/index.css'

const pinia = createPinia()

/**
 * toast 插件是否已在**本页面**安装过。
 *
 * # 为什么需要这个守卫（第 106 轮真机发现）
 *
 * 第 93~103 轮的自绘页（空间 / 搜索 / 热门 / 分区 / 动态 / 消息）各自在 `mount.ts` 里
 * `createApp + setupApp`，而 `setupApp` 每次都 `app.use(Toast, …)` —— 每次 use 都会往
 * body 追加一个新的 toast 容器。真机实测空间页累积到 **12 个容器**，同一个事件被所有容器
 * 渲染：一次「已加入稍后再看」会同时弹出两条一模一样的 toast。
 *
 * 修法：Toast 只装一次（第一个 app 负责渲染容器），后续 app 不装。
 * 它们内部调用 `useToast()` 时拿不到注入，会回落到 vue-toastification 的 **globalEventBus**
 * —— 与第一个实例是同一个总线，所以提示仍然只渲染一次，而且行为完全一致。
 * （见 node_modules/vue-toastification 的 useToast：`inject(toastInjectionKey) ?? createToastInterface(globalEventBus)`）
 */
let toastInstalled = false

export async function setupApp(app: App) {
  // webext-bridge v6 移除了 getCurrentContext，这里按运行环境自行判断
  const context = typeof window !== 'undefined' && /^(?:chrome|moz)-extension:/.test(window.location.protocol)
    ? 'popup'
    : 'content-script'

  // Inject a globally available `$app` object in template
  app.config.globalProperties.$app = { context }

  // Provide access to `app` in script setup with `const app = inject('app')`
  app.provide('app', app.config.globalProperties.$app)

  // Here you can install additional plugins for all contexts: popup, options page and content-script.
  // example: app.use(i18n)
  // example excluding content-script context: if (context !== 'content-script') app.use(i18n)
  app.use(i18n)
  if (!toastInstalled) {
    toastInstalled = true
    app
      .use(Toast, {
        transition: 'Vue-Toastification__fade',
        maxToasts: 20,
        newestOnTop: true,
        position: POSITION.TOP_RIGHT,
      })
  }
  app.use(components)
  app.use(pinia)
}
