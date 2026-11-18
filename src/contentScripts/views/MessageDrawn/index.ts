/**
 * 消息中心（自绘）的对外入口。
 *
 * **自挂载覆盖层**：不经过 App.vue / dock 体系。Lead 在 contentScripts/index.ts 里接线：
 *
 *   void setupMessageDrawnPage()
 *
 * 语义：返回 true = 自绘页已接管（原生 DOM 已隐藏）；
 * 返回 false = **页面完全没被改动**，原生消息中心保持原样可用。
 *
 * # 与既有「混合方案」`views/Message` 的关系
 *
 * 第 93/94 轮的 `views/Message` 走的是「原生 DOM 做数据源 + 自绘覆盖 + CSS 换皮」，
 * 第 102 轮新增本模块后，两者是**互斥**的（与 空间页 → spacePage、搜索页 → searchPage 一致）：
 *
 *   void setupMessageDrawnPage().then((takenOver) => {
 *     if (!takenOver)
 *       setupMessageDrawn()    // ← 是 views/Message 的入口（旧混合方案）
 *   })
 *
 * 本模块**从不 import `views/Message`**（那边有自己的 DOM 适配、状态与轮询），
 * 两者的回退关系完全由 Lead 的接线表达：自绘接管失败 → 旧混合方案照常生效 →
 * 旧方案自己也会在结构不认识时完全不接管。
 *
 * 页面卸载 / 离开消息中心时调用 `teardownMessageDrawnPage()`（幂等，未接管是空操作）。
 */
export {
  API_ORIGIN,
  DEFAULT_MESSAGE_TAB,
  MESSAGE_DRAWN_ACTIVE_CLASS,
  MESSAGE_DRAWN_HIDDEN_ATTR,
  MESSAGE_DRAWN_ROOT_ID,
  MESSAGE_HOST,
  MESSAGE_ORIGIN,
  MESSAGE_PAGE_BRIDGE_KEY,
  MESSAGE_TABS,
  NATIVE_PAGE_SELECTOR,
  VC_ORIGIN,
} from './constants'
export type { MessageTabId } from './constants'
export {
  fetchAts,
  fetchChatMessages,
  fetchLikes,
  fetchReplies,
  fetchSelfInfo,
  fetchSessions,
  fetchSystemNotices,
  fetchUserCards,
  getSelfMid,
  MessageApiError,
  setSelfMid,
} from './fetcher'
export type { SelfInfo } from './fetcher'
export {
  isMessageDrawnPageMounted,
  setupMessageDrawnPage,
  teardownMessageDrawnPage,
  watchMessageRoute,
} from './mount'
export type {
  ChatApiMsg,
  ChatContent,
  ChatMessage,
  ChatSession,
  FeedEntry,
  FeedSource,
  FeedUser,
  MessagePageBridge,
  SessionApiItem,
  SystemNotice,
} from './types'
export {
  absoluteImage,
  buildMessageHash,
  buildNativeMessageUrl,
  buildSessionUrl,
  buildSpaceUrl,
  extractMarkupLinks,
  formatChatTime,
  formatRelativeTime,
  formatSessionTime,
  isMessageHost,
  oneLine,
  parseChatContent,
  parseContent,
  parseMessageTab,
  parseTimeAt,
  stripHtml,
  summarizeLastMsg,
  toAtEntry,
  toChatMessage,
  toChatSession,
  toLikeEntry,
  toMidString,
  toNumber,
  toReplyEntry,
  toSystemNotice,
} from './utils'
