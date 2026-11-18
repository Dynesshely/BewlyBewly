/**
 * 动态页（自绘）的模块内文案（简中 / 繁中 / 粤语 / 英文）。
 *
 * 不进 `src/_locales`（本轮写入范围不允许改），沿用 views/Space / views/Search /
 * views/Channel 的模块内 i18n 方案：语言由 `resolveModuleLocale(settings.language)` 解析，
 * 四种语言的键集合必须完全一致（`DynamicMessages` 接口约束）。
 */
import type { ModuleLocale } from '~/utils/moduleI18n'

import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

export interface DynamicMessages {
  /** tab 无障碍分组名 */
  tabsAria: string
  /** 四个 tab 的文案（与原生一致：全部 / 视频投稿 / 追番追剧 / 专栏） */
  tabAll: string
  tabVideo: string
  tabPgc: string
  tabArticle: string
  loading: string
  loadMore: string
  retry: string
  errorTitle: string
  /** 错误态里的回退入口：在原版页面打开 */
  errorNative: string
  emptyTitle: string
  emptyDescription: string
  /** 列表到底了 */
  end: string
  /** 正文「展开 / 收起」 */
  expand: string
  collapse: string
  /** 操作栏 */
  forward: string
  comment: string
  like: string
  liked: string
  /** 操作栏无障碍名称（带作者名，便于读屏区分） */
  actionAria: string
  /** 视频卡 */
  openVideo: string
  /** 图片 */
  viewImage: string
  /** 转发引用块 */
  quoteFrom: string
  /** 大会员 / 认证徽标 */
  vip: string
  /** 话题 */
  topic: string
  /** 打开动态详情 */
  openDetail: string
}

const CMN_CN: DynamicMessages = {
  tabsAria: '动态分类',
  tabAll: '全部',
  tabVideo: '视频投稿',
  tabPgc: '追番追剧',
  tabArticle: '专栏',
  loading: '载入中…',
  loadMore: '加载更多',
  retry: '重试',
  errorTitle: '动态加载失败',
  errorNative: '在原版页面打开',
  emptyTitle: '这里还没有动态',
  emptyDescription: '关注一些 UP 主之后，他们的动态会出现在这里。',
  end: '没有更多了',
  expand: '展开',
  collapse: '收起',
  forward: '转发',
  comment: '评论',
  like: '点赞',
  liked: '取消点赞',
  actionAria: '对 {name} 的动态{action}',
  openVideo: '打开视频',
  viewImage: '查看原图',
  quoteFrom: '转发自 {name}',
  vip: '大会员',
  topic: '话题',
  openDetail: '打开动态详情',
}

const CMN_TW: DynamicMessages = {
  tabsAria: '動態分類',
  tabAll: '全部',
  tabVideo: '影片投稿',
  tabPgc: '追番追劇',
  tabArticle: '專欄',
  loading: '載入中…',
  loadMore: '載入更多',
  retry: '重試',
  errorTitle: '動態載入失敗',
  errorNative: '在原版頁面開啟',
  emptyTitle: '這裡還沒有動態',
  emptyDescription: '關注一些 UP 主之後，他們的動態會出現在這裡。',
  end: '沒有更多了',
  expand: '展開',
  collapse: '收合',
  forward: '轉發',
  comment: '留言',
  like: '按讚',
  liked: '取消按讚',
  actionAria: '對 {name} 的動態{action}',
  openVideo: '打開影片',
  viewImage: '查看原圖',
  quoteFrom: '轉發自 {name}',
  vip: '大會員',
  topic: '話題',
  openDetail: '打開動態詳情',
}

const JYUT: DynamicMessages = {
  ...CMN_TW,
  tabsAria: '動態分類',
  tabVideo: '影片投稿',
  loading: '載入緊…',
  retry: '再試一次',
  errorNative: '喺原版頁面開啟',
  emptyDescription: '關注啲 UP 主之後，佢哋嘅動態就會喺呢度出現。',
  end: '冇更多喇',
  collapse: '收埋',
  like: '讚好',
  liked: '取消讚好',
  quoteFrom: '轉發自 {name}',
}

const EN: DynamicMessages = {
  tabsAria: 'Dynamic categories',
  tabAll: 'All',
  tabVideo: 'Videos',
  tabPgc: 'Anime & series',
  tabArticle: 'Articles',
  loading: 'Loading…',
  loadMore: 'Load more',
  retry: 'Retry',
  errorTitle: 'Failed to load dynamics',
  errorNative: 'Open in the original page',
  emptyTitle: 'No dynamics yet',
  emptyDescription: 'Follow some creators and their posts will show up here.',
  end: 'No more dynamics',
  expand: 'Expand',
  collapse: 'Collapse',
  forward: 'Repost',
  comment: 'Comment',
  like: 'Like',
  liked: 'Unlike',
  actionAria: '{action} the dynamic by {name}',
  openVideo: 'Open video',
  viewImage: 'View original image',
  quoteFrom: 'Reposted from {name}',
  vip: 'Premium',
  topic: 'Topic',
  openDetail: 'Open the dynamic',
}

const MESSAGES: Record<ModuleLocale, DynamicMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  'jyut': JYUT,
  'en': EN,
}

/** 当前界面语言下的动态页文案（跟随设置实时变化） */
export function useDynamicI18n() {
  const t = computed<DynamicMessages>(() =>
    getModuleMessages(MESSAGES, resolveModuleLocale(settings.value.language), CMN_CN),
  )

  /** 带一个字符串参数的文案替换（`{name}` / `{action}` 这类占位符） */
  const format = (template: string, values: Record<string, string>): string => {
    let output = template
    for (const [key, value] of Object.entries(values))
      output = output.replace(`{${key}}`, value)
    return output
  }

  return { t, format }
}
