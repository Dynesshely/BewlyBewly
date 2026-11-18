<script setup lang="ts">
/**
 * 消息中心（自绘）的页面壳：左侧会话列表 + 右侧聊天区，顶部五个 tab。
 *
 * 由 mount.ts 以「自挂载覆盖层」的方式挂在原生消息中心之上（原生 DOM 已被它隐藏），
 * 所以这里**完全不读原生 DOM**，一切数据都来自接口（见 fetcher.ts）。
 *
 * # tab 与地址栏
 *
 * 原生消息中心是 hash 路由（`#/whisper` / `#/reply` / `#/at` / `#/love` / `#/system`）。
 * 切 tab 时用 `history.pushState` 把 hash 写回去（刷新 / 前进后退都能回到同一个 tab），
 * B 站的 inject 包装会在 pushState 后派发 `historyChange`，mount.ts 监听到后调用
 * `syncRoute` 把 tab 推回来 —— 状态已经一致时 `syncRoute` 直接短路，不会自己触发自己。
 *
 * # 分页
 *
 *   会话列表 / 聊天记录 / 互动列表 / 系统通知：都是「滚动到底加载更多」；
 *   每组各有一套 `hasMore` + 游标 + 独立的加载态（互不干扰）。
 *
 * # 失败回退
 *
 * 接口失败**只影响本页内容**（错误态 + 重试 + 「在原版页面打开」链接）。
 * 真正「完全不接管」的判断在 mount.ts 的预取闸门里：预取失败就连覆盖层都不挂，
 * 原生页面一个字节都不改。
 */
import type { MessageTabId } from './constants'
import type { SelfInfo } from './fetcher'
import type { ChatMessage, ChatSession, FeedEntry, MessagePageBridge, SystemNotice } from './types'
import { computed, inject, onMounted, ref } from 'vue'
import { useBewlyApp } from '~/composables/useAppProvider'
import { useListPageActions } from '~/composables/useListPageActions'
import ChatView from './components/ChatView.vue'
import FeedList from './components/FeedList.vue'
import MessageTabs from './components/MessageTabs.vue'
import SessionList from './components/SessionList.vue'
import SystemList from './components/SystemList.vue'
import { MESSAGE_DRAWN_ROOT_ID, MESSAGE_PAGE_BRIDGE_KEY } from './constants'
import {
  fetchAts,
  fetchChatMessages,
  fetchLikes,
  fetchReplies,
  fetchSessions,
  fetchSystemNotices,
  fetchUserCards,
} from './fetcher'
import { absoluteImage, buildMessageHash, buildNativeMessageUrl } from './utils'

const props = defineProps<{
  initialTab: MessageTabId
  /** mount.ts 预取的当前登录用户 */
  selfInfo: SelfInfo
  /** mount.ts 预取的会话首屏（whisper tab） */
  initialSessions: ChatSession[]
  initialSessionsHasMore: boolean
  /** 预取时拿到的会话列表翻页游标（最后一页的 session_ts，微秒） */
  initialSessionsCursor: number | null
  /** 预取时选中的会话（原生页当前打开的会话 mid；不可用时为 null） */
  initialSelectedMid: string
  /** 预取的该会话首屏消息 */
  initialMessages: ChatMessage[]
  initialMessagesHasMore: boolean
  initialMessagesCursor: number | null
  /** 挂载瞬间当前 tab 是 reply / at / love 时的第一页（否则 null） */
  initialFeed: { entries: FeedEntry[], hasMore: boolean, cursor: { id?: number, time?: number } | null } | null
  /** 挂载瞬间当前 tab 是 system 时的第一页（否则 null） */
  initialNotices: { entries: SystemNotice[], hasMore: boolean, cursor: number | null } | null
}>()

const { handleBackToTop } = useBewlyApp()

// ============================ tab ============================

const tab = ref<MessageTabId>(props.initialTab)

// ============================ 会话列表 ============================

const sessions = ref<ChatSession[]>([...props.initialSessions])
const sessionsHasMore = ref<boolean>(props.initialSessionsHasMore)
const sessionsCursor = ref<number | null>(props.initialSessionsCursor)
const sessionsLoading = ref<boolean>(false)
const sessionsLoadingMore = ref<boolean>(false)
const sessionsError = ref<string>('')
/** 请求序号（同上） */
let sessionsSeq = 0
const sessionKeyword = ref<string>('')
/** 当前选中的会话 mid（空串 = 没有选中） */
const selectedMid = ref<string>(props.initialSelectedMid)

