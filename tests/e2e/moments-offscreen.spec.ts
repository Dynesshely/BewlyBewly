import { expect, test } from '@playwright/test'

import {
  focusPage,
  launchExtension,
  openHomeFixture,
  readExtensionSettings,
  skipIfExtensionMissing,
} from './utils'

/**
 * 第 10–11 轮新增能力：长列表离屏优化开关（设置页「页面增强 → 动态页 → 离屏优化」）。
 *
 * 动态页卡片需要登录态，这里只验证开关本身：
 * 1. 默认开启；2. 可被点击关闭；3. 关闭后写入扩展 settings（持久化）。
 */
test.describe('动态页离屏优化开关', () => {
  skipIfExtensionMissing()

  test('设置页可关闭离屏优化，并持久化到扩展设置', async () => {
    const context = await launchExtension()

    try {
      const page = await context.newPage()
      await openHomeFixture(page)
      await focusPage(page)

      // 命令面板 → 打开设置（与 keyboard-settings 用例同一路径）
      await page.keyboard.press('Control+k')
      await expect.poll(
        () => page.evaluate(() => Boolean(document.querySelector('#bewly')?.shadowRoot?.querySelector('.command-palette-mask'))),
        { timeout: 10_000 },
      ).toBe(true)
      await page.evaluate(() => {
        const root = document.querySelector('#bewly')?.shadowRoot
        const item = Array.from(root?.querySelectorAll('.command-palette-item') ?? [])
          .find(el => /settings|设置/i.test(el.textContent || ''))
        item?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await expect.poll(
        () => page.evaluate(() => Boolean(document.querySelector('#bewly')?.shadowRoot?.querySelector('#settings-window'))),
        { timeout: 20_000 },
      ).toBe(true)

      // 切到「页面增强」分组
      await page.evaluate(() => {
        const win = document.querySelector('#bewly')?.shadowRoot?.querySelector('#settings-window')
        const link = Array.from(win?.querySelectorAll('li a') ?? [])
          .find(a => /page enhancements|页面增强/i.test(a.textContent || ''))
        link?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      const readOptimizeToggle = () => page.evaluate(() => {
        const win = document.querySelector('#bewly')?.shadowRoot?.querySelector('#settings-window')
        const row = Array.from(win?.querySelectorAll('.b-settings-item') ?? [])
          .find(el => /off-screen optimization|离屏优化/i.test(el.textContent || '')) as HTMLElement | undefined
        const input = row?.querySelector('input[type="checkbox"]') as HTMLInputElement | null
        return {
          found: Boolean(row),
          checked: input ? input.checked : null,
        }
      })

      await expect.poll(async () => (await readOptimizeToggle()).found, { timeout: 20_000 }).toBe(true)
      const initial = await readOptimizeToggle()
      expect(initial.checked).toBe(true)

      // 点击开关（SettingsItem 右侧 right-content 里的 Radio 是隐藏 input + label 组合）
      const clicked = await page.evaluate(() => {
        const win = document.querySelector('#bewly')?.shadowRoot?.querySelector('#settings-window')
        const row = Array.from(win?.querySelectorAll('.b-settings-item') ?? [])
          .find(el => /off-screen optimization|离屏优化/i.test(el.textContent || '')) as HTMLElement | undefined
        const label = row?.querySelector('.right-content label') as HTMLElement | null
        label?.click()
        return Boolean(label)
      })
      expect(clicked).toBe(true)

      await expect.poll(async () => (await readOptimizeToggle()).checked, { timeout: 10_000 }).toBe(false)

      // 开关写入扩展设置（storage.local 的 settings，JSON 字符串）
      await expect.poll(async () => (await readExtensionSettings(context)).momentsOptimizeEnabled, { timeout: 10_000 }).toBe(false)

      // 复原，避免影响后续用例（每次用例其实都是新 profile，这里只是保持自洽）
      await page.evaluate(() => {
        const win = document.querySelector('#bewly')?.shadowRoot?.querySelector('#settings-window')
        const row = Array.from(win?.querySelectorAll('.b-settings-item') ?? [])
          .find(el => /off-screen optimization|离屏优化/i.test(el.textContent || '')) as HTMLElement | undefined
        const label = row?.querySelector('.right-content label') as HTMLElement | null
        label?.click()
      })
      await expect.poll(async () => (await readOptimizeToggle()).checked, { timeout: 10_000 }).toBe(true)
    }
    finally {
      await context.close()
    }
  })
})
