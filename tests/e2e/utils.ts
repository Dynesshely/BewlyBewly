import type { BrowserContext } from '@playwright/test'
import { readFileSync } from 'node:fs'

/**
 * 用本地快照响应 B 站页面文档请求。
 *
 * 只拦截 www.bilibili.com 的 document 请求，其余资源（静态资源、接口）放行；
 * 避免依赖 URL glob 的匹配细节（CI 上根路径 / 的语言重定向曾绕过 glob）。
 */
export async function routeBilibiliDocument(context: BrowserContext, fixturePath: string) {
  const body = readFileSync(fixturePath, 'utf-8')
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.hostname === 'www.bilibili.com' && request.resourceType() === 'document') {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body,
      })
      return
    }
    await route.continue()
  })
}
