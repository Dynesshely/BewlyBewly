/**
 * 自绘评论区的模块内文案（第 110 轮）。
 *
 * 不进 `src/_locales`（本轮写作用域不允许改），沿用 `views/MessageDrawn` / `views/Space`
 * 的模块内 i18n 方案：语言由 `resolveModuleLocale(settings.language)` 解析，
 * 四种语言的键集合由 `CommentDrawnMessages` 类型约束保证完全一致。
 */
import type { ModuleLocale } from '~/utils/moduleI18n'

import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

/** 时间文案（`{n}` 会被替换成数字） */
export interface CommentTimeLabels {
  justNow: string
  minutesAgo: string
  hoursAgo: string
  daysAgo: string
}

export interface CommentDrawnMessages {
  /** 排序 tab */
  sortHot: string
  sortLatest: string
  /** `{count}` 是总条数文本 */
  total: string
  // 列表状态
  loadingMore: string
  noMore: string
  emptyTitle: string
  emptyDescription: string
  emptyUpTitle: string
  emptyUpDescription: string
  errorTitle: string
  retry: string
  // 单条评论
  anonymous: string
  upBadge: string
  topBadge: string
  vipBadge: string
  upLiked: string
  upReplied: string
  /** `{count}` 是楼中楼条数 */
  repliesCount: string
  collapseReplies: string
  repliesLoading: string
  repliesLoadMore: string
  /** 只看 UP 主（自绘 tab 旁的开关） */
  onlyUp: string
  onlyUpOn: string
  onlyUpOff: string
  onlyUpUnavailable: string
  // 发评论
  composerPlaceholder: string
  composerSubmit: string
  composerSubmitting: string
  composerLoginHint: string
  composerLogin: string
  composerPosted: string
  // 时间
  time: CommentTimeLabels
}

const CMN_CN: CommentDrawnMessages = {
  sortHot: '按热度',
  sortLatest: '按时间',
  total: '{count} 条评论',
  loadingMore: '加载中…',
  noMore: '没有更多了',
  emptyTitle: '还没有评论',
  emptyDescription: '快来抢个沙发吧。',
  emptyUpTitle: 'UP 主还没有评论',
  emptyUpDescription: '关掉「只看 UP 主」可以看到全部评论。',
  errorTitle: '评论加载失败',
  retry: '重试',
  anonymous: '匿名用户',
  upBadge: 'UP',
  topBadge: '置顶',
  vipBadge: '大会员',
  upLiked: 'UP 主觉得很赞',
  upReplied: 'UP 主回复过',
  repliesCount: '共 {count} 条回复',
  collapseReplies: '收起回复',
  repliesLoading: '加载回复中…',
  repliesLoadMore: '加载更多回复',
  onlyUp: '只看 UP 主',
  onlyUpOn: '只看 UP 主评论',
  onlyUpOff: '显示全部评论',
  onlyUpUnavailable: '当前评论里没有 UP 主',
  composerPlaceholder: '发一条友善的评论',
  composerSubmit: '发布',
  composerSubmitting: '发布中…',
  composerLoginHint: '登录后可以发评论',
  composerLogin: '去登录',
  composerPosted: '评论已发布',
  time: {
    justNow: '刚刚',
    minutesAgo: '{n} 分钟前',
    hoursAgo: '{n} 小时前',
    daysAgo: '{n} 天前',
  },
}

const CMN_TW: CommentDrawnMessages = {
  sortHot: '按熱度',
  sortLatest: '按時間',
  total: '{count} 則留言',
  loadingMore: '載入中…',
  noMore: '沒有更多了',
  emptyTitle: '還沒有留言',
  emptyDescription: '快來搶個頭香吧。',
  emptyUpTitle: 'UP 主還沒有留言',
  emptyUpDescription: '關掉「只看 UP 主」可以看到全部留言。',
  errorTitle: '留言載入失敗',
  retry: '重試',
  anonymous: '匿名使用者',
  upBadge: 'UP',
  topBadge: '置頂',
  vipBadge: '大會員',
  upLiked: 'UP 主覺得很讚',
  upReplied: 'UP 主回覆過',
  repliesCount: '共 {count} 則回覆',
  collapseReplies: '收起回覆',
  repliesLoading: '載入回覆中…',
  repliesLoadMore: '載入更多回覆',
  onlyUp: '只看 UP 主',
  onlyUpOn: '只看 UP 主留言',
  onlyUpOff: '顯示全部留言',
  onlyUpUnavailable: '目前留言裡沒有 UP 主',
  composerPlaceholder: '發一則友善的留言',
  composerSubmit: '發佈',
  composerSubmitting: '發佈中…',
  composerLoginHint: '登入後可以發留言',
  composerLogin: '去登入',
  composerPosted: '留言已發佈',
  time: {
    justNow: '剛剛',
    minutesAgo: '{n} 分鐘前',
    hoursAgo: '{n} 小時前',
    daysAgo: '{n} 天前',
  },
}

