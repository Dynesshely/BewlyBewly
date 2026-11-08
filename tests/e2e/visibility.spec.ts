import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium, expect, test } from '@playwright/test'

import { routeBilibiliDocument } from './utils'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const EXTENSION_DIR = join(ROOT, 'extension')
const HOME_FIXTURE = join(ROOT, 'tests', 'e2e', 'fixtures', 'bilibili-home.html')

/**
 * 回归：页面挂载后必须可见。
 *
 * 曾出现过 style.css 路径错误导致 #bewly 透明度永久为 0 的黑屏问题，
 * 这里同时覆盖首屏与刷新后的场景。
 */
test.describe('扩展可见性回归', () => {
  test.skip(!existsSync(EXTENSION_DIR), '先运行 pnpm build 生成 extension/ 目录')

  test('#bewly 挂载后可见（含刷新）', async () => {
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
      await routeBilibiliDocument(page, HOME_FIXTURE)
      await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' })
      await expect(page.locator('#bewly')).toHaveCount(1, { timeout: 30_000 })

      const readState = () => page.evaluate(() => {
        const host = document.querySelector('#bewly')
        const root = host?.shadowRoot
        return {
          opacity: host
            ? getComputedStyle(host).opacity
            : null,
          styleSheets: root
            ? root.styleSheets.length
            : -1,
          textLen: (root?.textContent || '').length,
          cards: root
            ? root.querySelectorAll('[data-video-card]').length
            : -1,
        }
      })

      // 首屏：样式表加载后透明度应恢复为 1
      await expect.poll(async () => (await readState()).opacity, { timeout: 20_000 }).toBe('1')
      const first = await readState()
      expect(first.styleSheets).toBeGreaterThan(0)
      expect(first.textLen).toBeGreaterThan(0)

      // 刷新后仍然可见
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page.locator('#bewly')).toHaveCount(1, { timeout: 30_000 })
      await expect.poll(async () => (await readState()).opacity, { timeout: 20_000 }).toBe('1')
      const second = await readState()
      expect(second.styleSheets).toBeGreaterThan(0)
      expect(second.textLen).toBeGreaterThan(0)
    }
    finally {
      await context.close()
    }
  })
})
