/**
 * 分区页（自绘）的 DOM 适配层。
 *
 * 这里集中所有「依赖 B 站页面结构」的查询与副作用，页面改版只改这一处。
 * 所有类名都来自 2026-11-17 的 CDP 真机 dump（/c/douga/、/c/game/、/c/knowledge/、
 * /c/music/、/c/cinephile/、/c/ent/），详见 constants.ts 顶部的说明。
 */
import type { ChannelNavItem } from './constants'
import {
  CHANNEL_DRAWN_HIDDEN_ATTR,
  CHANNEL_NAV,
  FROM_REGION_FALLBACK,
  isNonRegionSlug,
  NATIVE_CHANNEL_CURRENT_CLASS,
  NATIVE_CHANNEL_NAV_SELECTOR,
  NATIVE_PAGE_SELECTOR,
  NATIVE_SUB_REGION_SELECTORS,
  REGION_PATH_RE,
} from './constants'

/**
 * from_region 是从页面自身的 region/feed/rcmd 请求里读出来的。
 *
 * 为什么要读而不是写死：真机里动画分区是 1005，这个编号不是 tid（动画 tid 是 1），
 * 也没有公开接口能查，写死等于给 30 个分区各押一个数字。
 * 页面自己发请求时 from_region 就在 URL 上（performance.getEntriesByType('resource')
 * 里能拿到完整 URL），读它永远和当次页面一致；读不到才退回 FROM_REGION_FALLBACK。
 */
const REGION_FEED_PATH = '/region/feed/rcmd'

/** 轮询原生 feed 请求的间隔与上限（原生首屏请求通常在 1–4s 内发出） */
const FROM_REGION_POLL_INTERVAL = 300
const FROM_REGION_POLL_TIMEOUT = 10_000

/** 二级分区 tab 的一项（只有页面自己提供二级入口时才有内容） */
export interface SubRegionTab {
  label: string
  href: string
  active: boolean
}

/** 当前路径的 slug（/c/douga/、/v/douga 都返回 douga；非分区页返回 null） */
export function getRegionSlug(url: string = location.href): string | null {
  try {
    const parsed = new URL(url)
    if (!/(?:^|\.)bilibili\.com$/i.test(parsed.hostname))
      return null
    const match = REGION_PATH_RE.exec(parsed.pathname)
    if (!match)
      return null
    const slug = match[1]
    if (!slug || isNonRegionSlug(slug))
      return null
    return slug
  }
  catch {
    return null
  }
}

/** 当前是否是「可被自绘接管的视频分区页」 */
export function isChannelRegionPage(url: string = location.href): boolean {
  return getRegionSlug(url) !== null
}

/** 把原生 href 补成绝对地址（// 开头补 https:，/ 开头补域名） */
function normalizeHref(href: string): string {
  if (href.startsWith('//'))
    return `https:${href}`
  if (href.startsWith('/'))
    return `https://www.bilibili.com${href}`
  return href
}

/** 标签 → slug（原生 PGC 项 href 是 /anime/ 这种，正则拿不到 slug 时按标签兜底） */
function labelToSlug(label: string): string | null {
  const found = CHANNEL_NAV.find(item => item.label === label)
  return found?.slug ?? null
}

/**
 * 读原生一级分类导航。
 *
 * 原生导航在 div.bili-header__channel .channel-items__left（真机 39 项），
 * 用它而不是只用常量表，是为了 B 站新增大分区时自绘的 pill 行自动跟上。
 * 读不到（页面结构变了 / 服务端渲染还没出来）返回空数组，由调用方退回常量表。
 */
export function readNativeNav(): ChannelNavItem[] {
  const links = Array.from(
    document.querySelectorAll<HTMLAnchorElement>(NATIVE_CHANNEL_NAV_SELECTOR),
  )
  const items: ChannelNavItem[] = []
  const seen = new Set<string>()
  for (const link of links) {
    const href = link.getAttribute('href') ?? ''
    const label = (link.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (!href || !label || label.length > 12)
      continue
    const match = REGION_PATH_RE.exec(href)
    const slug = match
      ? match[1]
      : labelToSlug(label)
    if (!slug || seen.has(slug))
      continue
    seen.add(slug)
    const known = CHANNEL_NAV.find(item => item.slug === slug)
    items.push({
      slug,
      label: known?.label ?? label,
      href: normalizeHref(href),
      region: Boolean(match) && !isNonRegionSlug(slug),
      color: known?.color,
    })
  }
  return items
}

/** 当前高亮的大分类 slug（优先读原生 --current 类，读不到用当前路径） */
export function getCurrentNavSlug(url: string = location.href): string | null {
  const nativeCurrent = document.querySelector<HTMLElement>(
    `.${NATIVE_CHANNEL_CURRENT_CLASS}`,
  )
  const href = nativeCurrent?.getAttribute('href') ?? ''
  const fromNative = REGION_PATH_RE.exec(href)?.[1]
  if (fromNative)
    return fromNative
  return getRegionSlug(url)
}

/** 原生页给出的分区名（div.channel-name，真机是「动画」「游戏」「知识」…） */
export function readRegionName(): string {
  const text = document.querySelector('.channel-name')?.textContent?.replace(/\s+/g, ' ').trim()
  return text ?? ''
}

/**
 * 原生页是否已经渲染出分区骨架。
 *
 * 用它做「接管前置条件」：骨架都没出来就动手会把服务端错误页 / 加载中的页面藏成白屏。
 */
export function hasNativeRegionLayout(): boolean {
  return Boolean(
    document.querySelector('.feedchannel')
    || document.querySelector('.channel-page')
    || document.querySelector('.channel-container'),
  )
}

/**
 * 等原生骨架出现（最多 timeout 毫秒）。
 *
 * 失败返回 false —— 调用方据此完全不接管，让原生页面留着，符合「失败回退原生」。
 */
export async function waitForNativeRegionLayout(timeout = 6000): Promise<boolean> {
  if (hasNativeRegionLayout())
    return true
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    await new Promise(resolve => window.setTimeout(resolve, 150))
    if (hasNativeRegionLayout())
      return true
  }
  return false
}

