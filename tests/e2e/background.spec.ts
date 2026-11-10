import { expect, test } from '@playwright/test'

import { launchExtension, skipIfExtensionMissing } from './utils'

/**
 * 后台消息通道冒烟测试（在线）。
 *
 * 依赖真实 B 站接口，默认跳过；用 E2E_ONLINE=1 运行。
 */
test.describe('后台消息通道', () => {
  skipIfExtensionMissing()
  test.skip(!process.env.E2E_ONLINE, '需要在线环境（设置 E2E_ONLINE=1）')

  test('getRecommendVideos 返回真实数据', async () => {
    test.setTimeout(180_000)

    const context = await launchExtension()

    try {
      const page = await context.newPage()
      await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' })
      await expect(page.locator('#bewly')).toHaveCount(1, { timeout: 60_000 })
      await page.waitForTimeout(5_000)

      const session = await page.context().newCDPSession(page)
      const contexts: any[] = []
      session.on('Runtime.executionContextCreated', e => contexts.push(e.context))
      await session.send('Runtime.enable')
      await page.waitForTimeout(1_500)

      const target = contexts.find(c => c.name === 'BewlyBewly')
      expect(target).toBeTruthy()

      const result = await session.send('Runtime.evaluate', {
        expression: '(async () => { try { const r = await chrome.runtime.sendMessage({ contentScriptQuery: \'getRecommendVideos\' }); return JSON.stringify({ code: r && r.code, count: r && r.data && r.data.item ? r.data.item.length : 0 }) } catch (e) { return \'ERR: \' + (e && e.message) } })()',
        contextId: target!.id,
        awaitPromise: true,
        returnByValue: true,
      })

      const value = result.result?.value as string
      expect(value.startsWith('ERR')).toBe(false)
      const parsed = JSON.parse(value)
      expect(parsed.code).toBe(0)
      expect(parsed.count).toBeGreaterThan(0)
    }
    finally {
      await context.close()
    }
  })
})
