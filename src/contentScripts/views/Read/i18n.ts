import type { ModuleLocale } from '~/utils/moduleI18n'
import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

/**
 * 专栏列表页自绘层的文案。
 *
 * 走「模块内 i18n」约定（与 articlePage / channelPage 等一致）：只在本模块内维护，
 * 不写进 `src/_locales`（那属于主线词条，本轮不碰）。四种语言键集合必须完全一致。
 */
export interface ReadListMessages {
  /** 页面标题 */
  pageTitle: string
  /** 页面副标题 */
  pageSubtitle: string
  /** 已加载条数，形如「共 {count} 篇」 */
  count: string
  loading: string
  loadMore: string
  noMore: string
  retry: string
  empty: string
  views: string
  likes: string
  unknownAuthor: string
  minutesAgo: string
  hoursAgo: string
  daysAgo: string
  dateSameYear: string
  dateOtherYear: string
  coverAlt: string
}

const CMN_CN: ReadListMessages = {
  pageTitle: '专栏',
  pageSubtitle: 'B 站 UP 主的图文长文，按推荐排序',
  count: '共 {count} 篇',
  loading: '正在加载…',
  loadMore: '加载更多',
  noMore: '没有更多了',
  retry: '加载失败，点击重试',
  empty: '暂时没有可显示的专栏文章',
  views: '阅读',
  likes: '点赞',
  unknownAuthor: '未知作者',
  minutesAgo: '{count} 分钟前',
  hoursAgo: '{count} 小时前',
  daysAgo: '{count} 天前',
  dateSameYear: '{month} 月 {day} 日',
  dateOtherYear: '{year} 年 {month} 月 {day} 日',
  coverAlt: '封面：{title}',
}

const CMN_TW: ReadListMessages = {
  pageTitle: '專欄',
  pageSubtitle: 'B 站 UP 主的圖文長文，按推薦排序',
  count: '共 {count} 篇',
  loading: '正在載入…',
  loadMore: '載入更多',
  noMore: '沒有更多了',
  retry: '載入失敗，點擊重試',
  empty: '暫時沒有可顯示的專欄文章',
  views: '閱讀',
  likes: '點讚',
  unknownAuthor: '未知作者',
  minutesAgo: '{count} 分鐘前',
  hoursAgo: '{count} 小時前',
  daysAgo: '{count} 天前',
  dateSameYear: '{month} 月 {day} 日',
  dateOtherYear: '{year} 年 {month} 月 {day} 日',
  coverAlt: '封面：{title}',
}

const JYUT: ReadListMessages = {
  ...CMN_TW,
  pageSubtitle: 'B 站 UP 主嘅圖文長文，按推薦排序',
  loading: '載入緊…',
  loadMore: '載入多啲',
  noMore: '冇喇',
  retry: '載入失敗，撳一下再試',
  empty: '暫時冇專欄文章可以睇',
  likes: '讚好',
}

const EN: ReadListMessages = {
  pageTitle: 'Articles',
  pageSubtitle: 'Long-form posts from Bilibili creators, recommended for you',
  count: '{count} articles',
  loading: 'Loading…',
  loadMore: 'Load more',
  noMore: 'No more articles',
  retry: 'Failed to load — click to retry',
  empty: 'No articles to show right now',
  views: 'views',
  likes: 'likes',
  unknownAuthor: 'Unknown author',
  minutesAgo: '{count} min ago',
  hoursAgo: '{count} h ago',
  daysAgo: '{count} d ago',
  dateSameYear: '{month}/{day}',
  dateOtherYear: '{year}/{month}/{day}',
  coverAlt: 'Cover: {title}',
}

/** 四种语言键集合一致（缺键回退简中 / 英文，不会出现空串） */
export const MESSAGES: Record<ModuleLocale, ReadListMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  jyut: JYUT,
  en: EN,
}

export function getMessages(language?: string): ReadListMessages {
  return getModuleMessages<ReadListMessages>(MESSAGES, resolveModuleLocale(language ?? settings.value.language), CMN_CN)
}

/** 响应 settings.language 的文案（切语言后无需重建组件） */
export function useMessages() {
  return computed(() => getMessages(settings.value.language))
}

export function formatTemplate(template: string, params: Record<string, string | number>): string {
  let text = template
  for (const [name, value] of Object.entries(params))
    text = text.replaceAll(`{${name}}`, String(value))
  return text
}
