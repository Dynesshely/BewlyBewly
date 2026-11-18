/**
 * 首页推荐流（自绘）的模块内文案（简中 / 繁中 / 粤语 / 英文）。
 *
 * 不进 `src/_locales`（本轮写入范围不允许改），沿用 `views/Space` / `views/Channel`
 * 的模块内 i18n 方案：语言由 `resolveModuleLocale(settings.language)` 解析，
 * 四种语言的键集合必须完全一致。
 */
import type { ModuleLocale } from '~/utils/moduleI18n'

import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

export interface HomeDrawnMessages {
  /** tab 行 */
  tabRecommend: string
  tabAria: string
  /** 刷新推荐按钮 */
  refresh: string
  refreshHint: string
  refreshing: string
  /** 去其它页 */
  linksAria: string
  linkMoments: string
  linkPopular: string
  linkSearch: string
  linkWatchLater: string
  linkHistory: string
  /** 列表态 */
  loading: string
  loadMore: string
  retry: string
  errorTitle: string
  /** 错误态里的回退入口：在原版首页打开 */
  errorNative: string
  emptyTitle: string
  emptyDescription: string
  end: string
  /** 回到顶部 */
  backToTop: string
  backToTopHint: string
  /** 已加载条数 */
  loadedCount: string
  /** 诊断信息：接口无「到底」信号，靠上限停止 */
  reachedLimit: string
}

const CMN_CN: HomeDrawnMessages = {
  tabRecommend: '推荐',
  tabAria: '首页分区',
  refresh: '刷新推荐',
  refreshHint: '重新拉取第一页推荐（会把滚动位置重置到顶部）',
  refreshing: '正在刷新…',
  linksAria: '去其它页面',
  linkMoments: '动态',
  linkPopular: '热门',
  linkSearch: '搜索',
  linkWatchLater: '稍后再看',
  linkHistory: '历史',
  loading: '载入中…',
  loadMore: '加载更多',
  retry: '重试',
  errorTitle: '推荐加载失败',
  errorNative: '在原版首页打开',
  emptyTitle: '暂时没有推荐',
  emptyDescription: '接口这次没有返回可展示的内容，重试一次或稍后再来。',
  end: '没有更多了',
  backToTop: '回到顶部',
  backToTopHint: '滚过两屏后出现',
  loadedCount: '已加载 {count} 个视频',
  reachedLimit: '已达到本次会话的加载上限，刷新推荐可重新开始',
}

const CMN_TW: HomeDrawnMessages = {
  tabRecommend: '推薦',
  tabAria: '首頁分區',
  refresh: '重新整理推薦',
  refreshHint: '重新拉取第一頁推薦（會把捲動位置重設到頂部）',
  refreshing: '正在重新整理…',
  linksAria: '去其它頁面',
  linkMoments: '動態',
  linkPopular: '熱門',
  linkSearch: '搜尋',
  linkWatchLater: '稍後再看',
  linkHistory: '歷史',
  loading: '載入中…',
  loadMore: '載入更多',
  retry: '重試',
  errorTitle: '推薦載入失敗',
  errorNative: '在原版首頁開啟',
  emptyTitle: '暫時沒有推薦',
  emptyDescription: '介面這次沒有回傳可顯示的內容，重試一次或稍後再來。',
  end: '沒有更多了',
  backToTop: '回到頂部',
  backToTopHint: '捲過兩屏後出現',
  loadedCount: '已載入 {count} 個影片',
  reachedLimit: '已達到本次工作階段的載入上限，重新整理推薦可重新開始',
}

const JYUT: HomeDrawnMessages = {
  ...CMN_TW,
  refresh: 'Refresh 推薦',
  refreshing: 'Refresh 緊…',
  loading: '載入緊…',
  retry: '再試一次',
  errorNative: '喺原版首頁開啟',
  emptyDescription: '呢次冇嘢可以睇，再試一次或者遲啲再嚟。',
  end: '冇喇',
}

const EN: HomeDrawnMessages = {
  tabRecommend: 'Recommended',
  tabAria: 'Home sections',
  refresh: 'Refresh feed',
  refreshHint: 'Fetch page 1 again (scrolls back to the top)',
  refreshing: 'Refreshing…',
  linksAria: 'Go to other pages',
  linkMoments: 'Moments',
  linkPopular: 'Popular',
  linkSearch: 'Search',
  linkWatchLater: 'Watch later',
  linkHistory: 'History',
  loading: 'Loading…',
  loadMore: 'Load more',
  retry: 'Retry',
  errorTitle: 'Failed to load recommendations',
  errorNative: 'Open the original homepage',
  emptyTitle: 'No recommendations right now',
  emptyDescription: 'The feed returned nothing to show this time. Retry, or come back later.',
  end: 'No more videos',
  backToTop: 'Back to top',
  backToTopHint: 'Appears after scrolling two screens',
  loadedCount: 'Loaded {count} videos',
  reachedLimit: 'Session load limit reached. Refresh the feed to start over',
}

const MESSAGES: Record<ModuleLocale, HomeDrawnMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  'jyut': JYUT,
  'en': EN,
}

/** 当前界面语言下的首页文案（跟随设置实时变化） */
export function useHomeDrawnI18n() {
  const t = computed<HomeDrawnMessages>(() =>
    getModuleMessages(MESSAGES, resolveModuleLocale(settings.value.language)),
  )
  return { t }
}
