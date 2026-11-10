/**
 * 动态占位页模块内 i18n。
 *
 * 只服务 `views/Moments/**`；语言取自 `settings.language`，缺省回退简中（cmn-CN）。
 */
import { computed } from 'vue'
import { settings } from '~/logic'

export type MomentsLocale = 'cmn-CN' | 'en'

const MESSAGES = {
  'cmn-CN': {
    badge: '占位页',
    title: '动态',
    subtitle: '真正的动态流由原生 t.bilibili.com 提供，这里先给出骨架与入口。',
    open_native: '打开原生动态页',
    open_native_hint: '在新标签页打开 B 站原生动态，功能完整',
    skeleton_note: '下面是计划中的信息结构，尚未接入数据',
    why_title: '为什么这里是占位',
    why_body: 'Bewly 目前接管的是首页、列表与番剧等页面；动态流依赖 B 站原生的时间线接口与长列表虚拟滚动，本轮先交付骨架与入口，避免给出一个半成品的假动态流。',
    plan_title: '计划中的形态',
    plan_1: '信息流按「关注 / 全部 / 转发」分组，顶部 sticky 分段控件；',
    plan_2: '动态卡片复用首页的媒体节奏：正文 + 图片宫格 + 视频缩略；',
    plan_3: '详情走抽屉而不是整页跳转，保持 Bewly 的原地浏览节奏。',
    skeleton_like: '点赞',
    skeleton_comment: '评论',
    skeleton_forward: '转发',
  },
  'en': {
    badge: 'Placeholder',
    title: 'Moments',
    subtitle: 'The real feed lives on t.bilibili.com — this page ships the skeleton and entry points first.',
    open_native: 'Open native moments',
    open_native_hint: 'Opens the native Bilibili moments page in a new tab',
    skeleton_note: 'Planned structure below — no data wired up yet',
    why_title: 'Why is this a placeholder?',
    why_body: 'Bewly currently takes over the home page, list pages and anime pages. The moments feed relies on Bilibili\'s native timeline APIs and long-list virtual scrolling, so this round ships the skeleton and entry points instead of a half-baked fake feed.',
    plan_title: 'Planned shape',
    plan_1: 'Feed grouped by Following / All / Reposts with a sticky segmented control;',
    plan_2: 'Moment cards reuse the home page rhythm: text + image grid + video thumbnail;',
    plan_3: 'Details open in a drawer instead of a full page jump, keeping Bewly\'s in-place browsing flow.',
    skeleton_like: 'Like',
    skeleton_comment: 'Comment',
    skeleton_forward: 'Repost',
  },
} as const

export type MomentsMessageKey = keyof typeof MESSAGES['cmn-CN']

export const NATIVE_MOMENTS_URL = 'https://t.bilibili.com'

export function resolveMomentsLocale(language?: string): MomentsLocale {
  return language === 'en'
    ? 'en'
    : 'cmn-CN'
}

export function useMomentsI18n() {
  const locale = computed<MomentsLocale>(() => resolveMomentsLocale(settings.value.language))

  function t(key: MomentsMessageKey): string {
    const dict = MESSAGES[locale.value] ?? MESSAGES['cmn-CN']
    return dict[key] ?? MESSAGES['cmn-CN'][key] ?? key
  }

  return { t, locale }
}
