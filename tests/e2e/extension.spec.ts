import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium, expect, test } from '@playwright/test'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const EXTENSION_DIR = join(ROOT, 'extension')
const HOME_FIXTURE = join(ROOT, 'tests', 'e2e', 'fixtures', 'bilibili-home.html')

test.describe('扩展挂载冒烟测试', () => {
  test.skip(!existsSync(EXTENSION_DIR), '先运行 pnpm build 生成 extension/ 目录')

  test('在 B 站首页 fixture 上挂载 #bewly', async () => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${EXTENSION_DIR}`,
        `--load-extension=${EXTENSION_DIR}`,
      ],
      viewport: { width: 1440, height: 900 },
    })

    try {
      const page = await context.newPage()

      // 用本地快照替代真实 B 站首页，避免依赖线上环境
      await context.route('https://www.bilibili.com/**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'text/html; charset=utf-8',
          body: readFileSync(HOME_FIXTURE, 'utf-8'),
        })
      })

      await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' })

      // 内容脚本会在页面里创建 #bewly 容器并挂载 Shadow DOM
      await expect(page.locator('#bewly')).toHaveCount(1, { timeout: 30_000 })

      const shadowMounted = await page.evaluate(() => {
        const host = document.querySelector('#bewly')
        return !!host?.shadowRoot?.querySelector('#bewly-wrapper, .bewly-wrapper')
      })
      expect(shadowMounted).toBe(true)
    }
    finally {
      await context.close()
    }
  })
})
