<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import FallbackImage from '~/components/Feedback/FallbackImage.vue'

import { useMessages } from '../i18n'
import { closeLightbox, stepLightboxImage } from '../lightbox'
import { ui } from '../state'

/**
 * 正文图片大图浮层。
 *
 * 只在点击正文图片后渲染（ui.lightbox.open），关闭后 DOM 上不留节点。
 * 交互：点击遮罩 / 关闭按钮关闭，←/→ 或两侧按钮切换同文图片，Esc 由 shortcuts.ts 统一处理。
 * 打开时把焦点送到关闭按钮，键盘用户可以直接用方向键与 Esc。
 */
const t = useMessages()

const closeRef = ref<HTMLButtonElement | null>(null)
/** 当前大图是否加载失败：失败后不再重试、不发新请求；切换图片时重置 */
const imageFailed = ref(false)

// #region 键盘可达性（第 19 轮）：打开聚焦 / shadowRoot capture 焦点陷阱 / 关闭恢复
const rootRef = ref<HTMLElement | null>(null)
let restoreFocusTo: HTMLElement | null = null
let trappedRoot: ShadowRoot | Document | null = null

/** 穿透 shadow root 找真正获得焦点的元素（document.activeElement 只会返回 host） */
function activeElementDeep(): HTMLElement | null {
  let el = document.activeElement as HTMLElement | null
  while (el?.shadowRoot?.activeElement)
    el = el.shadowRoot.activeElement as HTMLElement
  return el
}

/** 面板内真实可聚焦元素（排除隐藏 / 禁用 / tabindex=-1） */
function panelFocusables(): HTMLElement[] {
  const root = rootRef.value
  if (!root)
    return []
  return Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter(el => el.getClientRects().length > 0)
}

/** 焦点在面板内循环；没有可聚焦元素时聚焦面板容器本身（tabindex=-1） */
function moveFocusInPanel(backward: boolean): void {
  const items = panelFocusables()
  if (!items.length) {
    rootRef.value?.focus({ preventScroll: true })
    return
  }
  const active = activeElementDeep()
  const current = active
    ? items.indexOf(active)
    : -1
  const next = current < 0
    ? (backward
        ? items.length - 1
        : 0)
    : (current + (backward
        ? -1
        : 1) + items.length) % items.length
  items[next]?.focus({ preventScroll: true })
}

/** 捕获阶段拦下 Tab：必须 preventDefault，否则浏览器默认行为会把焦点移出面板 */
function onTabCapture(event: Event): void {
  if (!(event instanceof KeyboardEvent) || event.key !== 'Tab')
    return
  event.preventDefault()
  event.stopPropagation()
  moveFocusInPanel(event.shiftKey)
}

/** 事件发生在 shadow root 内：监听挂到面板所在的 root（ShadowRoot / Document） */
function bindTabTrap(): void {
  unbindTabTrap()
  const node = rootRef.value?.getRootNode()
  if (node instanceof ShadowRoot || node instanceof Document) {
    trappedRoot = node
    node.addEventListener('keydown', onTabCapture, true)
  }
}

function unbindTabTrap(): void {
  if (trappedRoot) {
    trappedRoot.removeEventListener('keydown', onTabCapture, true)
    trappedRoot = null
  }
}

watch(() => ui.lightbox.open, async (open) => {
  if (!open) {
    unbindTabTrap()
    restoreFocusTo?.focus?.({ preventScroll: true })
    restoreFocusTo = null
    return
  }
  restoreFocusTo = activeElementDeep()
  await nextTick()
  bindTabTrap()
  imageFailed.value = false
  const items = panelFocusables()
  if (items.length)
    items[0]?.focus({ preventScroll: true })
  else
    rootRef.value?.focus({ preventScroll: true })
})

onBeforeUnmount(unbindTabTrap)
// #endregion

const current = computed(() => ui.lightbox.images[ui.lightbox.index] ?? '')
const canPrev = computed(() => ui.lightbox.index > 0)
const canNext = computed(() => ui.lightbox.index < ui.lightbox.images.length - 1)
const hasMultiple = computed(() => ui.lightbox.images.length > 1)

/** 同一张图只失败一次；切换图片（current 变化）时重置，给新图重新尝试的机会 */
watch(current, () => {
  imageFailed.value = false
})
</script>

<template>
  <Transition name="bap-fade">
    <div
      v-if="ui.lightbox.open"
      ref="rootRef"
      class="bap-lightbox"
      role="dialog"
      aria-modal="true"
      :aria-label="t.imageViewer"
      tabindex="-1"

      @click.self="closeLightbox()"
    >
      <button
        ref="closeRef"
        type="button"
        class="bap-lightbox__btn bap-lightbox__close"
        :aria-label="t.close"
        :title="t.close"
        @click="closeLightbox()"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>

      <button
        v-if="hasMultiple"
        type="button"
        class="bap-lightbox__btn bap-lightbox__nav is-prev"
        :disabled="!canPrev"
        :aria-label="t.imagePrev"
        :title="t.imagePrev"
        @click.stop="stepLightboxImage(-1)"
      >
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 3 5 8l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <img
        v-if="current && !imageFailed"
        class="bap-lightbox__image"
        :src="current"
        alt=""
        draggable="false"
        @click.stop
        @error="imageFailed = true"
      >
      <FallbackImage
        v-else-if="current"
        class="bap-lightbox__fallback"
        kind="image"
        :text="t.imageFallback"
      />

      <button
        v-if="hasMultiple"
        type="button"
        class="bap-lightbox__btn bap-lightbox__nav is-next"
        :disabled="!canNext"
        :aria-label="t.imageNext"
        :title="t.imageNext"
        @click.stop="stepLightboxImage(1)"
      >
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <p class="bap-lightbox__hint">
        <span v-if="hasMultiple" class="bap-lightbox__counter">{{ ui.lightbox.index + 1 }} / {{ ui.lightbox.images.length }}</span>
        <span>{{ t.imageHint }}</span>
      </p>
    </div>
  </Transition>
</template>
