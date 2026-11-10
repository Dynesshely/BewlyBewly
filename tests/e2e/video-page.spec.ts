import type { BrowserContext, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'

import { launchExtension, skipIfExtensionMissing } from './utils'

/**
 * 播放页快照：只保留增强层依赖的结构（播放器 / 标题 / UP 主 / 右栏 / 可滚动正文），
 * 不依赖真实 B 站脚本，避免测试受网络与广告影响。
 */
const VIDEO_PAGE_FIXTURE = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>这是一个测试视频_哔哩哔哩_bilibili</title>
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; }
      #mirror-vdcon { display: flex; gap: 16px; padding: 16px; margin: 0 auto; max-width: 1600px; }
      .left-container { flex: 1 1 70%; min-width: 0; }
      #playerWrap { background: #000; }
      #bilibili-player { position: relative; height: 420px; overflow: hidden; }
      .bpx-player-container { width: 100%; height: 100%; }
      video { display: block; width: 100%; height: 100%; object-fit: contain; }
      .right-container { flex: 0 0 28%; }
      .video-title { margin: 16px 0; font-size: 20px; }
      .video-desc { min-height: 1600px; }
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
          <h1 class="video-title">这是一个测试视频</h1>
          <input id="test-input" placeholder="评论" />
          <div class="video-desc">正文</div>
        </div>
        <div class="right-container">
          <div class="up-panel-container"><span class="up-name">测试 UP 主</span></div>
          <div class="recommend-list">推荐列表</div>
        </div>
      </div>
    </div>
  </body>
