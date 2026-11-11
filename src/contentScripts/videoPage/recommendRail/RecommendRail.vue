<script setup lang="ts">
import type { RailCard, RailPlacement } from './types'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { setHostHitOpen } from '.'
import { useMessages } from '../i18n'
import { RAIL_MAX_VISIBLE, RAIL_MIN_VISIBLE } from './types'

/**
 * 视频页推荐轨道（第 27 轮）。
 *
 * 用户要求「和首页一样的横向聚焦视图，同时可见 4~7 张，交互一致，支持当前标签页内嵌预览」。
 * 这里不复用首页那套「把卡片从网格里重排」的实现（首页卡片本身就是网格、视频页原生卡片是
 * 350×84 的小横卡，结构完全不同），而是把原生卡片的数据采集出来、在 shadow 里重新渲染成轨道，
 * 交互按首页聚焦浏览的语义对齐：
 *
 * - ← / → 切换 active 卡（Home / End 跳到首尾）；
 * - 鼠标滚轮横向切换（纵向滚动仍是滚页面：只在轨道本身有横向溢出时拦截）；
 * - 两侧箭头 + 卡片 hover 浮起 + Tab 聚焦 + :focus-visible 描边；
 * - 点击 = 当前标签页内嵌预览（emit `open-video-preview`，与首页聚焦浏览同一通道），
 *   Ctrl/⌘ + 点击或中键 = 新标签页。
 *
 * 可见数量按容器宽计算：`clamp(4, floor(width / 最小卡宽), 7)`，卡片等比缩放填满，
 * 因此 1280–2560 宽都能稳定落在 4~7 张。
 */
const props = defineProps<{
  cards: RailCard[]
  placement: RailPlacement
}>()

const emit = defineEmits<{
  (e: 'preview', url: string): void
  (e: 'openNewTab', url: string): void
  (e: 'close'): void
}>()

const t = useMessages()

const trackRef = ref<HTMLElement | null>(null)
const cardRefs = ref<HTMLElement[]>([])
const activeIndex = ref(0)

/** 可见卡片数量：4~7，按容器宽与最小卡宽计算 */
const visibleCount = computed(() => {
  const raw = Math.floor(props.placement.width / 168)
  return Math.min(RAIL_MAX_VISIBLE, Math.max(RAIL_MIN_VISIBLE, raw))
})

/** 单卡宽度（含间隙之前）：容器宽去掉间隙后平均分 */
const cardWidth = computed(() => {
  const gaps = 12 * (visibleCount.value - 1)
  return Math.max(148, Math.floor((props.placement.width - gaps) / visibleCount.value))
})

/** 轨道总宽（用于 translate 计算） */
const step = computed(() => cardWidth.value + 12)

/** 最多能滚到的 activeIndex，保证右侧不露空 */
const maxIndex = computed(() => Math.max(0, props.cards.length - visibleCount.value))

const offset = computed(() => {
  const target = Math.min(activeIndex.value, maxIndex.value)
  return -target * step.value
})

const trackStyle = computed(() => ({
  width: `${props.cards.length * step.value}px`,
  transform: `translate3d(${offset.value}px, 0, 0)`,
}))

const rootStyle = computed(() => ({
  top: `${props.placement.top}px`,
  left: `${props.placement.left}px`,
  width: `${props.placement.width}px`,
}))

const cardStyle = computed(() => ({ width: `${cardWidth.value}px` }))

const canPrev = computed(() => activeIndex.value > 0)
const canNext = computed(() => activeIndex.value < maxIndex.value)

function setActive(index: number, focus = false): void {
  const next = Math.min(maxIndex.value, Math.max(0, index))
  activeIndex.value = next
  if (focus)
    void nextTick(() => cardRefs.value[next]?.focus({ preventScroll: true }))
}

function stepBy(delta: number, focus = false): void {
  setActive(activeIndex.value + delta, focus)
}

function handleKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault()
      stepBy(-1, true)
      break
    case 'ArrowRight':
      event.preventDefault()
      stepBy(1, true)
      break
    case 'Home':
      event.preventDefault()
      setActive(0, true)
      break
    case 'End':
      event.preventDefault()
      setActive(maxIndex.value, true)
      break
    case 'Enter':
    case ' ': {
      const card = props.cards[activeIndex.value]
      if (!card)
        break
      event.preventDefault()
      if (event.ctrlKey || event.metaKey)
        emit('openNewTab', card.url)
      else
        emit('preview', card.url)
      break
    }
  }
}

/**
 * 滚轮：横向滚轮 / Shift+滚轮切换卡片；纵向滚动交还给页面。
 *
 * 只有「轨道本身已经能横向滚动」时才拦截，避免把正常的页面滚动吃掉。
 */
function handleWheel(event: WheelEvent): void {
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
    ? event.deltaX
    : (event.shiftKey
        ? event.deltaY
        : 0)
  if (!delta)
    return
  event.preventDefault()
  if (Math.abs(delta) < 12)
    return
  stepBy(delta > 0
    ? 1
    : -1)
}

function setCardRef(el: unknown, index: number): void {
  if (el instanceof HTMLElement)
    cardRefs.value[index] = el
}

watch(() => props.cards, () => {
  activeIndex.value = Math.min(activeIndex.value, maxIndex.value)
})

// 焦点在轨道里时拦截左右键（不在轨道里不劫持，避免影响播放器快捷键）
onMounted(() => {
  trackRef.value?.addEventListener('keydown', handleKeydown)
})

/**
 * 键盘 / 指针进入轨道时打开宿主命中。
 *
 * 宿主默认 `pointer-events: none`，鼠标点击若没先触发 pointermove（例如键盘 Tab 进来后
 * 直接点卡片、或用无障碍工具触发 click），宿主仍是 none → B 站委托会改 URL。
 * 这里在轨道根上补 `pointerenter` / `focusin`，确保任何进入轨道的交互都先打开命中。
 */
function onRailFocusIn(): void {
  setHostHitOpen(true)
}

onBeforeUnmount(() => {
  trackRef.value?.removeEventListener('keydown', handleKeydown)
})

/**
 * 卡片激活（第 27 轮真机修复 v2）。
 *
 * 上一版把「捕获阶段拦所有事件」和「冒泡阶段 @click 激活」混在一起，结果
 * `stopImmediatePropagation()` 把同一元素自己的冒泡监听也拦掉了 —— 真机表现是
 * 「既不跳转也不开预览」。现在改成：**捕获阶段一次性完成拦截 + 激活**，
 * 不再依赖冒泡阶段的 @click，也不再调用 stopImmediatePropagation。
 *
 * 事件链路：
 * - 捕获阶段：`preventDefault() + stopPropagation()` —— 拦掉 B 站挂在 document 上的委托
 *   与原生 `<a href>` 的默认跳转；
 * - 用 `event.composedPath()` 找最近的 `.bvp-rail__card`（shadow 边界对 composedPath 透明）；
 * - 命中卡片 → 按修饰键分流：主键 = 内嵌预览（emit preview），中键 / Ctrl / ⌘ / Shift = 新标签页。
 *
 * ⚠️ 不要再给卡片加 `@click`：激活完全在捕获阶段完成，冒泡阶段的监听只会带来
 * 「被自己的 stopPropagation 拦掉」或「触发两次」两类问题（第 27 轮真机各踩过一次）。
 */
function onCaptureClick(event: Event): void {
  if (!(event instanceof MouseEvent))
    return

  // 先拦外层：阻止默认跳转 + 阻止事件继续传播到 document 上的 B 站委托
  event.preventDefault()
  event.stopPropagation()

  const card = findCardFromEvent(event)
  if (!card)
    return

  if (event.type === 'auxclick' || event.button === 1) {
    emit('openNewTab', card.url)
    return
  }
  if (event.button !== 0)
    return
  if (event.ctrlKey || event.metaKey || event.shiftKey)
    emit('openNewTab', card.url)
  else
    emit('preview', card.url)
}

