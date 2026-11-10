import { expect, test } from '@playwright/test'

import { focusPage, launchExtension, openHomeFixture, skipIfExtensionMissing, waitForStableCardCount } from './utils'

/**
 * 第 8/9 轮新增能力：卡片悬停操作条（点赞 / 收藏 / 稍后再看）。
 *
 * 只验证「悬停出现、移出消失、不遮挡卡片点击」这些无副作用的可见行为，
 * 不点击任何会写数据的按钮，避免测试依赖登录态与真实写接口。
 */
test.describe('视频卡悬停操作条', () => {
  skipIfExtensionMissing()

  test('悬停卡片浮现操作条，移出后隐藏，且不触发任何写操作', async () => {
    const context = await launchExtension()

    try {
      const page = await context.newPage()
      await openHomeFixture(page, { minCards: 1 })
      await waitForStableCardCount(page, 4)
      await focusPage(page)

      const readBar = () => page.evaluate(() => {
        const root = document.querySelector('#bewly')?.shadowRoot
        const card = root?.querySelector('[data-video-card][data-video-url*="/video/"]') as HTMLElement | null
        const bar = card?.querySelector('.bewly-card-actions') as HTMLElement | null
        const toasts = root?.querySelectorAll('.Vue-Toastification__toast').length ?? 0
        return {
          hasCard: Boolean(card),
          hasBar: Boolean(bar),
          opacity: bar
            ? getComputedStyle(bar).opacity
            : null,
          pointerEvents: bar
            ? getComputedStyle(bar).pointerEvents
            : null,
          buttons: bar
            ? bar.querySelectorAll('button').length
            : 0,
          toasts,
        }
      })

      const initial = await readBar()
      expect(initial.hasCard).toBe(true)
      expect(initial.hasBar).toBe(true)
      expect(initial.buttons).toBeGreaterThanOrEqual(2)
      expect(initial.opacity).toBe('0')
      expect(initial.pointerEvents).toBe('none')

      const card = page.locator('[data-video-card][data-video-url*="/video/"]').first()
      await card.scrollIntoViewIfNeeded()
      await card.hover()

      await expect.poll(async () => (await readBar()).opacity, { timeout: 10_000 }).toBe('1')
      const hovered = await readBar()
      expect(hovered.pointerEvents).toBe('auto')
      // 没有点击任何按钮：不应出现 toast（写操作反馈）
      expect(hovered.toasts).toBe(0)

      // 移出卡片后操作条淡出
      await page.mouse.move(4, 4)
      await expect.poll(async () => (await readBar()).opacity, { timeout: 10_000 }).toBe('0')

      // 悬停 / 移出都没有改变页面地址（没有触发跳转）
      expect(new URL(page.url()).hostname).toBe('www.bilibili.com')
    }
    finally {
      await context.close()
    }
  })
})