</html>`

async function openVideoPage(): Promise<{ context: BrowserContext, page: Page }> {
  const context = await launchExtension({ allowPopups: true })

  const page = await context.newPage()
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.hostname === 'www.bilibili.com' && request.resourceType() === 'document') {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: VIDEO_PAGE_FIXTURE,
      })
      return
    }
    await route.continue()
  })

  await page.goto('https://www.bilibili.com/video/BV1xx411c7mD', { waitUntil: 'domcontentloaded' })
  return { context, page }
}

/** 等增强层挂载完成；未接线时直接 skip，不让整套 e2e 变红 */
async function ensureOverlay(page: Page): Promise<void> {
  await page
    .waitForSelector('#bewly-video-page', { state: 'attached', timeout: 15_000 })
    .catch(() => null)

  const mounted = await page.evaluate(() => {
    const host = document.querySelector('#bewly-video-page')
    return Boolean(host?.shadowRoot?.querySelector('.bvp-fab'))
  })

  if (!mounted)
    test.skip(true, '未检测到 #bewly-video-page 增强层，请确认 contentScripts/index.ts 已接线 setupVideoPage()')
}

test.describe('视频播放页增强', () => {
  skipIfExtensionMissing()

  test('T / Esc 切换影院模式，并写进 sessionStorage', async () => {
    const { context, page } = await openVideoPage()

    try {
      await ensureOverlay(page)

      await page.keyboard.press('t')
      await expect(page.locator('html')).toHaveClass(/bewly-video-cinema/)
      await expect(page.locator('.right-container')).toBeHidden()
      expect(await page.evaluate(() => sessionStorage.getItem('bewly-video-cinema'))).toBe('1')

      await page.keyboard.press('Escape')
      await expect(page.locator('html')).not.toHaveClass(/bewly-video-cinema/)
      expect(await page.evaluate(() => sessionStorage.getItem('bewly-video-cinema'))).toBe('0')
    }
    finally {
      await context.close()
    }
  })

  test('播放器滚出视口后收成迷你浮窗，P 还原', async () => {
    const { context, page } = await openVideoPage()

    try {
      await ensureOverlay(page)
      await page.evaluate(() => window.scrollTo(0, 900))
      await expect(page.locator('html')).toHaveClass(/bewly-video-mini/)

      const box = await page.locator('#playerWrap').boundingBox()
      expect(box).not.toBeNull()
      // 浮在右下角：右边缘贴近视口右侧（24px 边距），整体在视口内
      expect(box!.x + box!.width).toBeGreaterThan(1400)
      expect(box!.y + box!.height).toBeLessThanOrEqual(900)

      await page.keyboard.press('p')
      await expect(page.locator('html')).not.toHaveClass(/bewly-video-mini/)
    }
    finally {
      await context.close()
    }
  })

  test('滚动后出现带进度细线的紧凑信息栏', async () => {
    const { context, page } = await openVideoPage()

    try {
      await ensureOverlay(page)
      await expect(page.locator('.bvp-compact')).toBeHidden()

      await page.evaluate(() => window.scrollTo(0, 600))
      await expect(page.locator('.bvp-compact')).toBeVisible()
      await expect(page.locator('.bvp-compact__title')).toHaveText('这是一个测试视频')
      await expect(page.locator('.bvp-compact__progress-fill')).toHaveCount(1)
    }
    finally {
      await context.close()
    }
  })

  test('M 静音会给出反馈，输入框内不劫持快捷键', async () => {
    const { context, page } = await openVideoPage()

    try {
      await ensureOverlay(page)

      const toastText = () => page.evaluate(() => document
        .querySelector('#bewly-video-page')
        ?.shadowRoot
        ?.querySelector('.bvp-toast')
        ?.textContent
        ?.trim() ?? '')

      // 内容脚本运行在隔离世界，主世界对 video 元素的属性改写观察不到，
      // 因此这里验证「可观察的反馈」与「输入框内不劫持」两类行为。
      await page.keyboard.press('m')
      await expect.poll(toastText, { timeout: 5_000 }).not.toBe('')
      const afterMute = await toastText()

      // 焦点在输入框里时不劫持快捷键（提示条不应变化）
      await page.locator('#test-input').focus()
      await page.keyboard.press('m')
      await page.waitForTimeout(300)
      expect(await toastText()).toBe(afterMute)

      // J / L / 数字键至少要能安全触发，不抛异常、不破坏页面状态
      await page.locator('#test-input').blur()
      await page.keyboard.press('j')
      await page.keyboard.press('l')
      await page.keyboard.press('5')
      await expect(page.locator('#bewly-video-page')).toHaveCount(1)
    }
    finally {
      await context.close()
    }
  })

  test('? 打开快捷键帮助，Esc 关闭', async () => {
    const { context, page } = await openVideoPage()

    try {
      await ensureOverlay(page)

      // Playwright 走 CDP 时 `Shift+/` 的 key 仍是 "/"，无法产生真正的 "?"，
      // 这里用合成事件模拟真实用户按下的 "?"（content script 监听的是 keydown.key）
      await page.evaluate(() => {
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true }))
      })
      await expect(page.locator('.bvp-help__dialog')).toBeVisible()
      expect(await page.locator('.bvp-help__row').count()).toBeGreaterThanOrEqual(10)

      await page.keyboard.press('Escape')
      await expect(page.locator('.bvp-help__dialog')).toBeHidden()
    }
    finally {
      await context.close()
    }
  })
})

/**
 * 番剧 / 电影播放页快照。
 *
 * 与视频页的差异正是本次要覆盖的部分：没有 `#playerWrap`（舞台上移到播放器父级）、
 * 标题 / UP 主在 CSS Modules 类名里、集数列表用 `numberListItem_*`。
 */
