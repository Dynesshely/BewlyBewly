import type { BrowserContext, Page } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium, expect, test } from '@playwright/test'

/**
 * service worker 里执行 chrome.storage 调用时使用；测试运行环境（浏览器上下文）自带 chrome，
 * 但仓库 tsconfig 没有引入 @types/chrome，这里做最小声明，避免 typecheck 报未定义。
 */
declare const chrome: {
  storage: {
    local: {
      get: (key: string) => Promise<Record<string, unknown>>
      set: (items: Record<string, unknown>) => Promise<void>
    }
  }
}

export const ROOT = fileURLToPath(new URL('../..', import.meta.url))
export const EXTENSION_DIR = join(ROOT, 'extension')
export const HOME_FIXTURE = join(ROOT, 'tests', 'e2e', 'fixtures', 'bilibili-home.html')

/** 构建产物缺失时整个 spec 跳过（而不是每个用例各写一遍） */
export function extensionBuilt(): boolean {
  return existsSync(join(EXTENSION_DIR, 'manifest.json'))
}

/** 给 describe 级 test.skip 用的统一提示 */
export function skipReason(): string {
  return '先运行 pnpm build 生成 extension/ 目录'
}

export interface LaunchOptions {
  /** 允许新标签页（Enter 打开卡片的用例需要） */
  allowPopups?: boolean
  viewport?: { width: number, height: number }
}

/**
 * 统一启动带扩展的 Chromium 持久上下文。
 *
 * 所有需要扩展的 spec 都用它，避免每个用例重复写 args / channel / viewport。
 */
export async function launchExtension(options: LaunchOptions = {}): Promise<BrowserContext> {
  const { allowPopups = false, viewport = { width: 1440, height: 900 } } = options
  return chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
      ...(allowPopups
        ? ['--disable-popup-blocking']
        : []),
    ],
    viewport,
  })
}

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

/** 在页面里读取 #bewly 的 shadow root 状态（避免每个用例各写一段 evaluate） */
export async function readExtensionState(page: Page) {
  return page.evaluate(() => {
    const host = document.querySelector('#bewly')
    const root = host?.shadowRoot ?? null
    return {
      hostExists: Boolean(host),
      hasShadowRoot: Boolean(root),
      hasWrapper: Boolean(root?.querySelector('#bewly-wrapper, .bewly-wrapper')),
      opacity: host
        ? getComputedStyle(host).opacity
        : null,
      styleSheets: root
        ? root.styleSheets.length
        : -1,
      cards: root?.querySelectorAll('[data-video-card]').length ?? 0,
    }
  })
}

/** 当前高亮卡片的 data-video-url（键盘导航是否就绪、高亮是否移动的判断依据） */
export async function readActiveCardUrl(page: Page): Promise<string> {
  return page.evaluate(() => {
    const root = document.querySelector('#bewly')?.shadowRoot
    return root
      ?.querySelector('[data-video-card][data-keyboard-active]')
      ?.getAttribute('data-video-url') ?? ''
  })
}

/** 卡片数量（含注入的测试卡片） */
export async function countCards(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelector('#bewly')?.shadowRoot?.querySelectorAll('[data-video-card]').length ?? 0)
}

/**
 * 等扩展挂载就绪：host 可见 + shadow root 里有 wrapper + 样式表已注入。
 *
 * 这是所有扩展用例的统一入口，替代「#bewly 出现就立刻操作」的写法。
 */
export async function waitForExtensionReady(page: Page, options: { minCards?: number, timeoutMs?: number } = {}): Promise<void> {
  const { minCards = 0, timeoutMs = 45_000 } = options

  await expect(page.locator('#bewly')).toHaveCount(1, { timeout: timeoutMs })

  await expect.poll(async () => {
    const state = await readExtensionState(page)
    if (!state.hasWrapper || state.styleSheets <= 0)
      return false
    return state.opacity === '1'
  }, {
    timeout: timeoutMs,
    message: '扩展挂载就绪（#bewly 可见、shadow root 注入样式）',
  }).toBe(true)

  if (minCards > 0)
    await waitForStableCardCount(page, minCards, timeoutMs)
}

