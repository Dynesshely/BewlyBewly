<script setup lang="ts">
import type { DrawnActionType, DrawnMoment } from '../types'

import { computed } from 'vue'

import Picture from '~/components/Picture.vue'
import { useDrawnMomentsI18n } from '../i18n'
import DrawnMomentActionIcon from './DrawnMomentActionIcon.vue'
import DrawnMomentContent from './DrawnMomentContent.vue'
import DrawnMomentQuote from './DrawnMomentQuote.vue'
import DrawnMomentText from './DrawnMomentText.vue'

/**
 * 自绘动态卡片。
 *
 * 结构（第 93 轮要求）：头像 40 圆 / 昵称 / 时间 / 正文 / 图片网格 / 转发引用块 / 操作栏。
 * 操作栏只做「代理点击」：转发 / 评论 / 点赞都转给原生按钮，不自己发请求、不写改写接口。
 */
const props = defineProps<{
  moment: DrawnMoment
}>()

const emit = defineEmits<{
  (e: 'action', type: DrawnActionType): void
}>()

const { t } = useDrawnMomentsI18n()

const actions = computed(() => [
  {
    type: 'forward' as const,
    count: props.moment.stats.forward,
    label: t.value.forward,
    icon: 'forward' as const,
  },
  {
    type: 'comment' as const,
    count: props.moment.stats.comment,
    label: t.value.comment,
    icon: 'comment' as const,
  },
  {
    type: 'like' as const,
    count: props.moment.stats.like,
    label: props.moment.stats.liked ? t.value.liked : t.value.like,
    icon: 'like' as const,
  },
])
</script>

<template>
  <article class="bewly-moment">
    <header class="bewly-moment__header">
      <span class="bewly-moment__avatar">
        <Picture :src="moment.avatar" :alt="moment.authorName" fallback-kind="avatar" />
      </span>
      <span class="bewly-moment__meta">
        <span class="bewly-moment__name">{{ moment.authorName }}</span>
        <span v-if="moment.time" class="bewly-moment__time">{{ moment.time }}</span>
      </span>
    </header>

    <div class="bewly-moment__body">
      <DrawnMomentText v-if="moment.text" :text="moment.text" :lines="6" />
      <DrawnMomentContent v-if="moment.content" :content="moment.content" />
      <DrawnMomentQuote v-if="moment.quote" :quote="moment.quote" />
    </div>

    <footer class="bewly-moment__actions">
      <button
        v-for="action in actions"
        :key="action.type"
        type="button"
        class="bewly-moment__action"
        :class="{ 'is-liked': action.type === 'like' && moment.stats.liked }"
        :aria-label="action.label"
        :title="action.label"
        @click="emit('action', action.type)"
      >
        <DrawnMomentActionIcon :name="action.icon" />
        <span v-if="action.count" class="bewly-moment__action-count">{{ action.count }}</span>
      </button>
    </footer>
  </article>
</template>
