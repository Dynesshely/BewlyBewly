import { expect, test } from '@playwright/test'

import {
  clickDockItem,
  launchExtension,
  openHomeFixture,
  seedFakeLoginCookies,
  skipIfExtensionMissing,
  stubBackgroundJson,
  waitForStableCardCount,
} from './utils'

/**
 * 第 18 轮：反馈态组件（ErrorState / EmptyState）的 e2e 覆盖。
 *
 * 动态页需要登录 + 网络：这里用「伪造登录 cookie + background 接口桩」稳定复现两种状态：
 *   1. 接口返回 code=-500 → ErrorState（role=alert + 重试按钮）；
 *   2. 接口返回空列表 → EmptyState（role=status）。
 * 桩在 service worker 的 fetch 上生效，不依赖线上环境。
 */
const MOMENTS_API = '/x/polymer/web-dynamic/v1/feed/all'

test.describe('反馈态组件（错误 / 空列表）', () => {
  skipIfExtensionMissing()

  test('接口失败显示 role=alert 与重试按钮，空列表显示 role=status', async () => {
    const context = await launchExtension()

    try {
      await seedFakeLoginCookies(context)
      const page = await context.newPage()
      await openHomeFixture(page, { minCards: 1 })
      await waitForStableCardCount(page, 2)

      // 1) 失败态：接口返回 -500
      await stubBackgroundJson(context, [
        {
          match: MOMENTS_API,
          body: {
            code: -500,
            message: 'E2E 模拟接口失败',
            ttl: 1,
            data: null,
          },
        },
      ])
      await clickDockItem(page, /moments|动态/i)

      const errorState = page.locator('.feedback-error')
      await expect(errorState).toBeVisible({ timeout: 30_000 })
      await expect(errorState).toHaveAttribute('role', 'alert')
      expect(await errorState.textContent()).toContain('E2E 模拟接口失败')

      const retryButton = errorState.locator('.feedback-error__retry')
      await expect(retryButton).toHaveCount(1)
      await expect(retryButton).toHaveAttribute('aria-label', /.+/)

      // 2) 空列表：把桩切到 code=0 + 空 items，点重试后应变成 EmptyState（role=status）
      await stubBackgroundJson(context, [
        {
          match: MOMENTS_API,
          body: {
            code: 0,
            message: '0',
            ttl: 1,
            data: {
              items: [],
              has_more: false,
              offset: '',
              update_baseline: '',
            },
          },
        },
      ])
      await retryButton.click()

      const emptyState = page.locator('.feedback-state')
      await expect(emptyState).toBeVisible({ timeout: 30_000 })
      await expect(emptyState).toHaveAttribute('role', 'status')
      await expect(errorState).toHaveCount(0)
    }
    finally {
      await context.close()
    }
  })
})
