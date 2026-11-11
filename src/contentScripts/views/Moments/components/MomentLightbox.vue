<script setup lang="ts">
import type { MomentImage } from '../types'
import FallbackImage from '~/components/Feedback/FallbackImage.vue'
import SkeletonBlock from '~/components/Feedback/SkeletonBlock.vue'
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

// #region 大图加载兜底（第 20 轮）：加载中骨架、失败用统一占位、切图重置
/** 当前大图是否仍在加载 */
const imageLoading = ref(true)
/** 当前大图是否加载失败：失败后不再重试，切图时重置 */
const imageFailed = ref(false)

/** 占位阶段给舞台一个稳定尺寸，避免骨架 → 图片切换时布局跳动 */
const showPlaceholder = computed(() => imageLoading.value || imageFailed.value)
const stageStyle = computed<Record<string, string> | undefined>(() => showPlaceholder.value
  ? {
      minHeight: 'min(52vh, 360px)',
      minWidth: 'min(520px, 84vw)',
    }
  : undefined)

const imageRef = ref<HTMLImageElement | null>(null)

function handleImageLoad() {
  imageLoading.value = false
}

function handleImageError() {
  imageLoading.value = false
  imageFailed.value = true
}

/**
 * 缓存命中时 `load` 可能在 watcher 之前就已完成，`complete` 兜底同步一次状态，
 * 避免骨架一直挂着。
 */
function syncImageState() {
  const img = imageRef.value
  if (!img || !img.complete)
    return
  if (img.naturalWidth > 0) {
    imageLoading.value = false
    imageFailed.value = false
  }
  else {
    imageLoading.value = false
    imageFailed.value = true
  }
}

watch(currentUrl, async () => {
  imageLoading.value = true
  imageFailed.value = false
  await nextTick()
  syncImageState()
})
// #endregion

// #region 键盘可达性（第 19/20 轮）：打开聚焦 / shadowRoot capture 焦点陷阱 / Esc 不穿透 / 关闭焦点回归
let previousActiveElement: HTMLElement | null = null
let trappedRoot: ShadowRoot | Document | null = null
/** 正在关闭：卸载时恢复焦点期间不再拦截 focusin */
let closing = false

/** 穿透 shadow root 找真正获得焦点的元素（document.activeElement 只会返回 host） */
function activeElementDeep(): HTMLElement | null {
  let el = document.activeElement as HTMLElement | null
  while (el?.shadowRoot?.activeElement)
    el = el.shadowRoot.activeElement as HTMLElement
  return el
}

/** 灯箱内真实可聚焦元素（排除隐藏 / 禁用 / tabindex=-1） */
function panelFocusables(): HTMLElement[] {
  const root = dialogRef.value
  if (!root)
    return []
  return Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter(el => el.getClientRects().length > 0)
}

