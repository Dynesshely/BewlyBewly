/**
 * 搜索结果页（自绘）的模块内文案（简中 / 繁中 / 粤语 / 英文）。
 *
 * 不进 `src/_locales`（本轮写作用域不允许改），沿用 `views/Space` 的模块内 i18n 方案：
 * 语言由 `resolveModuleLocale(settings.language)` 解析，四种语言的键集合必须完全一致。
 *
 * 一级分区的名字**不翻译**（见 constants.ts 的 SEARCH_TIDS）：那是 B 站自己的中文
 * 分区名，原生搜索页在任何界面语言下也都显示中文，硬翻反而对不上用户熟悉的叫法。
 */
import type { ModuleLocale } from '~/utils/moduleI18n'

import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

export interface SearchDrawnMessages {
  /** 搜索按钮 */
  searchSubmit: string
  /** 搜索框无障碍名称 */
  searchAria: string
  searchPlaceholder: string
  /** 筛选栏 */
  filtersAria: string
  orderLabel: string
  orderTotalrank: string
  orderClick: string
  orderPubdate: string
  orderDm: string
  orderStow: string
  durationLabel: string
  durationAll: string
  durationShort: string
  durationMedium: string
  durationLong: string
  durationXlong: string
  tidLabel: string
  tidAll: string
  /** 命中数，`{count}` 是已格式化的数字 */
  resultCount: string
  /** 命中数达到接口上限时的文案（接口最多只回 1000 条） */
  resultCountCapped: string
  /** 分页 */
  pageAria: string
  prevPage: string
  nextPage: string
  pageStatus: string
  goPage: string
  /** 状态 */
  loading: string
  retry: string
  errorTitle: string
  /** 错误态里的回退入口：在原版页面打开 */
  errorNative: string
  emptyTitle: string
  emptyDescription: string
  /** 空态按钮：放宽筛选（清掉排序 / 时长 / 分区） */
  emptyClearFilters: string
  /** 空态按钮：在原版页面打开 */
  emptyNative: string
  /** 错误态二级出路说明 */
  errorFallbackHint: string
}

const CMN_CN: SearchDrawnMessages = {
  searchSubmit: '搜索',
  searchAria: '搜索关键词',
  searchPlaceholder: '搜索视频、UP 主、番剧…',
  filtersAria: '搜索结果筛选',
  orderLabel: '排序',
  orderTotalrank: '综合排序',
  orderClick: '最多播放',
  orderPubdate: '最新发布',
  orderDm: '最多弹幕',
  orderStow: '最多收藏',
  durationLabel: '时长',
  durationAll: '全部',
  durationShort: '10 分钟内',
  durationMedium: '10–30 分钟',
  durationLong: '30–60 分钟',
  durationXlong: '60 分钟以上',
  tidLabel: '分区',
  tidAll: '全部分区',
  resultCount: '约 {count} 条结果',
  resultCountCapped: '{count} 条以上结果',
  pageAria: '结果分页',
  prevPage: '上一页',
  nextPage: '下一页',
  pageStatus: '第 {page} / {total} 页',
  goPage: '跳到第 {page} 页',
  loading: '载入中…',
  retry: '重试',
  errorTitle: '搜索结果加载失败',
  errorNative: '在原版页面打开',
  emptyTitle: '没有找到相关视频',
  emptyDescription: '换一个关键词，或放宽筛选条件再试试。',
  emptyClearFilters: '清空筛选条件',
  emptyNative: '在原版页面打开',
  errorFallbackHint: '重试还是不行？可以清空筛选条件，或切到原版搜索页。',
}

const CMN_TW: SearchDrawnMessages = {
  searchSubmit: '搜尋',
  searchAria: '搜尋關鍵字',
  searchPlaceholder: '搜尋影片、UP 主、番劇…',
  filtersAria: '搜尋結果篩選',
  orderLabel: '排序',
  orderTotalrank: '綜合排序',
  orderClick: '最多播放',
  orderPubdate: '最新發佈',
  orderDm: '最多彈幕',
  orderStow: '最多收藏',
  durationLabel: '時長',
  durationAll: '全部',
  durationShort: '10 分鐘內',
  durationMedium: '10–30 分鐘',
  durationLong: '30–60 分鐘',
  durationXlong: '60 分鐘以上',
  tidLabel: '分區',
  tidAll: '全部分區',
  resultCount: '約 {count} 筆結果',
  resultCountCapped: '{count} 筆以上結果',
  pageAria: '結果分頁',
  prevPage: '上一頁',
  nextPage: '下一頁',
  pageStatus: '第 {page} / {total} 頁',
  goPage: '跳到第 {page} 頁',
  loading: '載入中…',
  retry: '重試',
  errorTitle: '搜尋結果載入失敗',
  errorNative: '在原版頁面開啟',
  emptyTitle: '沒有找到相關影片',
  emptyDescription: '換一個關鍵字，或放寬篩選條件再試試。',
  emptyClearFilters: '清空篩選條件',
  emptyNative: '在原版頁面開啟',
  errorFallbackHint: '重試還是不行？可以清空篩選條件，或切到原版搜尋頁。',
}

const JYUT: SearchDrawnMessages = {
  ...CMN_TW,
  searchSubmit: '搵',
  searchAria: '搵咩',
  searchPlaceholder: '搵影片、UP 主、番劇…',
  durationAll: '全部',
  loading: '載入緊…',
  retry: '再試一次',
  errorNative: '喺原版頁面開啟',
  emptyTitle: '搵唔到相關影片',
  emptyDescription: '換個關鍵字，或者放寬篩選再搵過。',
  emptyClearFilters: '清走晒篩選',
  emptyNative: '喺原版頁面開啟',
  errorFallbackHint: '再試都搵唔到？可以清走篩選，或者切去原版搜尋頁。',
}

const EN: SearchDrawnMessages = {
  searchSubmit: 'Search',
  searchAria: 'Search keyword',
  searchPlaceholder: 'Search videos, creators, anime…',
  filtersAria: 'Search result filters',
  orderLabel: 'Sort by',
  orderTotalrank: 'Relevance',
  orderClick: 'Most played',
  orderPubdate: 'Newest',
  orderDm: 'Most danmaku',
  orderStow: 'Most favorited',
  durationLabel: 'Duration',
  durationAll: 'Any',
  durationShort: 'Under 10 min',
  durationMedium: '10–30 min',
  durationLong: '30–60 min',
  durationXlong: 'Over 60 min',
  tidLabel: 'Category',
  tidAll: 'All categories',
  resultCount: 'About {count} results',
  resultCountCapped: 'More than {count} results',
  pageAria: 'Result pagination',
  prevPage: 'Previous',
  nextPage: 'Next',
  pageStatus: 'Page {page} of {total}',
  goPage: 'Go to page {page}',
  loading: 'Loading…',
  retry: 'Retry',
  errorTitle: 'Failed to load search results',
  errorNative: 'Open in the original page',
  emptyTitle: 'No matching videos',
  emptyDescription: 'Try another keyword or loosen the filters.',
  emptyClearFilters: 'Clear filters',
  emptyNative: 'Open in the original page',
  errorFallbackHint: 'Still failing? Clear the filters, or use the original search page.',
}

const MESSAGES: Record<ModuleLocale, SearchDrawnMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  'jyut': JYUT,
  'en': EN,
}

/** 当前界面语言下的搜索页文案（跟随设置实时变化） */
export function useSearchDrawnI18n() {
  const t = computed<SearchDrawnMessages>(() =>
    getModuleMessages(MESSAGES, resolveModuleLocale(settings.value.language)),
  )
  return { t }
}
