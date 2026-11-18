import type { ModuleLocale } from '~/utils/moduleI18n'

import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

/** 排行榜分区 tab 的文案 */
export interface RegionLabels {
  all: string
  anime: string
  guochuang: string
  documentary: string
  movie: string
  tv: string
  variety: string
  animation: string
  game: string
  kichiku: string
  music: string
  dance: string
  cinephile: string
  entertainment: string
  knowledge: string
  tech: string
  food: string
  car: string
  fashion: string
  sports: string
  animal: string
}

export interface PopularMessages {
  /** 顶层 tab 导航的无障碍名称 */
  navAria: string
  tabPopular: string
  tabWeekly: string
  tabPrecious: string
  tabRank: string

  popularTitle: string
  popularSubtitle: string
  popularRules: string
  popularRulesBody: string

  weeklyTitle: string
  weeklySubtitle: string
  /** 形如「第 {number} 期」 */
  weeklyIssue: string
  weeklyIssueSelect: string
  weeklyPrev: string
  weeklyNext: string

  preciousTitle: string
  preciousSubtitle: string
  /** 形如「共 {count} 个宝藏视频」 */
  preciousCount: string

  rankTitle: string
  rankSubtitle: string
  rankRegionAria: string
  /** 形如「第 {rank} 名」 */
  rankNo: string

  loading: string
  loadMore: string
  retry: string
  errorTitle: string
  /** 错误态里的回退按钮：在原版页面打开 */
  errorNative: string
  emptyTitle: string
  emptyDescription: string
  /** 空态按钮：切到「排行榜」tab（热门没内容时更可能有东西看） */
  emptyRank: string
  /** 错误态二级出路说明 */
  errorFallbackHint: string

  playCount: string
  danmakuCount: string

  region: RegionLabels
}

const CMN_CN: PopularMessages = {
  navAria: '热门与排行榜导航',
  tabPopular: '综合热门',
  tabWeekly: '每周必看',
  tabPrecious: '入站必刷',
  tabRank: '排行榜',

  popularTitle: '热门',
  popularSubtitle: '各个领域中新奇好玩的优质内容都在这里',
  popularRules: '热门规则',
  popularRulesBody: '综合热门按播放、互动、新鲜度等数据综合排序，随浏览与互动实时更新；同一天内多次刷新结果会略有差异。',

  weeklyTitle: '每周必看',
  weeklySubtitle: '每周挑选站内值得一看的内容',
  weeklyIssue: '第 {number} 期',
  weeklyIssueSelect: '选择期号',
  weeklyPrev: '上一期',
  weeklyNext: '下一期',

  preciousTitle: '入站必刷',
  preciousSubtitle: '我不允许还有人没看过这些宝藏视频',
  preciousCount: '共 {count} 个宝藏视频',

  rankTitle: '排行榜',
  rankSubtitle: '全站与各分区视频排行，每小时更新',
  rankRegionAria: '排行榜分区',
  rankNo: '第 {rank} 名',

  loading: '载入中…',
  loadMore: '加载更多',
  retry: '重试',
  errorTitle: '内容加载失败',
  errorNative: '在原版页面打开',
  emptyTitle: '暂无内容',
  emptyDescription: '这个分类暂时没有可展示的内容，稍后再看看吧。',
  emptyRank: '去看看排行榜',
  errorFallbackHint: '重试还是不行？可以去排行榜看看，或切到原版页面。',

  playCount: '播放',
  danmakuCount: '弹幕',

  region: {
    all: '全部',
    anime: '番剧',
    guochuang: '国创',
    documentary: '纪录片',
    movie: '电影',
    tv: '电视剧',
    variety: '综艺',
    animation: '动画',
    game: '游戏',
    kichiku: '鬼畜',
    music: '音乐',
    dance: '舞蹈',
    cinephile: '影视',
    entertainment: '娱乐',
    knowledge: '知识',
    tech: '科技数码',
    food: '美食',
    car: '汽车',
    fashion: '时尚美妆',
    sports: '体育运动',
    animal: '动物',
  },
}

const CMN_TW: PopularMessages = {
  navAria: '熱門與排行榜導覽',
  tabPopular: '綜合熱門',
  tabWeekly: '每週必看',
  tabPrecious: '入站必刷',
  tabRank: '排行榜',

  popularTitle: '熱門',
  popularSubtitle: '各個領域中新奇好玩的優質內容都在這裡',
  popularRules: '熱門規則',
  popularRulesBody: '綜合熱門依播放、互動、新鮮度等數據綜合排序，會隨瀏覽與互動即時更新；同一天內多次重新整理結果可能略有差異。',

  weeklyTitle: '每週必看',
  weeklySubtitle: '每週挑選站內值得一看的內容',
  weeklyIssue: '第 {number} 期',
  weeklyIssueSelect: '選擇期號',
  weeklyPrev: '上一期',
  weeklyNext: '下一期',

  preciousTitle: '入站必刷',
  preciousSubtitle: '我不允許還有人沒看過這些寶藏影片',
  preciousCount: '共 {count} 個寶藏影片',

  rankTitle: '排行榜',
  rankSubtitle: '全站與各分區影片排行，每小時更新',
  rankRegionAria: '排行榜分區',
  rankNo: '第 {rank} 名',

  loading: '載入中…',
  loadMore: '載入更多',
  retry: '重試',
  errorTitle: '內容載入失敗',
  errorNative: '在原版頁面開啟',
  emptyTitle: '暫無內容',
  emptyDescription: '這個分類暫時沒有可展示的內容，稍後再看看吧。',
  emptyRank: '去看看排行榜',
  errorFallbackHint: '重試還是不行？可以去排行榜看看，或切到原版頁面。',

  playCount: '播放',
  danmakuCount: '彈幕',

  region: {
    all: '全部',
    anime: '番劇',
    guochuang: '國創',
    documentary: '紀錄片',
    movie: '電影',
    tv: '電視劇',
    variety: '綜藝',
    animation: '動畫',
    game: '遊戲',
    kichiku: '鬼畜',
    music: '音樂',
    dance: '舞蹈',
    cinephile: '影視',
    entertainment: '娛樂',
    knowledge: '知識',
    tech: '科技數碼',
    food: '美食',
    car: '汽車',
    fashion: '時尚美妝',
    sports: '體育運動',
    animal: '動物',
  },
}

