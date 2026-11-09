import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium, expect, test } from '@playwright/test'

import { routeBilibiliDocument } from './utils'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const EXTENSION_DIR = join(ROOT, 'extension')
const HOME_FIXTURE = join(ROOT, 'tests', 'e2e', 'fixtures', 'bilibili-home.html')

test.describe('聚焦浏览（Cover Flow）', () => {
  test.skip(!existsSync(EXTENSION_DIR), '先运行 pnpm build 生成 extension/ 目录')

  test('聚焦模式下快捷键：Ctrl+K 命令面板、回车新标签、空格页面内预览', async () => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${EXTENSION_DIR}`,
        `--load-extension=${EXTENSION_DIR}`,
        '--disable-popup-blocking',
      ],
      viewport: { width: 1440, height: 900 },
    })

    try {
      const page = await context.newPage()
      await routeBilibiliDocument(page, HOME_FIXTURE)
      await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' })
      await expect(page.locator('#bewly')).toHaveCount(1, { timeout: 30_000 })
      await page.waitForFunction(
        () => (document.querySelector('#bewly')?.shadowRoot?.querySelectorAll('[data-video-card]').length ?? 0) > 0,
        undefined,
        { timeout: 30_000 },
      )

      // 注入带视频链接的测试卡片，保证聚焦浏览有可用的轨道
      await page.evaluate(() => {
        const root = document.querySelector('#bewly')!.shadowRoot!
        const container = root.querySelector('.bewly-scroll-container') || root.querySelector('#bewly-wrapper') || root
        for (let i = 0; i < 4; i++) {
          const el = document.createElement('div')
          el.setAttribute('data-video-card', '')
          el.setAttribute('data-video-url', `https://www.bilibili.com/video/BVTESTFOCUS${i}`)
          el.setAttribute('data-video-title', `测试卡片 ${i}`)
          el.style.cssText = 'height: 320px; width: 480px'
          container.appendChild(el)
        }
      })

      const paletteOpen = () => page.evaluate(() => !!document.querySelector('#bewly')?.shadowRoot?.querySelector('.command-palette-mask'))
      // 面板文案跟随界面语言，用命令的按键提示 `F` 定位，避免依赖具体语言
      const focusItemVisible = () => page.evaluate(() => {
        const root = document.querySelector('#bewly')?.shadowRoot
        return Array.from(root?.querySelectorAll('.command-palette-item') ?? [])
          .some(el => el.querySelector('kbd')?.textContent?.trim() === 'F')
      })
      const inFocus = () => page.evaluate(() => document.documentElement.classList.contains('bewly-focus-browse'))

      // 进入聚焦浏览：面板项由 computed 渲染，等它真正出现再点
      await page.keyboard.press('Control+k')
      await expect.poll(paletteOpen, { timeout: 5_000 }).toBe(true)
      await expect.poll(focusItemVisible, { timeout: 5_000 }).toBe(true)
      await page.evaluate(() => {
        const root = document.querySelector('#bewly')!.shadowRoot!
        const target = Array.from(root.querySelectorAll('.command-palette-item'))
          .find(el => el.querySelector('kbd')?.textContent?.trim() === 'F')
        target?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await expect.poll(inFocus, { timeout: 10_000 }).toBe(true)

      // 1) 聚焦模式下 Ctrl+K 仍可打开命令面板
      await page.keyboard.press('Control+k')
      await expect.poll(paletteOpen, { timeout: 5_000 }).toBe(true)

      // 2) Esc 只关面板，不退出聚焦浏览
      await page.keyboard.press('Escape')
      await expect.poll(paletteOpen, { timeout: 5_000 }).toBe(false)
      expect(await inFocus()).toBe(true)

      // 3) 回车：新标签打开当前卡片
      // 先按 End 落到注入的测试卡片（带 video URL），避免 active 卡片是数据未就绪的骨架卡
      await page.keyboard.press('End')
      await page.waitForTimeout(600)
      const activeUrl = await page.evaluate(() => document
        .querySelector('#bewly')
        ?.shadowRoot
        ?.querySelector('[data-video-card][data-keyboard-active]')
        ?.getAttribute('data-video-url') ?? '')
      expect(activeUrl).toContain('/video/')

      const tabsBefore = context.pages().length
      await page.keyboard.press('Enter')
      await expect.poll(() => context.pages().length, { timeout: 10_000 }).toBeGreaterThan(tabsBefore)

      for (const p of context.pages()) {
        if (p !== page && p.url().includes('/video/'))
          await p.close().catch(() => {})
      }
      await page.bringToFront()

      // 4) 空格：在当前页打开内嵌预览抽屉（不整页跳转）
      await page.keyboard.press('Space')
      const drawerVisible = () => page.evaluate(() => !!document.querySelector('#bewly')?.shadowRoot?.querySelector('.bewly-iframe-drawer'))
      await expect.poll(drawerVisible, { timeout: 10_000 }).toBe(true)
      const drawerSrc = await page.evaluate(() => document
        .querySelector('#bewly')
        ?.shadowRoot
        ?.querySelector('.bewly-iframe-drawer iframe')
        ?.getAttribute('src') ?? '')
      expect(drawerSrc).toContain(activeUrl.replace(/^https?:\/\//, ''))
      // 聚焦模式仍在，抽屉关闭后可以继续浏览
      expect(await inFocus()).toBe(true)

      // 5) 抽屉打开后不点击页面任何位置，直接按 Esc 也能关闭（默认策略需两下）
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      await page.keyboard.press('Escape')
      await expect.poll(drawerVisible, { timeout: 10_000 }).toBe(false)
      expect(await inFocus()).toBe(true)
    }
    finally {
      await context.close()
    }
  })
})
