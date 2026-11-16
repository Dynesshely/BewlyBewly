<script setup lang="ts">
import { ref } from 'vue'

import { openSession, requestLoadMore } from '../actions'
import { formatUnread, useMessages } from '../i18n'
import { state } from '../state'

const t = useMessages()
const scroller = ref<HTMLElement | null>(null)

function badgeText(unread: number | null): string {
  if (unread === null)
    return ''
  return unread > 99
    ? '99+'
    : String(unread)
}

function sessionLabel(name: string, unread: number | null): string {
  return unread
    ? `${name}，${formatUnread(t.value.unreadBadge, unread)}`
    : name
}

/** 滚到接近底部时让原生列表加载更多 */
function onScroll(): void {
  const el = scroller.value
  if (!el)
    return
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 96)
    requestLoadMore()
}
</script>

<template>
  <section class="bewly-msg-sessions" :aria-label="state.sessionTitle">
    <header class="bewly-msg-sessions__head">
      <span class="bewly-msg-sessions__title">{{ state.sessionTitle }}</span>
      <span class="bewly-msg-sessions__count" aria-hidden="true">{{ state.sessions.length }}</span>
    </header>

    <div ref="scroller" class="bewly-msg-sessions__scroll" @scroll.passive="onScroll">
      <button
        v-for="session in state.sessions"
        :key="session.dataId"
        class="bewly-msg-session"
        :class="{ 'is-active': session.active, 'is-pinned': session.pinned }"
        type="button"
        :aria-current="session.active ? 'true' : undefined"
        :aria-label="sessionLabel(session.name, session.unread)"
        @click="openSession(session.dataId)"
      >
        <span class="bewly-msg-session__avatar-wrap">
          <img v-if="session.avatar" class="bewly-msg-session__avatar" :src="session.avatar" alt="" loading="lazy">
          <span v-else class="bewly-msg-session__avatar bewly-msg-session__avatar--fallback">{{ session.initial }}</span>
        </span>

        <span class="bewly-msg-session__main">
          <span class="bewly-msg-session__row">
            <span class="bewly-msg-session__name">{{ session.name }}</span>
            <span v-if="session.timeText" class="bewly-msg-session__time">{{ session.timeText }}</span>
          </span>
          <span class="bewly-msg-session__row">
            <span class="bewly-msg-session__info">
              <span v-if="session.redAlert" class="bewly-msg-session__alert">{{ session.redAlert }}</span>
              <span class="bewly-msg-session__summary">{{ session.summary }}</span>
            </span>
            <span v-if="session.unread" class="bewly-msg-session__badge" aria-hidden="true">{{ badgeText(session.unread) }}</span>
            <span v-else-if="session.dot" class="bewly-msg-session__dot" aria-hidden="true" />
            <span v-else-if="session.silent" class="bewly-msg-session__silent" aria-hidden="true" />
          </span>
        </span>
      </button>

      <p v-if="!state.sessions.length" class="bewly-msg-sessions__empty">
        {{ t.emptySessions }}
      </p>
    </div>
  </section>
</template>
