<script setup lang="ts">
/**
 * 聊天记录（自绘）。
 *
 * 数据来自 `fetch_session_msgs`（API），不读原生 DOM。
 *
 * # 气泡规则
 *
 *   自己（`sender_uid === 当前登录 mid`）→ 右对齐、主题色底、白字
 *   对方                                → 左对齐、灰底、文字色 1
 *   时间分隔                            → 与上一条相差 ≥ 5 分钟时插一条居中标签
 *
 * # 消息类型（真机验证过的 msg_type，见 utils.parseChatContent）
 *
 *   1  文本 / 2 图片 / 7 视频分享卡 / 10 系统卡片 / 13 图片卡片 / 其它 → 占位
 */
import type { ChatMessage, ChatSession } from '../types'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { CHAT_IMAGE_MAX } from '../constants'
import { useMessageDrawnI18n } from '../i18n'
import { formatChatTime } from '../utils'

const props = defineProps<{
  session: ChatSession | null
  messages: ChatMessage[]
  /** 当前登录用户头像 / 昵称（自己发的消息左侧不显示头像，只在需要时用） */
  selfAvatar: string
  selfName: string
  isLoading: boolean
  isLoadingEarlier: boolean
  hasMore: boolean
  errorMessage: string
}>()

const emit = defineEmits<{
  (e: 'loadEarlier'): void
  (e: 'retry'): void
  (e: 'back'): void
}>()

const { t } = useMessageDrawnI18n()

const scrollRef = ref<HTMLElement | null>(null)
const sentinelRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

/** 时间分隔阈值：相邻两条相差超过 5 分钟才插标签（与原生观感一致） */
const TIME_GAP = 5 * 60

interface RenderRow {
  key: string
  /** 分隔标签（居中）或消息气泡 */
  type: 'time' | 'message'
  /** type === 'time' 时的文案 */
  label?: string
  /** type === 'message' 时的消息 */
  message?: ChatMessage
}

/**
 * 把消息列表拍平成「时间分隔 + 气泡」的渲染行。
 *
 * 消息已在 fetcher 里按时间正序排好；这里只插分隔，不改顺序。
 */
const rows = computed<RenderRow[]>(() => {
  const result: RenderRow[] = []
  let previousTime = 0
  for (const message of props.messages) {
    if (!previousTime || message.time - previousTime >= TIME_GAP) {
      result.push({
        key: `time-${message.key}`,
        type: 'time',
        label: formatChatTime(message.time),
      })
    }
    previousTime = message.time
    result.push({
      key: message.key,
      type: 'message',
      message,
    })
  }
  return result
})

/** 图片按原始宽高比缩放到 CHAT_IMAGE_MAX 以内 */
function imageSize(message: ChatMessage): { width: string, height: string } {
  if (message.content.kind !== 'image')
    return { width: 'auto', height: 'auto' }
  const { width, height } = message.content
  if (!width || !height)
    return { width: `${CHAT_IMAGE_MAX}px`, height: 'auto' }
  const scale = Math.min(1, CHAT_IMAGE_MAX / Math.max(width, height))
  return {
    width: `${Math.round(width * scale)}px`,
    height: `${Math.round(height * scale)}px`,
  }
}

/** 滚到底（新消息 / 首次加载） */
async function scrollToBottom() {
  await nextTick()
  const el = scrollRef.value
  if (el)
    el.scrollTop = el.scrollHeight
}

/** 滚到顶部时的「加载更早」触发器 */
function connectObserver() {
  observer?.disconnect()
  // 极老的浏览器 / 非浏览器环境没有 IntersectionObserver：不接观察器（不报错），
  // 列表仍可正常渲染，只是不会自动加载更多（用户仍可通过覆盖层的刷新动作重拉）。
  if (typeof IntersectionObserver === 'undefined')
    return
  const target = sentinelRef.value
  const root = scrollRef.value
  if (!target || !root)
    return
  observer = new IntersectionObserver(
    (records) => {
      if (!records.some(record => record.isIntersecting))
        return
      if (props.isLoading || props.isLoadingEarlier || !props.hasMore)
        return
      emit('loadEarlier')
    },
    { root, rootMargin: '80px 0px' },
  )
  observer.observe(target)
}

onMounted(async () => {
  await scrollToBottom()
  connectObserver()
})

// 换会话或首次拿到消息时滚到底部（聊天的心智是「最新在最下面」）
watch(() => props.session?.mid, async () => {
  await scrollToBottom()
  connectObserver()
})
watch(() => props.messages.length, async (next, prev) => {
  // 只有「变多且之前为空」或「换了会话」才强制滚到底；加载更早时保持当前视口
  if (prev === 0 && next > 0)
    await scrollToBottom()
})
</script>

