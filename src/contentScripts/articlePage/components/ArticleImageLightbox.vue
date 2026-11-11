<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

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

const current = computed(() => ui.lightbox.images[ui.lightbox.index] ?? '')
const canPrev = computed(() => ui.lightbox.index > 0)
const canNext = computed(() => ui.lightbox.index < ui.lightbox.images.length - 1)
const hasMultiple = computed(() => ui.lightbox.images.length > 1)

watch(() => ui.lightbox.open, async (open) => {
  if (!open)
    return
  await nextTick()
  closeRef.value?.focus({ preventScroll: true })
})
</script>

<template>
  <Transition name="bap-fade">
    <div
      v-if="ui.lightbox.open"
      class="bap-lightbox"
      role="dialog"
      aria-modal="true"
      :aria-label="t.imageViewer"
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
        v-if="current"
        class="bap-lightbox__image"
        :src="current"
        alt=""
        draggable="false"
        @click.stop
      >

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
