import { computed } from 'vue'

import { settings } from '~/logic'

export type ListLocale = 'cmn-CN' | 'en'

/**
 * 列表页模块内文案。
 * 不改动 src/_locales/**，由本模块自行维护；settings.value.language 为 en 时使用英文，
 * 其余语言（含空值）一律回落简体中文。
 */
export const MESSAGES: Record<ListLocale, Record<string, string>> = {
  'cmn-CN': {
    'view.comfortable': '舒适',
    'view.compact': '紧凑',
    'view.list': '列表',
    'view.group_label': '视图模式',
    'sort.label': '排序',
    'sort.time': '时间',
    'sort.duration': '时长',
    'sort.title': '标题',
    'sort.note': '已按「{dim}」排序，顺序只作用于当前已加载的 {count} 条内容',
    'filter.placeholder': '过滤标题 / UP 主',
    'filter.clear': '清除过滤',
    'filter.empty_title': '没有匹配的内容',
    'filter.empty_desc': '当前过滤词「{word}」没有匹配到任何条目，换个关键词试试。',
    'search.placeholder': '输入过滤词，回车搜索全部历史',
    'group.today': '今天',
    'group.yesterday': '昨天',
    'group.thisWeek': '本周',
    'group.earlier': '更早',
    'count.loaded': '已加载 {count} 条',
    'count.items': '{count} 条',
    'action.watchLater': '稍后再看',
    'action.copy': '复制链接',
    'action.remove': '移除',
    'action.unfavorite': '取消收藏',
    'action.copied': '链接已复制',
    'action.copy_failed': '复制失败，请手动复制',
    'action.watchLater_ok': '已加入稍后再看',
    'action.watchLater_failed': '加入稍后再看失败',
    'a11y.quick_actions': '快捷操作',
    'history.subtitle': '按时间倒序记录你最近看过的视频',
    'history.paused_subtitle': '观看历史记录已暂停',
    'history.empty_title': '还没有观看记录',
    'history.empty_desc': '看过的视频会自动出现在这里，方便随时接着看。',
    'watch_later.subtitle': '共 {count} 个视频，随时接着看',
    'watch_later.empty_title': '稍后再看是空的',
    'watch_later.empty_desc': '在视频页点「稍后再看」，或悬停卡片时点第一个快捷按钮，就能把视频攒到这里。',
    'favorites.subtitle': '「{name}」共 {count} 条收藏',
    'favorites.empty_title': '这个收藏夹还是空的',
    'favorites.empty_desc': '换个收藏夹看看，或者先去 B 站收藏一些视频。',
    'favorites.categories': '收藏夹分类',
    'progress.watched': '已看 {watched} / {total}',
    'progress.finished': '已看完 · {total}',
    'shortcut.button': '本页快捷键',
    'shortcut.title': '本页快捷键',
    'shortcut.cycle_view': '循环切换视图模式（舒适 → 紧凑 → 列表）',
    'shortcut.cycle_sort': '循环切换排序方式（时间 → 时长 → 标题）',
    'shortcut.focus_filter': '聚焦关键词过滤框',
    'shortcut.toggle_help': '打开 / 关闭本页快捷键说明',
    'shortcut.global_help': '显示全局快捷键帮助',
    'shortcut.close': '关闭',
    'shortcut.note': '在输入框内不会触发，字母键不区分大小写。',
  },
  'en': {
    'view.comfortable': 'Comfortable',
    'view.compact': 'Compact',
    'view.list': 'List',
    'view.group_label': 'View mode',
    'sort.label': 'Sort',
    'sort.time': 'Time',
    'sort.duration': 'Duration',
    'sort.title': 'Title',
    'sort.note': 'Sorted by {dim}; the order only applies to the {count} loaded items',
    'filter.placeholder': 'Filter by title / uploader',
    'filter.clear': 'Clear filter',
    'filter.empty_title': 'No matching items',
    'filter.empty_desc': 'Nothing matches "{word}". Try another keyword.',
    'search.placeholder': 'Type to filter, press Enter to search the whole history',
    'group.today': 'Today',
    'group.yesterday': 'Yesterday',
    'group.thisWeek': 'This week',
    'group.earlier': 'Earlier',
    'count.loaded': '{count} loaded',
    'count.items': '{count} items',
    'action.watchLater': 'Watch later',
    'action.copy': 'Copy link',
    'action.remove': 'Remove',
    'action.unfavorite': 'Remove from favorites',
    'action.copied': 'Link copied',
    'action.copy_failed': 'Copy failed, please copy it manually',
    'action.watchLater_ok': 'Added to Watch Later',
    'action.watchLater_failed': 'Failed to add to Watch Later',
    'a11y.quick_actions': 'Quick actions',
    'history.subtitle': 'Your recently watched videos, newest first',
    'history.paused_subtitle': 'Watch history recording is paused',
    'history.empty_title': 'No watch history yet',
    'history.empty_desc': 'Videos you watch will show up here so you can pick up where you left off.',
    'watch_later.subtitle': '{count} videos waiting for you',
    'watch_later.empty_title': 'Watch Later is empty',
    'watch_later.empty_desc': 'Use the Watch Later button on a video page, or the first quick action on a hovered card.',
    'favorites.subtitle': '"{name}" · {count} items',
    'favorites.empty_title': 'This folder is empty',
    'favorites.empty_desc': 'Try another folder, or favorite some videos on Bilibili first.',
    'favorites.categories': 'Favorite folders',
    'progress.watched': 'Watched {watched} / {total}',
    'progress.finished': 'Finished · {total}',
    'shortcut.button': 'Page shortcuts',
    'shortcut.title': 'Page shortcuts',
    'shortcut.cycle_view': 'Cycle view mode (comfortable -> compact -> list)',
    'shortcut.cycle_sort': 'Cycle sort mode (time -> duration -> title)',
    'shortcut.focus_filter': 'Focus the keyword filter',
    'shortcut.toggle_help': 'Open / close this shortcut help',
    'shortcut.global_help': 'Show the global shortcut help',
    'shortcut.close': 'Close',
    'shortcut.note': 'Shortcuts are ignored while typing in a field.',
  },
}

/**
 * 列表页文案工具。
 * tl(key, params) 支持 {name} 形式的占位符替换。
 */
export function useListI18n() {
  const locale = computed<ListLocale>(() => (settings.value.language === 'en'
    ? 'en'
    : 'cmn-CN'))

  function tl(key: string, params?: Record<string, string | number>): string {
    const dict = MESSAGES[locale.value] ?? MESSAGES['cmn-CN']
    let text = dict[key] ?? MESSAGES['cmn-CN'][key] ?? key
    if (params) {
      for (const [name, value] of Object.entries(params))
        text = text.replaceAll(`{${name}}`, String(value))
    }
    return text
  }

  return { locale, tl }
}
