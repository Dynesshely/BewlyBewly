import { expect, test } from '@playwright/test'

import { HOME_FIXTURE, launchExtension, routeBilibiliDocument, skipIfExtensionMissing, waitForExtensionReady, waitForStableCardCount } from './utils'

/**
 * 首屏性能基线：记录 #bewly 挂载与首屏卡片出现耗时，作为回归对照。
 */
test.describe('首屏性能基线', () => {
  skipIfExtensionMissing()

  test('记录 #bewly 挂载与首屏卡片耗时', async () => {
    const context = await launchExtension()

    try {
      const page = await context.newPage()
      await routeBilibiliDocument(page, HOME_FIXTURE)

      await routeBilibiliDocument(page, HOME_FIXTURE)

      const start = Date.now()
      await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' })
      await waitForExtensionReady(page)
      const mountMs = Date.now() - start

      await waitForStableCardCount(page, 1)
      const cardsMs = Date.now() - start

      test.info().annotations.push(
        { type: 'perf', description: `#bewly mount: ${mountMs}ms, first cards: ${cardsMs}ms` },
      )

      // 宽松上限，仅用于发现明显回退
      expect(mountMs).toBeLessThan(30_000)
      expect(cardsMs).toBeLessThan(30_000)
    }
    finally {
      await context.close()
    }
  })
})
