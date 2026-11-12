import type { BrowserContext, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'

import { launchExtension, skipIfExtensionMissing } from './utils'

/**
 * 第 18 轮：合集（collection）选集面板的补充覆盖。
 *
 * fixture 按真机形态构造：header「测试合集 （1/3）…订阅合集」+ 列表 video-pod__list section
 * （没有 multip）+ 3 个不同 bvid 的 <a> 包裹条目；当前视频是第 2 个。
 * 断言：入口文案是「合集」、面板 3 项、当前项 aria-current、点第 3 项触发对应链接。
 */
const COLLECTION_FIXTURE = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>合集视频 2_哔哩哔哩_bilibili</title>
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; }
      #mirror-vdcon { display: flex; gap: 16px; padding: 16px; margin: 0 auto; max-width: 1600px; }
      .left-container { flex: 1 1 70%; min-width: 0; }
      #bilibili-player { position: relative; height: 420px; overflow: hidden; background: #000; }
      .bpx-player-container { width: 100%; height: 100%; }
      video { display: block; width: 100%; height: 100%; object-fit: contain; }
      .right-container { flex: 0 0 28%; }
      .video-title { margin: 16px 0; font-size: 20px; }
      .video-desc { min-height: 1200px; }
      #arc_toolbar_report { display: flex; align-items: center; gap: 8px; min-height: 44px; }
      #arc_toolbar_report button { padding: 4px 10px; }
      .video-pod__header { padding: 8px; font-weight: 600; }
      .video-pod__list { display: flex; flex-direction: column; gap: 4px; }
      .video-pod__item { padding: 6px; }
      .video-pod__item.active { background: #ddd; }
      .pod-link { color: inherit; text-decoration: none; display: block; }
    </style>
  </head>
  <body>
    <div id="app">
      <div class="video-container-v1" id="mirror-vdcon">
        <div class="left-container scroll-sticky">
          <div id="playerWrap">
            <div id="bilibili-player">
              <div class="bpx-player-container"><video preload="metadata"></video></div>
            </div>
          </div>
          <h1 class="video-title">合集视频 2</h1>
          <div id="arc_toolbar_report"><button type="button">分享</button></div>
          <div class="video-desc">正文</div>
        </div>
        <div class="right-container">
          <div class="video-pod video-pod">
            <div class="video-pod__header">测试合集 （1/3） 123万播放 暂无简介 简介 订阅合集</div>
            <div class="video-pod__list section">
              <a class="pod-link" href="/video/BV1collect01"><div class="simple-base-item video-pod__item normal">合集视频 1</div></a>
              <a class="pod-link" href="/video/BV1collect02"><div class="simple-base-item video-pod__item active normal">合集视频 2</div></a>
              <a class="pod-link" href="/video/BV1collect03"><div class="simple-base-item video-pod__item normal">合集视频 3</div></a>
            </div>
          </div>
        </div>
      </div>
    </div>
    <script>
      document.querySelectorAll('a.pod-link').forEach((anchor) => {
        anchor.addEventListener('click', (event) => {
          event.preventDefault()
          const item = anchor.querySelector('.video-pod__item')
          document.querySelectorAll('.video-pod__item').forEach((el) => el.classList.remove('active'))
          item.classList.add('active')
          document.body.dataset.clickedCollection = new URL(anchor.href).pathname.split('/').pop()
        })
      })
    </script>
  </body>
</html>`

async function openCollectionPage(): Promise<{ context: BrowserContext, page: Page }> {
  const context = await launchExtension()
  const page = await context.newPage()
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.hostname === 'www.bilibili.com' && request.resourceType() === 'document') {
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: COLLECTION_FIXTURE })
      return
    }
    await route.continue()
  })
  await page.goto('https://www.bilibili.com/video/BV1collect02', { waitUntil: 'domcontentloaded' })
  return { context, page }
}

test.describe('合集选集面板', () => {
  skipIfExtensionMissing()

  test('入口「合集」、面板 3 项、当前项 aria-current、点第 3 项触发链接', async () => {
    const { context, page } = await openCollectionPage()

    try {
      // 视频页增强层挂载后，合集入口按钮应出现（定位在 #bewly-video-page 的 shadow root 内）
      const selectionFab = page.locator('[data-bvp-action="selection"]')
      await expect(selectionFab).toHaveCount(1, { timeout: 30_000 })

      const fabText = (await selectionFab.textContent())?.trim() ?? ''
      expect(fabText).toMatch(/合集|collection/i)
      expect(fabText).not.toMatch(/选集|parts/i)

      await selectionFab.click()
      const panel = page.locator('.bvp-playlist')
      await expect(panel).toBeVisible({ timeout: 10_000 })
      await expect(panel).toHaveAttribute('data-kind', 'collection')
      await expect(panel.locator('.bvp-playlist__item')).toHaveCount(3)

      // 当前视频是第 2 条：唯一 aria-current + 高亮类
      await expect(panel.locator('[aria-current="true"]')).toHaveCount(1)
      await expect(panel.locator('[aria-current="true"]')).toContainText('合集视频 2')
      await expect(panel.locator('.bvp-playlist__item.is-active')).toHaveCount(1)

      // 点第 3 项：跳到对应 bvid（fixture 用自己的点击处理记录，不会真的导航）
      await panel.locator('.bvp-playlist__item').nth(2).click()
      await expect.poll(
        () => page.evaluate(() => document.body.dataset.clickedCollection ?? ''),
        { timeout: 10_000, message: '点第 3 项应触发 BV1collect03 的链接' },
      ).toBe('BV1collect03')
    }
    finally {
      await context.close()
    }
  })
})