/** 未读角标：会话未读总数（其它 tab 的未读数来自 msgfeed/unread，本轮未接） */
const sessionUnread = computed(() =>
  sessions.value.reduce((sum, session) => sum + session.unread, 0),
)

const tabBadges = computed<Partial<Record<MessageTabId, number>>>(() => ({
  whisper: sessionUnread.value || undefined,
}))

/** 补昵称 / 头像用：已经查过的 mid 不再重复请求 */
const fetchedCards = new Set<string>()

/** 搜索过滤（本地过滤：会话列表本身是全量分页拉的，够用） */
const visibleSessions = computed<ChatSession[]>(() => {
  const keyword = sessionKeyword.value.trim().toLowerCase()
  if (!keyword)
    return sessions.value
  return sessions.value.filter(session =>
    session.name.toLowerCase().includes(keyword)
    || session.summary.toLowerCase().includes(keyword),
  )
})

/** 拉一页会话（first=首屏 / 换 tab 时的整表刷新） */
async function loadSessions(first = false) {
  if (first) {
    sessionsLoading.value = true
    sessionsError.value = ''
  }
  else {
    if (sessionsLoading.value || sessionsLoadingMore.value || !sessionsHasMore.value || sessionsCursor.value === null)
      return
    sessionsLoadingMore.value = true
  }

  const seq = ++sessionsSeq
  try {
    const result = await fetchSessions(first
      ? undefined
      : sessionsCursor.value ?? undefined)
    // 普通用户会话没有 account_info，先用 user/cards 补昵称 / 头像再入列表
    const incoming = await fillSessionNames(result.sessions)
    if (seq !== sessionsSeq)
      return
    sessions.value = first
      ? incoming
      : [
          ...sessions.value,
          ...incoming.filter(next => !sessions.value.some(current => current.mid === next.mid)),
        ]
    sessionsHasMore.value = result.hasMore
    sessionsCursor.value = result.minTs
    sessionsError.value = ''

    // 首屏自动选中第一个会话（与原生一致：打开消息中心默认落在最近一个会话）
    if (first && !selectedMid.value && sessions.value.length)
      void selectSession(sessions.value[0].mid)
  }
  catch (error) {
    if (seq === sessionsSeq && first)
      sessionsError.value = toMessage(error)
  }
  finally {
    if (seq === sessionsSeq) {
      sessionsLoading.value = false
      sessionsLoadingMore.value = false
    }
  }
}

/**
 * 补昵称 / 头像。
 *
 * `get_sessions` 对普通用户不返回 `account_info`（真机 20 条里只有 3 个系统号带），
 * 所以这里用 `user/cards` 批量补。失败不影响列表（退化成「用户 <mid>」）。
 */
async function fillSessionNames(list: ChatSession[]): Promise<ChatSession[]> {
  const missing = list
    .filter(session => !session.name || session.name.startsWith('用户 ') || !session.avatar)
    .map(session => session.mid)
    .filter(mid => !fetchedCards.has(mid))
  if (!missing.length)
    return list

  missing.forEach(mid => fetchedCards.add(mid))
  const cards = await fetchUserCards(missing)
  if (!cards.size)
    return list

  return list.map((session) => {
    const card = cards.get(session.mid)
    if (!card)
      return session
    return {
      ...session,
      name: card.name || session.name,
      avatar: absoluteImage(card.face) || session.avatar,
    }
  })
}

// ============================ 聊天 ============================

const messages = ref<ChatMessage[]>([...props.initialMessages])
const messagesHasMore = ref<boolean>(props.initialMessagesHasMore)
const messagesCursor = ref<number | null>(props.initialMessagesCursor)
const chatLoading = ref<boolean>(false)
const chatLoadingEarlier = ref<boolean>(false)
const chatError = ref<string>('')
/** 聊天区滚动位置：加载更早的消息后要保持视口不动 */

const selectedSession = computed<ChatSession | null>(() =>
  sessions.value.find(session => session.mid === selectedMid.value) ?? null,
)

/** 拉某会话的首屏消息（整表替换） */
async function loadMessages(mid: string) {
  chatLoading.value = true
  chatError.value = ''
  messages.value = []
  messagesHasMore.value = false
  messagesCursor.value = null
  try {
    const result = await fetchChatMessages(mid)
    // 期间可能已经切到别的会话，丢弃这次结果
    if (mid !== selectedMid.value)
      return
    messages.value = result.messages
    messagesHasMore.value = result.hasMore
    messagesCursor.value = result.minSeqno
  }
  catch (error) {
    if (mid === selectedMid.value)
      chatError.value = toMessage(error)
  }
  finally {
    chatLoading.value = false
  }
}

