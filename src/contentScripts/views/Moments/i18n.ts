/**
 * 动态页模块内 i18n。
 *
 * 只服务 `views/Moments/**`，不触碰全局 `src/_locales`。
 * 语言取自 `settings.language`，缺省回退简中（cmn-CN）。
 */
import type { MomentCardType } from './types'
import { computed } from 'vue'
import { settings } from '~/logic'

import { formatCount, formatRelativeTime, typeMessageKey } from './utils/format'

export type MomentsLocale = 'cmn-CN' | 'en'

const MESSAGES = {
  'cmn-CN': {
    // #region 页头
    page_title: '动态',
    page_subtitle: '关注时间线 · 视频 / 图文 / 转发 / 专栏 / 直播',
    page_badge: '全部动态',
    refresh: '刷新',
    refresh_hint: '重新拉取最新动态',
    open_native: '原生动态页',
    count_loaded: '已加载 {n} 条',
    // #endregion

    // #region 键盘
    keyboard_title: '键盘操作',
    keyboard_hint_bar: 'j / k 或 ↑ / ↓ 切换卡片 · o 打开原动态 · Esc 取消高亮',
    // #endregion

    // #region 状态
    loading: '正在加载动态…',
    loading_more: '正在加载更多…',
    load_failed: '动态加载失败',
    load_more_failed: '加载更多失败',
    retry: '重试',
    load_more: '加载更多',
    no_more: '没有更多动态了',
    empty_title: '还没有动态',
    empty_desc: '关注的 UP 主最近没有更新，或者你还没有登录 B 站',
    login_required: '动态流需要登录 B 站后才能加载',
    // #endregion

    // #region 卡片
    type_video: '视频',
    type_images: '图文',
    type_text: '动态',
    type_forward: '转发',
    type_article: '专栏',
    type_live: '直播',
    type_pgc: '番剧',
    type_unknown: '动态',
    open_original: '打开原动态',
    expand: '展开',
    collapse: '收起',
    origin_deleted: '原动态已删除',
    stat_forward: '转发',
    stat_comment: '评论',
    stat_like: '点赞',
    play_count: '{n} 播放',
    danmaku_count: '{n} 弹幕',
    live_badge: '直播中',
    live_offline: '未开播',
    live_online: '{n} 人在看',
    article_badge: '专栏',
    image_alt: '第 {n} 张图片',
    avatar_alt: '{name} 的头像',
    media_open_hint: '打开视频',
    // #endregion

    // #region 大图
    lightbox_close: '关闭',
    lightbox_prev: '上一张',
    lightbox_next: '下一张',
    lightbox_counter: '{current} / {total}',
    lightbox_hint: 'Esc 关闭 · ← / → 切换',
    // #endregion

    // #region 时间
    just_now: '刚刚',
    minutes_ago: '{n} 分钟前',
    hours_ago: '{n} 小时前',
    days_ago: '{n} 天前',
    date_at: '{date}',
    // #endregion
  },
  en: {
    page_title: 'Moments',
    page_subtitle: 'Following feed · videos, photos, reposts, articles and live',
    page_badge: 'All moments',
    refresh: 'Refresh',
    refresh_hint: 'Fetch the latest moments',
    open_native: 'Native moments',
    count_loaded: '{n} loaded',

    keyboard_title: 'Keyboard',
    keyboard_hint_bar: 'j / k or ↑ / ↓ to move · o to open the original post · Esc to clear',

    loading: 'Loading moments…',
    loading_more: 'Loading more…',
    load_failed: 'Failed to load moments',
    load_more_failed: 'Failed to load more moments',
    retry: 'Retry',
    load_more: 'Load more',
    no_more: 'No more moments',
    empty_title: 'Nothing here yet',
    empty_desc: 'The creators you follow have not posted recently, or you are not signed in',
    login_required: 'Sign in to Bilibili to load your moments feed',

    type_video: 'Video',
    type_images: 'Photos',
    type_text: 'Post',
    type_forward: 'Repost',
    type_article: 'Article',
    type_live: 'Live',
    type_pgc: 'Bangumi',
    type_unknown: 'Post',
    open_original: 'Open original',
    expand: 'Expand',
    collapse: 'Collapse',
    origin_deleted: 'The original post was deleted',
    stat_forward: 'Reposts',
    stat_comment: 'Comments',
    stat_like: 'Likes',
    play_count: '{n} views',
    danmaku_count: '{n} danmaku',
    live_badge: 'LIVE',
    live_offline: 'Offline',
    live_online: '{n} watching',
    article_badge: 'Article',
    image_alt: 'Image {n}',
    avatar_alt: 'Avatar of {name}',
    media_open_hint: 'Open video',

    lightbox_close: 'Close',
    lightbox_prev: 'Previous',
    lightbox_next: 'Next',
    lightbox_counter: '{current} / {total}',
    lightbox_hint: 'Esc to close · ← / → to switch',

    just_now: 'just now',
    minutes_ago: '{n} min ago',
    hours_ago: '{n} h ago',
    days_ago: '{n} d ago',
    date_at: '{date}',
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

  function t(key: MomentsMessageKey, params?: Record<string, string | number>): string {
    const dict = MESSAGES[locale.value] ?? MESSAGES['cmn-CN']
    let text: string = dict[key] ?? MESSAGES['cmn-CN'][key] ?? key
    if (params) {
      for (const [name, value] of Object.entries(params))
        text = text.replaceAll(`{${name}}`, String(value))
    }
    return text
  }

  /** 卡片类型文案 */
  function typeLabel(type: MomentCardType): string {
    return t(typeMessageKey(type))
  }

  /** 紧凑数字：12345 → 1.2万 / 12.3K */
  function count(value: number | string | undefined): string {
    return formatCount(value, locale.value)
  }

  /** 相对时间：3 小时前 / 3 h ago */
  function time(timestamp: number): string {
    return formatRelativeTime(timestamp, t)
  }

  return { t, locale, typeLabel, count, time }
}
