import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'

import { focusPage, launchExtension, openHomeFixture, skipIfExtensionMissing, waitForStableCardCount } from './utils'

/**
 * 第 20 轮：命令面板焦点陷阱回归。
 *
 * 第 19 轮给命令面板加了「捕获 Tab + preventDefault + 循环聚焦」的焦点陷阱；
 * 这里用真实键盘事件连续 Tab / Shift+Tab 5 次，断言焦点始终留在 .command-palette-mask 内。
 */
function readPaletteFocus(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('#bewly')?.shadowRoot
    const mask = root?.querySelector('.command-palette-mask') as HTMLElement | null
    let active = document.activeElement as HTMLElement | null
    while (active?.shadowRoot?.activeElement)
      active = active.shadowRoot.activeElement as HTMLElement
    return {
      maskExists: Boolean(mask),
      insideMask: Boolean(mask && active && (mask === active || mask.contains(active))),
      activeTag: active?.tagName ?? '',
      activeClass: typeof active?.className === 'string'
        ? active.className
        : '',
    }
  })
}

test.describe('命令面板焦点陷阱', () => {
  skipIfExtensionMissing()

  test('连按 Tab / Shift+Tab 5 次，焦点始终在面板内', async () => {
    const context = await launchExtension()

    try {
      const page = await context.newPage()
      await openHomeFixture(page, { minCards: 1 })
      await waitForStableCardCount(page, 2)
      await focusPage(page)

      await page.keyboard.press('Control+k')
      await expect.poll(async () => (await readPaletteFocus(page)).maskExists, { timeout: 15_000 }).toBe(true)
      // 打开后焦点应落在面板内（输入框）
      await expect.poll(async () => (await readPaletteFocus(page)).insideMask, { timeout: 10_000 }).toBe(true)

      for (let index = 1; index <= 5; index++) {
        await page.keyboard.press('Tab')
        const state = await readPaletteFocus(page)
        expect(state.maskExists, `Tab #${index} 后面板仍然存在`).toBe(true)
        expect(state.insideMask, `Tab #${index} 后焦点应留在面板内（当前 ${state.activeTag}.${state.activeClass}）`).toBe(true)
      }

      for (let index = 1; index <= 5; index++) {
        await page.keyboard.press('Shift+Tab')
        const state = await readPaletteFocus(page)
        expect(state.insideMask, `Shift+Tab #${index} 后焦点应留在面板内（当前 ${state.activeTag}.${state.activeClass}）`).toBe(true)
      }

      // Esc 关闭面板后焦点不应再被陷阱拦住
      await page.keyboard.press('Escape')
      await expect.poll(async () => (await readPaletteFocus(page)).maskExists, { timeout: 10_000 }).toBe(false)
    }
    finally {
      await context.close()
    }
  })
})
