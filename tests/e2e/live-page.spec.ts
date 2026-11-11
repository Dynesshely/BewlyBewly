import type { BrowserContext, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'

import { launchExtension, skipIfExtensionMissing } from './utils'

/**
 * 第 18 轮：直播页影院模式的 e2e 覆盖。
 *
 * fixture 复刻真机舞台结构：.live-non-revenue-player（舞台）+ .live-player-handle-bar（顶部操作条）
 * + .live-player-bg（画面容器）。断言 #bewly-live-page 挂载、按 T 后 html.bewly-live-cinema 生效、
 * 操作条隐藏、舞台铺满视口高度。
 */
const LIVE_FIXTURE = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>E2E 测试直播间 - 哔哩哔哩直播</title>
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; background: #111; color: #eee; }
      .app-layout { display: flex; gap: 16px; padding: 16px; }
      .player-area { flex: 1 1 70%; min-width: 0; }
      .live-non-revenue-player { position: relative; width: 960px; max-width: 100%; height: 540px; background: #000; }
      .live-player-bg { width: 100%; height: 100%; }
      .live-player-handle-bar { position: absolute; top: 0; left: 0; padding: 6px 10px; background: rgba(0, 0, 0, 0.5); }
      video { width: 100%; height: 100%; object-fit: contain; }
      .aside-area { flex: 0 0 30%; min-height: 520px; }
    </style>
  </head>
  <body>
    <div class="app-layout">
      <div class="player-area">
        <div class="live-non-revenue-player">
          <div class="live-player-handle-bar">直播间操作条</div>
          <div class="live-player-bg"><video preload="metadata"></video></div>
        </div>
      </div>
      <aside class="aside-area"><p>聊天区</p></aside>
    </div>
  </body>
</html>`

async function openLivePage(): Promise<{ context: BrowserContext, page: Page }> {
  const context = await launchExtension()
  const page = await context.newPage()
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.hostname === 'live.bilibili.com' && request.resourceType() === 'document') {
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: LIVE_FIXTURE })
      return
    }
    await route.continue()
  })
  await page.goto('https://live.bilibili.com/6', { waitUntil: 'domcontentloaded' })
  return { context, page }
}

function readLiveState(page: Page) {
  return page.evaluate(() => {
    const host = document.querySelector('#bewly-live-page')
    const root = host?.shadowRoot ?? null
    const player = document.querySelector('[data-bewly-live-player]') as HTMLElement | null
    const handleBar = document.querySelector('[data-bewly-live-handle-bar]') as HTMLElement | null
    const playerRect = player?.getBoundingClientRect()
    return {
      hostExists: Boolean(host),
      overlayReady: Boolean(root?.querySelector('.blp-root')),
      pageClass: document.documentElement.classList.contains('bewly-live-page'),
      cinema: document.documentElement.classList.contains('bewly-live-cinema'),
      hasPlayerAttr: Boolean(player),
      hasHandleBarAttr: Boolean(handleBar),
      handleBarDisplay: handleBar
        ? getComputedStyle(handleBar).display
        : '',
      playerHeight: playerRect
        ? Math.round(playerRect.height)
        : 0,
      playerPosition: player
        ? getComputedStyle(player).position
        : '',
      asideHidden: (() => {
        const aside = document.querySelector('[data-bewly-live-aside]') as HTMLElement | null
        return aside
          ? getComputedStyle(aside).display === 'none'
          : null
      })(),
      viewportHeight: window.innerHeight,
    }
  })
}

test.describe('直播页影院模式', () => {
  skipIfExtensionMissing()

  test('T 进入影院：页面标记、操作条隐藏、舞台铺满视口；再按 T 退出', async () => {
    const { context, page } = await openLivePage()

    try {
      await expect(page.locator('#bewly-live-page')).toHaveCount(1, { timeout: 30_000 })
      // 模块挂载后会给原生舞台 / 操作条打标记（首屏异步，模块自己也有一次 900ms 补扫）
      await expect.poll(async () => (await readLiveState(page)).hasPlayerAttr, { timeout: 30_000 }).toBe(true)
      await expect.poll(async () => (await readLiveState(page)).hasHandleBarAttr, { timeout: 15_000 }).toBe(true)

      const initial = await readLiveState(page)
      expect(initial.overlayReady).toBe(true)
      expect(initial.pageClass).toBe(true)
      expect(initial.cinema).toBe(false)
      expect(initial.playerHeight).toBeLessThan(initial.viewportHeight)

      await page.keyboard.press('t')
      await expect.poll(async () => (await readLiveState(page)).cinema, { timeout: 10_000 }).toBe(true)

      const cinema = await readLiveState(page)
      expect(cinema.handleBarDisplay).toBe('none')
      expect(cinema.playerPosition).toBe('fixed')
      expect(Math.abs(cinema.playerHeight - cinema.viewportHeight)).toBeLessThanOrEqual(2)

      // Esc 与 T 都能退出影院
      await page.keyboard.press('Escape')
      await expect.poll(async () => (await readLiveState(page)).cinema, { timeout: 10_000 }).toBe(false)

      await page.keyboard.press('t')
      await expect.poll(async () => (await readLiveState(page)).cinema, { timeout: 10_000 }).toBe(true)
      await page.keyboard.press('t')
      await expect.poll(async () => (await readLiveState(page)).cinema, { timeout: 10_000 }).toBe(false)

      const restored = await readLiveState(page)
      expect(restored.handleBarDisplay).not.toBe('none')
    }
    finally {
      await context.close()
    }
  })
})
