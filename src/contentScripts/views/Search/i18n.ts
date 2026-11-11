import type { ModuleLocale } from '~/utils/moduleI18n'
/**
 * 搜索起始页模块内 i18n。
 *
 * 只服务 `views/Search/**`，不触碰全局 `src/_locales`。
 * 四种模块语言：cmn-CN 简中 / cmn-TW 繁体 / jyut 繁体（粤语词）/ en 英文，
 * 语言解析统一走 `~/utils/moduleI18n`（见 docs/i18n-modules.md）。
 */
import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

export type SearchLocale = ModuleLocale

const CMN_CN = {
  recent_title: '最近搜索',
  recent_empty: '还没有最近搜索，搜一次就会留在这里',
  recent_clear: '清空记录',
  recent_more: '更多',
  recent_pin: '置顶',
  recent_unpin: '取消置顶',
  recent_delete: '删除',
  recent_pin_named: '置顶「{keyword}」',
  recent_unpin_named: '取消置顶「{keyword}」',
  recent_delete_named: '删除「{keyword}」',
  recent_pin_limit: '最多置顶 3 条最近搜索',
  recent_clear_confirm: '确认清空',
  recent_clear_hint: '再点一次清空全部记录，3 秒内有效；按 Esc 取消',
  hot_title: '热门搜索',
  hot_refresh: '换一批',
  hot_retry: '重试',
  hot_source_remote: '来自 B 站实时热搜 · 结果缓存 10 分钟',
  hot_source_fallback: '热搜加载失败或未登录，已回落到内置词表',
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
} as const

export type SearchMessageKey = keyof typeof CMN_CN
type SearchDict = Record<SearchMessageKey, string>

const CMN_TW: SearchDict = {
  recent_title: '最近搜尋',
  recent_empty: '還沒有最近搜尋，搜一次就會留在這裡',
  recent_clear: '清空記錄',
  recent_more: '更多',
  recent_pin: '置頂',
  recent_unpin: '取消置頂',
  recent_delete: '刪除',
  recent_pin_named: '置頂「{keyword}」',
  recent_unpin_named: '取消置頂「{keyword}」',
  recent_delete_named: '刪除「{keyword}」',
  recent_pin_limit: '最多置頂 3 條最近搜尋',
  recent_clear_confirm: '確認清空',
  recent_clear_hint: '再撳一次清空全部記錄，3 秒內有效；按 Esc 取消',
  hot_title: '熱門搜尋',
  hot_refresh: '換一批',
  hot_retry: '重試',
  hot_source_remote: '來自 B 站即時熱搜 · 結果快取 10 分鐘',
  hot_source_fallback: '熱搜載入失敗或未登入，已回落到內建詞表',
  direct_title: '直達',
  direct_placeholder: '貼上 BV 號 / av 號 / 動畫號 / B 站連結',
  direct_go: '開啟',
  direct_hint: '辨識到的對象會直接開啟，不會被當成搜尋詞',
  direct_invalid: '沒有辨識出有效的 BV 號或 B 站連結',
  direct_detected: '已辨識為 {label}：{id}',
  direct_paste_switch: '頁面內直接貼上時自動直達',
  direct_paste_on: '已開啟：在搜尋框裡貼上 BV 號或連結會直接開啟',
  direct_paste_off: '已關閉：貼上的內容會按一般搜尋詞處理',
  direct_navigate: '已辨識 {label}，正在開啟',
  keyboard_hint: '按 / 聚焦搜尋框 · Enter 搜尋 · 支援直接貼上 BV 號或連結',
  start_page_title: '搜尋起始頁',
  label_bv: 'BV 號',
  label_av: 'av 號',
  label_bangumi: '動畫',
  label_space: '使用者首頁',
  label_live: '直播間',
  label_dynamic: '動態',
  label_article: '專欄',
  label_video: '影片',
  label_link: 'B 站連結',
  open_new_tab: '在新分頁開啟',
}

