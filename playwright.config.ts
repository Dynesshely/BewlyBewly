import { defineConfig } from '@playwright/test'

/**
 * 无头浏览器测试环境。
 *
 * - dom-probe：离线快照 + 可选的线上探测，用来发现 B 站上游 DOM 变更
 * - extension：加载构建产物，验证扩展在 B 站页面上的挂载
 *
 * 使用系统 Edge（channel: 'msedge'），无需下载 Playwright 自带浏览器。
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    channel: 'msedge',
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
})
