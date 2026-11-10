import type { NotificationCategoryId } from './state'

import type { ModuleLocale } from '~/utils/moduleI18n'
import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

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

const CMN_TW: NotificationMessages = {
  panel: '訊息頁增強',
  fabWithUnread: '訊息頁增強，{count} 條未讀',
  close: '關閉',
  unreadLabel: '未讀',
  unreadUnknown: '未偵測到未讀計數',
  unreadBadgeLabel: '訊息頁增強',
  unreadOnly: '只看未讀',
  unreadOnlyHint: '隱藏已讀訊息',
  unreadFilterUnavailable: '目前頁面沒有可辨識的已讀 / 未讀標記，篩選不可用',
  noUnreadItems: '目前分類沒有未讀訊息',
  categories: '分類跳轉',
  category: {
    reply: '回覆',
    at: '@我',
    love: '按讚',
    system: '系統',
  },
  categoryUnavailable: '目前頁面找不到該分類',
  categoryNotFound: '找不到「{name}」入口',
  switchedTo: '已切到「{name}」',
  markAllRead: '全部已讀',
  markedAllRead: '已點擊原生「全部已讀」',
  markAllReadUnavailable: '目前頁面沒有原生「全部已讀」按鈕',
  density: '清單密度',
  densityComfortable: '舒適',
  densityCompact: '緊湊',
  shortcuts: '快速鍵',
  shortcutUnread: '切換「只看未讀」',
  shortcutCategories: '跳到分類 1–4',
  shortcutDensity: '切換清單密度',
  shortcutClose: '關閉面板',
  unreadOnlyOn: '已開啟只看未讀',
  unreadOnlyOff: '已關閉只看未讀',
  switchOn: '已開啟',
  switchOff: '已關閉',
}

const JYUT: NotificationMessages = {
  ...CMN_TW,
  panel: '訊息頁增強',
  fabWithUnread: '訊息頁增強，{count} 條未讀',
  unreadUnknown: '未見到未讀計數',
  unreadOnlyHint: '收埋睇咗嘅訊息',
  unreadFilterUnavailable: '呢頁冇已讀 / 未讀標記，篩選唔到',
  noUnreadItems: '呢個分類冇未讀訊息',
  category: {
    reply: '回覆',
    at: '@我',
    love: '讚好',
    system: '系統',
  },
  categoryUnavailable: '呢頁搵唔到呢個分類',
  switchedTo: '轉咗去「{name}」',
  markedAllRead: '撳咗原生「全部已讀」',
  shortcutUnread: '切換「淨係睇未讀」',
  shortcutDensity: '切換清單密度',
  unreadOnlyOn: '開咗淨係睇未讀',
  unreadOnlyOff: '熄咗淨係睇未讀',
  switchOn: '開咗',
  switchOff: '熄咗',
}

/** 模块自建 i18n：四种语言键集合完全一致（缺键回退简中 / 英文，不会出现空串） */
export const MESSAGES: Record<ModuleLocale, NotificationMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  jyut: JYUT,
  en: EN,
}

export function normalizeLanguage(language?: string): ModuleLocale {
  return resolveModuleLocale(language)
}

export function getMessages(language?: string): NotificationMessages {
  return getModuleMessages<NotificationMessages>(MESSAGES, resolveModuleLocale(language ?? settings.value.language), CMN_CN)
}

/** 响应 settings.language 的文案（切换语言后立即生效，不需要重建 UI） */
export function useMessages() {
  return computed(() => getMessages(settings.value.language))
}

export function formatName(template: string, name: string): string {
  return template.replace('{name}', name)
}
