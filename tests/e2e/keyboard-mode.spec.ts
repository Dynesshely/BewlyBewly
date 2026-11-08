import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium, expect, test } from '@playwright/test'

import { routeBilibiliDocument } from './utils'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const EXTENSION_DIR = join(ROOT, 'extension')
const HOME_FIXTURE = join(ROOT, 'tests', 'e2e', 'fixtures', 'bilibili-home.html')

test.describe('键盘模式开关', () => {
  test.skip(!existsSync(EXTENSION_DIR), '先运行 pnpm build 生成 extension/ 目录')

  test('命令面板可关闭/恢复键盘卡片导航', async () => {
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
      await page.waitForFunction(
        () => (document.querySelector('#bewly')?.shadowRoot?.querySelectorAll('[data-video-card]').length ?? 0) > 3,
        undefined,
        { timeout: 30_000 },
      )

      const read = () => page.evaluate(() => {
        const root = document.querySelector('#bewly')?.shadowRoot
        const cards = root
          ? Array.from(root.querySelectorAll('[data-video-card]'))
          : []
        return {
          disabled: document.documentElement.hasAttribute('data-keyboard-nav-disabled'),
          active: cards.findIndex(card => card.hasAttribute('data-keyboard-active')),
        }
      })

      // 默认开启：方向键应移动高亮
      await expect.poll(async () => (await read()).active, { timeout: 10_000 }).toBeGreaterThanOrEqual(0)
      const initial = (await read()).active
      await page.keyboard.press('ArrowRight')
      await expect.poll(async () => (await read()).active, { timeout: 5_000 }).not.toBe(initial)

      // 通过命令面板关闭
      const toggle = async () => {
        await page.keyboard.press('Control+k')
        await expect.poll(() => page.evaluate(() => !!document.querySelector('#bewly')?.shadowRoot?.querySelector('.command-palette')), { timeout: 5_000 }).toBe(true)
        await page.evaluate(() => {
          const root = document.querySelector('#bewly')?.shadowRoot
          const items = Array.from(root?.querySelectorAll('.command-palette-item') ?? [])
          const target = items.find(el => (el.textContent || '').includes('键盘卡片导航') || (el.textContent || '').toLowerCase().includes('keyboard card'))
          target?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        })
        await page.waitForTimeout(400)
      }

      await toggle()
      await expect.poll(async () => (await read()).disabled, { timeout: 5_000 }).toBe(true)
      await expect.poll(async () => (await read()).active, { timeout: 5_000 }).toBe(-1)

      // 关闭后方向键不再切换
      const before = await read()
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(300)
      const after = await read()
      expect(after.active).toBe(before.active)

      // 再开回来
      await toggle()
      await expect.poll(async () => (await read()).disabled, { timeout: 5_000 }).toBe(false)
      await expect.poll(async () => (await read()).active, { timeout: 5_000 }).toBeGreaterThanOrEqual(0)
    }
    finally {
      await context.close()
    }
  })
})