const JYUT: SearchDict = {
  ...CMN_TW,
  recent_empty: '仲未有最近搜尋，搜一次就會喺呢度',
  hot_source_remote: '來自 B 站即時熱搜 · 結果快取 10 分鐘',
  hot_source_fallback: '熱搜載入唔到或者未登入，轉用內建詞表',
  direct_placeholder: '貼上 BV 號 / av 號 / 動畫號 / B 站連結',
  direct_hint: '認到嘅嘢會直接開，唔會當成搜尋詞',
  direct_invalid: '認唔到有效嘅 BV 號或者 B 站連結',
  direct_paste_switch: '喺呢頁貼上就自動直達',
  direct_paste_on: '開咗：喺搜尋框貼 BV 號或者連結會直接開',
  direct_paste_off: '閂咗：貼上嘅嘢會當普通搜尋詞',
  direct_navigate: '認到 {label}，開緊',
  keyboard_hint: '撳 / 聚焦搜尋框 · Enter 搜尋 · 支援直接貼 BV 號或者連結',
  label_space: '用戶主頁',
  label_video: '影片',
  open_new_tab: '喺新分頁開',
}

const EN: SearchDict = {
  recent_title: 'Recent searches',
  recent_empty: 'No recent searches yet — they show up here after your first search',
  recent_clear: 'Clear',
  recent_more: 'More',
  recent_pin: 'Pin',
  recent_unpin: 'Unpin',
  recent_delete: 'Delete',
  recent_pin_named: 'Pin "{keyword}"',
  recent_unpin_named: 'Unpin "{keyword}"',
  recent_delete_named: 'Delete "{keyword}"',
  recent_pin_limit: 'Up to 3 recent searches can be pinned',
  recent_clear_confirm: 'Confirm clear',
  recent_clear_hint: 'Click again within 3 seconds to clear all history; press Esc to cancel',
  hot_title: 'Trending searches',
  hot_refresh: 'Shuffle',
  hot_retry: 'Retry',
  hot_source_remote: 'Live Bilibili hot searches · cached for 10 minutes',
  hot_source_fallback: 'Hot search unavailable — showing the built-in keyword list',
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
}

/** 四种语言键集合完全一致（缺键回退简中 / 英文，不会出现空串） */
export const MESSAGES: Record<ModuleLocale, SearchDict> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  jyut: JYUT,
  en: EN,
}

interface HotKeyword {
  keyword: string
}

/**
 * 内置词表：真实热搜接口失败 / 未登录时的回落词（按语言分）。
 * 英文用英文词；繁体与粤语共用繁中词表（热搜词本身是中文检索词）。
 */
const HOT_KEYWORDS: Record<ModuleLocale, HotKeyword[]> = {
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
  'cmn-TW': [
    { keyword: '新番' },
    { keyword: '國創' },
    { keyword: '動畫推薦' },
    { keyword: '動畫電影' },
    { keyword: '遊戲實況' },
    { keyword: 'AI 程式設計' },
    { keyword: '知識科普' },
    { keyword: '美食探店' },
    { keyword: '旅行 vlog' },
    { keyword: '音樂現場' },
    { keyword: '紀錄片' },
    { keyword: '數碼評測' },
  ],
  jyut: [
    { keyword: '新番' },
    { keyword: '國創' },
    { keyword: '動畫推薦' },
    { keyword: '動畫電影' },
    { keyword: '遊戲實況' },
    { keyword: 'AI 程式設計' },
    { keyword: '知識科普' },
    { keyword: '美食探店' },
    { keyword: '旅行 vlog' },
    { keyword: '音樂現場' },
    { keyword: '紀錄片' },
    { keyword: '數碼評測' },
  ],
  en: [
    { keyword: 'anime' },
    { keyword: 'donghua' },
    { keyword: 'anime review' },
    { keyword: 'animated movie' },
    { keyword: 'gameplay' },
    { keyword: 'AI coding' },
    { keyword: 'science' },
    { keyword: 'food' },
    { keyword: 'travel vlog' },
    { keyword: 'live music' },
    { keyword: 'documentary' },
    { keyword: 'tech review' },
  ],
}

export function resolveSearchLocale(language?: string): SearchLocale {
  return resolveModuleLocale(language)
}

export function useSearchI18n() {
  const locale = computed<SearchLocale>(() => resolveSearchLocale(settings.value.language))

  function t(key: SearchMessageKey, params?: Record<string, string | number>): string {
    const dict = getModuleMessages<SearchDict>(MESSAGES, locale.value, CMN_CN)
    let text: string = dict[key] ?? CMN_CN[key] ?? key
    if (params) {
      for (const [name, value] of Object.entries(params))
        text = text.replaceAll(`{${name}}`, String(value))
    }
    return text
  }

  const hotKeywords = computed<string[]>(() => (HOT_KEYWORDS[locale.value] ?? HOT_KEYWORDS['cmn-CN']).map(item => item.keyword))

  return { t, hotKeywords, locale }
}
