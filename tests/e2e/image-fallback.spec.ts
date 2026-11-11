import { readFileSync } from 'node:fs'

import { expect, test } from '@playwright/test'

import { HOME_FIXTURE, launchExtension, skipIfExtensionMissing, waitForExtensionReady } from './utils'

/**
 * 第 20 轮：封面图 404 的统一兜底。
 *
 * 把 hdslb 图片请求全部拦成 404，断言：
 * - 卡片里出现 .bewly-image-fallback（虚线占位 + role=img）；
 * - 同一张封面（同一个 img src）只请求一次 —— 失败后不重试、不新增请求。
 */
const HOME_HTML = readFileSync(HOME_FIXTURE, 'utf-8')

test.describe('封面图 404 兜底', () => {
  skipIfExtensionMissing()

  test('出现 .bewly-image-fallback，且同一封面只请求一次', async () => {
    const context = await launchExtension()

    try {
      const page = await context.newPage()
      /** 只统计「真正的图片 URL」请求次数（avif/webp 候选另算，不算重复请求） */
      const requestCounts = new Map<string, number>()

      await page.route('**/*', async (route) => {
        const request = route.request()
        const url = new URL(request.url())

        if (url.hostname === 'www.bilibili.com' && request.resourceType() === 'document') {
          await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: HOME_HTML })
          return
        }

        // 图片（含 hdslb 头像 / 封面）：一律 404，模拟 CDN 全部失败
        if (request.resourceType() === 'image' && /(?:^|\.)hdslb\.com$/.test(url.hostname)) {
          if (!url.pathname.endsWith('.avif') && !url.pathname.endsWith('.webp')) {
            const key = url.toString()
            requestCounts.set(key, (requestCounts.get(key) ?? 0) + 1)
          }
          await route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' })
          return
        }

        await route.continue()
      })

      await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' })
      await waitForExtensionReady(page, { minCards: 1 })

      // 至少一张卡片里的封面显示统一兜底占位
      const fallback = page.locator('[data-video-card] .bewly-image-fallback').first()
      await expect(fallback).toBeVisible({ timeout: 30_000 })
      await expect(fallback).toHaveAttribute('role', 'img')

      // 等一小段时间确认没有重试请求（失败后 <img> 被占位替换，不应再发请求）
      await page.waitForTimeout(1500)
      const counts = [
        ...requestCounts.values(),
      ]
      test.info().annotations.push({
        type: 'image-requests',
        description: JSON.stringify({
          urls: [
            ...requestCounts.keys(),
          ].slice(0, 8),
          counts: counts.slice(0, 8),
        }),
      })

      expect(counts.length).toBeGreaterThan(0)
      // 每张封面的 img src 恰好请求一次
      expect(counts.every(count => count === 1)).toBe(true)
    }
    finally {
      await context.close()
    }
  })
})
