import type { CDPSession, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { HOME_FIXTURE, launchExtension, routeBilibiliDocument, skipIfExtensionMissing, waitForExtensionReady, waitForStableCardCount } from './utils'

/**
 * 首屏性能基线 + 限速下的图片加载收益测量（第 12 / 14 轮）。
 *
 * 第一部分（基线）：记录 #bewly 挂载、首屏卡片出现耗时、CLS 代理值、图片加载属性覆盖率。
 * 第二部分（限速）：用 CDP 模拟 Fast 3G / Slow 4G，测量
 *   - 首屏卡片数量、封面图开始加载时间；
 *   - fetchpriority=high / low 的图片数量，以及两类请求的「开始时间差」；
 *   - Chromium 实际采用的请求优先级（Network.requestWillBeSent 的 initialPriority），
 *     用来验证 `fetchpriority` 是否真的被浏览器采纳（不是只看 DOM 属性）；
 *   - CLS 代理值。
 *
 * 所有测量都是**只读**的：不修改扩展源码、不改页面，只挂 CDP 监听。
 */

interface ImageAttrs {
  src: string
  priority: string
  loading: string
  /** 图片所在卡片在视口内的位置（px，负值表示在视口上方） */
  top: number
  /** 是否在首屏（视口内） */
  firstScreen: boolean
}

interface NetRequest {
  url: string
  timestamp: number
  priority: string
  type?: string
}

const NET_PROFILES = [
  {
    id: 'fast-3g',
    label: 'Fast 3G',
    latency: 150,
    downloadThroughput: 1.6 * 1024 * 1024 / 8, // 1.6 Mbps
    uploadThroughput: 750 * 1024 / 8, // 750 kbps
  },
  {
    id: 'slow-4g',
    label: 'Slow 4G',
    latency: 150,
    downloadThroughput: 4 * 1024 * 1024 / 8, // 4 Mbps
    uploadThroughput: 3 * 1024 * 1024 / 8, // 3 Mbps
  },
]

/** 读取 shadow root 内卡片封面 / 头像的加载属性与位置（不含 style 内图标） */
async function readImageAttrs(page: Page): Promise<ImageAttrs[]> {
  return page.evaluate(() => {
    const root = document.querySelector('#bewly')?.shadowRoot
    if (!root)
      return []
    const viewportHeight = window.innerHeight
    const imgs = Array.from(root.querySelectorAll('[data-video-card] img')) as HTMLImageElement[]
    return imgs
      .filter(img => img.getAttribute('src') || img.currentSrc)
      .map((img) => {
        const card = img.closest('[data-video-card]')
        const rect = card instanceof HTMLElement
          ? card.getBoundingClientRect()
          : null
        const top = rect
          ? Math.round(rect.top)
          : 0
        // cover / avatar 的 src 是协议相对地址（//i2.hdslb.com/...），
        // 要和 CDP 的绝对请求 URL 对齐必须先转成绝对地址
        const raw = img.getAttribute('src') || img.currentSrc
        let absolute = raw
        try {
          absolute = new URL(raw, location.href).href
        }
        catch {
          absolute = raw
        }
        return {
          src: absolute,
          priority: img.getAttribute('fetchpriority') ?? '',
          loading: img.getAttribute('loading') ?? '',
          top,
          firstScreen: Boolean(rect && rect.top < viewportHeight && rect.bottom > 0),
        }
      })
  })
}

/** 首屏可见卡片数量 + CLS 代理值 */
async function readPageMetrics(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('#bewly')?.shadowRoot
    const cards = Array.from(root?.querySelectorAll('[data-video-card]') ?? []) as HTMLElement[]
    const firstScreenCards = cards.filter((card) => {
      const rect = card.getBoundingClientRect()
      return rect.top < window.innerHeight && rect.bottom > 0 && rect.height > 0
    }).length

    let cls = 0
    try {
      const entries = performance.getEntriesByType('layout-shift') as unknown as Array<{ value: number, hadRecentInput: boolean }>
      for (const entry of entries) {
        if (!entry.hadRecentInput)
          cls += entry.value
      }
    }
    catch {
      // 浏览器不支持时保持 0
    }

    return {
      cards: cards.length,
      firstScreenCards,
      cls: Number(cls.toFixed(4)),
    }
  })
}

