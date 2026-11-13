<script setup lang="ts">
import { useEventListener } from '@vueuse/core'

import { DRAWER_VIDEO_ENTER_PAGE_FULL, DRAWER_VIDEO_EXIT_PAGE_FULL } from '~/constants/globalEvents'
import { settings } from '~/logic'
import { isHomePage, isInIframe } from '~/utils/main'
import { resolveModuleLocale } from '~/utils/moduleI18n'

// TODO: support shortcuts like `Ctrl+Alt+T` to open in new tab, `Esc` to close

const props = defineProps<{
  url: string
  title?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const show = ref(false)
const headerShow = ref(false)
const iframeRef = ref<HTMLIFrameElement | null>(null)
const currentUrl = ref<string>(props.url)
const showIframe = ref<boolean>(false)
const delayCloseTimer = ref<NodeJS.Timeout | null>(null)
const removeTopBarClassInjected = ref<boolean>(false)

/* #region 抽屉内导航栈（前进 / 后退） */

/** 轮询 iframe 当前 URL 的间隔（跨文档导航后同源仍可读 location.href） */
const NAV_POLL_INTERVAL = 500
/** back / forward 发出后等待 iframe 响应的兜底时间：超时就不再认作「历史导航」 */
const NAV_PENDING_TIMEOUT = 2000

/** 导航栈（normalize 后的 URL） */
const navStack = ref<string[]>([])
/** 当前在栈中的位置 */
const navIndex = ref(-1)
/** 正在等待 iframe 响应的历史导航方向 */
const pendingDirection = ref<'back' | 'forward' | null>(null)
/** iframe 是否仍可访问（跨域 / 已被移除时为 false，按钮直接 disabled） */
const iframeAccessible = ref<boolean>(true)
/** 用户是否主动导航过（首次加载的重定向不应变成一条历史记录） */
const hasUserNavigated = ref<boolean>(false)
/** iframe 首次 load 是否已完成（完成后的 URL 变化才是真实导航） */
const firstLoadDone = ref<boolean>(false)

let navPollTimer: ReturnType<typeof setInterval> | null = null
let pendingTimer: ReturnType<typeof setTimeout> | null = null
/** navigateTo 的目标地址：把紧随其后的同源重定向（如 spm 参数）并进同一条历史 */
let pendingTargetUrl: string | null = null
let pendingTargetExpireAt = 0

/** URL 归一化：只去掉末尾斜杠，避免同一页面因尾斜杠被记成两条历史 */
function normalizeDrawerUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

function clearPendingTarget(): void {
  pendingTargetUrl = null
  pendingTargetExpireAt = 0
}

function clearPendingDirection(): void {
  pendingDirection.value = null
  if (pendingTimer) {
    clearTimeout(pendingTimer)
    pendingTimer = null
  }
}

function armPendingTimeout(): void {
  if (pendingTimer)
    clearTimeout(pendingTimer)
  pendingTimer = setTimeout(() => {
    pendingTimer = null
    pendingDirection.value = null
  }, NAV_PENDING_TIMEOUT)
}

/** 读 iframe 当前 URL；不可访问（跨域 / iframe 已移除）时返回 null，不抛错 */
function readIframeUrl(): string | null {
  try {
    const win = iframeRef.value?.contentWindow
    if (!win)
      return null
    const href = win.location.href
    if (!href || href === 'about:blank')
      return null
    return normalizeDrawerUrl(href)
  }
  catch {
    // 跨域或 iframe 已销毁：视为不可访问
    return null
  }
}

function resetNavStack(initialUrl?: string): void {
  clearPendingDirection()
  const initial = initialUrl
    ? normalizeDrawerUrl(initialUrl)
    : ''
  navStack.value = initial && initial !== 'about:blank'
    ? [initial]
    : []
  navIndex.value = navStack.value.length - 1
  hasUserNavigated.value = false
  firstLoadDone.value = false
}

/** 把新 URL 记入导航栈：截断「前进」部分后追加；首次加载阶段替换栈顶 */
function pushNavUrl(url: string): void {
  const normalized = normalizeDrawerUrl(url)
  if (!normalized || normalized === 'about:blank')
    return

  const current = navStack.value[navIndex.value]
  if (current === normalized)
    return

  // 首次加载 / B 站自身的重定向：替换栈顶，不产生「可后退」
  if (!firstLoadDone.value && !hasUserNavigated.value) {
    const next = [...navStack.value]
    if (next.length === 0)
      next.push(normalized)
    else
      next[navIndex.value] = normalized
    navStack.value = next
    if (navIndex.value < 0)
      navIndex.value = 0
    return
  }

  // 主动导航：截断 forward 后追加
  const truncated = navStack.value.slice(0, navIndex.value + 1)
  truncated.push(normalized)
  navStack.value = truncated
  navIndex.value = truncated.length - 1
}

const drawerNavLabels = computed(() => {
  const locale = resolveModuleLocale(settings.value.language)
  const dict = {
    'cmn-CN': { back: '后退', forward: '前进' },
    'cmn-TW': { back: '上一頁', forward: '下一頁' },
    'jyut': { back: '返上一頁', forward: '去下一頁' },
    'en': { back: 'Back', forward: 'Forward' },
  }
  return dict[locale]
})

const canNavigate = computed(() => iframeAccessible.value && !isInIframe())
const canBack = computed(() => canNavigate.value && navIndex.value > 0)
const canForward = computed(() => canNavigate.value && navIndex.value < navStack.value.length - 1)

/** 外部（App.vue）在抽屉已打开时改导航目标：同 iframe 内跳转并记入栈，不重建 iframe */
function navigateTo(url: string): void {
  if (!url)
    return
  const normalized = normalizeDrawerUrl(url)
  const iframe = iframeRef.value
  if (!iframe)
    return

  hasUserNavigated.value = true
  clearPendingDirection()
  pendingTargetUrl = normalized
  pendingTargetExpireAt = Date.now() + NAV_PENDING_TIMEOUT

  try {
    const win = iframe.contentWindow
    if (win)
      win.location.href = normalized
    else
      iframe.src = normalized
  }
  catch {
    // 跨域 / 子窗口不可用时退回改 src（会重建文档，但至少能跳过去）
    iframe.src = normalized
  }

  currentUrl.value = normalized
  pushNavUrl(normalized)
}

function goBack(): void {
  if (!canBack.value || !iframeRef.value)
    return
  hasUserNavigated.value = true
  pendingDirection.value = 'back'
  armPendingTimeout()
  try {
    iframeRef.value.contentWindow?.history.back()
  }
  catch {
    clearPendingDirection()
  }
}

function goForward(): void {
  if (!canForward.value || !iframeRef.value)
    return
  hasUserNavigated.value = true
  pendingDirection.value = 'forward'
  armPendingTimeout()
  try {
    iframeRef.value.contentWindow?.history.forward()
  }
  catch {
    clearPendingDirection()
  }
}

/**
 * 500ms 轮询 iframe URL，维护导航栈。
 *
 * - URL 变化且来自我们的 back / forward（能对上栈里相邻项）→ 只移动 index；
 * - 其它变化（用户点了 iframe 内链接 / B 站 SPA 跳转）→ push 并截断 forward；
 * - contentWindow 不可访问 → 按钮 disabled，不抛错。
 */
function pollIframeUrl(): void {
  if (!iframeRef.value)
    return

  const href = readIframeUrl()
  if (href === null) {
    iframeAccessible.value = false
    return
  }
  iframeAccessible.value = true
  currentUrl.value = href

  if (href === navStack.value[navIndex.value])
    return

  // navigateTo 之后紧跟的同页面重定向（B 站常加 spm_id_from 等参数）：
  // 并进同一条历史，避免「点一次推荐却要后退两步」。
  if (pendingTargetUrl && Date.now() <= pendingTargetExpireAt) {
    try {
      const target = new URL(pendingTargetUrl)
      const actual = new URL(href)
      if (target.origin === actual.origin && target.pathname === actual.pathname) {
        const next = [...navStack.value]
        next[navIndex.value] = href
        navStack.value = next
        clearPendingTarget()
        return
      }
    }
    catch {
      // URL 解析失败时按普通导航处理
    }
  }
  clearPendingTarget()

  if (pendingDirection.value === 'back') {
    const previous = navStack.value[navIndex.value - 1]
    if (previous === href) {
      navIndex.value -= 1
      clearPendingDirection()
      return
    }
    clearPendingDirection()
  }
  else if (pendingDirection.value === 'forward') {
    const next = navStack.value[navIndex.value + 1]
    if (next === href) {
      navIndex.value += 1
      clearPendingDirection()
      return
    }
    clearPendingDirection()
  }

  // 首次加载完成前出现的 URL（B 站重定向等）只替换栈顶，不算用户导航；
  // 之后的变化才是真实导航，要 push 并截断 forward。
  if (firstLoadDone.value)
    hasUserNavigated.value = true
  pushNavUrl(href)
}

/* #endregion */

useEventListener(window, 'popstate', updateIframeUrl)
nextTick(() => {
  useEventListener(iframeRef.value?.contentWindow, 'historyChange', updateCurrentUrl)
  useEventListener(iframeRef.value?.contentWindow, 'popstate', updateCurrentUrl)

  useEventListener(iframeRef.value?.contentWindow, 'DOMContentLoaded', () => {
    if (headerShow.value) {
      iframeRef.value?.contentWindow?.document.documentElement.classList.add('remove-top-bar-without-placeholder')
      removeTopBarClassInjected.value = true
    }
    else {
      iframeRef.value?.contentWindow?.document.documentElement.classList.remove('remove-top-bar-without-placeholder')
      removeTopBarClassInjected.value = false
    }
  })
})

onMounted(() => {
  // 兜底：抽屉只允许出现在顶层页面，iframe 内不再嵌套第二层抽屉
  // （App.vue 已把 iframe 内的 openIframeDrawer 改成 location.href，这里再防一层）
  if (isInIframe())
    return

  history.pushState(null, '', props.url)
  show.value = true
  headerShow.value = true
  // 每次打开抽屉都从当前地址重新建栈（关闭时已清空）
  resetNavStack(props.url)
  startNavPolling()
  nextTick(() => {
    // 先聚焦 iframe 元素，再把焦点交给其子文档，避免首次按键被父页面截获
    iframeRef.value?.focus()
    try {
      iframeRef.value?.contentWindow?.focus()
    }
    catch {
      // 跨域时忽略
    }
  })
})

onBeforeUnmount(() => {
  stopNavPolling()
  clearPendingDirection()
  releaseIframeResources()
})

onUnmounted(() => {
  history.replaceState(null, '', 'https://www.bilibili.com')
})

function updateCurrentUrl() {
  if (iframeRef.value?.contentWindow) {
    try {
      currentUrl.value = iframeRef.value.contentWindow.location.href.replace(/\/$/, '')
      history.pushState(null, '', currentUrl.value.replace(/\/$/, ''))
    }
    catch (error) {
      console.error('Unable to access iframe URL:', error)
    }
  }
}

async function updateIframeUrl() {
  if (isHomePage()) {
    await handleClose()
    return
  }
  await nextTick()

  if (iframeRef.value?.contentWindow) {
    iframeRef.value.contentWindow.location.replace(location.href.replace(/\/$/, ''))
  }
}

async function handleClose() {
  if (delayCloseTimer.value) {
    clearTimeout(delayCloseTimer.value)
  }
  // 关闭后栈必须重置：下次打开另一个视频时「后退」应是 disabled
  stopNavPolling()
  resetNavStack()
  await releaseIframeResources()
  show.value = false
  headerShow.value = false
  delayCloseTimer.value = setTimeout(() => {
    emit('close')
  }, 300)
}

function startNavPolling(): void {
  stopNavPolling()
  navPollTimer = setInterval(pollIframeUrl, NAV_POLL_INTERVAL)
}

function stopNavPolling(): void {
  if (navPollTimer) {
    clearInterval(navPollTimer)
    navPollTimer = null
  }
}

async function releaseIframeResources() {
  // Clear iframe content
  currentUrl.value = 'about:blank'
  /**
   * eg: When use 'iframeRef.value?.contentWindow?.document' of t.bilibili.com iframe on bilibili.com, there may be cross domain issues
   * set the src to 'about:blank' to avoid this issue, it also can release the memory
   */
  if (iframeRef.value) {
    iframeRef.value.src = 'about:blank'
  }
  await nextTick()
  iframeRef.value?.contentWindow?.close()

  // Remove iframe from the DOM
  iframeRef.value?.parentNode?.removeChild(iframeRef.value)
  await nextTick()

  // Nullify the reference
  iframeRef.value = null
}

/** iframe 每次加载完成：显示内容、并把 Esc 监听重新挂到新的子文档上 */
function onIframeLoad() {
  showIframe.value = true
  bindIframeEscListener()

  // 只在首次 load 时同步栈顶（把 props.url 归一化后 / B 站重定向的最终地址记下来）；
  // 之后的每次 load 都交给 500ms 轮询处理，避免把 back / forward 的结果误记成新条目。
  if (!firstLoadDone.value) {
    const href = readIframeUrl()
    if (href)
      pushNavUrl(href)
    firstLoadDone.value = true
  }
}

function handleOpenInNewTab() {
  if (iframeRef.value) {
    window.open(iframeRef.value.contentWindow?.location.href.replace(/\/$/, ''), '_blank')
    handleClose()
  }
}

const isEscPressed = ref<boolean>(false)
const escPressedTimer = ref<NodeJS.Timeout | null>(null)
const disableEscPress = ref<boolean>(false)

/**
 * Esc 关闭抽屉。
 *
 * 之前只把监听挂在 iframe 的 contentWindow 上，导致两种情形失效：
 * - 抽屉刚打开时焦点还在父窗口（iframe.focus() 不会把焦点交给 iframe 的子文档），
 *   此时按 Esc 事件只在父页面派发，抽屉收不到；
 * - 用户必须先用鼠标点进 iframe 区域，Esc 才生效。
 *
 * 现在父窗口与 iframe 子文档各挂一份：两者的事件不会冒泡到对方，不存在重复触发。
 */
function handleEscKeydown(e: KeyboardEvent) {
  e.preventDefault()
  if (settings.value.closeDrawerWithoutPressingEscAgain) {
    if (escPressedTimer.value)
      clearTimeout(escPressedTimer.value)
    handleClose()
    return
  }
  if (disableEscPress.value)
    return
  if (isEscPressed.value) {
    handleClose()
  }
  else {
    isEscPressed.value = true
    if (escPressedTimer.value)
      clearTimeout(escPressedTimer.value)
    escPressedTimer.value = setTimeout(() => {
      isEscPressed.value = false
    }, 1300)
  }
}

// 父窗口：抽屉打开后焦点通常仍停留在父页面
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape')
    handleEscKeydown(e)
})

