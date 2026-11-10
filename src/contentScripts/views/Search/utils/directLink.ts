import type { SearchMessageKey } from '../i18n'

/**
 * 搜索起始页的「直达」解析。
 *
 * 支持：纯 BV 号 / av 号 / 番剧 ss、ep 号 / 用户 UID 主页链接 / 各类 B 站链接
 * （包括分享文案里夹带的链接与 b23.tv 短链）。
 *
 * 只接受 B 站域名，避免把任意 URL 当成可跳转目标。
 */
export type DirectLinkKind = 'bv' | 'av' | 'bangumi' | 'space' | 'live' | 'dynamic' | 'article' | 'video' | 'link'

export interface DirectLinkResult {
  kind: DirectLinkKind
  /** 用于提示与 aria-label 的稳定标识（BV 号 / 剧集号 / 主机名） */
  id: string
  url: string
}

const BV_PATTERN = /\bBV[0-9A-Za-z]{10}\b/
const AV_PATTERN = /\bav(\d{1,12})\b/i
const SEASON_PATTERN = /\b(ss|ep)(\d{1,12})\b/i
const BILIBILI_URL_PATTERN = /https?:\/\/[^\s"'<>]+|\/\/[^\s"'<>]+|(?:[a-z0-9-]+\.)*bilibili\.com\/[^\s"'<>]*|b23\.tv\/[^\s"'<>]*/i
const TRAILING_PUNCTUATION = /[.,;:!?，。、；：！？）)】\]]+$/

const LABEL_KEYS: Record<DirectLinkKind, SearchMessageKey> = {
  bv: 'label_bv',
  av: 'label_av',
  bangumi: 'label_bangumi',
  space: 'label_space',
  live: 'label_live',
  dynamic: 'label_dynamic',
  article: 'label_article',
  video: 'label_video',
  link: 'label_link',
}

export function labelKeyForKind(kind: DirectLinkKind): SearchMessageKey {
  return LABEL_KEYS[kind] ?? 'label_link'
}

function isBilibiliHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return host === 'bilibili.com'
    || host.endsWith('.bilibili.com')
    || host === 'b23.tv'
    || host.endsWith('.b23.tv')
}

function normalizeUrl(raw: string): string | null {
  let text = raw.trim().replace(TRAILING_PUNCTUATION, '')
  if (!text)
    return null
  if (text.startsWith('//'))
    text = `https:${text}`
  else if (!/^https?:\/\//i.test(text))
    text = `https://${text}`

  try {
    const url = new URL(text)
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      return null
    if (!isBilibiliHost(url.hostname))
      return null
    url.protocol = 'https:'
    return url.toString()
  }
  catch {
    return null
  }
}

function classifyUrl(url: string): DirectLinkResult {
  const parsed = new URL(url)
  const host = parsed.hostname.toLowerCase()
  const path = parsed.pathname

  if (host === 'b23.tv' || host.endsWith('.b23.tv'))
    return { kind: 'link', id: host + path, url }

  if (host.startsWith('space.')) {
    const uid = path.match(/^\/(\d+)/)?.[1]
    return { kind: 'space', id: uid ?? host, url }
  }
  if (host.startsWith('live.')) {
    const room = path.match(/^\/(\d+)/)?.[1]
    return { kind: 'live', id: room ?? host, url }
  }
  if (host.startsWith('t.'))
    return { kind: 'dynamic', id: parsed.pathname || host, url }

  const bv = path.match(/^\/video\/(BV[0-9A-Za-z]{10})/)
  if (bv)
    return { kind: 'bv', id: bv[1], url }
  const av = path.match(/^\/video\/av(\d+)/i)
  if (av)
    return { kind: 'av', id: `av${av[1]}`, url }
  const season = path.match(/^\/bangumi\/play\/(ss|ep)(\d+)/i)
  if (season)
    return { kind: 'bangumi', id: `${season[1].toLowerCase()}${season[2]}`, url }
  if (path.startsWith('/bangumi/'))
    return { kind: 'bangumi', id: path, url }
  const article = path.match(/^\/read\/cv(\d+)/i)
  if (article)
    return { kind: 'article', id: `cv${article[1]}`, url }
  const opus = path.match(/^\/opus\/(\d+)/i)
  if (opus)
    return { kind: 'dynamic', id: `opus ${opus[1]}`, url }
  if (path.startsWith('/video/'))
    return { kind: 'video', id: path, url }

  return { kind: 'link', id: host, url }
}

/**
 * 解析一段粘贴文本 / 输入内容，命中时返回可直接打开的目标。
 * 优先级：链接 > BV 号 > av 号 > 番剧号。
 */
export function parseDirectLink(raw: string): DirectLinkResult | null {
  const text = raw.trim()
  if (!text)
    return null

  const urlMatch = text.match(BILIBILI_URL_PATTERN)
  if (urlMatch) {
    const normalized = normalizeUrl(urlMatch[0])
    if (normalized)
      return classifyUrl(normalized)
  }

  const bvMatch = text.match(BV_PATTERN)
  if (bvMatch) {
    const id = bvMatch[0]
    return { kind: 'bv', id, url: `https://www.bilibili.com/video/${id}` }
  }

  const avMatch = text.match(AV_PATTERN)
  if (avMatch) {
    const id = `av${avMatch[1]}`
    return { kind: 'av', id, url: `https://www.bilibili.com/video/${id}` }
  }

  const seasonMatch = text.match(SEASON_PATTERN)
  if (seasonMatch) {
    const id = `${seasonMatch[1].toLowerCase()}${seasonMatch[2]}`
    return { kind: 'bangumi', id, url: `https://www.bilibili.com/bangumi/play/${id}` }
  }

  return null
}
