import type { BrowserContext, Page } from '@playwright/test'

import { Buffer } from 'node:buffer'

import { expect, test } from '@playwright/test'

import { launchExtension, skipIfExtensionMissing } from './utils'

/**
 * 第 18 轮：文章 / opus 阅读模式的 e2e 覆盖。
 *
 * 用 opus 结构快照（.opus-detail 正文 ≥ 200 字 + 2 张图 + 1 个 pre），不依赖线上页面。
 * 断言用户可见行为：浮层按钮、沉浸阅读 html class、正文限宽 720、图片 lightbox、代码块复制按钮。
 */
const ARTICLE_BODY_TEXT = 'E2E 文章正文段落。'.repeat(30)

const OPUS_FIXTURE = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>E2E 测试图文_哔哩哔哩</title>
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; }
      .bili-opus-view { max-width: 1600px; margin: 0 auto; padding: 16px; }
      .opus-detail { background: #fff; }
      .opus-module-content { padding: 8px 16px; }
      .opus-detail p { line-height: 1.8; }
      .opus-detail img { display: block; width: 480px; height: 270px; object-fit: cover; margin: 12px 0; }
      .side-toolbar { position: fixed; right: 12px; top: 120px; width: 40px; }
    </style>
  </head>
  <body>
    <div class="bili-opus-view">
      <div class="opus-detail">
        <div class="opus-module-title">E2E 测试图文标题</div>
        <div class="opus-module-content">
          <p>${ARTICLE_BODY_TEXT}</p>
          <p>${ARTICLE_BODY_TEXT}</p>
          <p>
            <img src="https://i0.hdslb.com/bfs/article/e2e-image-1.png" alt="图一" />
            <img src="https://i0.hdslb.com/bfs/article/e2e-image-2.png" alt="图二" />
          </p>
          <pre><code>const e2e = 'code block'</code></pre>
        </div>
      </div>
      <div class="side-toolbar"><button type="button">收藏</button></div>
    </div>
  </body>
</html>`

async function openOpusPage(): Promise<{ context: BrowserContext, page: Page }> {
  const context = await launchExtension()
  const page = await context.newPage()
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.hostname === 'www.bilibili.com' && request.resourceType() === 'document') {
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: OPUS_FIXTURE })
      return
    }
    // 正文图片固定用 1×1 PNG 兜住：fixture 里的 i0.hdslb.com 地址在真实网络下是 404，
    // 第 19 轮的图片失败兜底会在 img error 后把 <img> 换成占位，
    // 导致 lightbox 里读不到原图 src（用例假红）。这里让图片请求确定性成功。
    if (url.hostname === 'i0.hdslb.com' && request.resourceType() === 'image') {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
      })
      return
    }
    await route.continue()
  })
  await page.goto('https://www.bilibili.com/opus/123456789', { waitUntil: 'domcontentloaded' })
  return { context, page }
}

/** 在文章增强浮层（独立 shadow root）里查询 */
function readArticleOverlay(page: Page) {
  return page.evaluate(() => {
    const host = document.querySelector('#bewly-article-page')
    const root = host?.shadowRoot ?? null
    const dock = root?.querySelector('.bap-dock') as HTMLElement | null
    return {
      hostExists: Boolean(host),
      ready: root?.querySelector('.bap-root')?.getAttribute('data-ready') === 'true',
      fabCount: root?.querySelectorAll('.bap-fab').length ?? 0,
      readingPressed: root?.querySelector('.bap-fab[aria-pressed]')?.getAttribute('aria-pressed') ?? '',
      readingClass: document.documentElement.classList.contains('bewly-article-reading'),
      contentMaxWidth: (() => {
        const content = document.querySelector('[data-bewly-article-content]') as HTMLElement | null
        return content
          ? getComputedStyle(content).maxWidth
          : ''
      })(),
      contentWidth: (() => {
        const content = document.querySelector('[data-bewly-article-content]') as HTMLElement | null
        if (!content)
          return 0
        const style = getComputedStyle(content)
        const padding = (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0)
        // max-width 作用在内容盒上：去掉左右内边距才是「正文宽度」
        return Math.round(content.getBoundingClientRect().width - padding)
      })(),
      lightboxOpen: Boolean(root?.querySelector('.bap-lightbox')),
      lightboxImage: root?.querySelector('.bap-lightbox__image')?.getAttribute('src') ?? '',
      copyButtons: document.querySelectorAll('[data-bewly-code-copy]').length,
      dockVisible: dock
        ? getComputedStyle(dock).display !== 'none'
        : false,
    }
  })
}

test.describe('文章 / opus 阅读模式', () => {
  skipIfExtensionMissing()

  test('阅读模式 / 限宽 720 / 图片 lightbox / 代码块复制按钮', async () => {
    const { context, page } = await openOpusPage()

    try {
      // 浮层挂载（独立 shadow root，不依赖 #bewly 应用）
      await expect(page.locator('#bewly-article-page')).toHaveCount(1, { timeout: 30_000 })
      await expect.poll(async () => (await readArticleOverlay(page)).ready, { timeout: 30_000 }).toBe(true)
      // ready 之后正文宽度/按钮在个别机器上仍有一拍延迟（整套并发运行时出现过 flaky），再等一拍再断言
      await expect.poll(async () => (await readArticleOverlay(page)).contentWidth > 0, { timeout: 15_000 }).toBe(true)
      await expect.poll(async () => (await readArticleOverlay(page)).fabCount >= 5, { timeout: 15_000 }).toBe(true)

      const initial = await readArticleOverlay(page)
      // 阅读模式下有 5 个按钮：沉浸阅读 / 字号− / 字号+ / 目录 / 回到顶部
      expect(initial.fabCount).toBeGreaterThanOrEqual(5)
      expect(initial.dockVisible).toBe(true)
      expect(initial.readingClass).toBe(false)

      // 点「沉浸阅读」→ html.bewly-article-reading + 正文限宽 720
      await page.locator('#bewly-article-page').waitFor({ state: 'attached' })
      await page.evaluate(() => {
        const root = document.querySelector('#bewly-article-page')?.shadowRoot
        const button = Array.from(root?.querySelectorAll('.bap-fab') ?? [])
          .find(el => /沉浸阅读|reading/i.test(el.getAttribute('aria-label') || '')) as HTMLElement | undefined
        button?.click()
      })
      await expect.poll(async () => (await readArticleOverlay(page)).readingClass, { timeout: 10_000 }).toBe(true)

      await expect.poll(async () => (await readArticleOverlay(page)).contentMaxWidth, { timeout: 10_000 }).toBe('720px')
      const reading = await readArticleOverlay(page)
      expect(reading.readingPressed).toBe('true')
      expect(reading.contentWidth).toBeLessThanOrEqual(720)

      // 代码块被注入复制按钮
      expect(reading.copyButtons).toBeGreaterThanOrEqual(1)

      // 点正文图片 → 打开 lightbox（同文两张图可前后切换）
      await page.locator('.opus-detail img').first().click()
      await expect.poll(async () => (await readArticleOverlay(page)).lightboxOpen, { timeout: 10_000 }).toBe(true)
      const withLightbox = await readArticleOverlay(page)
      expect(withLightbox.lightboxImage).toContain('e2e-image-1')

      // Esc 关闭 lightbox
      await page.keyboard.press('Escape')
      await expect.poll(async () => (await readArticleOverlay(page)).lightboxOpen, { timeout: 10_000 }).toBe(false)

      // 再点一次「沉浸阅读」退出（html class 移除）
      await page.evaluate(() => {
        const root = document.querySelector('#bewly-article-page')?.shadowRoot
        const button = Array.from(root?.querySelectorAll('.bap-fab') ?? [])
          .find(el => /退出阅读|exit/i.test(el.getAttribute('aria-label') || '')) as HTMLElement | undefined
        button?.click()
      })
      await expect.poll(async () => (await readArticleOverlay(page)).readingClass, { timeout: 10_000 }).toBe(false)
    }
    finally {
      await context.close()
    }
  })
})
