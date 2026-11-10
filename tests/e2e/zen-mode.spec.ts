import { expect, test } from '@playwright/test'

import { focusPage, launchExtension, openHomeFixture, skipIfExtensionMissing, waitForStableCardCount } from './utils'

/**
 * 第 7 轮新增能力：全站清屏模式（Shift+Z）。
 *
 * 断言用户可见结果而不是实现细节：html / 根节点 class、Dock 是否隐藏、sessionStorage 是否记住状态。
 */
test.describe('全站清屏模式（Zen）', () => {
  skipIfExtensionMissing()

  test('Shift+Z 进入清屏，Shift+Z / Esc 退出，状态写进 sessionStorage', async () => {
    const context = await launchExtension()

    try {
      const page = await context.newPage()
      await openHomeFixture(page, { minCards: 1 })
      await waitForStableCardCount(page, 2)
      await focusPage(page)

      const readZen = () => page.evaluate(() => {
        const root = document.querySelector('#bewly')?.shadowRoot
        const wrapper = root?.querySelector('.bewly-wrapper') as HTMLElement | null
        const dock = root?.querySelector('.dock-wrap') as HTMLElement | null
        return {
          html: document.documentElement.classList.contains('bewly-zen'),
          wrapper: Boolean(wrapper?.classList.contains('bewly-zen')),
          session: sessionStorage.getItem('bewly-zen'),
          dockHidden: dock
            ? getComputedStyle(dock).display === 'none'
            : false,
        }
      })

      await page.keyboard.press('Shift+Z')
      await expect.poll(async () => (await readZen()).html, { timeout: 10_000 }).toBe(true)
      const zen = await readZen()
      expect(zen.wrapper).toBe(true)
      expect(zen.session).toBe('1')
      expect(zen.dockHidden).toBe(true)

      // Esc 退出清屏
      await page.keyboard.press('Escape')
      await expect.poll(async () => (await readZen()).html, { timeout: 10_000 }).toBe(false)
      const afterEsc = await readZen()
      expect(afterEsc.session).toBe('0')
      expect(afterEsc.dockHidden).toBe(false)

      // 再次 Shift+Z 进入，再用 Shift+Z 退出（快捷键互为开关）
      await page.keyboard.press('Shift+Z')
      await expect.poll(async () => (await readZen()).html, { timeout: 10_000 }).toBe(true)
      await page.keyboard.press('Shift+Z')
      await expect.poll(async () => (await readZen()).html, { timeout: 10_000 }).toBe(false)
    }
    finally {
      await context.close()
    }
  })
})
