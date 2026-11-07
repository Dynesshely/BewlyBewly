import type { App, Plugin } from 'vue'

// Settings 面板是冷路径（体积大、打开频率低），从全局静态注册中排除，
// 由 App.vue 通过 defineAsyncComponent 按需加载，构建时拆成独立 chunk
const paths: Record<string, { default: Component }> = import.meta.glob([
  './*/*.vue',
  './*.vue',
  './OverlayScrollbarsComponent.ts',
  '!./Settings/**',
], { eager: true })

export default {
  install: (app: App) => {
    for (const path in paths) {
      const splitPath = path.split('/')
      const name = splitPath[splitPath.length - 1].replace('.vue', '').replace('.ts', '')
      app.component(name, paths[path].default)
    }
  },
} as Plugin
