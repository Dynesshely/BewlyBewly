import { defineConfig } from 'vite'

import packageJson from './package.json'
import { isDev, isFirefox, isSafari, r } from './scripts/utils'
import { sharedConfig } from './vite.config'

// bundling the content script using Vite
export default defineConfig({
  ...sharedConfig,
  build: {
    watch: isDev
      ? {
          include: ['./**/*'],
        }
      : undefined,
    outDir: r(isFirefox
      ? 'extension-firefox/dist/contentScripts'
      : isSafari ? 'extension-safari/dist/contentScripts' : 'extension/dist/contentScripts'),
    cssCodeSplit: false,
    cssMinify: 'esbuild',
    emptyOutDir: false,
    sourcemap: false, // https://github.com/vitejs/vite-plugin-vue/issues/35
    lib: {
      entry: r('src/contentScripts/index.ts'),
      name: packageJson.name,
      formats: ['iife'],
      // vite 8 默认用 package name 作为 CSS 文件名，这里固定回 style.css
      cssFileName: 'style',
    },
    rollupOptions: {
      output: {
        entryFileNames: 'index.global.js',
        extend: true,
      },
    },
  },
})