<template>
  <section class="msg-chat" :aria-label="t.chatAria">
    <!-- 没有选中会话 -->
    <div v-if="!session" class="msg-chat__placeholder">
      <span class="i-mingcute:message-2-line msg-chat__placeholder-icon" aria-hidden="true" />
      <p class="msg-chat__placeholder-title">
        {{ t.chatNoSessionTitle }}
      </p>
      <p class="msg-chat__placeholder-desc">
        {{ t.chatNoSessionDescription }}
      </p>
    </div>

    <template v-else>
      <header class="msg-chat__head">
        <button class="msg-chat__back" type="button" :aria-label="t.chatBack" @click="emit('back')">
          <span class="i-mingcute:left-line" aria-hidden="true" />
        </button>
        <img
          v-if="session.avatar"
          class="msg-chat__head-avatar"
          :src="session.avatar"
          :alt="session.name"
          referrerpolicy="no-referrer"
        >
        <span class="msg-chat__head-name">{{ session.name }}</span>
        <span v-if="session.muted" class="msg-chat__head-flag">{{ t.sessionMuted }}</span>
      </header>

      <div ref="scrollRef" class="msg-chat__scroll">
        <div ref="sentinelRef" class="msg-chat__sentinel" aria-hidden="true" />

        <p v-if="isLoadingEarlier" class="msg-chat__hint">
          {{ t.chatLoadEarlierLoading }}
        </p>
        <button
          v-else-if="hasMore && messages.length"
          class="msg-chat__load-earlier"
          type="button"
          @click="emit('loadEarlier')"
        >
          {{ t.chatLoadEarlier }}
        </button>
        <p v-else-if="messages.length" class="msg-chat__hint">
          {{ t.chatNoMore }}
        </p>

        <ol v-if="rows.length" class="msg-chat__list">
          <li v-for="row in rows" :key="row.key" class="msg-chat__row" :class="`is-${row.type}`">
            <p v-if="row.type === 'time'" class="msg-chat__time">
              {{ row.label }}
            </p>

            <div
              v-else-if="row.message"
              class="msg-chat__bubble-wrap"
              :class="{ 'is-mine': row.message.mine }"
            >
              <img
                v-if="!row.message.mine && session.avatar"
                class="msg-chat__bubble-avatar"
                :src="session.avatar"
                :alt="session.name"
                referrerpolicy="no-referrer"
              >
              <span v-else-if="!row.message.mine" class="msg-chat__bubble-avatar is-fallback" aria-hidden="true">
                {{ session.name ? Array.from(session.name)[0] : '?' }}
              </span>

              <div class="msg-chat__bubble" :class="`is-${row.message.content.kind}`">
                <p v-if="row.message.content.kind === 'text'" class="msg-chat__text">
                  {{ row.message.content.text }}
                </p>

                <img
                  v-else-if="row.message.content.kind === 'image'"
                  class="msg-chat__image"
                  :src="row.message.content.url"
                  :alt="t.chatImageAlt"
                  :style="imageSize(row.message)"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                >

                <a
                  v-else-if="row.message.content.kind === 'share'"
                  class="msg-chat__share"
                  :href="row.message.content.url || undefined"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <img
                    v-if="row.message.content.thumb || row.message.content.cover"
                    class="msg-chat__share-thumb"
                    :src="row.message.content.thumb || row.message.content.cover"
                    :alt="row.message.content.title"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                  >
                  <span class="msg-chat__share-body">
                    <span class="msg-chat__share-title">{{ row.message.content.title }}</span>
                    <span class="msg-chat__share-author">{{ row.message.content.author }}</span>
                  </span>
                </a>

                <div v-else-if="row.message.content.kind === 'card'" class="msg-chat__card">
                  <p class="msg-chat__card-title">
                    {{ row.message.content.title || t.chatCardTitle }}
                  </p>
                  <p v-if="row.message.content.text" class="msg-chat__card-text">
                    {{ row.message.content.text }}
                  </p>
                  <img
                    v-if="row.message.content.cover"
                    class="msg-chat__card-cover"
                    :src="row.message.content.cover"
                    :alt="row.message.content.title"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                  >
                  <a
                    v-if="row.message.content.jumpUrl"
                    class="msg-chat__card-link"
                    :href="row.message.content.jumpUrl"
                    target="_blank"
                    rel="noreferrer noopener"
                  >{{ t.chatCardOpen }}</a>
                </div>

                <p v-else class="msg-chat__unsupported">
                  {{ t.chatUnsupported }}
                </p>
              </div>
            </div>
          </li>
        </ol>

        <div v-else-if="isLoading" class="msg-chat__skeletons" aria-hidden="true">
          <span v-for="index in 5" :key="index" class="msg-chat__skeleton" :class="{ 'is-mine': index % 2 === 0 }" />
        </div>

        <div v-else class="msg-chat__empty">
          <p class="msg-chat__empty-title">
            {{ t.chatEmptyTitle }}
          </p>
          <p class="msg-chat__empty-desc">
            {{ t.chatEmptyDescription }}
          </p>
        </div>

        <p v-if="errorMessage" class="msg-chat__error" role="alert">
          {{ errorMessage }}
          <button class="msg-chat__error-retry" type="button" @click="emit('retry')">
            {{ t.retry }}
          </button>
        </p>
      </div>
    </template>
  </section>
</template>
