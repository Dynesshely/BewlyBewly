<script setup lang="ts">
import type { MessageSystemView } from '../state'
import { useMessages } from '../i18n'

/**
 * 系统通知卡片：图标 + 标题 + 正文 + 时间 / 未读态。
 * 点击整体转发回原生条目的 click（B 站自己决定跳到哪）。
 */
defineProps<{
  item: MessageSystemView
}>()

const emit = defineEmits<{
  (e: 'open'): void
}>()

const messages = useMessages()
</script>

<template>
  <article
    class="bewly-msg-card bewly-msg-card--system"
    :class="{ 'is-unread': item.unread }"
    role="button"
    tabindex="0"
    @click="emit('open')"
    @keydown.enter.prevent="emit('open')"
    @keydown.space.prevent="emit('open')"
  >
    <span class="bewly-msg-card__icon" role="img" :aria-label="messages.systemNotice">
      <svg
        width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
    </span>

    <div class="bewly-msg-card__main">
      <div class="bewly-msg-card__title">
        <span class="bewly-msg-card__names">{{ item.title }}</span>
      </div>
      <p v-if="item.message" class="bewly-msg-card__text">
        {{ item.message }}
      </p>
      <div class="bewly-msg-card__meta">
        <span class="bewly-msg-card__time">{{ item.time }}</span>
        <span v-if="item.unread" class="bewly-msg-card__dot" role="status" :aria-label="messages.unreadDot" />
      </div>
    </div>
  </article>
</template>
