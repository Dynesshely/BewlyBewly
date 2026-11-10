import { expect, test } from '@playwright/test'

import { launchExtension, openHomeFixture, readExtensionState, skipIfExtensionMissing, waitForExtensionReady } from './utils'

/**
 * 回归：页面挂载后必须可见。
 *
 * 曾出现过 style.css 路径错误导致 #bewly 透明度永久为 0 的黑屏问题，
 * 这里同时覆盖首屏与刷新后的场景。
 */
test.describe('扩展可见性回归', () => {
  skipIfExtensionMissing()

  test('#bewly 挂载后可见（含刷新）', async () => {
    const context = await launchExtension()

    try {
      const page = await context.newPage()

      // 首屏：统一就绪 helper 已经保证了「透明度过 1 + 样式表已注入」
      await openHomeFixture(page, { minCards: 1 })
      const first = await readExtensionState(page)
      expect(first.styleSheets).toBeGreaterThan(0)
      expect(first.cards).toBeGreaterThan(0)

      // 刷新后仍然可见
      await page.reload({ waitUntil: 'domcontentloaded' })
      await waitForExtensionReady(page, { minCards: 1 })
      const second = await readExtensionState(page)
      expect(second.opacity).toBe('1')
      expect(second.styleSheets).toBeGreaterThan(0)
      expect(second.cards).toBeGreaterThan(0)
    }
    finally {
      await context.close()
    }
  })
})
