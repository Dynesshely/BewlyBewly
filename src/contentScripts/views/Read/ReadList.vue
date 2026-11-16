<script setup lang="ts">
import type { ReadCard } from './types'
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { fetchMoreCards } from './fetcher'
import { formatCount, formatPublishTime } from './format'
import { formatTemplate, useMessages } from './i18n'

/**
 * 专栏列表页（`/read/home`）的自绘卡片网格。
 *
 * 挂载在独立 shadow root 里（见 index.ts），因此这里的 class 名不会和 B 站页面冲突；
 * 样式全部来自 readList.shadow.scss，颜色只用 `--bew-*` 变量，深浅主题自动跟随。
 *
 * 数据：首屏卡片由 index.ts 传入（`__INITIAL_STATE__` 或原生 DOM 解析），
 * 之后的翻页由本组件调用 `/x/article/recommends`。任何一次翻页失败都只是
 * 显示「重试」，已经渲染出来的卡片不受影响。
 */
const props = defineProps<{ initialCards: ReadCard[] }>()

const t = useMessages()
const cards = ref<ReadCard[]>([...props.initialCards])
const page = ref(1)
const loading = ref(false)
const failed = ref(false)
const ended = ref(false)
const sentinel = ref<HTMLElement | null>(null)

let observer: IntersectionObserver | null = null

async function loadMore(): Promise<void> {
  if (loading.value || ended.value)
    return
  loading.value = true
  failed.value = false
  try {
    const next = await fetchMoreCards(page.value + 1, cards.value.map(card => card.id))
    if (next.length === 0) {
      ended.value = true
      return
    }
    // 同一个 id 只渲染一次（接口偶尔会把已展示的条目再返回一遍）
    const seen = new Set(cards.value.map(card => card.id))
    cards.value.push(...next.filter(card => !seen.has(card.id)))
    page.value += 1
  }
  catch {
    failed.value = true
  }
  finally {
    loading.value = false
  }
}

function onSentinel(entries: IntersectionObserverEntry[]): void {
  if (entries.some(entry => entry.isIntersecting))
    void loadMore()
}

onMounted(() => {
  if (!('IntersectionObserver' in window) || !sentinel.value)
    return
  observer = new IntersectionObserver(onSentinel, { rootMargin: '600px 0px' })
  observer.observe(sentinel.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

const countLabel = () => formatTemplate(t.value.count, { count: cards.value.length })
</script>

<template>
  <div class="brl-page" data-bewly-read-list>
    <header class="brl-header">
      <div class="brl-heading">
        <h1 class="brl-title">
          {{ t.pageTitle }}
        </h1>
        <span class="brl-count">{{ countLabel() }}</span>
      </div>
      <p class="brl-subtitle">
        {{ t.pageSubtitle }}
      </p>
    </header>

    <p v-if="cards.length === 0" class="brl-empty">
      {{ t.empty }}
    </p>

    <div v-else class="brl-grid">
      <a
        v-for="card in cards"
        :key="card.id"
        class="brl-card"
        :href="card.url"
        target="_blank"
        rel="noopener noreferrer"
        :title="card.title"
      >
        <div class="brl-cover">
          <img
            v-if="card.cover"
            class="brl-cover__img"
            :src="card.cover"
            :alt="formatTemplate(t.coverAlt, { title: card.title })"
            loading="lazy"
            decoding="async"
          >
          <div v-else class="brl-cover__placeholder" aria-hidden="true" />
          <span v-if="card.category" class="brl-tag">{{ card.category }}</span>
        </div>

        <h2 class="brl-card__title">
          {{ card.title }}
        </h2>

        <div class="brl-meta">
          <span class="brl-author">
            <img
              v-if="card.author.face"
              class="brl-avatar"
              :src="card.author.face"
              alt=""
              loading="lazy"
              decoding="async"
            >
            <span class="brl-author__name">{{ card.author.name || t.unknownAuthor }}</span>
          </span>
          <span v-if="card.publishTime" class="brl-time">
            {{ formatPublishTime(card.publishTime, t) }}
          </span>
        </div>

        <div class="brl-stats">
          <span class="brl-stat" :title="`${t.views} ${formatCount(card.views)}`">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M1.5 8s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4S1.5 8 1.5 8Z" stroke="currentColor" stroke-width="1.2" />
              <circle cx="8" cy="8" r="1.9" stroke="currentColor" stroke-width="1.2" />
            </svg>
            <span class="brl-sr">{{ t.views }}</span>
            {{ formatCount(card.views) }}
          </span>
          <span class="brl-stat" :title="`${t.likes} ${formatCount(card.likes)}`">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M5 7.5V13M5 7.5 7.6 3c.9 0 1.4.7 1.2 1.5L8.4 6.5h3.2c.9 0 1.5.8 1.3 1.6l-.9 4c-.1.5-.6.9-1.2.9H5"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linejoin="round"
              />
              <path d="M5 7.5H2.8V13H5" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
            </svg>
            <span class="brl-sr">{{ t.likes }}</span>
            {{ formatCount(card.likes) }}
          </span>
        </div>
      </a>
    </div>

    <footer class="brl-footer">
      <div ref="sentinel" class="brl-sentinel" aria-hidden="true" />
      <button
        v-if="!ended && cards.length > 0"
        type="button"
        class="brl-more"
        :disabled="loading"
        @click="loadMore()"
      >
        {{ loading ? t.loading : failed ? t.retry : t.loadMore }}
      </button>
      <p v-else-if="ended" class="brl-end">
        {{ t.noMore }}
      </p>
    </footer>
  </div>
</template>