/** 聊天区滚动容器（加载更早的消息时要保持视口，必须量它的高度） */
function chatScroller(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`#${MESSAGE_DRAWN_ROOT_ID} .msg-chat__scroll`)
}

/** 加载更早的消息（往列表头部插） */
async function loadEarlierMessages() {
  const mid = selectedMid.value
  if (!mid || chatLoadingEarlier.value || !messagesHasMore.value || messagesCursor.value === null)
    return
  chatLoadingEarlier.value = true
  chatError.value = ''
  const scroller = chatScroller()
  const previousHeight = scroller?.scrollHeight ?? 0
  const previousTop = scroller?.scrollTop ?? 0
  try {
    const result = await fetchChatMessages(mid, messagesCursor.value)
    if (mid !== selectedMid.value)
      return
    const known = new Set(messages.value.map(message => message.key))
    messages.value = [
      ...result.messages.filter(message => !known.has(message.key)),
      ...messages.value,
    ]
    messagesHasMore.value = result.hasMore
    messagesCursor.value = result.minSeqno

    // 保持视口：新内容插在上方，把滚动位置往下补同样的高度
    requestAnimationFrame(() => {
      const el = chatScroller()
      if (!el)
        return
      el.scrollTop = previousTop + (el.scrollHeight - previousHeight)
    })
  }
  catch (error) {
    if (mid === selectedMid.value)
      chatError.value = toMessage(error)
  }
  finally {
    chatLoadingEarlier.value = false
  }
}

/**
 * 选中会话并拉它的首屏消息。
 *
 * 自动选中第一个会话时也会拉（原生行为：打开消息中心默认展示最近一个会话），
 * 所以这里没有「只选不拉」的分支。
 */
async function selectSession(mid: string) {
  if (!mid)
    return
  if (mid === selectedMid.value && messages.value.length)
    return
  selectedMid.value = mid
  await loadMessages(mid)
}

// ============================ 互动列表（回复 / @ / 赞） ============================

const feedEntries = ref<FeedEntry[]>(props.initialFeed?.entries ?? [])
const feedHasMore = ref<boolean>(props.initialFeed?.hasMore ?? false)
const feedCursor = ref<{ id?: number, time?: number } | null>(props.initialFeed?.cursor ?? null)
const feedLoading = ref<boolean>(false)
const feedLoadingMore = ref<boolean>(false)
const feedError = ref<string>('')
const feedLoadMoreError = ref<string>('')
/** 请求序号：切 tab / 重新加载时递增，用来丢弃过期响应 */
let feedSeq = 0

type FeedTab = 'reply' | 'at' | 'love'

/** 是否属于「互动列表」三个 tab（回复 / @ / 赞） */
function isFeedTab(value: MessageTabId): value is FeedTab {
  return value === 'reply' || value === 'at' || value === 'love'
}

/** 清空互动列表状态（换 tab 时用；不会触发请求） */
function resetFeedState() {
  feedEntries.value = []
  feedHasMore.value = false
  feedCursor.value = null
  feedError.value = ''
  feedLoadMoreError.value = ''
}

/** 当前 tab 对应的请求函数 */
function feedFetcher(kind: FeedTab) {
  switch (kind) {
    case 'reply': return fetchReplies
    case 'at': return fetchAts
    case 'love': return fetchLikes
  }
}

async function loadFeed(kind: FeedTab, first = true) {
  if (first) {
    // 首屏整表刷新：即使上一份还在请求中也照样发新的，
    // 旧的响应靠下面的序号比对丢弃（否则「切 tab 会被前一个 tab 的 in-flight 卡住」）
    feedLoading.value = true
    feedError.value = ''
    feedLoadMoreError.value = ''
    feedEntries.value = []
    feedHasMore.value = false
    feedCursor.value = null
  }
  else {
    if (feedLoading.value || feedLoadingMore.value || !feedHasMore.value)
      return
    feedLoadingMore.value = true
    feedLoadMoreError.value = ''
  }

  const seq = ++feedSeq
  try {
    const result = await feedFetcher(kind)(first
      ? undefined
      : feedCursor.value ?? undefined)
    // 期间切了 tab / 又发了一次：丢弃这次结果
    if (tab.value !== kind || seq !== feedSeq)
      return
    feedEntries.value = first
      ? result.entries
      : [
          ...feedEntries.value,
          ...result.entries.filter(next => !feedEntries.value.some(current => current.key === next.key)),
        ]
    feedHasMore.value = result.hasMore
    feedCursor.value = result.cursor
  }
  catch (error) {
    if (tab.value !== kind || seq !== feedSeq)
      return
    if (first)
      feedError.value = toMessage(error)
    else
      feedLoadMoreError.value = toMessage(error)
  }
  finally {
    if (seq === feedSeq) {
      feedLoading.value = false
      feedLoadingMore.value = false
    }
  }
}

