<script setup lang="ts">
/**
 * 互动列表（回复我的 / @ 我的 / 收到的赞）。
 *
 * 三类接口的条目结构不同，但在 `utils.toReplyEntry / toAtEntry / toLikeEntry` 里
 * 已经归一化成同一个 `FeedEntry`，这里只按 `kind` 换文案。
 *
 * 真机事实：三张列表都是**游标分页**（`{is_end, id, time}`），不是 pn 分页 ——
 * `pn` 参数被接口忽略（实测 pn=1 / pn=2 返回完全相同的条目），
 * 所以「加载更多」必须把上一页的 cursor 原样传回去（见 fetcher）。
 */
import type { FeedEntry } from '../types'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import EmptyState from '~/components/Feedback/EmptyState.vue'
import ErrorState from '~/components/Feedback/ErrorState.vue'
import { useMessageDrawnI18n } from '../i18n'
import { formatRelativeTime } from '../utils'

/** 三种互动列表（'love' 是 URL / 原生 tab 的叫法，「收到的赞」） */
type FeedKind = 'reply' | 'at' | 'love'

const props = defineProps<{
  entries: FeedEntry[]
  kind: FeedKind
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  errorMessage: string
  /** 加载更多失败（已有列表时的行内错误） */
  loadMoreError: string
  /** 原生页地址：错误态里的回退入口 */
  nativeUrl: string
}>()

const emit = defineEmits<{
  (e: 'loadMore'): void
  (e: 'retry'): void
}>()

const { t } = useMessageDrawnI18n()

const sentinelRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

/** FeedEntry 的 kind（数据层叫 like）→ 列表视图的 kind（URL / 原生 tab 叫 love） */
function toFeedKind(kind: FeedEntry['kind']): FeedKind {
  return kind === 'like'
    ? 'love'
    : kind
}

/** 动作文案（`love` = 收到的赞，对应 FeedEntry.kind 的 `like`） */
function actionText(kind: FeedKind): string {
  switch (kind) {
    case 'reply': return t.value.replyAction
    case 'at': return t.value.atAction
    case 'love': return t.value.likeAction
  }
}

/** 动作人的展示名：赞可能有多人，取前两个拼「等 N 人」 */
function actorText(entry: FeedEntry): string {
  const names = entry.actors
    .map(actor => actor.name)
    .filter(Boolean)
  if (!names.length)
    return ''

  if (entry.kind !== 'like' || names.length === 1) {
    return names.length > 1
      ? `${names[0]} 等 ${names.length} 人`
      : names[0]
  }

  const total = Math.max(entry.actorCount, names.length)
  return total > names.length
    ? t.value.likeAndOthers.replace('{name}', names[0]).replace('{count}', String(total))
    : `${names.slice(0, 2).join('、')}`
}

/** 头像：最多展示 3 个（多人点赞时叠起来） */
function avatars(entry: FeedEntry): string[] {
  return entry.actors
    .map(actor => actor.avatar)
    .filter(Boolean)
    .slice(0, 3)
}

function connectObserver() {
  observer?.disconnect()
  // 极老的浏览器 / 非浏览器环境没有 IntersectionObserver：不接观察器（不报错），
  // 列表仍可正常渲染，只是不会自动加载更多（用户仍可通过覆盖层的刷新动作重拉）。
  if (typeof IntersectionObserver === 'undefined')
    return
  const target = sentinelRef.value
  if (!target)
    return
  observer = new IntersectionObserver(
    (records) => {
      if (!records.some(record => record.isIntersecting))
        return
      if (props.isLoading || props.isLoadingMore || !props.hasMore)
        return
      emit('loadMore')
    },
    { rootMargin: '160px 0px' },
  )
  observer.observe(target)
}

onMounted(async () => {
  await nextTick()
  connectObserver()
})
onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

watch(() => props.entries.length, async () => {
  await nextTick()
  if (props.hasMore)
    connectObserver()
})
</script>

<template>
  <section class="msg-feed">
    <ul v-if="entries.length" class="msg-feed__list">
      <li v-for="entry in entries" :key="entry.key" class="msg-feed__item">
        <a
          v-if="entry.url"
          class="msg-feed__link"
          :href="entry.url"
          target="_blank"
          rel="noreferrer noopener"
          :aria-label="t.feedOpen"
        />
        <div class="msg-feed__avatars">
          <img
            v-for="(avatar, index) in avatars(entry)"
            :key="index"
            class="msg-feed__avatar"
            :src="avatar"
            :alt="actorText(entry)"
            loading="lazy"
            referrerpolicy="no-referrer"
          >
          <span v-if="!avatars(entry).length" class="msg-feed__avatar is-fallback" aria-hidden="true">?</span>
        </div>

        <div class="msg-feed__body">
          <p class="msg-feed__line">
            <span class="msg-feed__actor">{{ actorText(entry) }}</span>
            <span class="msg-feed__action">{{ actionText(toFeedKind(entry.kind)) }}</span>
            <span v-if="entry.kind === 'like' && entry.actorCount > 1" class="msg-feed__count">
              {{ t.likeCount.replace('{count}', String(entry.actorCount)) }}
            </span>
          </p>
          <p v-if="entry.text" class="msg-feed__text">
            {{ entry.text }}
          </p>
          <p v-if="entry.title" class="msg-feed__title">
            {{ entry.title }}
          </p>
          <p class="msg-feed__time">
            {{ formatRelativeTime(entry.time) }}
          </p>
        </div>

        <img
          v-if="entry.cover"
          class="msg-feed__cover"
          :src="entry.cover"
          :alt="entry.title"
          loading="lazy"
          referrerpolicy="no-referrer"
        >
      </li>
    </ul>

    <div v-else-if="isLoading" class="msg-feed__skeletons" aria-hidden="true">
      <div v-for="index in 5" :key="index" class="msg-feed__skeleton">
        <span class="msg-feed__skeleton-avatar" />
        <span class="msg-feed__skeleton-lines">
          <span class="msg-feed__skeleton-line" />
          <span class="msg-feed__skeleton-line is-short" />
        </span>
      </div>
    </div>

    <ErrorState
      v-else-if="errorMessage"
      :title="t.errorTitle"
      :message="errorMessage"
      :retry-label="t.retry"
      @retry="emit('retry')"
    >
      <a class="msg-feed__native" :href="nativeUrl">{{ t.errorNative }}</a>
    </ErrorState>

    <EmptyState
      v-else
      :title="t.feedEmptyTitle"
      :description="t.feedEmptyDescription"
      icon="i-mingcute:notification-line"
    />

    <div ref="sentinelRef" class="msg-feed__sentinel" aria-hidden="true" />
    <p v-if="isLoadingMore" class="msg-feed__hint">
      {{ t.loading }}
    </p>
    <p v-else-if="entries.length && !hasMore" class="msg-feed__hint">
      {{ t.end }}
    </p>

    <p v-if="loadMoreError && entries.length" class="msg-feed__inline-error" role="alert">
      {{ loadMoreError }}
      <button class="msg-feed__inline-retry" type="button" @click="emit('loadMore')">
        {{ t.retry }}
      </button>
    </p>
  </section>
</template>
