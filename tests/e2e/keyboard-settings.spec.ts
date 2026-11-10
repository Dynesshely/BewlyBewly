import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium, expect, test } from '@playwright/test'

import { routeBilibiliDocument } from './utils'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const EXTENSION_DIR = join(ROOT, 'extension')
const HOME_FIXTURE = join(ROOT, 'tests', 'e2e', 'fixtures', 'bilibili-home.html')

test.describe('键盘与快捷键设置', () => {
  test.skip(!existsSync(EXTENSION_DIR), '先运行 pnpm build 生成 extension/ 目录')

  test('设置页可打开、能改键、能恢复默认', async () => {
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

      const paletteOpen = () => page.evaluate(() => !!document.querySelector('#bewly')?.shadowRoot?.querySelector('.command-palette-mask'))
      const settingsOpen = () => page.evaluate(() => !!document.querySelector('#bewly')?.shadowRoot?.querySelector('#settings-window'))

      // 命令面板 → 打开设置
      await page.keyboard.press('Control+k')
      await expect.poll(paletteOpen, { timeout: 5_000 }).toBe(true)
      await expect.poll(() => page.evaluate(() => {
        const root = document.querySelector('#bewly')?.shadowRoot
        return Array.from(root?.querySelectorAll('.command-palette-item') ?? [])
          .some(el => /settings|设置/i.test(el.textContent || ''))
      }), { timeout: 5_000 }).toBe(true)
      await page.evaluate(() => {
        const root = document.querySelector('#bewly')!.shadowRoot!
        Array.from(root.querySelectorAll('.command-palette-item'))
          .find(el => /settings|设置/i.test(el.textContent || ''))
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await expect.poll(settingsOpen, { timeout: 15_000 }).toBe(true)

      // 切到「键盘与快捷键」
      const keyboardPanel = () => page.evaluate(() => (document
        .querySelector('#bewly')
        ?.shadowRoot
        ?.querySelectorAll('.keyboard-shortcut-row')
        ?.length ?? 0))
      await page.evaluate(() => {
        const root = document.querySelector('#bewly')!.shadowRoot!
        const win = root.querySelector('#settings-window')
        Array.from(win?.querySelectorAll('li a') ?? [])
          .find(a => /键盘|keyboard/i.test(a.textContent || ''))
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await expect.poll(keyboardPanel, { timeout: 15_000 }).toBeGreaterThan(5)

      // 打开方式下拉框数量 = 2（Enter / Space）
      const selectCount = await page.evaluate(() => document
        .querySelector('#bewly')
        ?.shadowRoot
        ?.querySelectorAll('#settings-window .right-content div[cursor="pointer"]')
        ?.length ?? 0)
      expect(selectCount).toBeGreaterThanOrEqual(2)

      // 改键：第一行（Enter）改成 E
      const firstBtnText = () => page.evaluate(() => document
        .querySelector('#bewly')
        ?.shadowRoot
        ?.querySelector('.keyboard-key-btn')
        ?.textContent
        ?.trim() ?? '')
      expect(await firstBtnText()).toBe('Enter')

      // 点击进入等待按键状态（用 capturing 类判断，避免依赖界面语言）
      await page.evaluate(() => {
        document
          .querySelector('#bewly')!
          .shadowRoot!
          .querySelector<HTMLElement>('.keyboard-key-btn')
          ?.click()
      })
      const capturing = () => page.evaluate(() => document
        .querySelector('#bewly')
        ?.shadowRoot
        ?.querySelector('.keyboard-key-btn')
        ?.classList
        .contains('capturing') ?? false)
      await expect.poll(capturing, { timeout: 5_000 }).toBe(true)

      await page.keyboard.press('e')
      await expect.poll(firstBtnText, { timeout: 5_000 }).toBe('E')

      // 恢复全部默认
      await page.evaluate(() => {
        document
          .querySelector('#bewly')!
          .shadowRoot!
          .querySelector<HTMLElement>('.keyboard-restore-btn')
          ?.click()
      })
      await expect.poll(firstBtnText, { timeout: 5_000 }).toBe('Enter')
    }
    finally {
      await context.close()
    }
  })
})
