/**
 * 页面自检探测（第 24 轮）。
 *
 * 纯本地只读：只查询 DOM / location / matchMedia / 页面已注入的浮动层，
 * **不发网络请求、不写存储、不上报任何数据**。
 *
 * 探测以各增强模块「自己声明的选择器」为源：各模块 `dom.ts` 导出 `probeSelectors`，
 * 这里只做汇总，避免选择器维护两份。
 *
 * 结果按「正常 / 降级 / 不可用」分组，供设置页「诊断」组展示与复制为 Markdown。
 */
import type { ProbeGroupName, ProbeItem, ProbeReasonCode, ProbeReport, ProbeStatus } from './types'

import { getActiveShortcutScopes, SHORTCUT_REGISTRY } from '~/constants/shortcutRegistry'
import { settings } from '~/logic'
import { probeSelectors as articleSelectors, getArticlePageKind } from '../articlePage/dom'
import { probeSelectors as channelSelectors } from '../channelPage/dom'
import { probeSelectors as liveSelectors } from '../livePage/dom'
import { hasNativeOverlay } from '../nativeOverlay'
import { probeSelectors as notificationSelectors } from '../notificationPage/dom'
import { probeSelectors as searchSelectors } from '../searchPage/dom'
import { probeSelectors as spaceSelectors } from '../spacePage/dom'
import { probeSelectors as videoSelectors } from '../videoPage/dom'

export type { ProbeItem } from './types'

/** 浏览器与视口信息（不包含任何账号 / 隐私数据） */
export interface ProbeEnvironment {
  userAgent: string
  viewport: string
  devicePixelRatio: number
  dark: boolean
  reducedMotion: boolean
  bewlyMounted: boolean
  activeShortcutCount: number
}

export interface ProbeResult extends ProbeReport {
  env: ProbeEnvironment
}

function countMatches(selector: string): number {
  try {
    return document.querySelectorAll(selector).length
  }
  catch {
    return 0
  }
}

/** 当前页面生效的快捷键数量（按 registry 的 scope 过滤，纯本地计算） */
function countActiveShortcuts(): number {
  try {
    const activeScopes = getActiveShortcutScopes()
    return SHORTCUT_REGISTRY.filter(entry => activeScopes.has(entry.scope)).length
  }
  catch {
    return 0
  }
}

/** 已注入的浮动层宿主（nativeOverlay 的 host 元素） */
function isHostMounted(hostId: string): boolean {
  if (hasNativeOverlay(hostId))
    return true
  return document.querySelector(`#${hostId}`) !== null
}

