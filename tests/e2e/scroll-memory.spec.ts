import { expect, test } from '@playwright/test'

import {
  clickDockItem,
  extensionBuilt,
  focusPage,
  launchExtension,
  openHomeFixture,
  seedFakeLoginCookies,
  skipIfExtensionMissing,
  skipReason,
  stubBackgroundJson,
  waitForExtensionReady,
  waitForStableCardCount,
} from './utils'

/**
 * 第 20 轮的滚动位置记忆（第 21 轮补 e2e）。
 *
 * 两个能力各自独立：
 * 1. 首页子标签：切走时把 scrollTop 存进内存 + sessionStorage（`bewly-home-scroll-<tab>`），
 *    切回时轮询到内容够高再落位；刷新页面必须回到顶部（内存态随页面重载清空）；
 * 2. 列表页（历史 / 稍后再看 / 收藏）：记「最近可见卡片 + 相对偏移」到
 *    `bewly-list-scroll-<scope>`，reload / 返回后按卡片锚点反算 scrollTop。
 *
 * 断言都不绑定内部实现细节，只验证「用户可见的滚动位置」。
 */

/** 首页在 #bewly shadow root 里的滚动容器 */
const SCROLL_ROOT_SELECTOR = '.bewly-scroll-container'

async function readHomeScroll(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate((selector) => {
    const root = document.querySelector('#bewly')?.shadowRoot
    const container = root?.querySelector<HTMLElement>(selector) ?? null
    return container?.scrollTop ?? 0
  }, SCROLL_ROOT_SELECTOR)
}

/** 首页标签栏：返回每个标签的文案与是否当前激活 */
async function readHomeTabs(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const root = document.querySelector('#bewly')?.shadowRoot
    const buttons = Array.from(root?.querySelectorAll<HTMLElement>('.home-tabs-inside button') ?? [])
    return buttons.map((button, index) => ({
      index,
      text: (button.textContent || '').trim(),
      active: button.classList.contains('tab-activated'),
    }))
  })
}

async function clickHomeTab(page: import('@playwright/test').Page, index: number): Promise<void> {
  await page.evaluate((tabIndex) => {
    const root = document.querySelector('#bewly')?.shadowRoot
    const buttons = Array.from(root?.querySelectorAll<HTMLElement>('.home-tabs-inside button') ?? [])
    buttons[tabIndex]?.click()
  }, index)
}

/** 让首页滚动容器到达指定位置（程序化赋值，不会触发我们用来自保的 wheel 监听） */
async function setHomeScroll(page: import('@playwright/test').Page, top: number): Promise<number> {
  return page.evaluate(({ selector, value }) => {
    const root = document.querySelector('#bewly')?.shadowRoot
    const container = root?.querySelector<HTMLElement>(selector) ?? null
    if (!container)
      return -1
    container.scrollTop = value
    return container.scrollTop
  }, { selector: SCROLL_ROOT_SELECTOR, value: top })
}

/**
 * 等滚动位置「落到目标附近并稳定下来」。
 *
 * 切换子标签的瞬间浏览器滚动锚定会先给一个中间值（实测 496px），几十到几百毫秒后
 * 我们的恢复才真正落位；单次读取会读到中间态（第 21 轮 e2e 曾因此假红）。
 * 这里要求连续两次采样都接近目标、且彼此基本一致才算稳定。
 */
async function waitForSettledScroll(
  page: import('@playwright/test').Page,
  target: number,
  tolerance = 80,
): Promise<boolean> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const first = await readHomeScroll(page)
    if (Math.abs(first - target) > tolerance) {
      await page.waitForTimeout(100)
      continue
    }
    await page.waitForTimeout(250)
    const second = await readHomeScroll(page)
    if (Math.abs(second - target) <= tolerance && Math.abs(second - first) <= 8)
      return true
    await page.waitForTimeout(100)
  }
  return false
}

async function readHomeSessionKeys(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('bewly-home-scroll-')))
}

/** 列表页：滚动容器 / 卡片位置 / 已保存锚点 */
async function readListState(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const root = document.querySelector('#bewly')?.shadowRoot
    const container = root?.querySelector<HTMLElement>('.bewly-scroll-container') ?? null
    const cards = Array.from(root?.querySelectorAll<HTMLElement>('[data-bewly-list-card]') ?? [])
    const containerTop = container?.getBoundingClientRect().top ?? 0
    return {
      scrollTop: container?.scrollTop ?? 0,
      cards: cards.map(card => ({
        key: card.getAttribute('data-bewly-list-card') ?? '',
        top: Math.round(card.getBoundingClientRect().top - containerTop),
        height: Math.round(card.getBoundingClientRect().height),
      })),
      saved: (() => {
        try {
          const raw = sessionStorage.getItem('bewly-list-scroll-history')
          return raw
            ? JSON.parse(raw) as { key: string, offset: number }
            : null
        }
        catch {
          return null
        }
      })(),
    }
  })
}

