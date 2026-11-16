import { LIVE_HOST_RE } from './constants'

/**
 * 直播页自绘模块的纯函数工具：URL 解析、数字格式化、图片地址加尺寸参数。
 * 全部无副作用，方便单测与组件复用。
 */

/** 当前页面是不是直播站 */
export function isLiveHost(url: string = location.href): boolean {
  try {
    return LIVE_HOST_RE.test(new URL(url).hostname)
  }
  catch {
    return false
  }
}

/** 自绘页面的种类 */
export type LivePageKind = 'home' | 'room' | 'other'

/** 从路径判断页面种类：`/` 是首页，`/<房间号>` 与 `/blanc/<房间号>` 是直播间 */
export function resolvePageKind(pathname: string = location.pathname): LivePageKind {
  const path = pathname.replace(/\/+$/, '')
  if (path === '' || path === '/index.html' || path === '/index')
    return 'home'
  if (/^\/(?:blanc\/)?\d+$/.test(path))
    return 'room'
  return 'other'
}

/** 从路径解析房间号；解析不出来时返回 null */
export function parseRoomId(pathname: string = location.pathname): string | null {
  const match = /^\/(?:blanc\/)?(\d+)$/.exec(pathname.replace(/\/+$/, ''))
  return match?.[1] ?? null
}

/** 直播间地址：统一走房间号（短号跳转由 B 站自己处理） */
export function roomHref(roomId: number | string): string {
  return `https://live.bilibili.com/${roomId}`
}

/**
 * 数字 → 中文短文案：`1.3万`、`4312`。
 *
 * 与原生一致：大于等于一万按「万」保留一位小数（整万去掉小数），小于一万原样输出。
 */
export function formatCount(value: number | undefined | null): string {
  if (!value || !Number.isFinite(value) || value <= 0)
    return '0'
  if (value < 10_000)
    return String(Math.round(value))
  const wan = value / 10_000
  const text = wan >= 100
    ? wan.toFixed(0)
    : wan.toFixed(1)
  return `${text.replace(/\.0$/, '')}万`
}

/**
 * 给 hdslb 图片地址加尺寸 / 格式参数。
 *
 * 真机封面用的是 `@800w_450h_1c.webp` 这种后缀；地址里已经有 `@` 参数时原样返回，
 * 非 hdslb 域名（外链广告图等）同样原样返回，避免拼出坏链。
 */
export function sizedImage(url: string | undefined | null, width: number, height: number): string {
  if (!url)
    return ''
  const src = url.startsWith('//')
    ? `https:${url}`
    : url
  if (src.includes('@'))
    return src
  if (!/(?:^https?:\/\/)?[^/]*hdslb\.com\//.test(src))
    return src
  return `${src}@${width}w_${height}h_1c.webp`
}

/** 卡片封面：16:9，按网格列宽取 480×270 */
export function coverImage(url: string | undefined | null): string {
  return sizedImage(url, 480, 270)
}

/** 主播头像：正方形 */
export function faceImage(url: string | undefined | null, size = 64): string {
  return sizedImage(url, size, size)
}

/** 分区文案：`一级 · 二级`（有一边缺失时只显示另一边） */
export function areaLabel(parent: string, child: string): string {
  if (parent && child)
    return `${parent} · ${child}`
  return parent || child
}

/** 是否是可用的房间卡片（接口偶尔返回空房间，统一在这里过滤） */
export function isValidRoomCard(card: { roomId?: number, title?: string }): boolean {
  return Boolean(card.roomId)
}
