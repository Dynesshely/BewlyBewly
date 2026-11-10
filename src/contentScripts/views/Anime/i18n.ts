/**
 * 番剧页模块内 i18n。
 *
 * 只服务 `views/Anime/**`，不触碰全局 `src/_locales`。
 * 语言取自 `settings.language`，缺省回退简中（cmn-CN）。
 */
import { computed } from 'vue'
import { settings } from '~/logic'

export type AnimeLocale = 'cmn-CN' | 'en'

const MESSAGES = {
  'cmn-CN': {
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
  },
  en: {
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
  },
} as const

export type AnimeMessageKey = keyof typeof MESSAGES['cmn-CN']

export function resolveAnimeLocale(language?: string): AnimeLocale {
  return language === 'en'
    ? 'en'
    : 'cmn-CN'
}

export function useAnimeI18n() {
  const locale = computed<AnimeLocale>(() => resolveAnimeLocale(settings.value.language))

  function t(key: AnimeMessageKey, params?: Record<string, string | number>): string {
    const dict = MESSAGES[locale.value] ?? MESSAGES['cmn-CN']
    let text: string = dict[key] ?? MESSAGES['cmn-CN'][key] ?? key
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