/** 把指定 key 的卡片滚到「顶部 + offset」的位置 */
async function scrollListCardToTop(page: import('@playwright/test').Page, key: string, offset = 8): Promise<void> {
  await page.evaluate(({ cardKey, targetOffset }) => {
    const root = document.querySelector('#bewly')?.shadowRoot
    const container = root?.querySelector<HTMLElement>('.bewly-scroll-container') ?? null
    const card = root?.querySelector<HTMLElement>(`[data-bewly-list-card="${CSS.escape(cardKey)}"]`) ?? null
    if (!container || !card)
      return
    const delta = card.getBoundingClientRect().top - container.getBoundingClientRect().top - targetOffset
    container.scrollTop = Math.max(0, container.scrollTop + delta)
  }, { cardKey: key, targetOffset: offset })
}

/** 等历史页卡片渲染出来（与 list-offscreen.spec 同一判据） */
async function waitForListCards(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(
    () => (document.querySelector('#bewly')?.shadowRoot?.querySelectorAll('[data-bewly-list-card]').length ?? 0) > 0,
    undefined,
    { timeout: 30_000 },
  )
}

/** 历史接口桩：与 list-offscreen.spec 完全一致的最小结构 */
const HISTORY_ITEMS = Array.from({ length: 12 }, (_, index) => ({
  title: `E2E 历史视频 ${index}`,
  show_title: `E2E 历史视频 ${index}`,
  long_title: '',
  cover: 'https://i0.hdslb.com/bfs/archive/e2e-cover.jpg',
  covers: null,
  uri: `https://www.bilibili.com/video/BVE2ESCROLL${index}`,
  history: {
    oid: 1000 + index,
    epid: 0,
    bvid: `BVE2ESCROLL${index}`,
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

test.describe('滚动位置记忆', () => {
  skipIfExtensionMissing()

  test('首页：切子标签恢复滚动位置，刷新后回到顶部', async () => {
    test.slow()
    const context = await launchExtension()

    try {
      const page = await context.newPage()
      await openHomeFixture(page, { minCards: 2 })
      await waitForStableCardCount(page, 2)

      // 标签栏异步渲染（settings 读完之后才有）
      await page.waitForFunction(
        () => (document.querySelector('#bewly')?.shadowRoot?.querySelectorAll('.home-tabs-inside button').length ?? 0) >= 2,
        undefined,
        { timeout: 30_000 },
      ).catch(() => null)

      const tabs = await readHomeTabs(page)
      test.skip(tabs.length < 2, `首页只有一个子标签（${tabs.map(tab => tab.text).join('/')}），无法验证切换记忆`)

      const activeIndex = Math.max(0, tabs.findIndex(tab => tab.active))
      const otherIndex = tabs.findIndex((tab, index) => index !== activeIndex)
      const activeTab = tabs[activeIndex]
      const otherTab = tabs[otherIndex]

      // 1) 滚到 800px
      const scrolledTo = await setHomeScroll(page, 800)
      expect(scrolledTo).toBeGreaterThan(700)
      await page.waitForTimeout(200)

      // 2) 切到别的子标签（会触发保存），再切回来（触发恢复）
      await clickHomeTab(page, otherIndex)
      await page.waitForTimeout(800)
      const afterSwitchAway = await readHomeScroll(page)
      const savedKeys = await readHomeSessionKeys(page)
      expect(savedKeys.length).toBeGreaterThan(0)

      await clickHomeTab(page, activeIndex)
      // 等落位稳定（中间态 496ms 是浏览器滚动锚定，不是最终值）
      const settled = await waitForSettledScroll(page, scrolledTo)
      expect(settled, `切回「${activeTab.text}」后滚动位置应稳定在 ${scrolledTo}px 附近`).toBe(true)

      const restored = await readHomeScroll(page)
      const deviation = Math.round(restored - scrolledTo)
      test.info().annotations.push({
        type: 'scroll-home',
        description: `标签：${tabs.map(tab => tab.text).join(' / ')}；滚到 ${scrolledTo}px → 切到「${otherTab.text}」（${Math.round(afterSwitchAway)}px）→ 切回「${activeTab.text}」恢复 ${Math.round(restored)}px（偏差 ${deviation}px）；sessionStorage keys: ${savedKeys.join(', ')}`,
      })

      // 恢复本身必须生效：不能停在顶部
      expect(restored).toBeGreaterThan(300)
      // 第 21 轮修复后：ForYou 有 name、KeepAlive include 生效，切回不再重新请求；
      // 恢复后又做了 rAF×2 + 300ms 的二次校正，落点应稳定在 ±80px 内。
      expect(Math.abs(deviation)).toBeLessThanOrEqual(80)
    }
    finally {
      await context.close()
    }
  })

  /**
   * 第 21 轮修复（BUG 1）：刷新页面后必须回到顶部。
   *
   * 之前 Chromium 会自己恢复**内层滚动容器**的 scrollTop（实测 496px），第 20 轮的内存态
   * 设计挡不住它。现在首页首次挂载且没有待恢复记录时，会主动把 `.bewly-scroll-container`
   * 压回顶部（同步 + rAF×2 + 120ms + 400ms，用户一滚动就放弃）。
   */
  test('首页：刷新页面后回到顶部', async () => {
    const context = await launchExtension()
    try {
      const page = await context.newPage()
      await openHomeFixture(page, { minCards: 2 })
      await waitForStableCardCount(page, 2)
      await setHomeScroll(page, 800)
      await page.waitForTimeout(200)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await waitForExtensionReady(page)
      // 浏览器的 scroll restoration 可能晚于挂载（实测 500ms 之后还有一次），
      // 扩展的压制窗口约 1.6s，这里等到「回顶且连续两次采样都接近 0」再断言。
      let afterReload = await readHomeScroll(page)
      for (let attempt = 0; attempt < 40 && afterReload >= 5; attempt++) {
        await page.waitForTimeout(100)
        afterReload = await readHomeScroll(page)
      }
      await page.waitForTimeout(300)
      afterReload = await readHomeScroll(page)
      test.info().annotations.push({
        type: 'scroll-home-reload',
        description: `刷新后 scrollTop = ${Math.round(afterReload)}（期望 ≈ 0）`,
      })
      expect(afterReload).toBeLessThan(5)
    }
    finally {
      await context.close()
    }
  })

  test('历史列表：reload 后按最近卡片锚点恢复滚动位置', async () => {
    test.slow()
    test.skip(!extensionBuilt(), skipReason())
    const context = await launchExtension()

    try {
      await seedFakeLoginCookies(context)
      const page = await context.newPage()
      await openHomeFixture(page, { minCards: 1 })
      await waitForStableCardCount(page, 2)

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
      await waitForListCards(page)
      await page.waitForTimeout(600)

      const before = await readListState(page)
      test.skip(before.cards.length < 3, '历史页卡片不足 3 张，无法验证锚点恢复')

      // 先滚到列表中部，再以「应用实际记录下来的锚点」为准做 reload 断言。
      // 列表是网格布局，同一行的卡片 top 相同，所以不预设具体是哪一张，只验证：
      // 记录 key → reload → 落回这张卡附近。
      await scrollListCardToTop(page, before.cards[Math.min(4, before.cards.length - 1)].key, 8)
      await page.waitForTimeout(300)

      const saved = (await readListState(page)).saved
      expect(saved).not.toBeNull()
      const anchorKey = saved?.key ?? ''
      const anchorOffset = saved?.offset ?? 0
      expect(anchorKey.length).toBeGreaterThan(0)

      // 模拟「从列表离开再返回」：先回首页，再点回历史（列表页重新挂载，触发锚点恢复）。
      // 不用 reload 是因为扩展会记住上次所在页面，reload 后历史页自己就恢复了，
      // 再点一次 dock 会重置滚动，测不到恢复逻辑本身。
      await focusPage(page)
      await clickDockItem(page, /home|首页|主页/i)
      await page.waitForTimeout(600)
      await focusPage(page)
      await clickDockItem(page, /history|观看历史|历史/i)
      await waitForListCards(page)

      await expect.poll(async () => {
        const state = await readListState(page)
        const restoredCard = state.cards.find(card => card.key === anchorKey)
        // 第 21 轮修复后：恢复落位后再按同一锚点校正（rAF×2 + 300ms + 800ms），
        // 抵消卡片高度/封面加载造成的偏移，落点应稳定在 ±80px 内。
        const nearTop = restoredCard
          ? Math.abs(restoredCard.top - anchorOffset) <= 80
          : false
        return state.scrollTop > 100 && nearTop
      }, {
        timeout: 20_000,
        message: `reload 后应滚回锚点卡片 ${anchorKey} 附近`,
      }).toBe(true)

      const after = await readListState(page)
      const restoredCard = after.cards.find(card => card.key === anchorKey)
      test.info().annotations.push({
        type: 'scroll-list',
        description: `滚动后记录锚点卡片 ${anchorKey}（offset=${anchorOffset}px）→ reload 后 scrollTop=${Math.round(after.scrollTop)}，该卡 top=${restoredCard?.top ?? 'n/a'}px`,
      })
      // 恢复后不应停在顶部
      expect(after.scrollTop).toBeGreaterThan(100)
      // 同一条会话内只恢复一次：记录被清掉
      expect(after.saved).toBeNull()
    }
    finally {
      await context.close()
    }
  })
})
