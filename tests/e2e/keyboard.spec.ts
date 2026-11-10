import { expect, test } from '@playwright/test'

import {
  expectActiveCardUrl,
  focusPage,
  injectTestCards,
  launchExtension,
  openHomeFixture,
  readActiveCardUrl,
  waitForKeyboardHighlight,
  waitForStableCardCount,
} from './utils'

/**
 * 键盘卡片导航回归。
 *
 * 稳定性要点（修掉历史上的 flaky）：
 * - 统一用 openHomeFixture 等「扩展就绪 + 卡片数量稳定」，不再按固定数量 / 固定 timeout 判断；
 * - 断言用「高亮卡片的 data-video-url」而不是卡片索引：卡片分批渲染时索引会漂移；
 * - End / Enter 之前先把状态归一化（Home → 等待高亮出现），并把注入的测试卡片放在最后；
 * - 新标签页用 context.waitForEvent('page') 等待，不再轮询 context.pages().length。
 */
test.describe('键盘卡片导航', () => {
  test('方向键切换高亮、回车新标签、空格当前标签', async () => {
    const context = await launchExtension({ allowPopups: true })

    try {
      const page = await context.newPage()
      await openHomeFixture(page, { minCards: 1 })

      // 卡片数量稳定后再注入测试卡片，避免渲染中的数量变化影响 End 的落点
      await waitForStableCardCount(page, 4)
      const injected = await injectTestCards(page, 4, 'BVE2EKEY')
      await waitForStableCardCount(page, 4 + injected.length)

      await focusPage(page)

      // 状态归一化：先跳到第一张
      await page.keyboard.press('Home')
      const firstUrl = await waitForKeyboardHighlight(page)

      // 方向键：高亮必须离开第一张（用 URL 判断，避免索引漂移）
      await page.keyboard.press('ArrowRight')
      await expect.poll(async () => {
        const url = await readActiveCardUrl(page)
        return url !== '' && url !== firstUrl
      }, { timeout: 10_000, message: '方向键后高亮应移动到另一张卡片' }).toBe(true)

      // End：落到最后一张（注入的测试卡片，带 video URL）
      await page.keyboard.press('End')
      await expectActiveCardUrl(page, injected[injected.length - 1])

      // 回车：新标签打开
      const [popup] = await Promise.all([
        context.waitForEvent('page', { timeout: 15_000 }),
        page.keyboard.press('Enter'),
      ])
      expect(popup.url()).toContain('/video/')
      await popup.close().catch(() => {})

      // 空格：在当前页打开内嵌预览抽屉（不整页跳转）
      await page.bringToFront()
      await focusPage(page)
      await page.keyboard.press('Space')
      await expect.poll(
        () => page.evaluate(() => Boolean(document.querySelector('#bewly')?.shadowRoot?.querySelector('.bewly-iframe-drawer'))),
        { timeout: 15_000, message: '空格应打开内嵌预览抽屉' },
      ).toBe(true)
    }
    finally {
      await context.close()
    }
  })

  test('? 打开/关闭快捷键帮助面板', async () => {
    const context = await launchExtension()

    try {
      const page = await context.newPage()
      await openHomeFixture(page, { minCards: 1 })
      await focusPage(page)

      const helpVisible = () => page.evaluate(() => Boolean(document.querySelector('#bewly')?.shadowRoot?.querySelector('.keyboard-help-panel')))

      await page.keyboard.press('?')
      await expect.poll(helpVisible, { timeout: 10_000 }).toBe(true)

      await page.keyboard.press('?')
      await expect.poll(helpVisible, { timeout: 10_000 }).toBe(false)
    }
    finally {
      await context.close()
    }
  })
})
