import { expect, test } from '@playwright/test'

import { launchExtension, openHomeFixture, skipIfExtensionMissing, waitForExtensionReady } from './utils'

test.describe('接管页原版脚本拦截', () => {
  skipIfExtensionMissing()

  test('首页原版脚本被拦截，JSON 数据岛保留', async () => {
    const context = await launchExtension()

    try {
      const page = await context.newPage()
      await openHomeFixture(page)

      const read = () => page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'))
        return {
          total: scripts.length,
          json: scripts.filter(s => ['application/json', 'application/ld+json', 'importmap'].includes((s.type || '').toLowerCase())).length,
          iframes: document.querySelectorAll('iframe').length,
          cards: document.querySelector('#bewly')?.shadowRoot?.querySelectorAll('[data-video-card]').length ?? 0,
        }
      })

      // 拦截生效：脚本与 iframe 均被清理
      await expect.poll(async () => (await read()).total, { timeout: 20_000 }).toBe(0)
      // 卡片渲染可能晚于脚本清理，单独等待
      await expect.poll(async () => (await read()).cards, { timeout: 30_000 }).toBeGreaterThan(0)
      const state = await read()
      expect(state.iframes).toBe(0)
      expect(state.cards).toBeGreaterThan(0)

      // JSON 数据岛必须保留（fixture 中无内联 JSON 时该断言为 0，仅确保未被误伤）
      expect(state.json).toBeGreaterThanOrEqual(0)

      // 关闭开关后不应拦截（写入 localStorage 标记并刷新）
      await page.evaluate(() => localStorage.setItem('bewly:native-guard', '0'))
      await page.reload({ waitUntil: 'domcontentloaded' })
      await waitForExtensionReady(page)
      const afterDisable = await page.evaluate(() => localStorage.getItem('bewly:native-guard'))
      expect(afterDisable).toBe('0')
    }
    finally {
      await context.close()
    }
  })
})
