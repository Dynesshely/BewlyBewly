<script setup lang="ts">
/**
 * 会话列表（自绘）。
 *
 * 数据全部来自 `get_sessions`（API），不读原生 DOM：
 *   头像 40 圆 / 昵称 / 单行摘要 / 时间 / 未读红点数字。
 *
 * # 已读态怎么表达
 *
 * 真机 `get_sessions` 返回 `unread_count`（会话级未读条数）与 `is_dnd`（免打扰），
 * 没有逐条已读标记，所以未读就是那个数字，超过 99 显示 `99+`。
 *
 * # 滚动到底加载更多
 *
 * 用 IntersectionObserver 观察列表底部的哨兵；`hasMore` 为 false 时不再触发。
 * 父组件负责真正发请求，这里只管「什么时候该发」。
 */
import type { ChatSession } from '../types'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMessageDrawnI18n } from '../i18n'
import { formatSessionTime } from '../utils'

const props = defineProps<{
  sessions: ChatSession[]
  activeMid: string
  isLoading: boolean
  hasMore: boolean
  /** 搜索关键词（空串 = 不过滤） */
  keyword: string
  /** 未读数汇总（tab 角标用不到时忽略） */
  errorMessage?: string
}>()

const emit = defineEmits<{
  (e: 'select', mid: string): void
  (e: 'search', keyword: string): void
  (e: 'loadMore'): void
  (e: 'retry'): void
}>()

const { t } = useMessageDrawnI18n()

const scrollerRef = ref<HTMLElement | null>(null)
const sentinelRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

/** 未读数文案：99 条以上压成 99+ */
function badgeText(count: number): string {
  return count > 99
    ? '99+'
    : String(count)
}

/** 会话项的无障碍名称（含未读数，读屏能听出哪条是未读） */
function itemLabel(session: ChatSession): string {
  if (session.unread > 0)
    return t.value.sessionUnread.replace('{name}', session.name).replace('{count}', String(session.unread))
  return session.name
}

/** 头像兜底：没有头像时用昵称首字符 */
function initialOf(session: ChatSession): string {
  return session.name
    ? (Array.from(session.name)[0] ?? '')
    : '?'
}

function connectObserver() {
  observer?.disconnect()
  // 极老的浏览器 / 非浏览器环境没有 IntersectionObserver：不接观察器（不报错），
  // 列表仍可正常渲染，只是不会自动加载更多（用户仍可通过覆盖层的刷新动作重拉）。
  if (typeof IntersectionObserver === 'undefined')
    return
  const target = sentinelRef.value
  const root = scrollerRef.value
  if (!target || !root)
    return
  observer = new IntersectionObserver(
    (records) => {
      if (!records.some(record => record.isIntersecting))
        return
      if (props.isLoading || !props.hasMore)
        return
      emit('loadMore')
    },
    { root, rootMargin: '120px 0px' },
  )
  observer.observe(target)
}

onMounted(connectObserver)
onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

// 列表整体被替换（切 tab / 首次加载完）时哨兵会被重建，重新接一次
watch(() => props.sessions.length, () => {
  if (props.hasMore)
    connectObserver()
})
</script>

<template>
  <aside class="msg-sessions" :aria-label="t.sessionsAria">
    <div class="msg-sessions__search">
      <span class="i-mingcute:search-line msg-sessions__search-icon" aria-hidden="true" />
      <input
        class="msg-sessions__search-input"
        type="search"
        :value="keyword"
        :placeholder="t.sessionSearchPlaceholder"
        :aria-label="t.sessionSearchPlaceholder"
        @input="emit('search', ($event.target as HTMLInputElement).value)"
      >
    </div>

    <div ref="scrollerRef" class="msg-sessions__scroll">
      <ul v-if="sessions.length" class="msg-sessions__list">
        <li v-for="session in sessions" :key="session.mid">
          <button
            class="msg-sessions__item"
            :class="{ 'is-active': session.mid === activeMid, 'is-muted': session.muted }"
            type="button"
            :aria-label="itemLabel(session)"
            :aria-current="session.mid === activeMid ? 'true' : undefined"
            @click="emit('select', session.mid)"
          >
            <span class="msg-sessions__avatar">
              <img
                v-if="session.avatar"
                class="msg-sessions__avatar-img"
                :src="session.avatar"
                :alt="session.name"
                loading="lazy"
                referrerpolicy="no-referrer"
              >
              <span v-else class="msg-sessions__avatar-fallback" aria-hidden="true">{{ initialOf(session) }}</span>
            </span>

            <span class="msg-sessions__body">
              <span class="msg-sessions__row">
                <span class="msg-sessions__name">{{ session.name }}</span>
                <span class="msg-sessions__time">{{ formatSessionTime(session.time) }}</span>
              </span>
              <span class="msg-sessions__row">
                <span class="msg-sessions__summary">{{ session.summary }}</span>
                <span
                  v-if="session.unread > 0"
                  class="msg-sessions__badge"
                  :class="{ 'is-dot': session.muted }"
                >{{ session.muted ? '' : badgeText(session.unread) }}</span>
              </span>
            </span>
          </button>
        </li>
      </ul>

      <!-- 首屏加载 -->
      <div v-else-if="isLoading" class="msg-sessions__skeletons" aria-hidden="true">
        <div v-for="index in 6" :key="index" class="msg-sessions__skeleton">
          <span class="msg-sessions__skeleton-avatar" />
          <span class="msg-sessions__skeleton-lines">
            <span class="msg-sessions__skeleton-line is-name" />
            <span class="msg-sessions__skeleton-line" />
          </span>
        </div>
      </div>

      <!-- 搜索无结果 -->
      <p v-else-if="keyword" class="msg-sessions__hint">
        {{ t.sessionSearchEmpty }}
      </p>

      <!-- 空态 -->
      <div v-else class="msg-sessions__empty">
        <p class="msg-sessions__empty-title">
          {{ t.sessionEmptyTitle }}
        </p>
        <p class="msg-sessions__empty-desc">
          {{ t.sessionEmptyDescription }}
        </p>
      </div>

      <!-- 加载更多 / 到底了 -->
      <div ref="sentinelRef" class="msg-sessions__sentinel" aria-hidden="true" />
      <p v-if="isLoading && sessions.length" class="msg-sessions__hint">
        {{ t.loading }}
      </p>
      <p v-else-if="!hasMore && sessions.length" class="msg-sessions__hint">
        {{ t.end }}
      </p>

      <p v-if="errorMessage" class="msg-sessions__error" role="alert">
        {{ errorMessage }}
        <button class="msg-sessions__error-retry" type="button" @click="emit('retry')">
          {{ t.retry }}
        </button>
      </p>
    </div>
  </aside>
</template>
