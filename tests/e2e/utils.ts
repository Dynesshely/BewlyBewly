import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

/**
 * 用本地快照响应 B 站页面文档请求。
 *
 * 只拦截 www.bilibili.com 的 document 请求，其余资源（静态资源、接口）放行。
 * 用 page 级 route（而非 context 级），确保扩展加载场景下主文档请求一定被接管，
 * 避免 CI 上根路径被服务端语言重定向（/ -> /en）绕过拦截。
 */
export async function routeBilibiliDocument(page: Page, fixturePath: string) {
  const body = readFileSync(fixturePath, 'utf-8')
  await page.route('**/*', async (route) => {
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
