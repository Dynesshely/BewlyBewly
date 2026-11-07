import { defineConfig } from 'vite'

import { isDev, isFirefox, isSafari, r } from './scripts/utils'
import { sharedConfig } from './vite.config'

const contentScriptsDir = isFirefox
  ? 'extension-firefox/dist/contentScripts/esm'
  : isSafari
    ? 'extension-safari/dist/contentScripts/esm'
    : 'extension/dist/contentScripts/esm'

/**
 * content script 的 ESM 构建（用于代码分割）。
 *
 * 主 content script（loader，IIFE）通过 `import(chrome.runtime.getURL(...))` 在运行时
 * 加载本配置产出的 ESM bundle；冷路径组件（如 Settings）会被拆成独立 chunk 按需下载。
 */
export default defineConfig({
  ...sharedConfig,
  base: '/dist/',
  build: {
    watch: isDev
      ? {
          include: ['./**/*'],
        }
      : undefined,
    outDir: r(contentScriptsDir),
    cssCodeSplit: false,
    cssMinify: 'esbuild',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    terserOptions: { mangle: false },
    rollupOptions: {
      input: r('src/contentScripts/index.ts'),
      output: {
        format: 'es',
        entryFileNames: 'index.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.names?.some(name => name.endsWith('.css')))
            return 'style.css'
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
})
