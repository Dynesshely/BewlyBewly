import { computed } from 'vue'

import { LanguageType } from '~/enums/appEnums'
import { settings } from '~/logic'

export interface MessageDrawnMessages {
  /** 会话列表标题 */
  recent: string
  /** 分类 pill 组的无障碍标签 */
  categories: string
  /** 消息设置入口 */
  settings: string
  /** 列表为空 */
  emptySessions: string
  /** 时间格式化用 */
  yesterday: string
  /** 会话列表的加载更多提示 */
  loadingMore: string
  /** 会话项的未读无障碍文案 */
  unreadBadge: string
}

const CMN_CN: MessageDrawnMessages = {
  recent: '最近消息',
  categories: '消息分类',
  settings: '消息设置',
  emptySessions: '暂无会话',
  yesterday: '昨天',
  loadingMore: '正在加载更多…',
  unreadBadge: '{count} 条未读',
}

const EN: MessageDrawnMessages = {
  recent: 'Recent messages',
  categories: 'Message categories',
  settings: 'Message settings',
  emptySessions: 'No conversations',
  yesterday: 'Yesterday',
  loadingMore: 'Loading more…',
  unreadBadge: '{count} unread',
}

const MESSAGES: Record<string, MessageDrawnMessages> = {
  'cmn-CN': CMN_CN,
  'en': EN,
}

const FALLBACK_LANGUAGE = 'cmn-CN'

function normalizeLanguage(language?: string): string {
  return language === LanguageType.English
    ? 'en'
    : FALLBACK_LANGUAGE
}

export function getMessages(language?: string): MessageDrawnMessages {
  const key = normalizeLanguage(language ?? settings.value.language)
  return MESSAGES[key] ?? CMN_CN
}

export function useMessages() {
  return computed(() => getMessages(settings.value.language))
}

export function formatUnread(template: string, count: number): string {
  return template.replace('{count}', String(count))
}
