import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'

import {
  clickDockItem,
  launchExtension,
  openHomeFixture,
  seedFakeLoginCookies,
  skipIfExtensionMissing,
  waitForServiceWorker,
  waitForStableCardCount,
} from './utils'

/**
 * 第 21 轮：收藏页收藏夹管理（新建）的 stub e2e。
 *
 * 收藏页需要登录态 + 真实收藏接口，这里：
 * - 伪造登录 cookie（bili_jct / DedeUserID）；
 * - 在 background service worker 的 fetch 上做「有状态」桩：
 *   getFavoriteCategories 返回内存里的收藏夹数组、createFavoriteFolder 追加一条（或按开关返回 -500）、
 *   getFavoriteResources 返回空列表；
 * - 断言：新建成功后胶囊数量 +1 且新夹被选中；创建失败时出现 toast 且胶囊数量不变。
 */
/** 新建的收藏夹标题（中英共用，断言时不依赖界面语言） */
const CREATED_FOLDER_TITLE = 'E2E New Folder'
/** 「已创建」toast：跟随界面语言，用双语正则匹配（CI 默认英文） */
const CREATE_OK_RE = /Folder created|收藏夹已创建/i
/** 「创建失败」toast：同上 */
const CREATE_FAIL_RE = /Failed to create folder|创建收藏夹失败/i

const FOLDER_LIST_API = '/x/v3/fav/folder/created/list-all'
const FOLDER_ADD_API = '/x/v3/fav/folder/add'
const RESOURCE_LIST_API = '/x/v3/fav/resource/list'

/** 只统计胶囊本身（排除行末「+ 新建收藏夹」按钮） */
function chipCount(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelector('#bewly')?.shadowRoot?.querySelectorAll('.bewly-list-chip-wrap .bewly-list-chip').length ?? 0)
}

function activeChipTitle(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = document.querySelector('#bewly')?.shadowRoot?.querySelector('.bewly-list-chip-wrap .bewly-list-chip.is-active')
    return active?.textContent?.trim() ?? ''
  })
}

/** 打开收藏页并注入有状态桩；createFails 控制新建是否失败 */
async function setupFavorites(fails: boolean) {
  const context = await launchExtension()
  await seedFakeLoginCookies(context)
  const page = await context.newPage()
  await openHomeFixture(page, { minCards: 1 })
  await waitForStableCardCount(page, 2)

  const worker = await waitForServiceWorker(context)
  await worker.evaluate((apis) => {
    const scope = globalThis as unknown as {
      __e2eFav?: { folders: Array<Record<string, unknown>>, createFails: boolean }
      __e2eFavOriginalFetch?: typeof fetch
      fetch: typeof fetch
    }
    scope.__e2eFav = {
      folders: [
        {
          id: 1001,
          title: 'E2E 收藏夹 A',
          attr: 0,
          media_count: 1,
          fav_state: 0,
          fid: 1001,
        },
        {
          id: 1002,
          title: 'E2E 收藏夹 B',
          attr: 0,
          media_count: 0,
          fav_state: 0,
          fid: 1002,
        },
      ],
      createFails: false,
    }
    scope.__e2eFavOriginalFetch = scope.fetch
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })

    scope.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string'
        ? input
        : (input instanceof URL
            ? input.toString()
            : input.url)
      const state = scope.__e2eFav!

      if (url.includes(apis.folderList)) {
        return Promise.resolve(json({
          code: 0,
          message: '0',
          data: { list: state.folders, count: state.folders.length },
        }))
      }
      if (url.includes(apis.resourceList)) {
        return Promise.resolve(json({
          code: 0,
          message: '0',
          data: {
            info: { id: 0, cover: '', title: '' },
            medias: undefined,
          },
        }))
      }
      if (url.includes(apis.folderAdd)) {
        if (state.createFails)
          return Promise.resolve(json({ code: -500, message: 'E2E 创建失败', data: null }))
        const folder = {
          id: 1000 + state.folders.length + 1,
          title: 'E2E New Folder',
          attr: 0,
          media_count: 0,
          fav_state: 0,
          fid: 1000 + state.folders.length + 1,
        }
        state.folders.push(folder)
        return Promise.resolve(json({ code: 0, message: '0', data: folder }))
      }
      return scope.__e2eFavOriginalFetch!(input as RequestInfo, init)
    }) as typeof fetch
  }, { folderList: FOLDER_LIST_API, resourceList: RESOURCE_LIST_API, folderAdd: FOLDER_ADD_API })

  if (fails) {
    await worker.evaluate(() => {
      (globalThis as unknown as { __e2eFav: { createFails: boolean } }).__e2eFav.createFails = true
    })
  }

  await clickDockItem(page, /favorites|收藏/i)
  // 收藏页首屏需要先拉收藏夹列表（SW 桩）+ 默认收藏夹内容，给足超时
  await expect.poll(() => chipCount(page), { timeout: 45_000 }).toBe(2)
  return { context, page }
}

