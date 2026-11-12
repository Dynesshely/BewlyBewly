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

/**
 * 加载失败的封面**按 URL** 拉黑（第 31 轮修）。
 *
 * 之前按 bvid 拉黑：早期拍次里 `card.cover` 还是空串 / 相对地址时就渲染过一次，
 * error 之后该 bvid 被永久拉黑，后续即使拿到正确 URL 也不会再渲染（真机表现为 20 张全占位）。
 * 按 URL 拉黑后，bvid 换了新地址会自动重试。
 */
const failedUrls = ref<Set<string>>(new Set())

function markCoverFailed(url: string): void {
  if (!url)
    return
  const next = new Set(failedUrls.value)
  next.add(url)
  failedUrls.value = next
}

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
/**
 * 滚轮切换（第 29 轮用户反馈）。
 *
 * 用户要求：鼠标在轨道里时，**普通垂直滚轮也要横向切卡**，不再需要 Shift 或横向滚轮。
 * - 垂直滚轮：deltaY 走累计阈值（触控板一次滑动会连发很多小 delta，逐帧切换会「刷屏」）；
 * - Shift+滚轮 / 横向滚轮：保持可用，阈值更小（意图更明确）；
 * - 只有轨道**能继续切换**时才 `preventDefault`，否则把滚动让回页面（轨道外页面行为不变）。
 */
const WHEEL_STEP_THRESHOLD = 40
const WHEEL_SWIPE_RESET_MS = 200
let wheelAccumulator = 0
let lastWheelAt = 0

function handleWheel(event: WheelEvent): void {
  // 横向滚轮（触控板左右滑）/ Shift+滚轮：意图明确，小阈值
  const isHorizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey
  const raw = isHorizontalIntent
    ? (Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY)
    : event.deltaY
  if (!raw)
    return

  // 已经到头了：不拦滚动，交还页面（避免轨道边缘「吃掉」滚轮）
  const goingNext = raw > 0
  if ((goingNext && !canNext.value) || (!goingNext && !canPrev.value)) {
    wheelAccumulator = 0
    return
  }

  // 轨道内滚轮一律阻止页面滚动（页面固定布局下本来也不该滚）
  event.preventDefault()

  const now = performance.now()
  // 两次滚动间隔较长 → 视为新的一次手势，不累计
  if (now - lastWheelAt > WHEEL_SWIPE_RESET_MS)
    wheelAccumulator = 0
  lastWheelAt = now

  wheelAccumulator += raw
  const threshold = isHorizontalIntent ? 12 : WHEEL_STEP_THRESHOLD
  if (Math.abs(wheelAccumulator) < threshold)
    return

  const direction = wheelAccumulator > 0
    ? 1
    : -1
  wheelAccumulator = 0
  stepBy(direction)
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
  installWindowCaptureGuards()
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
  uninstallWindowCaptureGuards()
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
    openExternal(card.url)
    return
  }
  if (event.button !== 0)
    return
  if (event.ctrlKey || event.metaKey || event.shiftKey)
    openExternal(card.url)
  else
    openPreview(card.url)
}

/** 按下阶段只做拦截，不激活（避免中键滚动 / 拖拽链接）；激活统一放在 click / auxclick */
function onCapturePointerDown(event: Event): void {
  // 中键按下时阻止浏览器的自动滚动与「拖拽链接」默认行为
  if (event instanceof MouseEvent && event.button === 1)
    event.preventDefault()
}

// #region 第 29 轮：点击绝不改 URL（三步递进 + 兜底自愈）
//
// 真机现象（第 27 轮遗留）：点卡片后 iframe 抽屉打开，但 location.href 变成推荐视频地址。
// 已排除：卡片不在 <a> 内、elementFromPoint 命中正确、click 冒泡被拦。剩下唯一没试的方向是
// **B 站的路由跳转来自 pointerdown / mousedown 阶段的委托，或来自它注册在先的 capture 监听**。
//
// 因此按三步递进（哪一步生效见 docs 与汇报）：
//   a. 卡片 pointerdown/mousedown：preventDefault + stopPropagation + stopImmediatePropagation
//      —— 阻止 click 合成与按下阶段的 B 站处理；
//   b. window 上的 capture 监听（window 捕获早于 document）：命中轨道矩形就整链拦掉；
//   c. 兜底：记录 emit 前的 URL，setTimeout(0) 与 50ms 后用 history.replaceState 改回
//      （抽屉已打开，URL 变化对用户不可见），保证「用户看到的行为」一定正确。

