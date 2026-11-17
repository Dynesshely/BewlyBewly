<script setup lang="ts">
import type { MessageInteractionView } from '../state'

import { computed } from 'vue'

import Picture from '~/components/Picture.vue'
import { useMessages } from '../i18n'

/**
 * 回复 / @ / 收到的赞 三类列表的共用卡片（视觉语言与左栏会话列表一致）。
 *
 * - 头像：1 个 40 圆；多人点赞时两个头像叠放；
 * - 标题行：昵称（多人用「、」连接）+ 原生动作文案；
 * - 引用小卡：灰底，含源内容封面缩略图 + 引用原文（评论 / 正文）；
 * - 底部：时间、未读圆点、原生操作按钮（hover 才显，点击转发回原生按钮）。
 */
const props = defineProps<{
  item: MessageInteractionView
}>()

const emit = defineEmits<{
  (e: 'open'): void
  (e: 'button', type: 'reply' | 'like' | 'delete' | 'notice'): void
}>()

const messages = useMessages()

const unamesText = computed(() => props.item.unames.join('、'))

const quoteText = computed(() => props.item.reference || props.item.message)

const hasQuote = computed(() => Boolean(quoteText.value || props.item.cover))

const buttonLabels = computed<Record<string, string>>(() => ({
  reply: messages.value.actionReply,
  like: messages.value.actionLike,
  delete: messages.value.actionDelete,
  notice: messages.value.actionNotice,
}))
</script>

<template>
  <article
    class="bewly-msg-card"
    :class="{ 'is-unread': item.unread, 'is-multi': item.multi }"
    role="button"
    tabindex="0"
    @click="emit('open')"
    @keydown.enter.prevent="emit('open')"
    @keydown.space.prevent="emit('open')"
  >
    <div class="bewly-msg-card__avatars" :class="{ 'is-multi': item.multi }">
      <template v-if="item.avatars.length > 1">
        <Picture
          v-for="(avatar, avatarIndex) in item.avatars.slice(0, 2)"
          :key="avatar + avatarIndex"
          class="bewly-msg-card__avatar"
          :src="avatar"
          fallback-kind="avatar"
          :style="{ zIndex: 2 - avatarIndex }"
        />
      </template>
      <Picture
        v-else-if="item.avatars[0]"
        class="bewly-msg-card__avatar"
        :src="item.avatars[0]"
        fallback-kind="avatar"
      />
      <span v-else class="bewly-msg-card__avatar bewly-msg-card__avatar--fallback">
        {{ unamesText.slice(0, 1) || '?' }}
      </span>
    </div>

    <div class="bewly-msg-card__main">
      <div class="bewly-msg-card__title">
        <span class="bewly-msg-card__names">{{ unamesText || '—' }}</span>
        <span v-if="item.action" class="bewly-msg-card__action">{{ item.action }}</span>
      </div>

      <div v-if="hasQuote" class="bewly-msg-card__quote">
        <span v-if="item.cover" class="bewly-msg-card__cover">
          <Picture :src="item.cover" fallback-kind="video" />
        </span>
        <span v-if="quoteText" class="bewly-msg-card__quote-text">{{ quoteText }}</span>
      </div>

      <div class="bewly-msg-card__meta">
        <span class="bewly-msg-card__time">{{ item.time }}</span>
        <span v-if="item.unread" class="bewly-msg-card__dot" role="status" :aria-label="messages.unreadDot" />
        <span v-if="item.buttons.length" class="bewly-msg-card__buttons">
          <button
            v-for="button in item.buttons"
            :key="button"
            type="button"
            class="bewly-msg-card__button"
            @click.stop="emit('button', button)"
          >
            {{ buttonLabels[button] }}
          </button>
        </span>
      </div>
    </div>
  </article>
</template>
