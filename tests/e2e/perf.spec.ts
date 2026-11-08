import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium, expect, test } from '@playwright/test'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const EXTENSION_DIR = join(ROOT, 'extension')
const HOME_FIXTURE = join(ROOT, 'tests', 'e2e', 'fixtures', 'bilibili-home.html')

/**
 * 首屏性能基线：记录 #bewly 挂载与首屏卡片出现耗时，作为回归对照。
 */
test.describe('首屏性能基线', () => {
  test.skip(!existsSync(EXTENSION_DIR), '先运行 pnpm build 生成 extension/ 目录')

  test('记录 #bewly 挂载与首屏卡片耗时', async () => {
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
      await context.route(/^https:\/\/www\.bilibili\.com(\/.*)?$/, (route) => {
        route.fulfill({
          status: 200,
          contentType: 'text/html; charset=utf-8',
          body: readFileSync(HOME_FIXTURE, 'utf-8'),
        })
      })

      const start = Date.now()
      await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' })

      await expect(page.locator('#bewly')).toHaveCount(1, { timeout: 30_000 })
      const mountMs = Date.now() - start

      await page.waitForFunction(
        () => (document.querySelector('#bewly')?.shadowRoot?.querySelectorAll('[data-video-card]').length ?? 0) > 0,
        undefined,
        { timeout: 30_000 },
      )
      const cardsMs = Date.now() - start

      test.info().annotations.push(
        { type: 'perf', description: `#bewly mount: ${mountMs}ms, first cards: ${cardsMs}ms` },
      )

      // 宽松上限，仅用于发现明显回退
      expect(mountMs).toBeLessThan(30_000)
      expect(cardsMs).toBeLessThan(30_000)
    }
    finally {
      await context.close()
    }
  })
})
