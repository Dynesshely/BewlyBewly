import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium, expect, test } from '@playwright/test'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const EXTENSION_DIR = join(ROOT, 'extension')
const HOME_FIXTURE = join(ROOT, 'tests', 'e2e', 'fixtures', 'bilibili-home.html')

test.describe('键盘卡片导航', () => {
  test.skip(!existsSync(EXTENSION_DIR), '先运行 pnpm build 生成 extension/ 目录')

  test('方向键切换高亮、回车新标签、空格当前标签', async () => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${EXTENSION_DIR}`,
        `--load-extension=${EXTENSION_DIR}`,
        '--disable-popup-blocking',
      ],
      viewport: { width: 1440, height: 900 },
    })

    try {
      const page = await context.newPage()

      // 用本地快照替代真实 B 站首页
      await context.route('https://www.bilibili.com/**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'text/html; charset=utf-8',
          body: readFileSync(HOME_FIXTURE, 'utf-8'),
        })
      })

      await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' })
      await expect(page.locator('#bewly')).toHaveCount(1, { timeout: 30_000 })
      await page.waitForFunction(
        () => (document.querySelector('#bewly')?.shadowRoot?.querySelectorAll('[data-video-card]').length ?? 0) > 3,
        undefined,
        { timeout: 30_000 },
      )

      // 注入不受 Vue 管理的测试卡片（带视频链接），避免依赖骨架卡片数据
      await page.evaluate(() => {
        const root = document.querySelector('#bewly')!.shadowRoot!
        const container = root.querySelector('.bewly-scroll-container') || root.querySelector('#bewly-wrapper') || root
        for (let i = 0; i < 4; i++) {
          const el = document.createElement('div')
          el.setAttribute('data-video-card', '')
          el.setAttribute('data-video-url', `https://www.bilibili.com/video/BVTEST${i}`)
          el.style.cssText = 'height: 120px; display: block'
          container.appendChild(el)
        }
      })

      const getActiveIndex = () => page.evaluate(() => {
        const root = document.querySelector('#bewly')!.shadowRoot!
        return Array.from(root.querySelectorAll('[data-video-card]')).findIndex(card => card.hasAttribute('data-keyboard-active'))
      })

      // 初始高亮
      await expect.poll(getActiveIndex, { timeout: 10_000 }).toBeGreaterThanOrEqual(0)
      const initial = await getActiveIndex()

      // 方向键切换
      await page.keyboard.press('ArrowRight')
      await expect.poll(getActiveIndex, { timeout: 5_000 }).not.toBe(initial)

      // 跳到最后一个卡片（注入的测试卡片带视频链接）
      await page.keyboard.press('End')
      const lastIndex = await page.evaluate(() => {
        const root = document.querySelector('#bewly')!.shadowRoot!
        return root.querySelectorAll('[data-video-card]').length - 1
      })
      await expect.poll(getActiveIndex, { timeout: 5_000 }).toBe(lastIndex)

      // 回车：新标签打开
      const tabsBefore = context.pages().length
      await page.keyboard.press('Enter')
      await expect.poll(() => context.pages().length, { timeout: 10_000 }).toBeGreaterThan(tabsBefore)

      // 空格：当前标签打开
      await page.keyboard.press('Space')
      await expect.poll(() => page.url(), { timeout: 10_000 }).toContain('/video/BVTEST')
    }
    finally {
      await context.close()
    }
  })
})