/** 打开「+ 新建收藏夹」并提交标题 */
async function submitCreate(page: Page, title: string): Promise<void> {
  await page.locator('#bewly').evaluate((host) => {
    const root = (host as HTMLElement).shadowRoot
    const trigger = root?.querySelector('.bewly-list-chip.is-create') as HTMLElement | null
    trigger?.click()
  })
  const input = page.locator('.bewly-list-chip__input').first()
  await expect(input).toBeVisible({ timeout: 15_000 })
  await input.fill(title, { timeout: 15_000 })
  await input.press('Enter')
}

test.describe('收藏页收藏夹管理', () => {
  skipIfExtensionMissing()

  test('新建收藏夹成功后胶囊 +1 并选中新夹', async () => {
    test.setTimeout(180_000)
    const { context, page } = await setupFavorites(false)

    try {
      await submitCreate(page, CREATED_FOLDER_TITLE)

      // 文案跟随界面语言（CI 默认英文），用双语正则匹配
      await expect(page.locator('.Vue-Toastification__toast', { hasText: CREATE_OK_RE }))
        .toHaveCount(1, { timeout: 20_000 })
      await expect.poll(() => chipCount(page), { timeout: 45_000 }).toBe(3)
      // 选中态由新夹标题判断；标题是测试自己写的英文，与界面语言无关
      await expect.poll(() => activeChipTitle(page), { timeout: 15_000 })
        .toContain(CREATED_FOLDER_TITLE)
    }
    finally {
      await context.close()
    }
  })

  test('新建收藏夹失败时出现 toast 且胶囊数量不变', async () => {
    test.setTimeout(180_000)
    const { context, page } = await setupFavorites(true)

    try {
      await submitCreate(page, 'E2E Failing Folder')

      await expect(page.locator('.Vue-Toastification__toast', { hasText: CREATE_FAIL_RE }))
        .toHaveCount(1, { timeout: 20_000 })
      // 失败时不能新增胶囊；用轮询兜住「失败后短暂重渲染」的场景
      await expect.poll(() => chipCount(page), { timeout: 15_000 }).toBe(2)
    }
    finally {
      await context.close()
    }
  })
})

/**
 * 第 26 轮：收藏夹页窄屏（768）走查用例。
 *
 * 断言口径（只保证「收藏页自身」不产生横向溢出）：
 * - 卡片网格固定 2 列（comfortable 视图，minmax(0,1fr) × 2）；
 * - 胶囊行保持单行（不换行）；
 * - 收藏页容器 / #bewly 宿主没有横向溢出；
 * - document 级别的横向滚动由 B 站原生头部的既有行为决定（不在本用例断言范围内），
 *   实测值写进 annotation 供对照。
 */
const NARROW_MEDIAS = Array.from({ length: 3 }, (_, index) => ({
  id: 2000 + index,
  type: 2,
  title: `E2E narrow card ${index + 1}`,
  cover: 'https://i0.hdslb.com/bfs/archive/e2e-narrow.jpg',
  intro: 'E2E',
  page: 1,
  duration: 120,
  upper: { mid: 1, name: 'E2E UP', face: '' },
  cnt_info: { collect: 0, play: 100, danmaku: 1 },
  link: `bilibili://video/2000${index}`,
  ctime: 1700000000,
  pubtime: 1700000000,
  fav_time: 1700000100 + index,
  bvid: `BVE2ENARROW${index}`,
  ugc: { first_cid: 3000 + index },
}))