/** 找几个关键时间点：封面请求的最早开始时间、high / low 请求的开始时间差 */
function summarizeRequests(requests: NetRequest[], responses: NetRequest[], attrs: ImageAttrs[], baseTimestamp: number | null, eventKeys: string[]) {
  const normalize = (url: string) => {
    try {
      return new URL(url, location.href).href
    }
    catch {
      return url
    }
  }
  // <picture> 会优先请求 .avif / .webp 变体（URL = img src + 后缀），所以按「前缀匹配」关联
  const attrList = attrs.filter(item => item.src)
  const matchAttr = (url: string) => {
    const normalized = normalize(url)
    return attrList.find(item => normalized === item.src
      || normalized.startsWith(`${item.src}.`)
      || normalized.startsWith(item.src))
  }
  const toMs = (timestamp: number) => Math.round((timestamp - (baseTimestamp ?? timestamp)) * 1000)
  const seenUrls = new Set<string>()
  const imageRequests = requests
    .filter((request) => {
      if (seenUrls.has(request.url))
        return false
      const matched = matchAttr(request.url) !== undefined
      if (matched)
        seenUrls.add(request.url)
      return matched
    })
    .sort((a, b) => a.timestamp - b.timestamp)

  const coverRequests = imageRequests.map(request => ({
    ...request,
    domPriority: matchAttr(request.url)?.priority ?? '',
  }))
  // 只按封面（672w 变体）统计「封面开始加载时间」，头像单独算
  const coverOnly = coverRequests.filter(item => item.url.includes('672w'))

  const firstCover = coverOnly[0]?.timestamp ?? null
  const firstCardImage = coverRequests[0]?.timestamp ?? null
  const highRequests = coverRequests.filter(item => item.domPriority === 'high')
  const lowRequests = coverRequests.filter(item => item.domPriority === 'low')

  // 同一 URL 的响应时间（fetchpriority 影响的是排队与响应先后，开始时间可能同帧）
  const responseByUrl = new Map(responses.map(item => [item.url, item.timestamp]))
  const responseTimes = (list: typeof coverRequests) => list
    .map(item => responseByUrl.get(item.url))
    .filter((value): value is number => typeof value === 'number')
    .map(toMs)
    .sort((a, b) => a - b)
  const median = (values: number[]) => values.length
    ? Math.round(values[Math.floor(values.length / 2)])
    : null

  // 严格按「同为 672w 封面」分组比较，避免小头像响应快拉低 low 组的均值
  const coversHigh = coverOnly.filter(item => item.domPriority === 'high')
  const coversLow = coverOnly.filter(item => item.domPriority === 'low')
  // 关键对照：high 封面是否全部在首屏、low 里是否混入了首屏封面（用 DOM 位置做正确性核对）
  const attrByUrl = new Map(attrs.map(item => [item.src, item]))
  const attrForRequest = (url: string) => attrByUrl.get(url) ?? matchAttr(url)
  const highCoverFirstScreenCount = coversHigh.filter(item => attrForRequest(item.url)?.firstScreen).length
  const lowCoverFirstScreenCount = coversLow.filter(item => attrForRequest(item.url)?.firstScreen).length
  const highResponseTimes = responseTimes(coversHigh)
  const lowResponseTimes = responseTimes(coversLow)
  const coverResponses = coverOnly
    .map(item => ({
      domPriority: item.domPriority,
      atMs: responseByUrl.get(item.url),
    }))
    .filter((item): item is { domPriority: string, atMs: number } => typeof item.atMs === 'number')
    .map(item => ({
      domPriority: item.domPriority,
      atMs: toMs(item.atMs),
    }))
    .sort((a, b) => a.atMs - b.atMs)

  const firstHigh = highRequests[0]?.timestamp ?? null
  const firstLow = lowRequests[0]?.timestamp ?? null
  const priorityMismatch = coverRequests.filter((item) => {
    if (!item.domPriority)
      return false
    const expectedHigh = item.domPriority === 'high'
    const actualHigh = item.priority === 'High'
    return expectedHigh !== actualHigh
  }).length

  return {
    cardImageRequests: coverRequests.length,
    coverRequests: coverOnly.length,
    firstCardImageStartMs: firstCardImage !== null
      ? toMs(firstCardImage)
      : null,
    coverFirstStartMs: firstCover !== null
      ? toMs(firstCover)
      : null,
    highCount: attrs.filter(item => item.priority === 'high').length,
    lowCount: attrs.filter(item => item.priority === 'low').length,
    /** 分配合理性：high 里有多少张确实在首屏、low 里有多少张在首屏（high 应全部在首屏） */
    highFirstScreenCount: attrs.filter(item => item.priority === 'high' && item.firstScreen).length,
    lowFirstScreenCount: attrs.filter(item => item.priority === 'low' && item.firstScreen).length,
    highRequests: highRequests.length,
    lowRequests: lowRequests.length,
    highFirstStartMs: firstHigh !== null
      ? toMs(firstHigh)
      : null,
    lowFirstStartMs: firstLow !== null
      ? toMs(firstLow)
      : null,
    /** low 第一张相对 high 第一张的延迟（正数 = high 确实先开始） */
    orderDeltaMs: firstHigh !== null && firstLow !== null
      ? toMs(firstLow) - toMs(firstHigh)
      : null,
    /** 实际网络优先级与 DOM 期望不一致的请求数（CDP 未提供 initialPriority 时恒为 0） */
    priorityMismatch,
    /** 封面（672w）按 DOM fetchpriority 分组的响应到达时间（相对首个网络请求，ms） */
    /** high 封面里首屏图片数 / low 封面里首屏图片数（正常应分别为 12 / 0） */
    highCoverFirstScreenCount,
    lowCoverFirstScreenCount,
    coverHighFirstResponseMs: highResponseTimes[0] ?? null,
    coverLowFirstResponseMs: lowResponseTimes[0] ?? null,
    coverHighMedianResponseMs: median(highResponseTimes),
    coverLowMedianResponseMs: median(lowResponseTimes),
    /** 前 8 个封面响应的到达顺序（high 应更早） */
    coverResponseOrder: coverResponses.slice(0, 8),
    /** 本机 Chromium 的 CDP requestWillBeSent 是否带 initialPriority */
    netPriorityAvailable: eventKeys.includes('initialPriority'),
  }
}