const BANGUMI_PLAYBACK_FIXTURE = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>测试番剧 第1话_哔哩哔哩_bilibili</title>
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; }
      .main-container { max-width: 1600px; margin: 0 auto; padding: 16px; }
      .player-wrap { background: #000; }
      #bilibili-player { position: relative; height: 420px; overflow: hidden; }
      .bpx-player-container { width: 100%; height: 100%; }
      video { display: block; width: 100%; height: 100%; object-fit: contain; }
      .mediainfo_mediaInfo__abc { margin: 16px 0; }
      .mediainfo_mediaTitle__abc { font-size: 20px; }
      .eplist_ep_list_wrapper__abc { min-height: 1200px; }
      .numberListItem_number_list_item__abc { padding: 6px 0; }
    </style>
  </head>
  <body>
    <div id="app">
      <div class="main-container">
        <div class="player-wrap">
          <div id="bilibili-player">
            <div class="bpx-player-container"><video preload="metadata"></video></div>
          </div>
        </div>
        <div class="mediainfo_mediaInfo__abc">
          <h1 class="mediainfo_mediaTitle__abc">测试番剧 第1话</h1>
          <div class="upinfo_upInfoCard__abc"><a class="upinfo_upName__abc">测试 UP 主</a></div>
        </div>
        <div class="eplist_ep_list_wrapper__abc" id="ep-list">
          <div class="numberListItem_number_list_item__abc numberListItem_select__abc" data-ep="1">第1话</div>
          <div class="numberListItem_number_list_item__abc" data-ep="2">第2话</div>
          <div class="numberListItem_number_list_item__abc" data-ep="3">第3话</div>
        </div>
      </div>
    </div>
    <script>
      document.querySelectorAll('.numberListItem_number_list_item__abc').forEach((el) => {
        el.addEventListener('click', () => {
          document.querySelectorAll('.numberListItem_number_list_item__abc').forEach((item) => {
            item.classList.remove('numberListItem_select__abc')
          })
          el.classList.add('numberListItem_select__abc')
          document.body.dataset.clickedEpisode = el.dataset.ep
        })
      })
    </script>
  </body>
</html>`

async function openBangumiPlaybackPage(): Promise<{ context: BrowserContext, page: Page }> {
  const context = await launchExtension({ allowPopups: true })

  const page = await context.newPage()
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.hostname === 'www.bilibili.com' && request.resourceType() === 'document') {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: BANGUMI_PLAYBACK_FIXTURE,
      })
      return
    }
    await route.continue()
  })

  await page.goto('https://www.bilibili.com/bangumi/play/ep123456', { waitUntil: 'domcontentloaded' })
  return { context, page }
}

test.describe('番剧 / 电影播放页增强', () => {
  skipIfExtensionMissing()

  test('T / Esc 切换影院模式，隐藏信息列并铺满视口', async () => {
    const { context, page } = await openBangumiPlaybackPage()

    try {
      await ensureOverlay(page)

      await page.keyboard.press('t')
      await expect(page.locator('html')).toHaveClass(/bewly-video-cinema/)
      await expect(page.locator('.mediainfo_mediaInfo__abc')).toBeHidden()

      // 番剧页没有 #playerWrap：舞台标记在播放器父级上，且被 fixed 到视口顶部
      const stage = page.locator('[data-bewly-player-stage]')
      await expect(stage).toHaveCount(1)
      expect(await stage.evaluate(el => getComputedStyle(el).position)).toBe('fixed')
      const box = await stage.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.width).toBeGreaterThan(1400)
      expect(box!.y).toBeLessThanOrEqual(1)

      await page.keyboard.press('Escape')
      await expect(page.locator('html')).not.toHaveClass(/bewly-video-cinema/)
    }
    finally {
      await context.close()
    }
  })

  test('滚动后收成迷你浮窗，P 还原', async () => {
    const { context, page } = await openBangumiPlaybackPage()

    try {
      await ensureOverlay(page)
      await page.evaluate(() => window.scrollTo(0, 900))
      await expect(page.locator('html')).toHaveClass(/bewly-video-mini/)

      const box = await page.locator('[data-bewly-player-stage]').boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x + box!.width).toBeGreaterThan(1400)
      expect(box!.y + box!.height).toBeLessThanOrEqual(900)

      await page.keyboard.press('p')
      await expect(page.locator('html')).not.toHaveClass(/bewly-video-mini/)
    }
    finally {
      await context.close()
    }
  })

  test('] / [ 切换下一集 / 上一集', async () => {
    const { context, page } = await openBangumiPlaybackPage()

    try {
      await ensureOverlay(page)

      const clickedEpisode = () => page.evaluate(() => document.body.dataset.clickedEpisode ?? '')

      await page.keyboard.press(']')
      await expect.poll(clickedEpisode, { timeout: 5_000 }).toBe('2')

      await page.keyboard.press(']')
      await expect.poll(clickedEpisode, { timeout: 5_000 }).toBe('3')

      await page.keyboard.press('[')
      await expect.poll(clickedEpisode, { timeout: 5_000 }).toBe('2')
    }
    finally {
      await context.close()
    }
  })

  test('帮助面板列出切集，页面上没有集数列表时不列出', async () => {
    const { context, page } = await openBangumiPlaybackPage()

    try {
      await ensureOverlay(page)

      const openHelp = () => page.evaluate(() => {
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true }))
      })
      const helpLabels = () => page.evaluate(() => Array.from(
        document
          .querySelector('#bewly-video-page')
          ?.shadowRoot
          ?.querySelectorAll('.bvp-help__label') ?? [],
      ).map(el => el.textContent?.trim() ?? ''))

      await openHelp()
      await expect(page.locator('.bvp-help__dialog')).toBeVisible()
      // 文案跟随界面语言（CI 下是英文），用正则同时匹配中英文
      const hasNextEpisode = (labels: string[]) => labels.some(label => /next episode|下一集/i.test(label))
      expect(hasNextEpisode(await helpLabels())).toBe(true)
      await page.keyboard.press('Escape')
      await expect(page.locator('.bvp-help__dialog')).toBeHidden()

      // 电影单集场景：删掉集数列表后，切集快捷键与帮助项都应消失
      await page.evaluate(() => document.querySelector('#ep-list')?.remove())
      await page.waitForTimeout(800)
      await openHelp()
      await expect(page.locator('.bvp-help__dialog')).toBeVisible()
      expect(hasNextEpisode(await helpLabels())).toBe(false)
    }
    finally {
      await context.close()
    }
  })
})
/**
 * 播放列表页快照：URL 走 `/list/watchlater`，右侧是 `.video-pod` 列表。
 * 点条目时不真正路由，只记录点击并搬移 active 类，模拟 B 站的 SPA 切换。
 */
const PLAYLIST_PAGE_FIXTURE = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>列表视频 2_哔哩哔哩_bilibili</title>
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; }
      #mirror-vdcon { display: flex; gap: 16px; padding: 16px; margin: 0 auto; max-width: 1600px; }
      .left-container { flex: 1 1 70%; min-width: 0; }
      #playerWrap { background: #000; }
      #bilibili-player { position: relative; height: 420px; overflow: hidden; }
      .bpx-player-container { width: 100%; height: 100%; }
      video { display: block; width: 100%; height: 100%; object-fit: contain; }
      .right-container { flex: 0 0 28%; }
      .video-title { margin: 16px 0; font-size: 20px; }
      .video-desc { min-height: 1600px; }
      .video-pod__list { display: flex; flex-direction: column; gap: 4px; }
      .video-pod__item { padding: 6px; }
      .video-pod__item.active { background: #ddd; }
    </style>
  </head>
  <body>
    <div id="app">
      <div class="video-container-v1" id="mirror-vdcon">
        <div class="left-container scroll-sticky">
          <div id="playerWrap">
            <div id="bilibili-player">
              <div class="bpx-player-container">
                <video preload="metadata"></video>
                <button class="bpx-player-ctrl-next" type="button">下一个</button>
              </div>
            </div>
          </div>
          <h1 class="video-title">列表视频 2</h1>
          <div class="video-desc">正文</div>
        </div>
        <div class="right-container">
          <div class="video-pod">
            <div class="video-pod__list">
              <div class="video-pod__item">
                <a href="/video/BV1111111111">列表视频 1</a><span class="title-txt">列表视频 1</span>
              </div>
              <div class="video-pod__item active">
                <a href="/video/BV2222222222">列表视频 2</a><span class="title-txt">列表视频 2</span>
              </div>
              <div class="video-pod__item">
                <a href="/video/BV3333333333">列表视频 3</a><span class="title-txt">列表视频 3</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <script>
      document.querySelectorAll('.video-pod__item > a').forEach((anchor) => {
        anchor.addEventListener('click', (event) => {
          event.preventDefault()
          const item = anchor.parentElement
          document.querySelectorAll('.video-pod__item').forEach((el) => el.classList.remove('active'))
          item.classList.add('active')
          document.body.dataset.clickedItem = anchor.getAttribute('href')
        })
      })
      document.querySelector('.bpx-player-ctrl-next')?.addEventListener('click', () => {
        document.body.dataset.nativeNext = String(Number(document.body.dataset.nativeNext || 0) + 1)
      })
    </script>
  </body>
</html>`

async function openPlaylistPage(): Promise<{ context: BrowserContext, page: Page }> {
  const context = await launchExtension({ allowPopups: true })

  const page = await context.newPage()
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.hostname === 'www.bilibili.com' && request.resourceType() === 'document') {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: PLAYLIST_PAGE_FIXTURE,
      })
      return
    }
    await route.continue()
  })

  await page.goto('https://www.bilibili.com/list/watchlater?bvid=BV2222222222', { waitUntil: 'domcontentloaded' })
  return { context, page }
}

