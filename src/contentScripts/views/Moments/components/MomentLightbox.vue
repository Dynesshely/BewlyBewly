<script setup lang="ts">
import type { MomentImage } from '../types'
import { useMomentsI18n } from '../i18n'
import { momentImageUrl } from '../utils/normalize'

const props = defineProps<{
  images: MomentImage[]
  index: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:index', index: number): void
}>()

const { t } = useMomentsI18n()

const closeButtonRef = ref<HTMLButtonElement | null>(null)
const dialogRef = ref<HTMLElement | null>(null)

const currentImage = computed(() => props.images[props.index] ?? props.images[0])
/** 大图用原图、不裁切，只限制宽度避免拉超大图 */
const currentUrl = computed(() => momentImageUrl(currentImage.value?.url, '1600w'))
const counter = computed(() => t('lightbox_counter', {
  current: Math.min(props.index + 1, props.images.length),
  total: props.images.length,
}))

let previousActiveElement: HTMLElement | null = null
let scrollContainer: HTMLElement | null = null
let previousOverflow = ''

function step(delta: number) {
  const total = props.images.length
  if (total <= 1)
    return
  emit('update:index', (props.index + delta + total) % total)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented)
    return

  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    step(-1)
    return
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    step(1)
  }
}

/** 打开时锁住 App 的滚动容器，关闭时还原 */
function lockScroll() {
  scrollContainer = dialogRef.value?.closest('.bewly-scroll-container') ?? null
  if (!scrollContainer)
    return
  previousOverflow = scrollContainer.style.overflow
  scrollContainer.style.overflow = 'hidden'
}

function unlockScroll() {
  if (!scrollContainer)
    return
  scrollContainer.style.overflow = previousOverflow
  scrollContainer = null
}

onMounted(() => {
  previousActiveElement = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null
  lockScroll()
  window.addEventListener('keydown', handleKeydown)
  nextTick(() => closeButtonRef.value?.focus())
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  unlockScroll()
  previousActiveElement?.focus?.()
})
</script>

<template>
  <div
    ref="dialogRef"
    class="moment-lightbox"
    role="dialog"
    aria-modal="true"
    :aria-label="t('lightbox_close')"
    @click.self="emit('close')"
  >
    <button
      ref="closeButtonRef"
      type="button"
      class="moment-lightbox__close"
      :aria-label="t('lightbox_close')"
      @click="emit('close')"
    >
      <span class="i-tabler:x" aria-hidden="true" />
    </button>

    <button
      v-if="images.length > 1"
      type="button"
      class="moment-lightbox__nav is-prev"
      :aria-label="t('lightbox_prev')"
      @click.stop="step(-1)"
    >
      <span class="i-tabler:chevron-left" aria-hidden="true" />
    </button>

    <figure class="moment-lightbox__figure" @click.stop>
      <img :src="currentUrl" :alt="t('image_alt', { n: index + 1 })">
      <figcaption class="moment-lightbox__caption">
        <span class="moment-lightbox__counter">{{ counter }}</span>
        <span class="moment-lightbox__hint">{{ t('lightbox_hint') }}</span>
      </figcaption>
    </figure>

    <button
      v-if="images.length > 1"
      type="button"
      class="moment-lightbox__nav is-next"
      :aria-label="t('lightbox_next')"
      @click.stop="step(1)"
    >
      <span class="i-tabler:chevron-right" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.moment-lightbox {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  background: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(6px);
  animation: moment-lightbox-in 160ms ease-out;
}

.moment-lightbox__figure {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  max-width: min(1200px, 92vw);
  max-height: 100%;
  margin: 0;
}

.moment-lightbox__figure img {
  display: block;
  max-width: 100%;
  max-height: calc(100vh - 160px);
  border-radius: 8px;
  object-fit: contain;
  box-shadow: 0 12px 40px rgb(0 0 0 / 45%);
}

.moment-lightbox__caption {
  display: flex;
  gap: 12px;
  align-items: center;
  color: rgb(255 255 255 / 78%);
  font-size: 12px;
  line-height: 1.5;
}

.moment-lightbox__counter {
  font-variant-numeric: tabular-nums;
}

.moment-lightbox__hint {
  color: rgb(255 255 255 / 50%);
}

.moment-lightbox__close,
.moment-lightbox__nav {
  position: absolute;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgb(255 255 255 / 12%);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  transition:
    background-color 160ms ease,
    transform 160ms ease;

  &:hover {
    background: rgb(255 255 255 / 22%);
  }

  &:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }
}

.moment-lightbox__close {
  top: 20px;
  right: 20px;
}

.moment-lightbox__nav.is-prev {
  top: 50%;
  left: 20px;
  transform: translateY(-50%);
}

.moment-lightbox__nav.is-next {
  top: 50%;
  right: 20px;
  transform: translateY(-50%);
}

@keyframes moment-lightbox-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@media (max-width: 720px) {
  .moment-lightbox {
    padding: 32px 12px;
  }

  .moment-lightbox__nav {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .moment-lightbox {
    animation: none;
  }

  .moment-lightbox__close,
  .moment-lightbox__nav {
    transition: none;
  }
}
</style>