async function measureUnderThrottle(options: {
  latency: number
  downloadThroughput: number
  uploadThroughput: number
}) {
  const context = await launchExtension()
  try {
    const page = await context.newPage()
    await routeBilibiliDocument(page, HOME_FIXTURE)

    const cdp: CDPSession = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: options.latency,
      downloadThroughput: options.downloadThroughput,
      uploadThroughput: options.uploadThroughput,
    })

    const requests: NetRequest[] = []
    const responses: NetRequest[] = []
    let baseTimestamp: number | null = null
    let eventKeys: string[] = []
    // Playwright 内置的 CDP 类型没声明 initialPriority（CDP 里是 experimental 字段），这里做一次窄化
    cdp.on('Network.requestWillBeSent', (rawEvent) => {
      const event = rawEvent as unknown as {
        request: { url: string }
        timestamp: number
        type?: string
        initialPriority?: string
      }
      if (!eventKeys.length)
        eventKeys = Object.keys(rawEvent as object)
      if (baseTimestamp === null)
        baseTimestamp = event.timestamp
      if (event.type !== 'Image')
        return
      requests.push({
        url: event.request.url,
        timestamp: event.timestamp, // 秒（CDP monotonic）
        priority: event.initialPriority ?? '',
        type: event.type,
      })
    })

    cdp.on('Network.responseReceived', (rawEvent) => {
      const event = rawEvent as unknown as {
        type?: string
        timestamp: number
        response: { url: string }
      }
      if (event.type !== 'Image')
        return
      responses.push({
        url: event.response.url,
        timestamp: event.timestamp,
        priority: '',
        type: event.type,
      })
    })

    const navStart = Date.now()
    await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' })
    await waitForExtensionReady(page)
    const mountMs = Date.now() - navStart
    await waitForStableCardCount(page, 1)
    const cardsMs = Date.now() - navStart

    // 给限速下的图片请求一段时间开始（不等待全部加载完成，避免慢网下超时）
    await page.waitForTimeout(2500)

    const pageMetrics = await readPageMetrics(page)
    const attrs = await readImageAttrs(page)
    const requestSummary = summarizeRequests(requests, responses, attrs, baseTimestamp, eventKeys)

    return {
      mountMs,
      cardsMs,
      ...pageMetrics,
      ...requestSummary,
      totalImageRequests: requests.length,
      imagesWithPriority: attrs.filter(item => item.priority).length,
      imagesLazy: attrs.filter(item => item.loading === 'lazy').length,
    }
  }
  finally {
    await context.close()
  }
}