test.describe('收藏页窄屏（768）', () => {
  skipIfExtensionMissing()

  test('卡片 2 列、胶囊单行、收藏页无横向溢出', async () => {
    test.setTimeout(180_000)
    const context = await launchExtension()

    try {
      await seedFakeLoginCookies(context)
      const page = await context.newPage()
      // 先设视口再进页面：窄屏样式由媒体查询决定，晚设会让首帧按桌面布局渲染
      await page.setViewportSize({ width: 768, height: 900 })

      await openHomeFixture(page, { minCards: 1 })
      await waitForStableCardCount(page, 2)

      const worker = await waitForServiceWorker(context)
      await worker.evaluate((apis) => {
        const scope = globalThis as unknown as {
          __e2eNarrow?: Array<Record<string, unknown>>
          __e2eFavOriginalFetch?: typeof fetch
          fetch: typeof fetch
        }
        scope.__e2eNarrow = apis.medias
        scope.__e2eFavOriginalFetch = scope.fetch
        const json = (body: unknown) => new Response(JSON.stringify(body), {
          headers: { 'content-type': 'application/json' },
        })

        scope.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === 'string'
            ? input
            : (input instanceof URL
                ? input.toString()
                : input.url)

          if (url.includes(apis.folderList)) {
            return Promise.resolve(json({
              code: 0,
              message: '0',
              data: {
                list: [
                  {
                    id: 1001,
                    title: 'E2E folder A',
                    attr: 0,
                    media_count: 3,
                    fav_state: 0,
                    fid: 1001,
                  },
                  {
                    id: 1002,
                    title: 'E2E folder B',
                    attr: 0,
                    media_count: 0,
                    fav_state: 0,
                    fid: 1002,
                  },
                ],
                count: 2,
              },
            }))
          }
          if (url.includes(apis.resourceList)) {
            return Promise.resolve(json({
              code: 0,
              message: '0',
              data: {
                info: { id: 1001, cover: '', title: 'E2E folder A' },
                medias: scope.__e2eNarrow,
              },
            }))
          }
          return scope.__e2eFavOriginalFetch!(input as RequestInfo, init)
        }) as typeof fetch
      }, {
        folderList: FOLDER_LIST_API,
        resourceList: RESOURCE_LIST_API,
        medias: NARROW_MEDIAS,
      })

      await clickDockItem(page, /favorites|收藏/i)
      await expect.poll(() => chipCount(page), { timeout: 45_000 }).toBe(2)

      // 等卡片网格出现（3 条收藏）
      await expect.poll(
        () => page.evaluate(() => document.querySelector('#bewly')?.shadowRoot?.querySelectorAll('.bewly-list-grid .bewly-list-card').length ?? 0),
        { timeout: 45_000, message: '收藏页应渲染 3 张卡片' },
      ).toBe(3)

      const layout = await page.evaluate(() => {
        const root = document.querySelector('#bewly')?.shadowRoot
        const grid = root?.querySelector('.bewly-list-grid') as HTMLElement | null
        const page = root?.querySelector('.bewly-list-page') as HTMLElement | null
        const chips = root?.querySelector('.bewly-list-chips') as HTMLElement | null
        const host = document.querySelector('#bewly') as HTMLElement | null
        const cards = Array.from(grid?.querySelectorAll('.bewly-list-card') ?? []) as HTMLElement[]
        const columns = grid
          ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length
          : 0
        // 第一行卡片数：top 相同的卡片（网格换行判定）
        const firstRowTop = cards[0]
          ? Math.round(cards[0].getBoundingClientRect().top)
          : 0
        const firstRow = cards.filter(card => Math.abs(Math.round(card.getBoundingClientRect().top) - firstRowTop) <= 2).length

        return {
          columns,
          firstRow,
          cardWidth: cards[0]
            ? Math.round(cards[0].getBoundingClientRect().width)
            : 0,
          gridWidth: grid
            ? Math.round(grid.getBoundingClientRect().width)
            : 0,
          chipsWrap: chips
            ? getComputedStyle(chips).flexWrap
            : '',
          chipsHeight: chips
            ? Math.round(chips.getBoundingClientRect().height)
            : 0,
          chipsScrollable: chips
            ? chips.scrollWidth > chips.clientWidth
            : false,
          pageOverflow: page
            ? page.scrollWidth - page.clientWidth
            : -1,
          hostOverflow: host
            ? host.scrollWidth - host.clientWidth
            : -1,
          docOverflow: document.documentElement.scrollWidth - window.innerWidth,
          viewportWidth: window.innerWidth,
        }
      })

      test.info().annotations.push({
        type: 'narrow-768',
        description: JSON.stringify(layout),
      })

      expect(layout.viewportWidth).toBe(768)
      // 768 档：2 列（grid-template-columns 两段 + 第一行两张卡片）
      expect(layout.columns, `768 下网格应为 2 列，实际 ${layout.columns} 列（${JSON.stringify(layout)}）`).toBe(2)
      expect(layout.firstRow, `768 下第一行应排 2 张卡片，实际 ${layout.firstRow}`).toBe(2)
      // 胶囊行单行 + 可横向滚动（不换行撑高）
      expect(layout.chipsWrap).toBe('nowrap')
      expect(layout.chipsHeight).toBeLessThan(48)
      // 收藏页自身无横向溢出（document 级别受原生头部影响，只记录不断言）
      expect(layout.pageOverflow, '收藏页容器不应有横向溢出').toBeLessThanOrEqual(1)
      expect(layout.hostOverflow, '#bewly 宿主不应有横向溢出').toBeLessThanOrEqual(1)
    }
    finally {
      await context.close()
    }
  })
})