const JYUT: CommentDrawnMessages = {
  ...CMN_TW,
  sortHot: '按熱度',
  sortLatest: '按時間',
  total: '{count} 條留言',
  loadingMore: '載入緊…',
  noMore: '冇更多喇',
  emptyTitle: '仲未有留言',
  emptyDescription: '快啲嚟搶個頭位啦。',
  emptyUpTitle: 'UP 主仲未留言',
  emptyUpDescription: '閂咗「淨係睇 UP 主」就見到晒所有留言。',
  errorTitle: '留言載入失敗',
  retry: '再試一次',
  upLiked: 'UP 主覺得好正',
  upReplied: 'UP 主回覆過',
  repliesCount: '一共 {count} 條回覆',
  collapseReplies: '收埋回覆',
  repliesLoading: '載入緊回覆…',
  repliesLoadMore: '載入多啲回覆',
  onlyUp: '淨係睇 UP 主',
  onlyUpOn: '淨係顯示 UP 主留言',
  onlyUpOff: '顯示晒所有留言',
  onlyUpUnavailable: '而家啲留言冇 UP 主',
  composerPlaceholder: '留句好話啦',
  composerSubmit: '發佈',
  composerSubmitting: '發佈緊…',
  composerLoginHint: '登入咗就發得留言',
  composerLogin: '去登入',
  composerPosted: '留言發佈咗',
  time: {
    justNow: '啱啱',
    minutesAgo: '{n} 分鐘前',
    hoursAgo: '{n} 個鐘前',
    daysAgo: '{n} 日前',
  },
}

const EN: CommentDrawnMessages = {
  sortHot: 'Top',
  sortLatest: 'Newest',
  total: '{count} comments',
  loadingMore: 'Loading…',
  noMore: 'No more comments',
  emptyTitle: 'No comments yet',
  emptyDescription: 'Be the first to comment.',
  emptyUpTitle: 'The uploader has not commented',
  emptyUpDescription: 'Turn off "Uploader only" to see all comments.',
  errorTitle: 'Failed to load comments',
  retry: 'Retry',
  anonymous: 'Anonymous',
  upBadge: 'UP',
  topBadge: 'Pinned',
  vipBadge: 'Premium',
  upLiked: 'Liked by the uploader',
  upReplied: 'Replied by the uploader',
  repliesCount: '{count} replies',
  collapseReplies: 'Hide replies',
  repliesLoading: 'Loading replies…',
  repliesLoadMore: 'Load more replies',
  onlyUp: 'Uploader only',
  onlyUpOn: 'Showing uploader comments only',
  onlyUpOff: 'Showing all comments',
  onlyUpUnavailable: 'No uploader comments in the loaded list',
  composerPlaceholder: 'Write a friendly comment',
  composerSubmit: 'Post',
  composerSubmitting: 'Posting…',
  composerLoginHint: 'Sign in to comment',
  composerLogin: 'Sign in',
  composerPosted: 'Comment posted',
  time: {
    justNow: 'just now',
    minutesAgo: '{n} min ago',
    hoursAgo: '{n} h ago',
    daysAgo: '{n} d ago',
  },
}

const MESSAGES: Record<ModuleLocale, CommentDrawnMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  jyut: JYUT,
  en: EN,
}

/** 当前界面语言下的自绘评论区文案（跟随设置实时变化） */
export function useCommentDrawnI18n() {
  const t = computed<CommentDrawnMessages>(() =>
    getModuleMessages(MESSAGES, resolveModuleLocale(settings.value.language)),
  )
  return { t }
}

/** 简单占位符替换（`{count}` / `{n}`） */
export function fillTemplate(template: string, value: number | string): string {
  return template.replace(/\{(?:count|n)\}/g, String(value))
}
