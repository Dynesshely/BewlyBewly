/**
 * 消息中心（自绘）的模块内文案（简中 / 繁中 / 粤语 / 英文）。
 *
 * 不进 `src/_locales`（本轮写作用域不允许改），沿用 `views/Space` / `views/Search`
 * 的模块内 i18n 方案：语言由 `resolveModuleLocale(settings.language)` 解析，
 * 四种语言的键集合必须完全一致（`MessageDrawnMessages` 的类型约束保证）。
 */
import type { MessageTabId } from './constants'
import type { ModuleLocale } from '~/utils/moduleI18n'

import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

export interface MessageDrawnMessages {
  /** tab 名称 */
  tabWhisper: string
  tabReply: string
  tabAt: string
  tabLove: string
  tabSystem: string
  /** tab 栏无障碍名称 */
  tabsAria: string
  /** 会话列表 */
  sessionsAria: string
  sessionEmptyTitle: string
  sessionEmptyDescription: string
  sessionSearchPlaceholder: string
  sessionSearchEmpty: string
  /** 会话项的无障碍名称，`{name}` 是昵称，`{count}` 是未读数 */
  sessionUnread: string
  sessionPinned: string
  sessionMuted: string
  /** 聊天区 */
  chatAria: string
  chatEmptyTitle: string
  chatEmptyDescription: string
  chatNoSessionTitle: string
  chatNoSessionDescription: string
  chatLoadEarlier: string
  chatLoadEarlierLoading: string
  chatNoMore: string
  /** 聊天区顶栏的返回按钮（窄屏） */
  chatBack: string
  /** 消息内容的占位 */
  chatImageAlt: string
  chatUnsupported: string
  chatCardTitle: string
  chatCardOpen: string
  /** 互动列表 */
  replyAction: string
  atAction: string
  likeAction: string
  /** 点赞人数文案，`{count}` 是数字 */
  likeCount: string
  likeAndOthers: string
  feedEmptyTitle: string
  feedEmptyDescription: string
  feedLoadMore: string
  feedOpen: string
  /** 系统通知 */
  systemEmptyTitle: string
  systemEmptyDescription: string
  systemDetail: string
  /** 通用状态 */
  loading: string
  retry: string
  errorTitle: string
  errorLogin: string
  errorNative: string
  loadMoreError: string
  end: string
}

const CMN_CN: MessageDrawnMessages = {
  tabWhisper: '私信',
  tabReply: '回复我的',
  tabAt: '@ 我的',
  tabLove: '收到的赞',
  tabSystem: '系统通知',
  tabsAria: '消息分类',
  sessionsAria: '会话列表',
  sessionEmptyTitle: '还没有会话',
  sessionEmptyDescription: '收到私信后，会话会出现在这里。',
  sessionSearchPlaceholder: '搜索会话',
  sessionSearchEmpty: '没有匹配的会话',
  sessionUnread: '{name}，{count} 条未读',
  sessionPinned: '已置顶',
  sessionMuted: '已免打扰',
  chatAria: '聊天记录',
  chatEmptyTitle: '还没有消息',
  chatEmptyDescription: '打个招呼吧。',
  chatNoSessionTitle: '选择一个会话',
  chatNoSessionDescription: '从左侧列表选择一个会话，查看聊天记录。',
  chatLoadEarlier: '加载更早的消息',
  chatLoadEarlierLoading: '载入中…',
  chatNoMore: '没有更早的消息了',
  chatBack: '返回会话列表',
  chatImageAlt: '图片消息',
  chatUnsupported: '[暂不支持的消息类型]',
  chatCardTitle: '通知卡片',
  chatCardOpen: '查看详情',
  replyAction: '回复了你的评论',
  atAction: '在内容中提到了你',
  likeAction: '赞了你的内容',
  likeCount: '{count} 人赞过',
  likeAndOthers: '{name} 等 {count} 人',
  feedEmptyTitle: '这里还没有内容',
  feedEmptyDescription: '有新的互动时会出现在这里。',
  feedLoadMore: '加载更多',
  feedOpen: '打开内容',
  systemEmptyTitle: '没有系统通知',
  systemEmptyDescription: '账号与站务通知会出现在这里。',
  systemDetail: '查看详情',
  loading: '载入中…',
  retry: '重试',
  errorTitle: '内容加载失败',
  errorLogin: '需要先登录 B 站账号',
  errorNative: '在原版页面打开',
  loadMoreError: '加载更多失败',
  end: '没有更多了',
}