// ============================ 系统通知 ============================

const notices = ref<SystemNotice[]>(props.initialNotices?.entries ?? [])
const noticesHasMore = ref<boolean>(props.initialNotices?.hasMore ?? false)
const noticesCursor = ref<number | null>(props.initialNotices?.cursor ?? null)
const noticesLoading = ref<boolean>(false)
const noticesLoadingMore = ref<boolean>(false)
const noticesError = ref<string>('')
const noticesLoadMoreError = ref<string>('')
/** 请求序号（同上） */
let noticesSeq = 0

async function loadNotices(first = true) {
  if (first) {
    noticesLoading.value = true
    noticesError.value = ''
    noticesLoadMoreError.value = ''
    notices.value = []
    noticesHasMore.value = false
    noticesCursor.value = null
  }
  else {
    if (noticesLoading.value || noticesLoadingMore.value || !noticesHasMore.value || noticesCursor.value === null)
      return
    noticesLoadingMore.value = true
    noticesLoadMoreError.value = ''
  }

  const seq = ++noticesSeq
  try {
    const result = await fetchSystemNotices(first
      ? undefined
      : noticesCursor.value ?? undefined)
    if (tab.value !== 'system' || seq !== noticesSeq)
      return
    notices.value = first
      ? result.entries
      : [
          ...notices.value,
          ...result.entries.filter(next => !notices.value.some(current => current.key === next.key)),
        ]
    noticesHasMore.value = result.hasMore
    noticesCursor.value = result.cursor
  }
  catch (error) {
    if (tab.value !== 'system' || seq !== noticesSeq)
      return
    if (first)
      noticesError.value = toMessage(error)
    else
      noticesLoadMoreError.value = toMessage(error)
  }
  finally {
    if (seq === noticesSeq) {
      noticesLoading.value = false
      noticesLoadingMore.value = false
    }
  }
}

// ============================ tab 切换 ============================

/** 每个 tab 第一次进入时才拉数据（切回来不重复请求；预取过的那一页算已加载） */
const loadedTabs = new Set<MessageTabId>(['whisper'])
if (props.initialFeed && props.initialTab !== 'whisper')
  loadedTabs.add(props.initialTab)
if (props.initialNotices)
  loadedTabs.add('system')

function ensureTabData(next: MessageTabId) {
  if (next === 'whisper') {
    if (!sessions.value.length)
      void loadSessions(true)
    return
  }
  if (next === 'system') {
    if (!loadedTabs.has('system'))
      void loadNotices(true)
    return
  }
  if (!loadedTabs.has(next))
    void loadFeed(next, true)
}

/**
 * 切 tab：改状态 + 拉数据 + 写 hash。
 *
 * 注意顺序：必须**先**让 ensureTabData 判断「这个 tab 加载过没有」，再把它记进
 * loadedTabs —— 反过来的话首次切过去会被当成「已加载」，永远不发请求。
 */
function changeTab(next: MessageTabId) {
  if (next === tab.value)
    return
  tab.value = next
  // 换到另一个互动 tab 时先清空上一份列表，避免旧条目闪一下
  if (isFeedTab(next))
    resetFeedState()
  ensureTabData(next)
  loadedTabs.add(next)
  writeHash(next)
  handleBackToTop()
}

/** 把 tab 写回地址栏（hash 路由，与原生页同一套） */
function writeHash(next: MessageTabId) {
  const hash = buildMessageHash(next)
  if (location.hash === hash)
    return
  try {
    history.pushState(history.state, '', `${location.pathname}${location.search}${hash}`)
  }
  catch {
    // 地址栏不是必须的：写不进去只影响刷新后的落点，页面照常用
  }
}

/** 外部路由变化（前进后退）时由 mount.ts 调用 */
function syncRoute(next: MessageTabId) {
  if (next === tab.value)
    return
  tab.value = next
  if (isFeedTab(next))
    resetFeedState()
  ensureTabData(next)
  loadedTabs.add(next)
}

