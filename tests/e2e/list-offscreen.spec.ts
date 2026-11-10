import { expect, test } from '@playwright/test'

import {
  clickDockItem,
  focusPage,
  launchExtension,
  openHomeFixture,
  patchExtensionSettings,
  seedFakeLoginCookies,
  skipIfExtensionMissing,
  stubBackgroundJson,
  waitForExtensionReady,
  waitForStableCardCount,
} from './utils'

const HISTORY_ITEMS = Array.from({ length: 12 }, (_, index) => ({
  title: `E2E 历史视频 ${index}`,
  show_title: `E2E 历史视频 ${index}`,
  long_title: '',
  cover: 'https://i0.hdslb.com/bfs/archive/e2e-cover.jpg',
  covers: null,
  uri: `https://www.bilibili.com/video/BVE2ELIST${index}`,
  history: {
    oid: 1000 + index,
    epid: 0,
    bvid: `BVE2ELIST${index}`,
    page: 1,
    cid: 2000 + index,
    part: '',
    business: 'archive',
    dt: 1,
  },
  videos: 0,
  author_name: 'E2E UP',
  author_face: 'https://i0.hdslb.com/bfs/face/e2e.jpg',
  author_mid: 1,
  view_at: Math.floor(Date.now() / 1000) - index * 600,
  progress: 30,
  badge: '',
  duration: 120,
  current: '',
  total: 0,
  new_desc: '',
  is_finish: 0,
  is_fav: 0,
  kid: 5000 + index,
  tag_name: '',
  live_status: 0,
}))

const HISTORY_STUB = {
  code: 0,
  message: '0',
  ttl: 1,
  data: {
    list: HISTORY_ITEMS,
    cursor: {
      max: 0,
      view_at: 0,
      business: 'archive',
      ps: 20,
    },
  },
}

/**
 * 第 10 轮新增能力：列表页离屏优化（复用「长列表离屏优化」开关）。
 *
 * 列表页需要登录态，界面接口由 background 发起、页面级 route 拦不到，
 * 所以这里在 service worker 里给历史接口做桩 + 伪造登录 cookie，稳定拿到卡片。
 *
 * 断言重点是「开启优化后卡片仍然可见」以及「关闭优化后完全退回原渲染」，
 * 不绑定具体的 content-visibility 取值（实现细节变化不应让用例变红）。
 */
test.describe('列表页离屏优化', () => {
  skipIfExtensionMissing()

  test('离屏优化开启 / 关闭时历史页卡片都可见', async () => {
    test.slow()
    const context = await launchExtension()

    try {
      await seedFakeLoginCookies(context)
      const page = await context.newPage()
      await openHomeFixture(page, { minCards: 1 })
      await waitForStableCardCount(page, 2)

      // 给历史接口做桩（background fetch），再进入历史页
      await stubBackgroundJson(context, [
        { match: '/x/web-interface/history/cursor', body: HISTORY_STUB },
        {
          match: '/x/v2/history/shadow',
          body: {
            code: 0,
            message: '0',
            ttl: 1,
            data: false,
          },
        },
      ])

      await focusPage(page)
      await clickDockItem(page, /history|观看历史|历史/i)
      await page.waitForFunction(
        () => (document.querySelector('#bewly')?.shadowRoot?.querySelectorAll('[data-bewly-list-card]').length ?? 0) > 0,
        undefined,
        { timeout: 30_000 },
      )

      const readCards = () => page.evaluate(() => {
        const root = document.querySelector('#bewly')?.shadowRoot
        const listPage = root?.querySelector('.bewly-list-page') as HTMLElement | null
        const cards = Array.from(root?.querySelectorAll('[data-bewly-list-card]') ?? []) as HTMLElement[]
        return {
          hasListPage: Boolean(listPage),
          hasToolbar: Boolean(root?.querySelector('.bewly-list-toolbar')),
          cards: cards.length,
          visible: cards.filter((card) => {
            const rect = card.getBoundingClientRect()
            const style = getComputedStyle(card)
            return rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
          }).length,
          optimized: cards.filter(card => Boolean(card.style.contentVisibility)).length,
        }
      })

      // 卡片渲染后离屏优化是异步生效的（settings 异步同步 + 120ms 去抖扫描），等它写到卡片上
      await page.waitForFunction(
        () => Array.from(document.querySelector('#bewly')?.shadowRoot?.querySelectorAll('[data-bewly-list-card]') ?? [])
          .some(card => Boolean((card as HTMLElement).style.contentVisibility)),
        undefined,
        { timeout: 15_000 },
      ).catch(() => null)

      const enabled = await readCards()
      expect(enabled.hasListPage).toBe(true)
      expect(enabled.hasToolbar).toBe(true)
      expect(enabled.cards).toBeGreaterThan(0)
      expect(enabled.visible).toBe(enabled.cards)
      // 离屏优化必须真的写到卡片上（第 11 轮修复 shadow root 查询后，这条才可能通过）
      expect(enabled.optimized).toBeGreaterThan(0)

      // 关闭「离屏优化」（settings.momentsOptimizeEnabled），刷新后卡片仍全部可见
      await patchExtensionSettings(context, { momentsOptimizeEnabled: false })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await waitForExtensionReady(page)
      await page.waitForFunction(
        () => (document.querySelector('#bewly')?.shadowRoot?.querySelectorAll('[data-bewly-list-card]').length ?? 0) > 0,
        undefined,
        { timeout: 30_000 },
      )
      const disabled = await readCards()
      expect(disabled.cards).toBeGreaterThan(0)
      expect(disabled.visible).toBe(disabled.cards)
      expect(disabled.optimized).toBe(0)

      test.info().annotations.push({
        type: 'offscreen',
        description: `优化开启时带 content-visibility 的卡片：${enabled.optimized}/${enabled.cards}；关闭后：${disabled.optimized}/${disabled.cards}`,
      })
    }
    finally {
      await context.close()
    }
  })
})