/**
 * 等卡片数量「足够且稳定」。
 *
 * 首页卡片是异步分期渲染的：数量还在涨的时候按索引 / End / Enter 断言会踩到竞态
 * （keyboard.spec 的 flaky 根因之一）。这里要求连续两次采样相同且达到下限。
 */
export async function waitForStableCardCount(page: Page, minCards = 1, timeoutMs = 45_000): Promise<number> {
  const deadline = Date.now() + timeoutMs
  let last = -1
  let stableSamples = 0
  while (Date.now() < deadline) {
    const count = await countCards(page)
    if (count >= minCards && count === last) {
      stableSamples++
      if (stableSamples >= 2)
        return count
    }
    else {
      stableSamples = 0
    }
    last = count
    await page.waitForTimeout(250)
  }
  throw new Error(`卡片数量在 ${timeoutMs}ms 内没有稳定到 >= ${minCards}（当前 ${last}）`)
}

/** 等键盘导航高亮出现（模块挂载 + 首个高亮设置完成的信号） */
export async function waitForKeyboardHighlight(page: Page, timeoutMs = 30_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const url = await readActiveCardUrl(page)
    if (url)
      return url
    await page.waitForTimeout(150)
  }
  throw new Error('键盘导航高亮没有在超时内出现')
}

/** 等当前高亮卡片变成指定 URL（比比较索引稳定：不受卡片数量变化影响） */
export async function expectActiveCardUrl(page: Page, expectedUrl: string, timeoutMs = 15_000): Promise<void> {
  await expect.poll(() => readActiveCardUrl(page), {
    timeout: timeoutMs,
    message: `当前高亮卡片应为 ${expectedUrl}`,
  }).toBe(expectedUrl)
}

/** 注入不受 Vue 管理的测试卡片（带视频链接，供 Enter / Space / End 用例使用） */
export async function injectTestCards(page: Page, count: number, prefix = 'BVE2E', style = 'height: 120px; display: block'): Promise<string[]> {
  return page.evaluate(({ count, prefix, style }) => {
    const root = document.querySelector('#bewly')?.shadowRoot
    if (!root)
      return []
    const container = root.querySelector('.bewly-scroll-container') || root.querySelector('#bewly-wrapper') || root
    const urls: string[] = []
    for (let i = 0; i < count; i++) {
      const url = `https://www.bilibili.com/video/${prefix}${i}`
      urls.push(url)
      const el = document.createElement('div')
      el.setAttribute('data-video-card', '')
      el.setAttribute('data-video-url', url)
      el.setAttribute('data-video-title', `E2E 测试卡片 ${i}`)
      el.style.cssText = style
      container.appendChild(el)
    }
    return urls
  }, { count, prefix, style })
}

/** 让页面获得键盘焦点（避免焦点停留在输入框 / 面板里导致按键让行） */
export async function focusPage(page: Page): Promise<void> {
  await page.bringToFront()
  await page.evaluate(() => {
    const active = document.activeElement
    if (active instanceof HTMLElement)
      active.blur()
  })
}

/** 点击 dock 里的页面入口（按 tooltip 文案匹配；dock 在 shadow root 内） */
export async function clickDockItem(page: Page, pattern: RegExp): Promise<void> {
  const matched = await page.evaluate((source) => {
    const re = new RegExp(source, 'i')
    const root = document.querySelector('#bewly')?.shadowRoot
    const button = Array.from(root?.querySelectorAll('.dock-item') ?? []).find((el) => {
      const tip = (el.parentElement?.querySelector('.b-tooltip')?.textContent || '').trim()
      return re.test(tip)
    }) as HTMLElement | undefined
    button?.click()
    return Boolean(button)
  }, pattern.source)
  if (!matched)
    throw new Error(`没有找到匹配 ${pattern} 的 dock 入口`)
}

