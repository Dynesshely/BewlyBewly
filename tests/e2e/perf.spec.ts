import { expect, test } from '@playwright/test'

import { HOME_FIXTURE, launchExtension, routeBilibiliDocument, skipIfExtensionMissing, waitForExtensionReady, waitForStableCardCount } from './utils'

/**
 * 首屏性能基线：记录 #bewly 挂载与首屏卡片出现耗时、CLS 代理值、图片加载属性覆盖率。
 *
 * 说明：
 * - CLS 代理值 = 页面加载后 `layout-shift` 事件的累计值（不含用户输入触发的位移），
 *   在扩展就绪后额外观察 1s，取 `PerformanceObserver` 的 buffered 结果；
 * - 图片属性覆盖率统计的是 `#bewly` shadow root 内的 <img>：`loading` / `decoding` /
 *   `fetchpriority` 三个属性的覆盖数量，用来验证第 12 轮的懒加载改动是否真的生效
 *   （扩展构建产物由 Lead 统一构建，源改动要在重新构建后才会反映到这里）。
 */
test.describe('首屏性能基线', () => {
  skipIfExtensionMissing()

  test('记录 #bewly 挂载、首屏卡片、CLS 与图片属性覆盖率', async () => {
    const context = await launchExtension()

    try {
      const page = await context.newPage()
      await routeBilibiliDocument(page, HOME_FIXTURE)

      const start = Date.now()
      await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' })
      await waitForExtensionReady(page)
      const mountMs = Date.now() - start

      await waitForStableCardCount(page, 1)
      const cardsMs = Date.now() - start

      // 给布局稳定一点时间：CLS 代理值取扩展就绪 + 1s 内累计的 layout-shift
      await page.waitForTimeout(1000)

      const metrics = await page.evaluate(() => {
        const root = document.querySelector('#bewly')?.shadowRoot
        const cards = root?.querySelectorAll('[data-video-card]').length ?? 0
        const images = Array.from(root?.querySelectorAll('img') ?? []) as HTMLImageElement[]

        let cls = 0
        try {
          const entries = performance.getEntriesByType('layout-shift') as unknown as Array<{ value: number, hadRecentInput: boolean }>
          for (const entry of entries) {
            if (!entry.hadRecentInput)
              cls += entry.value
          }
        }
        catch {
          // 浏览器不支持时保持 0
        }

        return {
          cards,
          images: images.length,
          lazy: images.filter(img => img.getAttribute('loading') === 'lazy').length,
          eager: images.filter(img => img.getAttribute('loading') === 'eager').length,
          decodingAsync: images.filter(img => img.getAttribute('decoding') === 'async').length,
          fetchHigh: images.filter(img => img.getAttribute('fetchpriority') === 'high').length,
          fetchLow: images.filter(img => img.getAttribute('fetchpriority') === 'low').length,
          cls: Number(cls.toFixed(4)),
          styleSheets: root?.styleSheets.length ?? -1,
        }
      })

      const summary = {
        mountMs,
        cardsMs,
        ...metrics,
      }
      // eslint-disable-next-line no-console
      console.log(`[perf] ${JSON.stringify(summary)}`)
      test.info().annotations.push({
        type: 'perf',
        description: `mount: ${mountMs}ms, first cards: ${cardsMs}ms, cards: ${metrics.cards}, imgs: ${metrics.images}, lazy: ${metrics.lazy}, decodingAsync: ${metrics.decodingAsync}, fetchHigh: ${metrics.fetchHigh}, fetchLow: ${metrics.fetchLow}, CLS: ${metrics.cls}`,
      })

      expect(metrics.cards).toBeGreaterThan(0)
      expect(metrics.styleSheets).toBeGreaterThan(0)
      // 宽松上限，仅用于发现明显回退
      expect(mountMs).toBeLessThan(30_000)
      expect(cardsMs).toBeLessThan(30_000)
      // CLS 代理值：只做粗门槛（首屏不该出现明显跳动）
      expect(metrics.cls).toBeLessThan(0.5)
    }
    finally {
      await context.close()
    }
  })
})