test.describe('首屏性能基线', () => {
  skipIfExtensionMissing()

  test('记录 #bewly 挂载、首屏卡片、CLS 与图片属性覆盖率', async () => {
    const context = await launchExtension()

    try {
      const page = await context.newPage()
      await routeBilibiliDocument(page, HOME_FIXTURE)

      const start = Date.now()
      await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded' })
      await waitForExtensionReady(page)
      const mountMs = Date.now() - start

      await waitForStableCardCount(page, 1)
      const cardsMs = Date.now() - start

      // 给布局稳定一点时间：CLS 代理值取扩展就绪 + 1s 内累计的 layout-shift
      await page.waitForTimeout(1000)

      const metrics = await page.evaluate(() => {
        const root = document.querySelector('#bewly')?.shadowRoot
        const cards = root?.querySelectorAll('[data-video-card]').length ?? 0
        const images = Array.from(root?.querySelectorAll('img') ?? []) as HTMLImageElement[]

        let cls = 0
        try {
          const entries = performance.getEntriesByType('layout-shift') as unknown as Array<{ value: number, hadRecentInput: boolean }>
          for (const entry of entries) {
            if (!entry.hadRecentInput)
              cls += entry.value
          }
        }
        catch {
          // 浏览器不支持时保持 0
        }

        return {
          cards,
          images: images.length,
          lazy: images.filter(img => img.getAttribute('loading') === 'lazy').length,
          eager: images.filter(img => img.getAttribute('loading') === 'eager').length,
          decodingAsync: images.filter(img => img.getAttribute('decoding') === 'async').length,
          fetchHigh: images.filter(img => img.getAttribute('fetchpriority') === 'high').length,
          fetchLow: images.filter(img => img.getAttribute('fetchpriority') === 'low').length,
          cls: Number(cls.toFixed(4)),
          styleSheets: root?.styleSheets.length ?? -1,
        }
      })

      const summary = {
        mountMs,
        cardsMs,
        ...metrics,
      }
      // eslint-disable-next-line no-console
      console.log(`[perf] ${JSON.stringify(summary)}`)
      test.info().annotations.push({
        type: 'perf',
        description: `mount: ${mountMs}ms, first cards: ${cardsMs}ms, cards: ${metrics.cards}, imgs: ${metrics.images}, lazy: ${metrics.lazy}, decodingAsync: ${metrics.decodingAsync}, fetchHigh: ${metrics.fetchHigh}, fetchLow: ${metrics.fetchLow}, CLS: ${metrics.cls}`,
      })

      expect(metrics.cards).toBeGreaterThan(0)
      expect(metrics.styleSheets).toBeGreaterThan(0)
      // 宽松上限，仅用于发现明显回退
      expect(mountMs).toBeLessThan(30_000)
      expect(cardsMs).toBeLessThan(30_000)
      // CLS 代理值：只做粗门槛（首屏不该出现明显跳动）
      expect(metrics.cls).toBeLessThan(0.5)
      // 第 12 轮图片属性在重建后必须生效（覆盖率为 0 说明属性链路断了）
      expect(metrics.decodingAsync).toBeGreaterThan(0)
      expect(metrics.fetchHigh + metrics.fetchLow).toBeGreaterThan(0)
    }
    finally {
      await context.close()
    }
  })
})

test.describe('限速下的图片加载收益', () => {
  skipIfExtensionMissing()

  for (const profile of NET_PROFILES) {
    test(`${profile.label}：首屏卡片 / 封面加载时间 / high-low 顺序 / CLS`, async () => {
      // 同一档位跑两次，抵消单次抖动（取关键指标的 min 与均值）
      const first = await measureUnderThrottle(profile)
      const second = await measureUnderThrottle(profile)
      const result = {
        ...first,
        mountMs: Math.min(first.mountMs, second.mountMs),
        cardsMs: Math.min(first.cardsMs, second.cardsMs),
        coverFirstStartMs: Math.min(...[first.coverFirstStartMs, second.coverFirstStartMs].filter((value): value is number => value !== null)),
        coverHighMedianResponseMs: Math.round(((first.coverHighMedianResponseMs ?? 0) + (second.coverHighMedianResponseMs ?? 0)) / 2),
        coverLowMedianResponseMs: Math.round(((first.coverLowMedianResponseMs ?? 0) + (second.coverLowMedianResponseMs ?? 0)) / 2),
        runs: [first, second],
      }
      // eslint-disable-next-line no-console
      console.log(`[perf:net] ${JSON.stringify({ profile: profile.id, ...result })}`)
      test.info().annotations.push({
        type: 'perf-net',
        description: `${profile.label}: cards ${result.cards} (首屏 ${result.firstScreenCards}), coverFirstStart ${result.coverFirstStartMs !== null
          ? `${Math.round(result.coverFirstStartMs * 1000)}ms`
          : 'n/a'}, high ${result.highCount} / low ${result.lowCount}, orderDelta ${result.orderDeltaMs ?? 'n/a'}ms, mismatch ${result.priorityMismatch}, CLS ${result.cls}`,
      })

      expect(result.cards).toBeGreaterThan(0)
      expect(result.firstScreenCards).toBeGreaterThan(0)
      expect(result.highCount + result.lowCount).toBeGreaterThan(0)
    })
  }
})