/** 焦点在灯箱内循环；没有可聚焦元素时聚焦对话框本身（tabindex=-1） */
function moveFocusInPanel(backward: boolean): void {
  const items = panelFocusables()
  if (!items.length) {
    dialogRef.value?.focus({ preventScroll: true })
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

/** 捕获阶段拦下 Tab：必须 preventDefault，否则浏览器默认行为会把焦点移出灯箱 */
function onTabCapture(event: Event): void {
  if (!(event instanceof KeyboardEvent) || event.key !== 'Tab')
    return
  event.preventDefault()
  event.stopPropagation()
  moveFocusInPanel(event.shiftKey)
}

/**
 * 灯箱打开期间接管 Esc / ← / →。
 *
 * 挂在 `getRootNode()`（#bewly 的 ShadowRoot）的 **捕获阶段** 并 stopPropagation：
 * 页面与全局快捷键都监听在 bubble 阶段的 `window` 上，这样灯箱关闭键不会穿透到下层。
 */
function onKeyCapture(event: Event): void {
  if (!(event instanceof KeyboardEvent))
    return

  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    emit('close')
    return
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    event.stopPropagation()
    step(-1)
    return
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    event.stopPropagation()
    step(1)
  }
}

/**
 * 焦点跑到灯箱外（例如点击了图片、遮罩空白处）时拉回来。
 *
 * 不做这一步的话，焦点会落到 body，随后的 Tab 从 body 开始走、绕过 ShadowRoot 捕获陷阱。
 */
function onFocusInCapture(event: FocusEvent) {
  const root = dialogRef.value
  if (!root || closing)
    return
  const target = event.target
  if (target instanceof Node && root.contains(target))
    return
  const focusables = panelFocusables()
  const fallback = focusables[0] ?? root
  fallback.focus({ preventScroll: true })
}

/** 事件发生在 shadow root 内：监听挂到灯箱所在的 root（ShadowRoot / Document） */
function bindKeyTrap(): void {
  unbindKeyTrap()
  const node = dialogRef.value?.getRootNode()
  if (node instanceof ShadowRoot || node instanceof Document) {
    trappedRoot = node
    node.addEventListener('keydown', onTabCapture, true)
    node.addEventListener('keydown', onKeyCapture, true)
  }
  document.addEventListener('focusin', onFocusInCapture, true)
}

function unbindKeyTrap(): void {
  document.removeEventListener('focusin', onFocusInCapture, true)
  if (!trappedRoot)
    return
  trappedRoot.removeEventListener('keydown', onTabCapture, true)
  trappedRoot.removeEventListener('keydown', onKeyCapture, true)
  trappedRoot = null
}
// #endregion

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

onMounted(async () => {
  // 打开灯箱的图片按钮（MomentMedia 在 click 时会把焦点交给它）
  previousActiveElement = activeElementDeep()
  lockScroll()
  await nextTick()
  bindKeyTrap()
  syncImageState()
  const focusables = panelFocusables()
  if (focusables.length)
    focusables[0]?.focus({ preventScroll: true })
  else
    dialogRef.value?.focus({ preventScroll: true })
})

onBeforeUnmount(() => {
  closing = true
  unbindKeyTrap()
  if (downloadMessageTimer)
    clearTimeout(downloadMessageTimer)
  unlockScroll()
  // 关闭后焦点回到打开它的那张图片
  if (previousActiveElement?.isConnected)
    previousActiveElement.focus({ preventScroll: false })
  previousActiveElement = null
})
</script>

<template>
  <div
    ref="dialogRef"
    class="moment-lightbox"
    role="dialog"
    aria-modal="true"
    :aria-label="t('lightbox_title')"
    tabindex="-1"
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
      <div class="moment-lightbox__stage" :style="stageStyle">
        <img
          v-if="!imageFailed"
          ref="imageRef"
          :key="currentUrl"
          class="moment-lightbox__image"
          :src="currentUrl"
          :alt="t('image_alt', { n: index + 1 })"
          decoding="async"
          fetchpriority="high"
          @load="handleImageLoad"
          @error="handleImageError"
        >
        <SkeletonBlock
          v-if="imageLoading && !imageFailed"
          class="moment-lightbox__skeleton"
          height="100%"
          :radius="8"
        />
        <FallbackImage
          v-else-if="imageFailed"
          class="moment-lightbox__fallback"
          kind="image"
          :text="t('lightbox_image_failed')"
          :aria-label="t('lightbox_image_failed')"
        />
      </div>
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

.moment-lightbox__stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  max-height: calc(100vh - 160px);
  border-radius: 8px;
}

.moment-lightbox__image {
  display: block;
  max-width: 100%;
  max-height: calc(100vh - 160px);
  border-radius: 8px;
  object-fit: contain;
  box-shadow: 0 12px 40px rgb(0 0 0 / 45%);
}

/* 加载中骨架铺满舞台占位，图片加载完成后一起移除，避免空白闪烁 */
.moment-lightbox__skeleton {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.moment-lightbox__fallback {
  width: min(720px, 88vw);
  min-height: min(52vh, 360px);
  border-radius: 8px;
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