/** 伪造登录态 cookie，让列表页 / 动态页跳过「请先登录」分支（接口仍走真实网络） */
export async function seedFakeLoginCookies(context: BrowserContext): Promise<void> {
  await context.addCookies([
    {
      name: 'DedeUserID',
      value: '123456',
      domain: '.bilibili.com',
      path: '/',
    },
    {
      name: 'bili_jct',
      value: 'abcdef0123456789',
      domain: '.bilibili.com',
      path: '/',
    },
    {
      name: 'SESSDATA',
      value: 'e2e-fake-sessdata',
      domain: '.bilibili.com',
      path: '/',
    },
  ])
}

/** 等扩展的 background service worker 就绪（用它可以给接口做桩 / 改设置） */
export async function waitForServiceWorker(context: BrowserContext) {
  const existing = context.serviceWorkers().find(worker => worker.url().startsWith('chrome-extension://'))
  if (existing)
    return existing
  return context.waitForEvent('serviceworker', {
    predicate: worker => worker.url().startsWith('chrome-extension://'),
    timeout: 30_000,
  })
}

/**
 * 在 background service worker 里给接口做 JSON 桩。
 *
 * 内容脚本的接口请求由 background 发起（页面级 route 拦不到），
 * 因此这里替换 service worker 里的 fetch，让列表 / 动态页在无网络依赖的情况下渲染。
 */
export async function stubBackgroundJson(
  context: BrowserContext,
  rules: Array<{ match: string, body: unknown, status?: number }>,
): Promise<void> {
  const worker = await waitForServiceWorker(context)
  await worker.evaluate((rules) => {
    const scope = globalThis as unknown as {
      __bewlyE2ERules?: typeof rules
      __bewlyE2EOriginalFetch?: typeof fetch
      fetch: typeof fetch
    }
    if (!scope.__bewlyE2EOriginalFetch) {
      scope.__bewlyE2EOriginalFetch = scope.fetch
      scope.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string'
          ? input
          : (input instanceof URL
              ? input.toString()
              : input.url)
        const rule = (scope.__bewlyE2ERules ?? []).find(item => url.includes(item.match))
        if (rule) {
          return Promise.resolve(new Response(JSON.stringify(rule.body), {
            status: rule.status ?? 200,
            headers: { 'content-type': 'application/json' },
          }))
        }
        return scope.__bewlyE2EOriginalFetch!(input as RequestInfo, init)
      }) as typeof fetch
    }
    scope.__bewlyE2ERules = rules
  }, rules)
}

/** 直接改扩展 settings（storage.local 里是 JSON 字符串），用于开关类断言 */
export async function patchExtensionSettings(context: BrowserContext, patch: Record<string, unknown>): Promise<void> {
  const worker = await waitForServiceWorker(context)
  await worker.evaluate(async (patch) => {
    const stored = await chrome.storage.local.get('settings')
    const raw: unknown = stored.settings
    let current: Record<string, unknown> = {}
    if (typeof raw === 'string') {
      try {
        current = JSON.parse(raw) as Record<string, unknown>
      }
      catch {
        current = {}
      }
    }
    else if (raw && typeof raw === 'object') {
      current = raw as Record<string, unknown>
    }
    await chrome.storage.local.set({
      settings: JSON.stringify({
        ...current,
        ...patch,
      }),
    })
  }, patch)
}

/** 读取扩展 settings（同上，测试里用来断言开关持久化） */
export async function readExtensionSettings(context: BrowserContext): Promise<Record<string, unknown>> {
  const worker = await waitForServiceWorker(context)
  return worker.evaluate(async () => {
    const stored = await chrome.storage.local.get('settings')
    const raw: unknown = stored.settings
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as Record<string, unknown>
      }
      catch {
        return {}
      }
    }
    return (raw && typeof raw === 'object')
      ? raw as Record<string, unknown>
      : {}
  })
}

/** 打开 B 站首页 fixture 并等到扩展就绪 */
export async function openHomeFixture(page: Page, options: { minCards?: number } = {}): Promise<void> {
  await routeBilibiliDocument(page, HOME_FIXTURE)
  await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' })
  await waitForExtensionReady(page, { minCards: options.minCards ?? 0 })
}

/** 供 describe 级统一 skip 使用 */
export function skipIfExtensionMissing(): void {
  test.skip(!extensionBuilt(), skipReason())
}
