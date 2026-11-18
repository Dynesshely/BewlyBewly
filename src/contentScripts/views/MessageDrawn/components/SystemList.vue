<script setup lang="ts">
/**
 * 系统通知列表（自绘）。
 *
 * 数据来自 `message.bilibili.com/x/sys-msg/query_unified_notify`（同源，真机验证可用），
 * 翻页用上一页最后一条的 `cursor`。接口没有 `is_end`，只能按「本页拿满 20 条」判断
 * 还有没有下一页（见 fetcher.fetchSystemNotices）。
 */
import type { SystemNotice } from '../types'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import EmptyState from '~/components/Feedback/EmptyState.vue'
import ErrorState from '~/components/Feedback/ErrorState.vue'
import { useMessageDrawnI18n } from '../i18n'

const props = defineProps<{
  entries: SystemNotice[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  errorMessage: string
  loadMoreError: string
  nativeUrl: string
}>()

const emit = defineEmits<{
  (e: 'loadMore'): void
  (e: 'retry'): void
}>()

const { t } = useMessageDrawnI18n()

const sentinelRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

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
  <section class="msg-system">
    <ul v-if="entries.length" class="msg-system__list">
      <li v-for="entry in entries" :key="entry.key" class="msg-system__item">
        <img
          v-if="entry.logo"
          class="msg-system__logo"
          :src="entry.logo"
          alt=""
          loading="lazy"
          referrerpolicy="no-referrer"
        >
        <span v-else class="msg-system__logo is-fallback" aria-hidden="true">
          <span class="i-mingcute:notification-line" />
        </span>

        <div class="msg-system__body">
          <div class="msg-system__head">
            <p class="msg-system__title">
              {{ entry.title }}
            </p>
            <span class="msg-system__time">{{ entry.time }}</span>
          </div>
          <p class="msg-system__text">
            {{ entry.text }}
          </p>
          <a
            v-if="entry.link"
            class="msg-system__link"
            :href="entry.link"
            target="_blank"
            rel="noreferrer noopener"
          >{{ t.systemDetail }}</a>
        </div>
      </li>
    </ul>

    <div v-else-if="isLoading" class="msg-system__skeletons" aria-hidden="true">
      <div v-for="index in 5" :key="index" class="msg-system__skeleton">
        <span class="msg-system__skeleton-logo" />
        <span class="msg-system__skeleton-lines">
          <span class="msg-system__skeleton-line" />
          <span class="msg-system__skeleton-line is-short" />
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
      <a class="msg-system__native" :href="nativeUrl">{{ t.errorNative }}</a>
    </ErrorState>

    <EmptyState
      v-else
      :title="t.systemEmptyTitle"
      :description="t.systemEmptyDescription"
      icon="i-mingcute:notification-line"
    />

    <div ref="sentinelRef" class="msg-system__sentinel" aria-hidden="true" />
    <p v-if="isLoadingMore" class="msg-system__hint">
      {{ t.loading }}
    </p>
    <p v-else-if="entries.length && !hasMore" class="msg-system__hint">
      {{ t.end }}
    </p>

    <p v-if="loadMoreError && entries.length" class="msg-system__inline-error" role="alert">
      {{ loadMoreError }}
      <button class="msg-system__inline-retry" type="button" @click="emit('loadMore')">
        {{ t.retry }}
      </button>
    </p>
  </section>
</template>
