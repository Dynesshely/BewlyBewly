import type { App } from 'vue'

import { createPinia } from 'pinia'
import Toast, { POSITION } from 'vue-toastification'
import components from '~/components'

import { i18n } from '~/utils/i18n'
import 'vue-toastification/dist/index.css'

const pinia = createPinia()

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
  app
    .use(Toast, {
      transition: 'Vue-Toastification__fade',
      maxToasts: 20,
      newestOnTop: true,
      position: POSITION.TOP_RIGHT,
    })
  app.use(components)
  app.use(pinia)
}