/** 页面类型判定（与各模块入口的 URL 判定保持一致） */
export function detectPageKind(): ProbeGroupName | 'unknown' {
  const host = location.hostname
  const path = location.pathname
  if (getArticlePageKind())
    return 'article'
  if (host === 'search.bilibili.com')
    return 'search'
  if (host === 'space.bilibili.com')
    return 'space'
  if (host === 'message.bilibili.com')
    return 'notification'
  if (host === 'live.bilibili.com')
    return 'live'
  if (/^\/bangumi\/play\//.test(path))
    return 'bangumi'
  if (/^\/anime\//.test(path))
    return 'anime'
  if (/^\/list\//.test(path) || /^\/(?:history|watchlater|favorites|medialist)/.test(path))
    return 'list'
  if (/^\/video\//.test(path))
    return 'video'
  if (/^\/(?:v|channel|c)(?:\/|$)/.test(path))
    return 'channel'
  if (host === 't.bilibili.com')
    return 'moments'
  if (host === 'www.bilibili.com' && (path === '/' || path === '/index.html'))
    return 'home'
  return 'unknown'
}

interface ProbeSpec {
  name: string
  group: ProbeGroupName
  hostId?: string
  applies?: boolean
  selectors?: string[]
  enabled?: boolean
  requiresLogin?: boolean
  note?: string
}

export function collectProbeItems(): ProbeItem[] {
  const pageKind = detectPageKind()
  const isHome = /(?:^|\.)bilibili\.com$/.test(location.hostname) && (location.pathname === '/' || location.pathname === '/index.html')

  const specs: ProbeSpec[] = [
    {
      name: '首页卡片增强',
      group: 'home',
      applies: isHome,
      selectors: [
        '.feed-card',
        '.bili-grid .feed-card',
        '.bili-video-card',
        '[data-video-card]',
      ],
    },
    {
      name: '视频播放页增强',
      group: 'video',
      hostId: 'bewly-video-page',
      applies: /^\/(?:video|list|bangumi\/play)\//.test(location.pathname),
      selectors: videoSelectors,
      enabled: settings.value.videoPageCinemaMode || settings.value.videoPageMiniPlayer || settings.value.videoPageShortcuts,
    },
    {
      name: '视频页评论区增强',
      group: 'video',
      applies: /^\/video\//.test(location.pathname),
      selectors: ['#commentapp', 'bili-comments', 'bili-comment-thread-renderer'],
      enabled: settings.value.videoPageComments !== false,
      note: '评论区是 Web Components + shadow DOM，只从宿主元素判断',
    },
    {
      name: '番剧时间表',
      group: 'bangumi',
      applies: /^\/anime\//.test(location.pathname) || /^\/bangumi\//.test(location.pathname),
      selectors: [
        '.anime-timetable',
        '.timeline-item',
        '.anime-card',
        '.bili-video-card',
      ],
    },
    {
      name: '列表页增强',
      group: 'list',
      applies: /^\/list\//.test(location.pathname) || /^\/(?:history|watchlater|favorites|medialist)/.test(location.pathname),
      selectors: [
        '.bewly-list-page',
        '.bewly-list-toolbar',
        '.bili-video-card',
        '.history-record',
      ],
    },
    {
      name: '列表页滚动恢复',
      group: 'list',
      applies: /^\/list\//.test(location.pathname) || /^\/(?:history|watchlater|favorites|medialist)/.test(location.pathname),
      selectors: ['.bewly-list-page', '.bili-video-card', '[data-bewly-list-card]'],
      enabled: settings.value.enableListScrollMemory !== false,
    },
    {
      name: '搜索结果页增强',
      group: 'search',
      hostId: 'bewly-search-enhance',
      applies: location.hostname === 'search.bilibili.com',
      selectors: searchSelectors,
    },
    {
      name: '动态页',
      group: 'moments',
      applies: location.hostname === 't.bilibili.com' || pageKind === 'home',
      selectors: [
        '.bili-dyn-list__item',
        '.bili-dyn-item',
        '.moments-page',
        '.moments-feed',
      ],
    },
    {
      name: '消息页增强',
      group: 'notification',
      hostId: 'bewly-notification-page',
      applies: location.hostname === 'message.bilibili.com',
      selectors: notificationSelectors,
    },
    {
      name: '空间页增强',
      group: 'space',
      hostId: 'bewly-space-enhance',
      applies: location.hostname === 'space.bilibili.com',
      selectors: spaceSelectors,
    },
    {
      name: '文章阅读模式',
      group: 'article',
      hostId: 'bewly-article-page',
      applies: getArticlePageKind() !== null,
      selectors: articleSelectors,
    },
    {
      name: '分区 / 排行榜增强',
      group: 'channel',
      hostId: 'bewly-channel-enhance',
      applies: /^\/(?:v|channel|c)(?:\/|$)/.test(location.pathname),
      selectors: channelSelectors,
    },
    {
      name: '直播页增强',
      group: 'live',
      hostId: 'bewly-live-page',
      applies: location.hostname === 'live.bilibili.com',
      selectors: liveSelectors,
    },
  ]

  return specs.map((spec) => {
    const applies = spec.applies ?? true
    const enabled = spec.enabled ?? true
    const selectors = spec.selectors ?? []
    const selectorCounts = selectors.map(selector => ({
      selector,
      count: countMatches(selector),
    }))
    const matchedCount = selectorCounts.filter(item => item.count > 0).length
    const hostId = spec.hostId ?? null
    const hostMounted = hostId
      ? isHostMounted(hostId)
      : null

    let status: ProbeStatus = 'ok'
    let reasonCode: ProbeReasonCode = 'ok'

    if (!applies) {
      status = 'unavailable'
      reasonCode = 'not-applicable'
    }
    else if (!enabled) {
      status = 'degraded'
      reasonCode = 'user-disabled'
    }
    else if (spec.requiresLogin) {
      status = 'degraded'
      reasonCode = 'login-required'
    }
    else if (!selectors.length) {
      status = 'degraded'
      reasonCode = 'no-selectors'
    }
    else if (matchedCount === 0) {
      status = 'degraded'
      reasonCode = 'selectors-miss'
    }
    else if (hostMounted === false) {
      status = 'degraded'
      reasonCode = 'host-missing'
    }

    return {
      name: spec.name,
      group: status === 'ok'
        ? spec.group
        : status === 'degraded'
          ? 'degraded'
          : 'unavailable',
      status,
      hostId,
      hostMounted,
      selectorCounts,
      matchedCount,
      selectorCount: selectors.length,
      reasonCode,
      note: spec.note,
    }
  })
}

export function collectProbeReport(): ProbeResult {
  const items = collectProbeItems()
  const env: ProbeEnvironment = {
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth} × ${window.innerHeight}`,
    devicePixelRatio: window.devicePixelRatio,
    dark: document.documentElement.classList.contains('dark'),
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    bewlyMounted: document.querySelector('#bewly') !== null,
    activeShortcutCount: countActiveShortcuts(),
  }
  return {
    pageKind: detectPageKind(),
    items,
    okCount: items.filter(item => item.status === 'ok').length,
    degradedCount: items.filter(item => item.status === 'degraded').length,
    unavailableCount: items.filter(item => item.status === 'unavailable').length,
    env,
  }
}

/** 把原因代码转成当前语言的说明文案 */
export function reasonText(item: ProbeItem, t: import('./i18n').DiagnosticsMessages): string {
  switch (item.reasonCode) {
    case 'ok':
      return t.reasonOk
    case 'not-applicable':
      return t.reasonNotApplicable
    case 'user-disabled':
      return t.reasonUserDisabled
    case 'login-required':
      return t.reasonLoginRequired
    case 'selectors-miss':
      return t.reasonSelectorsMiss
    case 'no-selectors':
      return t.reasonNoSelectors
    case 'host-missing':
      return t.reasonHostMissing
  }
}

/** 结果转 Markdown（复制按钮用；纯字符串拼接，不发请求） */
export function reportToMarkdown(report: ProbeResult, messages: import('./i18n').DiagnosticsMessages): string {
  const pageLabel = messages.pageKindLabels[report.pageKind] ?? report.pageKind
  const reasonLabel = (item: ProbeItem) => reasonText(item, messages)
  const lines: string[] = [
    `# ${messages.title}`,
    '',
    `- ${messages.pageType}：${pageLabel}`,
    `- 浏览器：\`${report.env.userAgent}\``,
    `- 视口：\`${report.env.viewport}\` @ \`${report.env.devicePixelRatio}x\``,
    `- 暗色模式：${report.env.dark ? '是' : '否'}；减少动态效果：${report.env.reducedMotion ? '是' : '否'}`,
    `- Bewly 主应用挂载：${report.env.bewlyMounted ? '是' : '否'}`,
    `- 自检时间：${new Date().toLocaleString()}`,
    '',
    `正常 ${report.okCount} · 降级 ${report.degradedCount} · 不可用 ${report.unavailableCount}`,
    '',
  ]

  const statusLabels = { ok: messages.statusOk, degraded: messages.statusDegraded, unavailable: messages.statusUnavailable }
  for (const status of ['ok', 'degraded', 'unavailable'] as const) {
    const group = report.items.filter(item => item.status === status)
    if (!group.length)
      continue
    lines.push(`## ${statusLabels[status]}（${group.length}）`, '')
    for (const item of group) {
      lines.push(`- **${item.name}**：${reasonLabel(item)}`)
      if (item.hostId)
        lines.push(`  - ${item.hostMounted ? messages.hostMounted : messages.hostNotMounted}（\`#${item.hostId}\`）`)
      const hit = item.selectorCounts.filter(s => s.count > 0)
      if (hit.length)
        lines.push(`  - ${messages.selectorsHit}：${hit.map(s => `\`${s.selector}\` (${s.count})`).join('、')}`)
      else if (item.selectorCount)
        lines.push(`  - ${messages.selectorsHit}：0 / ${item.selectorCount}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