// iframe 子文档：焦点在预览页里时由它兜底。
// 每次 load 都要重新注册 —— 同源导航后旧文档的监听会随旧 window 一起丢弃。
let escBoundWindow: Window | null = null
function bindIframeEscListener() {
  const win = iframeRef.value?.contentWindow
  if (!win || win === escBoundWindow)
    return
  escBoundWindow = win
  win.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape')
      handleEscKeydown(e)
  })
}
watch(iframeRef, bindIframeEscListener, { immediate: true })

watchEffect(() => {
  if (isInIframe())
    return null

  useEventListener(window, 'message', ({ data }) => {
    switch (data) {
      case DRAWER_VIDEO_ENTER_PAGE_FULL:
        headerShow.value = false
        disableEscPress.value = true
        break
      case DRAWER_VIDEO_EXIT_PAGE_FULL:
        headerShow.value = true
        disableEscPress.value = false
        break
    }
  })
})

/**
 * 对外暴露：抽屉已打开时把 iframe 导航到新地址（App.vue 的 openIframeDrawer 调用），
 * 同 iframe、不重建；新地址会记入导航栈。
 */
defineExpose({ navigateTo })

// const keys = useMagicKeys()
// const ctrlAltT = keys['Ctrl+Alt+T']

// watch(() => ctrlAltT, (value) => {
//   if (value) {
//     handleOpenInNewTab()
//   }
// })
</script>

