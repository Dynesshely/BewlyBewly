/**
 * 首页（自绘）的页面壳。
 *
 * 由 mount.ts 以「自挂载覆盖层」的方式挂在旧首页之上（旧首页 DOM 已被它隐藏），
 * 拿到的一切都是挂载时预取好的快照（props），不再读原生 DOM。
 *
 * 顶部 tab 本轮只做「推荐」一个（其余入口做成右侧的跳转链接），
 * 网格与无限滚动在 components/HomeFeed.vue。
 *
 * 三个「减少心智负担」优化：
 *   1. 卡片 hover 显示「稍后再看」快捷按钮 —— 由 VideoCard 自带的
 *      VideoCardQuickActions 提供（悬停操作条，含稍后再看 / 点赞 / 收藏），
 *      本页不重写一套，保证行为与其它页面一致；
 *   2. 顶部「刷新推荐」按钮 —— 调 HomeFeed.reload() 重拉 fresh_idx=1 并回到顶部；
 *   3. 滚动位置记忆 —— 离开首页时记锚点卡片，回来时按锚点恢复（scrollMemory.ts）。
 */
<script setup lang="ts">
import type { HomeFeedItem } from './types'
import { useBewlyApp } from '~/composables/useAppProvider'
import HomeFeed from './components/HomeFeed.vue'
import { HOME_SIBLING_LINKS } from './constants'
import { useHomeDrawnI18n } from './i18n'

const props = defineProps<{
  initialItems: HomeFeedItem[]
  initialFreshIdx: number
}>()

const { t } = useHomeDrawnI18n()
const { handleBackToTop, scrollbarRef } = useBewlyApp()

const feedRef = ref<InstanceType<typeof HomeFeed> | null>(null)
const refreshing = ref<boolean>(false)
const loadedCount = ref<number>(props.initialItems.length)

/** 回到顶部按钮：滚过两屏才出现（与 views/Home 的阈值一致） */
const TWO_SCREENS = 2
const pageScrollTop = ref<number>(0)
const viewportHeight = ref<number>(typeof window !== 'undefined'
  ? window.innerHeight
  : 0)
const showBackToTop = computed(() => pageScrollTop.value > viewportHeight.value * TWO_SCREENS)

let shellEl: HTMLElement | null = null
let scrollFrame = 0

function handleScroll() {
  if (scrollFrame)
    return
  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = 0
    pageScrollTop.value = shellEl?.scrollTop ?? 0
  })
}

function updateViewportHeight() {
  viewportHeight.value = shellEl?.clientHeight || window.innerHeight || 0
}

function bindShell() {
  const next = (scrollbarRef.value as HTMLElement | null) ?? null
  if (next === shellEl)
    return
  if (shellEl)
    shellEl.removeEventListener('scroll', handleScroll)
  shellEl = next
  if (shellEl) {
    shellEl.addEventListener('scroll', handleScroll, { passive: true })
    pageScrollTop.value = shellEl.scrollTop
  }
  updateViewportHeight()
}

function scrollToTop() {
  const reducedMotion = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (shellEl && reducedMotion)
    shellEl.scrollTop = 0
  else
    handleBackToTop(0)
  pageScrollTop.value = 0
}

/** 顶部「刷新推荐」：重拉第一页 + 回到顶部 */
async function refreshFeed() {
  if (refreshing.value)
    return
  refreshing.value = true
  try {
    await feedRef.value?.reload()
  }
  finally {
    refreshing.value = false
  }
  scrollToTop()
}

function handleCount(value: number) {
  loadedCount.value = value
}

onMounted(() => {
  bindShell()
  window.addEventListener('resize', updateViewportHeight)
})

watch(scrollbarRef, () => nextTick(bindShell))

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewportHeight)
  if (shellEl)
    shellEl.removeEventListener('scroll', handleScroll)
  shellEl = null
  if (scrollFrame) {
    window.cancelAnimationFrame(scrollFrame)
    scrollFrame = 0
  }
})
</script>

<template>
  <div class="home-drawn-page">
    <header class="home-drawn-header">
      <div class="home-drawn-tabs" role="tablist" :aria-label="t.tabAria">
        <button
          class="home-drawn-tabs__tab is-active"
          type="button"
          role="tab"
          aria-selected="true"
        >
          {{ t.tabRecommend }}
        </button>
        <span class="home-drawn-tabs__count">{{ t.loadedCount.replace('{count}', String(loadedCount)) }}</span>
      </div>

      <div class="home-drawn-actions">
        <button
          class="home-drawn-refresh"
          type="button"
          :disabled="refreshing"
          :title="t.refreshHint"
          :aria-label="t.refresh"
          @click="refreshFeed"
        >
          <span
            class="home-drawn-refresh__icon"
            :class="refreshing ? 'i-svg-spinners:ring-resize' : 'i-tabler:refresh'"
            aria-hidden="true"
          />
          <span class="home-drawn-refresh__label">{{ refreshing ? t.refreshing : t.refresh }}</span>
        </button>

        <nav class="home-drawn-links" :aria-label="t.linksAria">
          <a
            v-for="link in HOME_SIBLING_LINKS"
            :key="link.id"
            class="home-drawn-links__item"
            :href="link.url"
            :title="t[link.i18nKey]"
          >
            <span :class="link.icon" aria-hidden="true" />
            <span class="home-drawn-links__label">{{ t[link.i18nKey] }}</span>
          </a>
        </nav>
      </div>
    </header>

    <HomeFeed
      ref="feedRef"
      :initial="initialItems"
      :initial-fresh-idx="initialFreshIdx"
      @count="handleCount"
    />

    <Transition name="fade">
      <button
        v-if="showBackToTop"
        type="button"
        class="home-drawn-back-to-top"
        :aria-label="t.backToTop"
        :title="`${t.backToTop} · ${t.backToTopHint}`"
        @click="scrollToTop"
      >
        <span class="i-tabler:arrow-up" aria-hidden="true" />
      </button>
    </Transition>
  </div>
</template>
