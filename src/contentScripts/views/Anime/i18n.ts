import type { ModuleLocale } from '~/utils/moduleI18n'
/**
 * 番剧页模块内 i18n。
 *
 * 只服务 `views/Anime/**`，不触碰全局 `src/_locales`。
 * 四种模块语言：cmn-CN 简中 / cmn-TW 繁体 / jyut 繁体（粤语词）/ en 英文，
 * 语言解析统一走 `~/utils/moduleI18n`（见 docs/i18n-modules.md）。
 */
import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

export type AnimeLocale = ModuleLocale

const CMN_CN = {
  timetable_title: '一周番剧时间表',
  timetable_subtitle: '按更新日浏览当季番剧，←/→ 切换日期',
  today: '今天',
  back_to_today: '回到今天',
  n_episodes: '{n} 部',
  day_pick: '当日主推',
  today_pick: '今日主推',
  watch_now: '去看',
  see_all_today: '查看当日全部',
  more_today: '当日其他更新',
  other_days: '其余日程',
  other_days_hint: '选择日期即可切换上方主推',
  keyboard_help: '键盘操作',
  keyboard_hint: '←/→ 切日 · Home/End 首尾 · Enter 打开主推',
  keyboard_help_title: '时间表键盘操作',
  key_prev_day: '前一天',
  key_next_day: '后一天',
  key_first_day: '周一（首日）',
  key_last_day: '周日（末日）',
  key_open: '打开当日主推番剧',
  key_switch_day: '在日期条内切换日期',
  follows: '{count} 人追番',
  airs_at: '{time} 更新',
  loading: '正在加载番剧时间表…',
  load_failed: '时间表加载失败，可稍后重试',
  retry: '重试',
  empty: '本周暂无排期数据',
  empty_day: '这一天没有更新',
  weekday_1: '周一',
  weekday_2: '周二',
  weekday_3: '周三',
  weekday_4: '周四',
  weekday_5: '周五',
  weekday_6: '周六',
  weekday_7: '周日',
  open_in_new_tab: '在新标签页打开',
} as const

export type AnimeMessageKey = keyof typeof CMN_CN
type AnimeDict = Record<AnimeMessageKey, string>

const CMN_TW: AnimeDict = {
  timetable_title: '一週動畫時間表',
  timetable_subtitle: '按更新日瀏覽當季動畫，←/→ 切換日期',
  today: '今天',
  back_to_today: '回到今天',
  n_episodes: '{n} 部',
  day_pick: '當日主推',
  today_pick: '今日主推',
  watch_now: '去看',
  see_all_today: '查看當日全部',
  more_today: '當日其他更新',
  other_days: '其餘日程',
  other_days_hint: '選擇日期即可切換上方主推',
  keyboard_help: '鍵盤操作',
  keyboard_hint: '←/→ 切日 · Home/End 首尾 · Enter 打開主推',
  keyboard_help_title: '時間表鍵盤操作',
  key_prev_day: '前一天',
  key_next_day: '後一天',
  key_first_day: '週一（首日）',
  key_last_day: '週日（末日）',
  key_open: '打開當日主推動畫',
  key_switch_day: '在日期條內切換日期',
  follows: '{count} 人追番',
  airs_at: '{time} 更新',
  loading: '正在載入動畫時間表…',
  load_failed: '時間表載入失敗，可稍後重試',
  retry: '重試',
  empty: '本週暫無排期資料',
  empty_day: '這一天沒有更新',
  weekday_1: '週一',
  weekday_2: '週二',
  weekday_3: '週三',
  weekday_4: '週四',
  weekday_5: '週五',
  weekday_6: '週六',
  weekday_7: '週日',
  open_in_new_tab: '在新分頁開啟',
}

const JYUT: AnimeDict = {
  ...CMN_TW,
  timetable_subtitle: '按更新日睇當季動畫，←/→ 切換日期',
  other_days_hint: '揀日期就可以切換上面主推',
  loading: '載入緊動畫時間表…',
  load_failed: '時間表載入失敗，轉頭再試',
  empty: '今個星期暫時冇排期資料',
  empty_day: '呢日冇更新',
  open_in_new_tab: '喺新分頁開',
}

const EN: AnimeDict = {
  timetable_title: 'Weekly anime timetable',
  timetable_subtitle: 'Browse this season by airing day. Press ←/→ to switch days.',
  today: 'Today',
  back_to_today: 'Back to today',
  n_episodes: '{n} titles',
  day_pick: 'Featured',
  today_pick: 'Today\'s pick',
  watch_now: 'Watch',
  see_all_today: 'See all today',
  more_today: 'Also airing today',
  other_days: 'Other days',
  other_days_hint: 'Pick a day to feature it above',
  keyboard_help: 'Keyboard',
  keyboard_hint: '←/→ day · Home/End first/last · Enter open pick',
  keyboard_help_title: 'Timetable keyboard shortcuts',
  key_prev_day: 'Previous day',
  key_next_day: 'Next day',
  key_first_day: 'Monday (first)',
  key_last_day: 'Sunday (last)',
  key_open: 'Open the featured anime of the day',
  key_switch_day: 'Move between days in the strip',
  follows: '{count} following',
  airs_at: 'Airs at {time}',
  loading: 'Loading the timetable…',
  load_failed: 'Failed to load the timetable, please retry later',
  retry: 'Retry',
  empty: 'No scheduling data this week',
  empty_day: 'Nothing airs on this day',
  weekday_1: 'Mon',
  weekday_2: 'Tue',
  weekday_3: 'Wed',
  weekday_4: 'Thu',
  weekday_5: 'Fri',
  weekday_6: 'Sat',
  weekday_7: 'Sun',
  open_in_new_tab: 'Open in a new tab',
}

/** 四种语言键集合完全一致（缺键回退简中 / 英文，不会出现空串） */
export const MESSAGES: Record<ModuleLocale, AnimeDict> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  jyut: JYUT,
  en: EN,
}

export function resolveAnimeLocale(language?: string): AnimeLocale {
  return resolveModuleLocale(language)
}

export function useAnimeI18n() {
  const locale = computed<AnimeLocale>(() => resolveAnimeLocale(settings.value.language))

  function t(key: AnimeMessageKey, params?: Record<string, string | number>): string {
    const dict = getModuleMessages<AnimeDict>(MESSAGES, locale.value, CMN_CN)
    let text: string = dict[key] ?? CMN_CN[key] ?? key
    if (params) {
      for (const [name, value] of Object.entries(params))
        text = text.replaceAll(`{${name}}`, String(value))
    }
    return text
  }

  function weekday(dayOfWeek: number): string {
    const index = Math.min(7, Math.max(1, Math.round(dayOfWeek || 1)))
    return t(`weekday_${index}` as AnimeMessageKey)
  }

  return { t, weekday, locale }
}