const JYUT: PopularMessages = {
  ...CMN_TW,
  navAria: '熱門同排行榜導覽',
  tabPopular: '綜合熱門',
  tabWeekly: '每週必睇',
  tabPrecious: '入站必刷',
  popularSubtitle: '各個領域中新奇好玩嘅優質內容都喺呢度',
  popularRulesBody: '綜合熱門按播放、互動、新鮮度等數據綜合排序，會隨瀏覽同互動即時更新；同一日內多次重新整理結果可能略有差異。',
  weeklyTitle: '每週必睇',
  weeklySubtitle: '每星期揀選站內值得一睇嘅內容',
  weeklyIssueSelect: '揀期號',
  weeklyPrev: '上一期',
  weeklyNext: '下一期',
  preciousSubtitle: '我唔允許仲有人未睇過呢啲寶藏影片',
  preciousCount: '共 {count} 個寶藏影片',
  rankSubtitle: '全站同各分區影片排行，每個鐘更新',
  loading: '載入緊…',
  loadMore: '載入更多',
  retry: '再試一次',
  errorTitle: '內容載入失敗',
  errorNative: '喺原版頁面開啟',
  emptyTitle: '暫時冇內容',
  emptyDescription: '呢個分類暫時冇嘢可以睇，遲啲再嚟睇下。',
  emptyRank: '去睇下排行榜',
  errorFallbackHint: '再試都唔得？可以去排行榜睇下，或者切去原版頁面。',
}

const EN: PopularMessages = {
  navAria: 'Popular and ranking navigation',
  tabPopular: 'Trending',
  tabWeekly: 'Weekly picks',
  tabPrecious: 'Must-watch',
  tabRank: 'Ranking',

  popularTitle: 'Trending',
  popularSubtitle: 'Fresh and fun videos from every corner of Bilibili',
  popularRules: 'How trending works',
  popularRulesBody: 'Trending combines views, interactions and freshness, and updates as you browse. Refreshing the page on the same day may show slightly different results.',

  weeklyTitle: 'Weekly picks',
  weeklySubtitle: 'A hand-picked selection of the week',
  weeklyIssue: 'Issue {number}',
  weeklyIssueSelect: 'Choose an issue',
  weeklyPrev: 'Previous issue',
  weeklyNext: 'Next issue',

  preciousTitle: 'Must-watch',
  preciousSubtitle: 'Classic videos no one should miss',
  preciousCount: '{count} must-watch videos',

  rankTitle: 'Ranking',
  rankSubtitle: 'Site-wide and per-region rankings, updated hourly',
  rankRegionAria: 'Ranking regions',
  rankNo: 'Rank {rank}',

  loading: 'Loading…',
  loadMore: 'Load more',
  retry: 'Retry',
  errorTitle: 'Failed to load',
  errorNative: 'Open the original page',
  emptyTitle: 'Nothing here yet',
  emptyDescription: 'This section has no content right now — check back later.',
  emptyRank: 'Browse the ranking',
  errorFallbackHint: 'Still failing? Try the ranking, or open the original page.',

  playCount: 'Views',
  danmakuCount: 'Danmaku',

  region: {
    all: 'All',
    anime: 'Bangumi',
    guochuang: 'Chinese animation',
    documentary: 'Documentary',
    movie: 'Movies',
    tv: 'TV series',
    variety: 'Variety',
    animation: 'Animation',
    game: 'Games',
    kichiku: 'Kichiku',
    music: 'Music',
    dance: 'Dance',
    cinephile: 'Film & TV',
    entertainment: 'Entertainment',
    knowledge: 'Knowledge',
    tech: 'Tech',
    food: 'Food',
    car: 'Cars',
    fashion: 'Fashion',
    sports: 'Sports',
    animal: 'Animals',
  },
}

export const MESSAGES: Record<ModuleLocale, PopularMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  'jyut': JYUT,
  'en': EN,
}

/** 取当前语言的文案（四种语言都有词典，getModuleMessages 只做兜底） */
export function getPopularMessages(language?: string): PopularMessages {
  const locale = resolveModuleLocale(language ?? settings.value.language)
  return getModuleMessages(MESSAGES, locale, CMN_CN)
}

/** 响应 settings.language 的文案 */
export function usePopularI18n() {
  const t = computed(() => getPopularMessages(settings.value.language))
  const locale = computed(() => resolveModuleLocale(settings.value.language))
  return { t, locale }
}

/** 形如「第 12 期」/「第 12 名」的模板 */
export function formatTemplate(template: string, values: Record<string, number | string>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  )
}
