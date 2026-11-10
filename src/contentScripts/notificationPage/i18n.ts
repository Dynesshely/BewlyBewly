import type { NotificationCategoryId } from './state'

import { computed } from 'vue'
import { LanguageType } from '~/enums/appEnums'

import { settings } from '~/logic'

export interface NotificationMessages {
  panel: string
  fabWithUnread: string
  close: string
  unreadLabel: string
  unreadUnknown: string
  /** 只用于「FAB 按钮 aria-label」的无数字版本 */
  unreadBadgeLabel: string
  unreadOnly: string
  unreadOnlyHint: string
  unreadFilterUnavailable: string
  noUnreadItems: string
  categories: string
  category: Record<NotificationCategoryId, string>
  categoryUnavailable: string
  categoryNotFound: string
  switchedTo: string
  markAllRead: string
  markedAllRead: string
  markAllReadUnavailable: string
  density: string
  densityComfortable: string
  densityCompact: string
  shortcuts: string
  shortcutUnread: string
  shortcutCategories: string
  shortcutDensity: string
  shortcutClose: string
  unreadOnlyOn: string
  unreadOnlyOff: string
  /** 开关按钮上的短状态文字 */
  switchOn: string
  switchOff: string
}

const CMN_CN: NotificationMessages = {
  panel: '消息页增强',
  fabWithUnread: '消息页增强，{count} 条未读',
  close: '关闭',
  unreadLabel: '未读',
  unreadUnknown: '未检测到未读计数',
  unreadBadgeLabel: '消息页增强',
  unreadOnly: '只看未读',
  unreadOnlyHint: '隐藏已读消息',
  unreadFilterUnavailable: '当前页面没有可识别的已读 / 未读标记，筛选不可用',
  noUnreadItems: '当前分类没有未读消息',
  categories: '分类跳转',
  category: {
    reply: '回复',
    at: '@我',
    love: '点赞',
    system: '系统',
  },
  categoryUnavailable: '当前页面未找到该分类',
  categoryNotFound: '未找到「{name}」入口',
  switchedTo: '已切到「{name}」',
  markAllRead: '全部已读',
  markedAllRead: '已点击原生「全部已读」',
  markAllReadUnavailable: '当前页面没有原生「全部已读」按钮',
  density: '列表密度',
  densityComfortable: '舒适',
  densityCompact: '紧凑',
  shortcuts: '快捷键',
  shortcutUnread: '切换「只看未读」',
  shortcutCategories: '跳到分类 1–4',
  shortcutDensity: '切换列表密度',
  shortcutClose: '关闭面板',
  unreadOnlyOn: '已开启只看未读',
  unreadOnlyOff: '已关闭只看未读',
  switchOn: '已开启',
  switchOff: '已关闭',
}

const EN: NotificationMessages = {
  panel: 'Notifications enhancements',
  fabWithUnread: 'Notifications enhancements, {count} unread',
  close: 'Close',
  unreadLabel: 'unread',
  unreadUnknown: 'Unread count unavailable',
  unreadBadgeLabel: 'Notifications enhancements',
  unreadOnly: 'Unread only',
  unreadOnlyHint: 'Hide messages already read',
  unreadFilterUnavailable: 'This page exposes no read / unread marker, filtering is unavailable',
  noUnreadItems: 'No unread messages in this category',
  categories: 'Jump to category',
  category: {
    reply: 'Replies',
    at: 'Mentions',
    love: 'Likes',
    system: 'System',
  },
  categoryUnavailable: 'Category not found on this page',
  categoryNotFound: 'No entry found for “{name}”',
  switchedTo: 'Switched to “{name}”',
  markAllRead: 'Mark all read',
  markedAllRead: 'Clicked the native “mark all read” button',
  markAllReadUnavailable: 'This page has no native “mark all read” button',
  density: 'List density',
  densityComfortable: 'Comfortable',
  densityCompact: 'Compact',
  shortcuts: 'Shortcuts',
  shortcutUnread: 'Toggle unread only',
  shortcutCategories: 'Jump to category 1–4',
  shortcutDensity: 'Toggle list density',
  shortcutClose: 'Close this panel',
  unreadOnlyOn: 'Unread only on',
  unreadOnlyOff: 'Unread only off',
  switchOn: 'On',
  switchOff: 'Off',
}

/** 模块自建 i18n：只覆盖简中与英文，其余语言回退简中 */
export const MESSAGES: Record<string, NotificationMessages> = {
  'cmn-CN': CMN_CN,
  'en': EN,
}

const FALLBACK_LANGUAGE = 'cmn-CN'

export function normalizeLanguage(language?: string): string {
  return language === LanguageType.English
    ? 'en'
    : FALLBACK_LANGUAGE
}

export function getMessages(language?: string): NotificationMessages {
  const key = normalizeLanguage(language ?? settings.value.language)
  return MESSAGES[key] ?? CMN_CN
}

/** 响应 settings.language 的文案（切换语言后立即生效，不需要重建 UI） */
export function useMessages() {
  return computed(() => getMessages(settings.value.language))
}

export function formatName(template: string, name: string): string {
  return template.replace('{name}', name)
}