/** 按下阶段只做拦截，不激活（避免中键滚动 / 拖拽链接）；激活统一放在 click / auxclick */
function onCapturePointerDown(event: Event): void {
  // 中键按下时阻止浏览器的自动滚动与「拖拽链接」默认行为
  if (event instanceof MouseEvent && event.button === 1)
    event.preventDefault()
}

/** 从事件路径里找最近的轨道卡片（composedPath 已穿透 shadow 边界） */
function findCardFromEvent(event: Event): RailCard | null {
  const path = typeof event.composedPath === 'function'
    ? event.composedPath()
    : []
  for (const node of path) {
    if (!(node instanceof HTMLElement))
      continue
    if (!node.classList.contains('bvp-rail__card'))
      continue
    const bvid = node.dataset.bvid
    if (!bvid)
      return null
    return props.cards.find(card => card.bvid === bvid) ?? null
  }
  return null
}
</script>

<template>
  <section
    class="bvp-rail"
    :style="rootStyle"
    role="region"
    :aria-label="t.recommendRailTitle"
    @pointerenter="onRailFocusIn"
    @focusin="onRailFocusIn"
    @pointerdown.capture="onCapturePointerDown"
    @click.capture="onCaptureClick"
    @auxclick.capture="onCaptureClick"
  >
    <header class="bvp-rail__head">
      <h2 class="bvp-rail__title">
        {{ t.recommendRailTitle }}
      </h2>
      <div class="bvp-rail__actions">
        <button
          class="bvp-rail__nav"
          type="button"
          :disabled="!canPrev"
          :aria-label="t.recommendRailPrev"
          :title="t.recommendRailPrev"
          @click="stepBy(-1)"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3 5 8l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <button
          class="bvp-rail__nav"
          type="button"
          :disabled="!canNext"
          :aria-label="t.recommendRailNext"
          :title="t.recommendRailNext"
          @click="stepBy(1)"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <button
          class="bvp-rail__close"
          type="button"
          :aria-label="t.recommendRailClose"
          :title="t.recommendRailClose"
          @click="emit('close')"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </header>

    <div
      ref="trackRef"
      class="bvp-rail__viewport"
      :style="{ width: `${placement.width}px` }"
      tabindex="0"
      :aria-label="t.recommendRailHint"
      @wheel="handleWheel"
    >
      <div class="bvp-rail__track" :style="trackStyle">
        <article
          v-for="(card, index) in cards"
          :key="card.bvid"
          :ref="el => setCardRef(el, index)"
          class="bvp-rail__card"
          :class="{ 'is-active': index === activeIndex }"
          :style="cardStyle"
          tabindex="0"
          role="button"
          :aria-label="`${card.title} ${card.upName}`"
          :data-bvid="card.bvid"
          :data-active="index === activeIndex ? '1' : '0'"
          @focus="activeIndex = Math.min(maxIndex, index)"
        >
          <span class="bvp-rail__cover">
            <img
              v-if="card.cover"
              :src="card.cover"
              :alt="card.title"
              loading="lazy"
              decoding="async"
              referrerpolicy="no-referrer"
            >
            <span v-if="card.duration" class="bvp-rail__duration">{{ card.duration }}</span>
          </span>
          <span class="bvp-rail__body">
            <span class="bvp-rail__card-title">{{ card.title }}</span>
            <span class="bvp-rail__meta">
              <span v-if="card.upName" class="bvp-rail__up">{{ card.upName }}</span>
              <span v-if="card.views" class="bvp-rail__views">{{ card.views }}</span>
            </span>
          </span>
        </article>
      </div>
    </div>
  </section>
</template>