/** 在 performance 资源表里找页面自己发的 region/feed/rcmd 请求，取出 from_region */
function readFromRegionFromPerformance(): number | null {
  let entries: PerformanceResourceTiming[] = []
  try {
    entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
  }
  catch {
    return null
  }
  for (const entry of entries) {
    if (!entry.name.includes(REGION_FEED_PATH))
      continue
    const match = /[?&]from_region=(\d+)/.exec(entry.name)
    if (!match)
      continue
    const value = Number.parseInt(match[1], 10)
    if (Number.isFinite(value) && value > 0)
      return value
  }
  return null
}

/**
 * 解析当前分区的 from_region。
 *
 * 顺序：页面自身请求（performance 资源表）→ 静态表 FROM_REGION_FALLBACK → null。
 *
 * 真机上「页面自身请求」这条**首屏基本读不到**：`region/feed/rcmd` 是触底才发的，
 * 首屏那 15 条由服务端直出。所以 mount.ts 调用时不轮询（timeout = 0），
 * 实际走静态表；轮询能力留着给「原生页已经滚动过」的场景（例如 SPA 内返回该分区）。
 */
export async function discoverFromRegion(
  slug: string | null,
  timeout = FROM_REGION_POLL_TIMEOUT,
): Promise<number | null> {
  const immediate = readFromRegionFromPerformance()
  if (immediate !== null)
    return immediate

  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    await new Promise(resolve => window.setTimeout(resolve, FROM_REGION_POLL_INTERVAL))
    const value = readFromRegionFromPerformance()
    if (value !== null)
      return value
  }

  if (slug && FROM_REGION_FALLBACK[slug] !== undefined)
    return FROM_REGION_FALLBACK[slug]
  return null
}

/**
 * 发现原生二级分区 tab。
 *
 * 当前 /c/* 布局里一个都没有（4 个分区页真机确认：div.channel-page__head 只有
 * 分区图标 + 分区名），所以本函数正常返回空数组，组件据此整行隐藏 —— 不伪造数据。
 * 保留它是为了：老版分区页（/tv/、/movie/、/variety/ 这类）或 B 站以后把二级入口
 * 加回来时，自绘页能自动多出一行二级 tab。
 */
export function discoverSubRegionTabs(): SubRegionTab[] {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(NATIVE_SUB_REGION_SELECTORS))
  const tabs: SubRegionTab[] = []
  const seen = new Set<string>()
  for (const node of nodes) {
    const clickable = node.matches('a')
      ? node
      : node.querySelector<HTMLAnchorElement>('a')
    const label = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (!label || label.length > 12)
      continue
    const href = clickable?.getAttribute('href') ?? ''
    const key = `${label}|${href}`
    if (seen.has(key))
      continue
    seen.add(key)
    tabs.push({
      label,
      href: href
        ? normalizeHref(href)
        : '',
      active: node.classList.contains('active') || node.getAttribute('aria-selected') === 'true',
    })
  }
  return tabs
}

/** 隐藏原生分区页（幂等；只动本模块标记过的节点） */
export function hideNativePage(): void {
  document.querySelectorAll<HTMLElement>(NATIVE_PAGE_SELECTOR).forEach((el) => {
    if (el.hasAttribute(CHANNEL_DRAWN_HIDDEN_ATTR))
      return
    el.setAttribute(CHANNEL_DRAWN_HIDDEN_ATTR, '')
    el.style.setProperty('display', 'none', 'important')
  })
}

/** 还原原生分区页（只还原本模块动过的节点） */
export function restoreNativePage(): void {
  document.querySelectorAll<HTMLElement>(`[${CHANNEL_DRAWN_HIDDEN_ATTR}]`).forEach((el) => {
    el.removeAttribute(CHANNEL_DRAWN_HIDDEN_ATTR)
    el.style.removeProperty('display')
  })
}

/** 当前原生页是否已被本模块隐藏（调试 / 回退判断） */
export function isNativePageHidden(): boolean {
  return document.querySelector(`[${CHANNEL_DRAWN_HIDDEN_ATTR}]`) !== null
}