<template>
  <div
    class="bewly-iframe-drawer"
    pos="absolute top-0 left-0" of-hidden w-full h-full
    z-999999
  >
    <!-- Mask -->
    <Transition name="fade">
      <div
        v-if="show"
        pos="absolute bottom-0 left-0" w-full h-full bg="black opacity-60"
        @click="handleClose"
      />
    </Transition>

    <Transition name="fade">
      <div
        v-if="headerShow"
        pos="relative top-0" flex="~ items-center justify-end gap-2"
        max-w="$bew-page-max-width" w-full h="$bew-top-bar-height"
        m-auto px-4
        pointer-events-none
      >
        <Tooltip
          class="bewly-iframe-drawer__nav mr-auto pointer-events-auto"
          :content="drawerNavLabels.back"
          :data-disabled="!canBack"
          placement="bottom"
          type="dark"
        >
          <Button
            style="
              --b-button-color: var(--bew-elevated-solid);
              --b-button-color-hover: var(--bew-elevated-solid-hover);
            "
            pointer-events-auto
            :disabled="!canBack"
            :aria-label="drawerNavLabels.back"
            :title="drawerNavLabels.back"
            @click="goBack"
          >
            <template #left>
              <i i-mingcute:arrow-left-line />
            </template>
          </Button>
        </Tooltip>
        <Tooltip
          class="bewly-iframe-drawer__nav pointer-events-auto"
          :content="drawerNavLabels.forward"
          :data-disabled="!canForward"
          placement="bottom"
          type="dark"
        >
          <Button
            style="
              --b-button-color: var(--bew-elevated-solid);
              --b-button-color-hover: var(--bew-elevated-solid-hover);
            "
            pointer-events-auto
            :disabled="!canForward"
            :aria-label="drawerNavLabels.forward"
            :title="drawerNavLabels.forward"
            @click="goForward"
          >
            <template #left>
              <i i-mingcute:arrow-right-line />
            </template>
          </Button>
        </Tooltip>
        <Button
          style="
            --b-button-color: var(--bew-elevated-solid);
            --b-button-color-hover: var(--bew-elevated-solid-hover);
          "
          pointer-events-auto
          @click="handleOpenInNewTab"
        >
          <template #left>
            <i i-mingcute:external-link-line />
          </template>
          {{ $t('iframe_drawer.open_in_new_tab') }}
          <!-- <div flex="~">
            <kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>T</kbd>
          </div> -->
        </Button>
        <Button
          v-if="!isEscPressed"
          style="
            --b-button-color: var(--bew-elevated-solid);
            --b-button-color-hover: var(--bew-elevated-solid-hover);
          "
          pointer-events-auto
          @click="handleClose"
        >
          <template #left>
            <i i-mingcute:close-line />
          </template>
          {{ $t('iframe_drawer.close') }}
          <kbd>Esc</kbd>
        </Button>
        <Button
          v-else
          type="error"
          @click="handleClose"
        >
          <template #left>
            <i i-mingcute:close-line />
          </template>
          {{ $t('iframe_drawer.press_esc_again_to_close') }}
          <kbd>Esc</kbd>
        </Button>
      </div>
    </Transition>

    <!-- Iframe -->
    <Transition name="drawer">
      <div
        v-if="show"
        :pos="`absolute ${headerShow ? 'top-$bew-top-bar-height' : 'top-0'} left-0`" of-hidden bg="$bew-bg"
        rounded="t-$bew-radius" w-full h-full
      >
        <Transition name="fade">
          <iframe
            v-show="showIframe"
            ref="iframeRef"
            :src="props.url"
            :style="{
              // Prevent top bar shaking when before the remove-top-bar-without-placeholder class is injected
              top: !removeTopBarClassInjected ? `calc(-1 * var(--bew-top-bar-height))` : '0',
            }"
            frameborder="0"
            pointer-events-auto
            pos="relative left-0"
            w-full
            h-full @load="onIframeLoad"
          />
        </Transition>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.3s;
}

.drawer-enter-from,
.drawer-leave-to {
  transform: translateY(100%);
}

/* 前进 / 后退：Tooltip 的浮层要盖在 iframe 之上（iframe 容器在 DOM 后面） */
.bewly-iframe-drawer__nav {
  position: relative;
  z-index: 2;
}

/* 前进 / 后退：disabled 时半透明且不可点（原生 disabled 已拦住 click，这里只补视觉） */
.bewly-iframe-drawer__nav[data-disabled="true"] :deep(.b-button) {
  cursor: default;
  opacity: 0.45;
}

.bewly-iframe-drawer__nav[data-disabled="true"] :deep(.b-button:hover) {
  background-color: var(--bew-elevated-solid);
}
</style>