// ============================ 刷新 / 滚动动作 ============================

/** 覆盖层的「刷新」动作：重拉当前 tab */
function reload() {
  switch (tab.value) {
    case 'whisper':
      void loadSessions(true)
      if (selectedMid.value)
        void loadMessages(selectedMid.value)
      return
    case 'system':
      void loadNotices(true)
      return
    default:
      void loadFeed(tab.value as FeedTab, true)
  }
}

/** 触底：让当前 tab 加载更多 */
function loadMoreCurrent() {
  switch (tab.value) {
    case 'whisper':
      void loadSessions(false)
      return
    case 'system':
      void loadNotices(false)
      return
    default:
      void loadFeed(tab.value as FeedTab, false)
  }
}

useListPageActions({
  isLoading: computed(() => sessionsLoading.value || feedLoading.value || noticesLoading.value || chatLoading.value),
  reachBottom: () => loadMoreCurrent(),
  refresh: () => reload(),
})

/** 当前 tab 的错误信息文案（错误态展示） */
function toMessage(error: unknown): string {
  if (error instanceof Error && error.message)
    return error.message
  return String(error)
}

/** 原生页地址（错误态里的回退入口） */
const nativeUrl = computed(() => buildNativeMessageUrl(tab.value))

/** 会话列表的「首次加载失败」只影响列表本身 */
const sessionListError = computed(() => sessionsError.value)

onMounted(() => {
  // 预取已经给了当前 tab 的首屏（whisper 是会话 + 聊天，互动 / 系统是各自的第一页），
  // 这里只需要把地址栏对齐；没有预取数据的 tab 在切过去时按需拉。
  if (tab.value !== 'whisper' && !loadedTabs.has(tab.value))
    ensureTabData(tab.value)
  // 地址栏与当前 tab 对齐（用户可能直接带 hash 打开）
  writeHash(tab.value)
})

const bridge = inject<MessagePageBridge | null>(MESSAGE_PAGE_BRIDGE_KEY, null)
if (bridge) {
  bridge.syncRoute = syncRoute
  bridge.reload = reload
}

defineExpose({ syncRoute, reload })
</script>

<template>
  <div class="msg-drawn-page" :data-bewly-message-drawn-tab="tab">
    <header class="msg-drawn-head">
      <MessageTabs :active="tab" :badges="tabBadges" @change="changeTab" />
    </header>

    <div
      class="msg-drawn-body"
      :class="{
        'is-whisper': tab === 'whisper',
        'has-selection': tab === 'whisper' && Boolean(selectedMid),
      }"
    >
      <template v-if="tab === 'whisper'">
        <SessionList
          :sessions="visibleSessions"
          :active-mid="selectedMid"
          :is-loading="sessionsLoading"
          :has-more="sessionsHasMore"
          :keyword="sessionKeyword"
          :error-message="sessionListError"
          @select="selectSession"
          @search="sessionKeyword = $event"
          @load-more="loadSessions(false)"
          @retry="loadSessions(true)"
        />

        <ChatView
          :session="selectedSession"
          :messages="messages"
          :self-avatar="selfInfo.face"
          :self-name="selfInfo.name"
          :is-loading="chatLoading"
          :is-loading-earlier="chatLoadingEarlier"
          :has-more="messagesHasMore"
          :error-message="chatError"
          @load-earlier="loadEarlierMessages"
          @retry="selectedMid && loadMessages(selectedMid)"
          @back="selectedMid = ''"
        />
      </template>

      <FeedList
        v-else-if="tab === 'reply' || tab === 'at' || tab === 'love'"
        :entries="feedEntries"
        :kind="tab"
        :is-loading="feedLoading"
        :is-loading-more="feedLoadingMore"
        :has-more="feedHasMore"
        :error-message="feedError"
        :load-more-error="feedLoadMoreError"
        :native-url="nativeUrl"
        @load-more="loadFeed(tab as FeedTab, false)"
        @retry="loadFeed(tab as FeedTab, true)"
      />

      <SystemList
        v-else
        :entries="notices"
        :is-loading="noticesLoading"
        :is-loading-more="noticesLoadingMore"
        :has-more="noticesHasMore"
        :error-message="noticesError"
        :load-more-error="noticesLoadMoreError"
        :native-url="nativeUrl"
        @load-more="loadNotices(false)"
        @retry="loadNotices(true)"
      />
    </div>
  </div>
</template>
