<script setup lang="ts">
import type { PopularTabId } from '../constants'
import { useEventListener } from '@vueuse/core'
import { useBewlyApp } from '~/composables/useAppProvider'
import { POPULAR_TABS, RANK_REGIONS } from '../constants'
import { usePopularI18n } from '../i18n'
import { pathForTab } from '../utils'

const props = defineProps<{ active: PopularTabId }>()
const emit = defineEmits<{ (e: 'select', tab: PopularTabId): void }>()

const { t } = usePopularI18n()
const { scrollbarRef } = useBewlyApp()
const navRef = ref<HTMLElement | null>(null)
const isStuck = ref(false)

/** 顶部 tab 的中文/英文文案 */
function tabLabel(id: PopularTabId): string {
  const labels = t.value
  switch (id) {
    case 'weekly':
      return labels.tabWeekly
    case 'precious':
      return labels.tabPrecious
    case 'rank':
      return labels.tabRank
    default:
      return labels.tabPopular
  }
}

function tabPath(id: PopularTabId): string {
  return pathForTab(id, RANK_REGIONS[0])
}

/** 普通左键切换内部 tab；带修饰键 / 中键时保留原生链接行为（可在新标签页打开原生页） */
function handleClick(event: MouseEvent, id: PopularTabId) {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
    return
  event.preventDefault()
  if (props.active !== id)
    emit('select', id)
}

/**
 * 吸顶位置：覆盖层里滚动容器从 Bewly 顶栏下方开始，粘性位置是 0；
 * 如果以后换个挂载方式（页面内容直接在顶栏下滚动），可用 CSS 变量覆盖。
 */
let stickyTop = 0

function readStickyTop() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--popular-nav-sticky-top')
  const parsed = Number.parseFloat(raw)
  if (Number.isFinite(parsed) && parsed > 0)
    stickyTop = parsed
}

function handleScroll() {
  const el = navRef.value
  if (!el)
    return
  isStuck.value = el.getBoundingClientRect().top <= stickyTop + 1
}

onMounted(readStickyTop)

useEventListener(scrollbarRef, 'scroll', handleScroll, { passive: true })
</script>

<template>
  <nav
    ref="navRef"
    class="popular-nav"
    :class="{ 'is-stuck': isStuck }"
    role="tablist"
    :aria-label="t.navAria"
  >
    <div class="popular-nav__tabs">
      <a
        v-for="tab in POPULAR_TABS"
        :key="tab.id"
        class="popular-tab"
        :class="{ 'is-active': active === tab.id }"
        :href="tabPath(tab.id)"
        role="tab"
        :aria-selected="active === tab.id"
        @click="handleClick($event, tab.id)"
      >
        {{ tabLabel(tab.id) }}
      </a>
    </div>
  </nav>
</template>