/** 记录预览前的 URL，用于兜底自愈 */
let previewReturnUrl = ''

/** 轨道矩形（视口坐标，含一点内边距，覆盖卡片 hover 浮起的高度） */
function railRectContains(x: number, y: number): boolean {
  const root = trackRef.value?.closest('.bvp-rail') as HTMLElement | null
  if (!root)
    return false
  const rect = root.getBoundingClientRect()
  const pad = 8
  return x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad
}

/**
 * b) window 捕获阶段：命中轨道就拦掉「外层」的委托，早于 document 上 B 站的监听。
 *
 * ⚠️ 关键：**不能 stopImmediatePropagation / stopPropagation 到「拦死自己」**。
 * window 捕获早于所有元素，一旦在这里停掉传播，轨道自己的 section 捕获（激活逻辑）就永远收不到，
 * 表现会和第 27 轮一样「既不跳转也不开预览」。
 * 这里只做 `preventDefault()`（阻止 B 站跳转的默认行为与中键自动滚动），**不阻断传播**，
 * 因此轨道自己的 section 捕获（激活逻辑）照常执行。
 */
function onWindowCapturePointer(event: Event): void {
  if (!(event instanceof MouseEvent))
    return
  if (!railRectContains(event.clientX, event.clientY))
    return
  event.preventDefault()
}

/**
 * a) 卡片按下阶段：阻止默认行为与后续 click 合成。
 *
 * 只对左键/中键生效；右键放行（contextmenu 不在本轮范围）。
 */
function onCardPointerDown(event: Event): void {
  if (!(event instanceof MouseEvent))
    return
  if (event.button !== 0 && event.button !== 1)
    return
  event.preventDefault()
  event.stopPropagation()
  if ('stopImmediatePropagation' in event)
    (event as Event).stopImmediatePropagation()
}

/** c) 兜底：把 URL 改回预览前（抽屉已打开，用户看不到） */
function restoreUrlAfterPreview(): void {
  for (const delay of [0, 50, 200]) {
    window.setTimeout(() => {
      const expected = previewReturnUrl
      if (!expected || location.href === expected)
        return
      try {
        history.replaceState(history.state, '', expected)
      }
      catch {
        // 跨域 / 受限环境：忽略
      }
    }, delay)
  }
}

/** 统一入口：预览（当前标签页内嵌抽屉）+ 记录 URL 供兜底还原 */
function openPreview(url: string): void {
  previewReturnUrl = location.href
  emit('preview', url)
  restoreUrlAfterPreview()
}

/** 统一入口：新标签页（不改变当前页 URL） */
function openExternal(url: string): void {
  previewReturnUrl = location.href
  emit('openNewTab', url)
  restoreUrlAfterPreview()
}

/** 安装 window 捕获监听（组件挂载时） */
function installWindowCaptureGuards(): void {
  for (const type of ['pointerdown', 'mousedown', 'click'] as const)
    window.addEventListener(type, onWindowCapturePointer, true)
}

function uninstallWindowCaptureGuards(): void {
  for (const type of ['pointerdown', 'mousedown', 'click'] as const)
    window.removeEventListener(type, onWindowCapturePointer, true)
}
// #endregion

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
          :data-cover="card.cover ? '1' : '0'"
          :data-failed="failedUrls.has(card.cover) ? '1' : '0'"
          @pointerdown="onCardPointerDown"
          @mousedown="onCardPointerDown"
          @focus="activeIndex = Math.min(maxIndex, index)"
        >
          <span class="bvp-rail__cover">
            <!-- 封面：采集不到 / 加载失败时渲染占位，避免整块留白（第 31 轮） -->
            <img
              v-if="card.cover && !failedUrls.has(card.cover)"
              :src="card.cover"
              :alt="card.title"
              loading="lazy"
              decoding="async"
              referrerpolicy="no-referrer"
              @error="markCoverFailed(card.cover)"
            >
            <span
              v-else
              class="bvp-rail__cover-fallback"
              role="img"
              :aria-label="card.title"
            >
              <span class="bvp-rail__cover-fallback-icon" aria-hidden="true" />
            </span>
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
