/**
 * 搜索起始页模块内 i18n。
 *
 * 只服务 `views/Search/**`，不触碰全局 `src/_locales`。
 * 语言取自 `settings.language`，缺省回退简中（cmn-CN）。
 */
import { computed } from 'vue'
import { settings } from '~/logic'

export type SearchLocale = 'cmn-CN' | 'en'

const MESSAGES = {
  'cmn-CN': {
    recent_title: '最近搜索',
    recent_empty: '还没有最近搜索，搜一次就会留在这里',
    recent_clear: '清空记录',
    recent_more: '更多',
    hot_title: '热门推荐',
    hot_refresh: '换一批',
    direct_title: '直达',
    direct_placeholder: '粘贴 BV 号 / av 号 / 番剧号 / B 站链接',
    direct_go: '打开',
    direct_hint: '识别的对象会直接打开，不会被当成搜索词',
    direct_invalid: '没有识别出有效的 BV 号或 B 站链接',
    direct_detected: '已识别为 {label}：{id}',
    direct_paste_switch: '页面内直接粘贴时自动直达',
    direct_paste_on: '已开启：在搜索框里粘贴 BV 号或链接会直接打开',
    direct_paste_off: '已关闭：粘贴的内容会按普通搜索词处理',
    direct_navigate: '已识别 {label}，正在打开',
    keyboard_hint: '按 / 聚焦搜索框 · Enter 搜索 · 支持直接粘贴 BV 号或链接',
    start_page_title: '搜索起始页',
    label_bv: 'BV 号',
    label_av: 'av 号',
    label_bangumi: '番剧',
    label_space: '用户主页',
    label_live: '直播间',
    label_dynamic: '动态',
    label_article: '专栏',
    label_video: '视频',
    label_link: 'B 站链接',
    open_new_tab: '在新标签页打开',
    hot_hint: '词条为本轮内置的策展词，命中后走 B 站搜索',
  },
  en: {
    recent_title: 'Recent searches',
    recent_empty: 'No recent searches yet — they show up here after your first search',
    recent_clear: 'Clear',
    recent_more: 'More',
    hot_title: 'Trending picks',
    hot_refresh: 'Shuffle',
    direct_title: 'Jump directly',
    direct_placeholder: 'Paste a BV id, av id, season id or a bilibili link',
    direct_go: 'Open',
    direct_hint: 'Recognised targets open directly instead of being searched',
    direct_invalid: 'No valid BV id or bilibili link recognised',
    direct_detected: 'Recognised as {label}: {id}',
    direct_paste_switch: 'Auto-jump when pasting on this page',
    direct_paste_on: 'On: pasting a BV id or link in the search box opens it directly',
    direct_paste_off: 'Off: pasted text is treated as a normal search keyword',
    direct_navigate: 'Recognised {label}, opening…',
    keyboard_hint: 'Press / to focus the search box · Enter to search · Paste a BV id or link to jump',
    start_page_title: 'Search start page',
    label_bv: 'BV id',
    label_av: 'av id',
    label_bangumi: 'Bangumi',
    label_space: 'User space',
    label_live: 'Live room',
    label_dynamic: 'Moment',
    label_article: 'Article',
    label_video: 'Video',
    label_link: 'Bilibili link',
    open_new_tab: 'Open in a new tab',
    hot_hint: 'These are curated in-module keywords; each one runs a Bilibili search',
  },
} as const

export type SearchMessageKey = keyof typeof MESSAGES['cmn-CN']

interface HotKeyword {
  keyword: string
}

/** 热门推荐词：本轮没有接线真实热词接口，先用策展词（Lead 可换成接口数据） */
const HOT_KEYWORDS: Record<SearchLocale, HotKeyword[]> = {
  'cmn-CN': [
    { keyword: '新番' },
    { keyword: '国创' },
    { keyword: '番剧推荐' },
    { keyword: '动画电影' },
    { keyword: '游戏实况' },
    { keyword: 'AI 编程' },
    { keyword: '知识科普' },
    { keyword: '美食探店' },
    { keyword: '旅行 vlog' },
    { keyword: '音乐现场' },
    { keyword: '纪录片' },
    { keyword: '数码测评' },
  ],
  'en': [
    { keyword: 'anime' },
    { keyword: 'donghua' },
    { keyword: 'anime review' },
    { keyword: 'animated movie' },
    { keyword: 'gameplay' },
    { keyword: 'AI coding' },
    { keyword: 'science' },
    { keyword: 'street food' },
    { keyword: 'travel vlog' },
    { keyword: 'live music' },
    { keyword: 'documentary' },
    { keyword: 'tech review' },
  ],
}

export function resolveSearchLocale(language?: string): SearchLocale {
  return language === 'en'
    ? 'en'
    : 'cmn-CN'
}

export function useSearchI18n() {
  const locale = computed<SearchLocale>(() => resolveSearchLocale(settings.value.language))

  function t(key: SearchMessageKey, params?: Record<string, string | number>): string {
    const dict = MESSAGES[locale.value] ?? MESSAGES['cmn-CN']
    let text: string = dict[key] ?? MESSAGES['cmn-CN'][key] ?? key
    if (params) {
      for (const [name, value] of Object.entries(params))
        text = text.replaceAll(`{${name}}`, String(value))
    }
    return text
  }

  const hotKeywords = computed<string[]>(() => (HOT_KEYWORDS[locale.value] ?? HOT_KEYWORDS['cmn-CN']).map(item => item.keyword))

  return { t, hotKeywords, locale }
}
