<script setup lang="ts">
/**
 * 直播首页（自绘）。
 *
 * 只负责「分区 pill + 直播卡片网格 + 无限滚动」三件事：
 *   - 原生页的 `main`（banner / 小播放器 / 我的关注 / 原生推荐流）与原生分区行由
 *     `index.ts` 在挂载前隐藏，本组件不复用任何原生 DOM；
 *   - 数据走页面同源的 `getListV2`（见 `api.ts`）；
 *   - 首屏加载失败 → 触发 `fatal`，由 `index.ts` 撤销接管、还原原生首页并提示；
 *     后续翻页失败只在列表底部给「重试」，不打断已经渲染出来的内容。
 */
import type { LiveAreaTab, LiveRoomCard as LiveRoomCardModel } from '../types'
import { fetchHomeFeed } from '../api'
import { HOME_MAX_PAGES, HOME_PAGE_SIZE } from '../constants'
import { useLiveI18n } from '../i18n'
import LiveRoomCard from './components/LiveRoomCard.vue'

const props = defineProps<{
  /** 首屏加载失败时的回退回调（由 index.ts 还原原生页面） */
  onFatal?: () => void
}>()

const { t } = useLiveI18n()

const cards = ref<LiveRoomCardModel[]>([])
const areas = ref<LiveAreaTab[]>([])
const page = ref(0)
const hasMore = ref(true)
const loading = ref(false)
const error = ref(false)
const fatal = ref(false)
const sentinel = ref<HTMLElement | null>(null)

let observer: IntersectionObserver | null = null
let disposed = false

/** 合并新一页，按房间号去重（接口翻页偶尔会重复给同一批） */
function appendCards(next: LiveRoomCardModel[]) {
  const seen = new Set(cards.value.map(card => card.roomId))
  for (const card of next) {
    if (seen.has(card.roomId))
      continue
    seen.add(card.roomId)
    cards.value.push(card)
  }
}

async function loadPage(): Promise<void> {
  if (loading.value || !hasMore.value || page.value >= HOME_MAX_PAGES)
    return
  loading.value = true
  error.value = false
  try {
    const feed = await fetchHomeFeed(page.value + 1, HOME_PAGE_SIZE)
    if (disposed)
      return
    page.value += 1
    if (!areas.value.length && feed.areas.length)
      areas.value = feed.areas
    appendCards(feed.list)
    hasMore.value = feed.hasMore && feed.list.length > 0
  }
  catch (err) {
    if (disposed)
      return
    error.value = true
    // 首屏没有任何内容可展示时，整体回退原生页
    if (!cards.value.length) {
      fatal.value = true
      props.onFatal?.()
    }
    else {
      console.warn('[BewlyBewly] 直播首页翻页失败', err)
    }
  }
  finally {
    if (!disposed)
      loading.value = false
  }
}

/** 首屏失败后的重试（只在没有内容时才需要） */
function retry() {
  if (loading.value)
    return
  error.value = false
  void loadPage()
}

function startObserver() {
  if (observer || !sentinel.value)
    return
  observer = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting))
      void loadPage()
  }, { rootMargin: '600px 0px' })
  observer.observe(sentinel.value)
}

onMounted(async () => {
  await loadPage()
  if (disposed || fatal.value)
    return
  await nextTick()
  startObserver()
})

onUnmounted(() => {
  disposed = true
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <div class="bew-live-shell">
    <div class="bew-live-inner">
      <header class="bew-live-home__head">
        <h1 class="bew-live-home__title">
          {{ t.homeTitle }}
        </h1>
        <p class="bew-live-home__subtitle">
          {{ t.homeSubtitle }}
        </p>
      </header>

      <nav v-if="areas.length" class="bew-live-areas" role="tablist" :aria-label="t.areaNavAria">
        <a
          v-for="area in areas"
          :key="area.name"
          class="bew-live-area"
          :href="area.href"
          target="_blank"
          rel="noopener"
        >
          <span class="bew-live-area__label">{{ area.name }}</span>
          <div v-if="area.subs.length" class="bew-live-area__subs">
            <a
              v-for="sub in area.subs"
              :key="sub.name"
              class="bew-live-area__sub"
              :href="sub.href"
              target="_blank"
              rel="noopener"
            >{{ sub.name }}</a>
          </div>
        </a>
      </nav>

      <div v-if="cards.length" class="bew-live-grid">
        <LiveRoomCard v-for="card in cards" :key="card.roomId" :card="card" />
      </div>

      <div v-else-if="error && !loading" class="bew-live-state">
        <p class="bew-live-state__title">
          {{ t.errorTitle }}
        </p>
        <button class="bew-live-btn" type="button" @click="retry">
          {{ t.retry }}
        </button>
      </div>

      <div v-else-if="!loading && !hasMore" class="bew-live-state">
        <p class="bew-live-state__title">
          {{ t.emptyTitle }}
        </p>
        <p class="bew-live-state__desc">
          {{ t.emptyDescription }}
        </p>
      </div>

      <div v-if="loading && !cards.length" class="bew-live-grid" aria-hidden="true">
        <div v-for="index in 12" :key="index" class="bew-live-skeleton">
          <div class="bew-live-skeleton__cover" />
          <div class="bew-live-skeleton__line" />
          <div class="bew-live-skeleton__line is-short" />
        </div>
      </div>

      <div ref="sentinel" class="bew-live-sentinel">
        <button
          v-if="hasMore && !loading && error"
          class="bew-live-btn"
          type="button"
          @click="retry"
        >
          {{ t.retry }}
        </button>
        <span v-else-if="loading && cards.length" class="bew-live-sentinel__text">{{ t.loading }}</span>
        <a
          v-else-if="!hasMore && cards.length"
          class="bew-live-sentinel__link"
          href="https://live.bilibili.com/p/eden/area-tags?parentAreaId=0&areaId=0"
          target="_blank"
          rel="noopener"
        >{{ t.recommendMore }}</a>
      </div>
    </div>
  </div>
</template>
