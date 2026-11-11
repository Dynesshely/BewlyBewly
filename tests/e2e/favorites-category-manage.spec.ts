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
          title: 'E2E 新建夹',
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
  await expect.poll(() => chipCount(page), { timeout: 30_000 }).toBe(2)
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
  await expect(input).toBeVisible({ timeout: 10_000 })
  await input.fill(title, { timeout: 10_000 })
  await input.press('Enter')
}

test.describe('收藏页收藏夹管理', () => {
  skipIfExtensionMissing()

  test('新建收藏夹成功后胶囊 +1 并选中新夹', async () => {
    test.setTimeout(150_000)
    const { context, page } = await setupFavorites(false)

    try {
      await submitCreate(page, 'E2E 新建夹')

      // 文案跟随界面语言（CI 默认英文），用正则同时匹配中英文
      await expect(page.locator('.Vue-Toastification__toast', { hasText: /收藏夹已创建|Folder created/i }))
        .toHaveCount(1, { timeout: 15_000 })
      await expect.poll(() => chipCount(page), { timeout: 30_000 }).toBe(3)
      await expect.poll(() => activeChipTitle(page), { timeout: 10_000 }).toContain('E2E 新建夹')
    }
    finally {
      await context.close()
    }
  })

  test('新建收藏夹失败时出现 toast 且胶囊数量不变', async () => {
    test.setTimeout(150_000)
    const { context, page } = await setupFavorites(true)

    try {
      await submitCreate(page, 'E2E 失败夹')

      await expect(page.locator('.Vue-Toastification__toast', { hasText: /创建收藏夹失败|Failed to create/i }))
        .toHaveCount(1, { timeout: 15_000 })
      expect(await chipCount(page)).toBe(2)
    }
    finally {
      await context.close()
    }
  })
})
