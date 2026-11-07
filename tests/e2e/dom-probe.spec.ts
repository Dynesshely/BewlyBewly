import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'

const HOME_FIXTURE = fileURLToPath(new URL('./fixtures/bilibili-home.html', import.meta.url))

/**
 * BewlyBewly 依赖的 B 站首页 DOM 选择器。
 * 这些选择器一旦消失，说明 B 站上游 DOM 发生了变更，需要更新适配代码。
 */
const HOME_SELECTORS = [
  '.bili-header',
  '.bili-header__bar',
  '.bili-header__banner',
]

/** 其他页面上的关键选择器（用于人工探针时参考） */
export const PAGE_SELECTORS = {
  home: HOME_SELECTORS,
  videoPlayer: ['.bpx-player-ctrl-btn.bpx-player-ctrl-web'],
  homeRedesign: ['.home-redesign-base'],
  bilibiliGate: ['.bilibili-gate-root'],
}

test.describe('Bilibili DOM 探针（离线快照）', () => {
  test('快照中仍包含 BewlyBewly 依赖的首页选择器', async ({ page }) => {
    await page.setContent(readFileSync(HOME_FIXTURE, 'utf-8'), { waitUntil: 'domcontentloaded' })

    const missing: string[] = []
    for (const selector of HOME_SELECTORS) {
      if (await page.locator(selector).count() === 0)
        missing.push(selector)
    }

    expect(missing, `以下选择器在快照中缺失: ${missing.join(', ')}`).toEqual([])
  })
})

test.describe('Bilibili DOM 探针（在线）', () => {
  test('线上首页 DOM 结构检测', async ({ page }) => {
    test.skip(process.env.BILIBILI_ONLINE_PROBE !== '1', '设置 BILIBILI_ONLINE_PROBE=1 时才做线上探测')

    const response = await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded', timeout: 45_000 })
    if (!response || response.status() >= 400)
      test.skip(true, `线上首页不可达 (status=${response?.status()})`)

    const result = await page.evaluate((selectors: string[]) => {
      const found: Record<string, number> = {}
      for (const selector of selectors)
        found[selector] = document.querySelectorAll(selector).length
      return { found, title: document.title, url: location.href }
    }, HOME_SELECTORS)

    // eslint-disable-next-line no-console
    console.log('online probe:', JSON.stringify(result))

    const missing = Object.entries(result.found).filter(([, count]) => count === 0).map(([selector]) => selector)
    expect(missing, `线上首页缺失选择器（B 站可能改版）: ${missing.join(', ')}`).toEqual([])
  })
})