test.describe('播放列表页增强', () => {
  skipIfExtensionMissing()

  const clickedItem = (page: Page) => page.evaluate(() => document.body.dataset.clickedItem ?? '')

  test('浮动按钮打开面板：当前项高亮，点条目切换', async () => {
    const { context, page } = await openPlaylistPage()

    try {
      await ensureOverlay(page)

      const playlistFab = page.locator('[data-bvp-action="playlist"]')
      await expect(playlistFab).toHaveCount(1)
      await playlistFab.click()

      const panel = page.locator('.bvp-playlist')
      await expect(panel).toBeVisible()
      await expect(panel.locator('.bvp-playlist__item')).toHaveCount(3)
      // 当前项 = 第 2 项（fixture 里 active 在第二项）
      await expect(panel.locator('[aria-current="true"]')).toHaveCount(1)
      await expect(panel.locator('[aria-current="true"]')).toContainText('列表视频 2')

      await panel.locator('.bvp-playlist__item').nth(2).click()
      await expect.poll(() => clickedItem(page), { timeout: 5_000 }).toBe('/video/BV3333333333')
    }
    finally {
      await context.close()
    }
  })

  test('Esc 关面板，[ / ] 切上 / 下一个播放项', async () => {
    const { context, page } = await openPlaylistPage()

    try {
      await ensureOverlay(page)

      await page.locator('[data-bvp-action="playlist"]').click()
      await expect(page.locator('.bvp-playlist')).toBeVisible()

      await page.keyboard.press('Escape')
      await expect(page.locator('.bvp-playlist')).toBeHidden()

      await page.keyboard.press(']')
      await expect.poll(() => clickedItem(page), { timeout: 5_000 }).toBe('/video/BV3333333333')

      await page.keyboard.press('[')
      await expect.poll(() => clickedItem(page), { timeout: 5_000 }).toBe('/video/BV2222222222')
    }
    finally {
      await context.close()
    }
  })

  test('A 开启自动连播后，视频 ended 会点原生「下一个」按钮', async () => {
    const { context, page } = await openPlaylistPage()

    try {
      await ensureOverlay(page)

      // 默认关闭
      expect(await page.evaluate(() => document.body.dataset.nativeNext ?? '')).toBe('')

      await page.keyboard.press('a')
      expect(await page.evaluate(() => sessionStorage.getItem('bewly-playlist-autoplay'))).toBe('1')

      await page.evaluate(() => {
        document.querySelector('video')?.dispatchEvent(new Event('ended'))
      })
      await expect.poll(
        () => page.evaluate(() => document.body.dataset.nativeNext ?? ''),
        { timeout: 5_000 },
      ).toBe('1')
    }
    finally {
      await context.close()
    }
  })

  test('没有原生下一个按钮时，自动连播兜底点列表下一项', async () => {
    const { context, page } = await openPlaylistPage()

    try {
      await ensureOverlay(page)
      await page.evaluate(() => document.querySelector('.bpx-player-ctrl-next')?.remove())

      await page.keyboard.press('a')
      await page.evaluate(() => {
        document.querySelector('video')?.dispatchEvent(new Event('ended'))
      })
      await expect.poll(() => clickedItem(page), { timeout: 5_000 }).toBe('/video/BV3333333333')

      // 已是最后一项：再 ended 时自动连播关闭并提示
      await page.waitForTimeout(600)
      await page.evaluate(() => {
        document.querySelector('video')?.dispatchEvent(new Event('ended'))
      })
      await expect.poll(
        () => page.evaluate(() => sessionStorage.getItem('bewly-playlist-autoplay')),
        { timeout: 5_000 },
      ).toBe('0')
    }
    finally {
      await context.close()
    }
  })

  test('没有播放列表结构时，入口与面板都不渲染', async () => {
    // 复用视频页 fixture（没有 .video-pod）
    const { context, page } = await openVideoPage()

    try {
      await ensureOverlay(page)
      await expect(page.locator('[data-bvp-action="playlist"]')).toHaveCount(0)
      await expect(page.locator('#bewly-video-playlist')).toHaveCount(0)
      await expect(page.locator('.bvp-playlist')).toHaveCount(0)
    }
    finally {
      await context.close()
    }
  })
})
