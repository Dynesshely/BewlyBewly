<script setup lang="ts">
import type { MomentImage } from '../types'
import { openLinkToNewTab } from '~/utils/main'
import { useMomentsI18n } from '../i18n'
import { downloadImage, imageFileExtension } from '../utils/download'
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
/** 展示用：去掉 @ 尺寸后加宽度限制，避免拉超大图 */
const currentUrl = computed(() => momentImageUrl(currentImage.value?.url, '1600w'))
/** 下载用：完全原始尺寸（不带任何 @ 后缀） */
const originalUrl = computed(() => momentImageUrl(currentImage.value?.url))
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

const downloading = ref(false)
const downloadFailed = ref(false)
let downloadMessageTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 下载当前图：fetch 成 blob 再触发浏览器下载（图床跨域，`<a download>` 会被忽略）。
 * 失败时回退到新标签页打开原图，并提示一句失败原因。
 */
async function handleDownload() {
  const url = originalUrl.value
  if (!url || downloading.value)
    return

  downloading.value = true
  downloadFailed.value = false
  const filename = `bilibili-moments-${Date.now()}-${props.index + 1}.${imageFileExtension(url)}`
  const succeeded = await downloadImage(url, filename)
  downloading.value = false

  if (succeeded)
    return

  downloadFailed.value = true
  openLinkToNewTab(url)
  if (downloadMessageTimer)
    clearTimeout(downloadMessageTimer)
  downloadMessageTimer = setTimeout(() => {
    downloadFailed.value = false
  }, 3000)
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
  if (downloadMessageTimer)
    clearTimeout(downloadMessageTimer)
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
      <img :src="currentUrl" :alt="t('image_alt', { n: index + 1 })" decoding="async" fetchpriority="high">
      <figcaption class="moment-lightbox__caption">
        <span class="moment-lightbox__counter">{{ counter }}</span>
        <span class="moment-lightbox__hint">{{ t('lightbox_hint') }}</span>
        <button
          type="button"
          class="moment-lightbox__download"
          :disabled="downloading"
          @click.stop="handleDownload"
        >
          <span
            :class="downloading ? 'i-tabler:loader-2 is-spinning' : 'i-tabler:download'"
            aria-hidden="true"
          />
          <span>{{ downloading ? t('lightbox_downloading') : t('lightbox_download') }}</span>
        </button>
        <span v-if="downloadFailed" class="moment-lightbox__message">
          {{ t('lightbox_download_failed') }}
        </span>
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
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  justify-content: center;
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

.moment-lightbox__download {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 3px 10px;
  border: 1px solid rgb(255 255 255 / 26%);
  border-radius: 999px;
  background: rgb(255 255 255 / 10%);
  color: #fff;
  font-size: 12px;
  line-height: 1.5;
  cursor: pointer;
  transition:
    background-color 160ms ease,
    opacity 160ms ease;

  &:hover {
    background: rgb(255 255 255 / 20%);
  }

  &:disabled {
    cursor: progress;
    opacity: 0.7;
  }

  &:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }
}

.moment-lightbox__message {
  color: rgb(255 255 255 / 72%);
}

.is-spinning {
  animation: moment-lightbox-spin 720ms linear infinite;
}

@keyframes moment-lightbox-spin {
  to {
    transform: rotate(360deg);
  }
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
  .moment-lightbox__nav,
  .moment-lightbox__download {
    transition: none;
  }

  .is-spinning {
    animation: none;
  }
}

/* #region 窄屏适配（第 17 轮） */
@media (max-width: 640px) {
  .moment-lightbox {
    padding: 12px;
  }

  .moment-lightbox__caption {
    max-width: 100%;
    overflow-wrap: anywhere;
  }

  .moment-lightbox__download {
    max-width: calc(100vw - 24px);
  }
}
/* #endregion */
</style>