const CMN_TW: MessageDrawnMessages = {
  tabWhisper: '私訊',
  tabReply: '回覆我的',
  tabAt: '@ 我的',
  tabLove: '收到的讚',
  tabSystem: '系統通知',
  tabsAria: '訊息分類',
  sessionsAria: '對話列表',
  sessionEmptyTitle: '還沒有對話',
  sessionEmptyDescription: '收到私訊後，對話會出現在這裡。',
  sessionSearchPlaceholder: '搜尋對話',
  sessionSearchEmpty: '沒有符合的對話',
  sessionUnread: '{name}，{count} 則未讀',
  sessionPinned: '已置頂',
  sessionMuted: '已勿擾',
  chatAria: '聊天紀錄',
  chatEmptyTitle: '還沒有訊息',
  chatEmptyDescription: '打個招呼吧。',
  chatNoSessionTitle: '選擇一個對話',
  chatNoSessionDescription: '從左側列表選一個對話，查看聊天紀錄。',
  chatLoadEarlier: '載入更早的訊息',
  chatLoadEarlierLoading: '載入中…',
  chatNoMore: '沒有更早的訊息了',
  chatBack: '返回對話列表',
  chatImageAlt: '圖片訊息',
  chatUnsupported: '[暫不支援的訊息類型]',
  chatCardTitle: '通知卡片',
  chatCardOpen: '查看詳情',
  replyAction: '回覆了你的評論',
  atAction: '在內容中提到了你',
  likeAction: '讚了你的內容',
  likeCount: '{count} 人讚過',
  likeAndOthers: '{name} 等 {count} 人',
  feedEmptyTitle: '這裡還沒有內容',
  feedEmptyDescription: '有新的互動時會出現在這裡。',
  feedLoadMore: '載入更多',
  feedOpen: '開啟內容',
  systemEmptyTitle: '沒有系統通知',
  systemEmptyDescription: '帳號與站務通知會出現在這裡。',
  systemDetail: '查看詳情',
  loading: '載入中…',
  retry: '重試',
  errorTitle: '內容載入失敗',
  errorLogin: '需要先登入 B 站帳號',
  errorNative: '在原版頁面開啟',
  loadMoreError: '載入更多失敗',
  end: '沒有更多了',
}

const JYUT: MessageDrawnMessages = {
  ...CMN_TW,
  tabWhisper: '私訊',
  sessionsAria: '對話列表',
  sessionEmptyTitle: '仲未有對話',
  sessionEmptyDescription: '收到私訊之後，對話就會喺度出現。',
  sessionSearchPlaceholder: '搵對話',
  sessionSearchEmpty: '搵唔到符合嘅對話',
  loading: '載入緊…',
  retry: '再試一次',
  errorNative: '喺原版頁面開啟',
  feedEmptyTitle: '呢度仲未有嘢',
  feedEmptyDescription: '有新互動就會喺度出現。',
  feedLoadMore: '載入多啲',
  end: '冇更多喇',
}

const EN: MessageDrawnMessages = {
  tabWhisper: 'Messages',
  tabReply: 'Replies',
  tabAt: 'Mentions',
  tabLove: 'Likes',
  tabSystem: 'Notices',
  tabsAria: 'Message categories',
  sessionsAria: 'Conversations',
  sessionEmptyTitle: 'No conversations yet',
  sessionEmptyDescription: 'New direct messages will show up here.',
  sessionSearchPlaceholder: 'Search conversations',
  sessionSearchEmpty: 'No matching conversations',
  sessionUnread: '{name}, {count} unread',
  sessionPinned: 'Pinned',
  sessionMuted: 'Muted',
  chatAria: 'Chat history',
  chatEmptyTitle: 'No messages yet',
  chatEmptyDescription: 'Say hi to start the conversation.',
  chatNoSessionTitle: 'Select a conversation',
  chatNoSessionDescription: 'Pick a conversation on the left to read its history.',
  chatLoadEarlier: 'Load earlier messages',
  chatLoadEarlierLoading: 'Loading…',
  chatNoMore: 'No earlier messages',
  chatBack: 'Back to conversations',
  chatImageAlt: 'Image message',
  chatUnsupported: '[Unsupported message type]',
  chatCardTitle: 'Notification card',
  chatCardOpen: 'View details',
  replyAction: 'replied to your comment',
  atAction: 'mentioned you',
  likeAction: 'liked your content',
  likeCount: '{count} likes',
  likeAndOthers: '{name} and {count} others',
  feedEmptyTitle: 'Nothing here yet',
  feedEmptyDescription: 'New interactions will appear here.',
  feedLoadMore: 'Load more',
  feedOpen: 'Open content',
  systemEmptyTitle: 'No system notices',
  systemEmptyDescription: 'Account and site notices will appear here.',
  systemDetail: 'View details',
  loading: 'Loading…',
  retry: 'Retry',
  errorTitle: 'Failed to load content',
  errorLogin: 'Please sign in to Bilibili first',
  errorNative: 'Open in the original page',
  loadMoreError: 'Failed to load more',
  end: 'No more content',
}

const MESSAGES: Record<ModuleLocale, MessageDrawnMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  'jyut': JYUT,
  'en': EN,
}

/** 当前界面语言下的消息中心文案（跟随设置实时变化） */
export function useMessageDrawnI18n() {
  const t = computed<MessageDrawnMessages>(() =>
    getModuleMessages(MESSAGES, resolveModuleLocale(settings.value.language)),
  )

  /** tab id → 文案 */
  const tabLabel = (tab: MessageTabId): string => {
    switch (tab) {
      case 'whisper': return t.value.tabWhisper
      case 'reply': return t.value.tabReply
      case 'at': return t.value.tabAt
      case 'love': return t.value.tabLove
      case 'system': return t.value.tabSystem
    }
  }

  return { t, tabLabel }
}
