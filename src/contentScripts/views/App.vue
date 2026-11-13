<script setup lang="ts">
import type { Ref } from 'vue'
import type { BewlyAppProvider } from '~/composables/useAppProvider'

import type { DockItem } from '~/stores/mainStore'
import { useEventListener, useThrottleFn, useToggle } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useDark } from '~/composables/useDark'
import { useFocusBrowse } from '~/composables/useFocusBrowse'
import { useKeyboardCardNavigation } from '~/composables/useKeyboardCardNavigation'
import { BEWLY_MOUNTED, DRAWER_VIDEO_ENTER_PAGE_FULL, DRAWER_VIDEO_EXIT_PAGE_FULL, IFRAME_PAGE_SWITCH_BEWLY, IFRAME_PAGE_SWITCH_BILI, OVERLAY_SCROLL_BAR_SCROLL } from '~/constants/globalEvents'
import { comboMatches, resolveShortcut } from '~/constants/shortcuts'
import { AppPage } from '~/enums/appEnums'
import { settings } from '~/logic'
import { useMainStore } from '~/stores/mainStore'
import { useSettingsStore } from '~/stores/settingsStore'
import { isHomePage, isInIframe, isNotificationPage, isVideoOrBangumiPage, openLinkToNewTab, queryDomUntilFound, scrollToTop } from '~/utils/main'
import emitter from '~/utils/mitt'

import { setupNecessarySettingsWatchers } from './necessarySettingsWatchers'

const { t } = useI18n()
const mainStore = useMainStore()
const settingsStore = useSettingsStore()

// 设置面板按需加载（冷路径，单独 chunk）
const Settings = defineAsyncComponent(() => import('~/components/Settings/Settings.vue'))
const { isDark } = useDark()
const [showSettings, toggleSettings] = useToggle(false)

// 键盘快捷键帮助 / 当前卡片信息条 / 接口失败提示
const showKeyboardHelp = ref(false)
const showCommandPalette = ref(false)
const aiFilterStatus = ref('')
let aiFilterTimer: ReturnType<typeof setTimeout> | null = null
const activeCardInfo = ref<{ title: string, meta: string, url: string, author?: string, view?: string, duration?: string, reason?: string, aiScore?: string, aiCategory?: string } | null>(null)
const showCardInfoDetail = ref(false)
interface QueueItem { title: string, url: string }
const queuedCards = ref<QueueItem[]>([])
const apiErrorVisible = ref(false)
let apiErrorTimer: ReturnType<typeof setTimeout> | null = null

emitter.on('toggle-keyboard-help', () => {
  showKeyboardHelp.value = !showKeyboardHelp.value
})
emitter.on('toggle-command-palette', () => {
  showCommandPalette.value = !showCommandPalette.value
})
emitter.on('command-open-settings', () => {
  showSettings.value = true
})
// 聚焦浏览等键盘交互里“在当前页打开”= 内嵌预览抽屉，而不是整页跳转
emitter.on('open-video-preview', (url: string) => {
  if (url)
    openIframeDrawer(url)
})
emitter.on('keyboard-active-card', (info: { title: string, meta: string, url: string, author?: string, view?: string, duration?: string, reason?: string, aiScore?: string, aiCategory?: string }) => {
  activeCardInfo.value = info
})
emitter.on('toggle-card-info-detail', () => {
  showCardInfoDetail.value = !showCardInfoDetail.value
})
emitter.on('ai-filter-start', ({ total }: { total: number }) => {
  aiFilterStatus.value = t('ai_filter_status.filtering', { total })
})
emitter.on('ai-filter-done', ({ ok, visible }: { ok: boolean, visible?: number }) => {
  aiFilterStatus.value = ok
    ? `${t('ai_filter_status.done')}${typeof visible === 'number'
      ? t('ai_filter_status.done_kept', { visible })
      : ''}`
    : t('ai_filter_status.failed')
  if (aiFilterTimer)
    clearTimeout(aiFilterTimer)
  aiFilterTimer = setTimeout(() => {
    aiFilterStatus.value = ''
  }, 2500)
})
emitter.on('queue-card', (info: { title: string, url: string }) => {
  if (!info.url)
    return
  if (queuedCards.value.some(item => item.url === info.url))
    return
  queuedCards.value.push({ title: info.title, url: info.url })
})
emitter.on('api-error', () => {
  apiErrorVisible.value = true
  if (apiErrorTimer)
    clearTimeout(apiErrorTimer)
  apiErrorTimer = setTimeout(() => {
    apiErrorVisible.value = false
  }, 3000)
})

// Get the 'page' query parameter from the URL
function getPageParam(): AppPage | null {
  const urlParams = new URLSearchParams(window.location.search)
  const result = urlParams.get('page') as AppPage | null
  if (result && Object.values(AppPage).includes(result))
    return result
  return null
}

const activatedPage = ref<AppPage>(getPageParam() || (settings.value.dockItemsConfig.find(e => e.visible === true)?.page || AppPage.Home))
const pages = {
  [AppPage.Home]: defineAsyncComponent(() => import('./Home/Home.vue')),
  [AppPage.Search]: defineAsyncComponent(() => import('./Search/Search.vue')),
  [AppPage.Anime]: defineAsyncComponent(() => import('./Anime/Anime.vue')),
  [AppPage.History]: defineAsyncComponent(() => import('./History/History.vue')),
  [AppPage.WatchLater]: defineAsyncComponent(() => import('./WatchLater/WatchLater.vue')),
  [AppPage.Favorites]: defineAsyncComponent(() => import('./Favorites/Favorites.vue')),
  [AppPage.Moments]: defineAsyncComponent(() => import('./Moments/Moments.vue')),
}
const mainAppRef = ref<HTMLElement>() as Ref<HTMLElement>
const scrollbarRef = ref()
const handlePageRefresh = ref<() => void>()
const handleReachBottom = ref<() => void>()
const handleThrottledPageRefresh = useThrottleFn(() => handlePageRefresh.value?.(), 500)
const handleThrottledReachBottom = useThrottleFn(() => handleReachBottom.value?.(), 500)
// 聚焦浏览没有原生滚动，触底哨兵不会触发；由它显式请求下一页
emitter.on('focus-browse-reach-end', () => {
  handleThrottledReachBottom()
})
const handleThrottledBackToTop = useThrottleFn(() => handleBackToTop(), 1000)
const topBarRef = ref()
const reachTop = ref<boolean>(true)

const iframeDrawerURL = ref<string>('')
const showIframeDrawer = ref<boolean>(false)
const iframeDrawerRef = ref<{ navigateTo: (url: string) => void } | null>(null)

const iframePageRef = ref()
useEventListener(window, 'message', ({ data }) => {
  switch (data) {
    case IFRAME_PAGE_SWITCH_BEWLY:
      {
        const currentDockItemConfig = settingsStore.getDockItemConfigByPage(activatedPage.value)
        if (currentDockItemConfig)
          currentDockItemConfig.useOriginalBiliPage = false
      }
      break
    case IFRAME_PAGE_SWITCH_BILI:
      {
        const currentDockItemConfig = settingsStore.getDockItemConfigByPage(activatedPage.value)
        if (currentDockItemConfig)
          currentDockItemConfig.useOriginalBiliPage = true
      }
      break
  }
})
const iframePageURL = computed((): string => {
  // If the iframe is not the BiliBili homepage or in iframe, then don't show the iframe page
  if (!isHomePage(window.self.location.href) || isInIframe())
    return ''
  const currentDockItemConfig = settings.value.dockItemsConfig.find(e => e.page === activatedPage.value)
  if (currentDockItemConfig) {
    return currentDockItemConfig.useOriginalBiliPage || !mainStore.getDockItemByPage(activatedPage.value)?.hasBewlyPage
      ? mainStore.getBiliWebPageURLByPage(activatedPage.value)
      : ''
  }
  return ''
})
const showBewlyPage = computed((): boolean => {
  if (isInIframe())
    return false

  const dockItem = mainStore.getDockItemByPage(activatedPage.value)
  if (!dockItem?.hasBewlyPage)
    return false

  if (iframePageURL.value)
    return false

  return isHomePage() && !settings.value.useOriginalBilibiliHomepage
})
const showTopBar = computed((): boolean => {
  // When using the open in drawer feature, the iframe inside the page will hide the top bar
  if (isVideoOrBangumiPage() && isInIframe())
    return false

  // when user open the notifications page as a drawer, don't show the top bar
  if (isNotificationPage() && settings.value.openNotificationsPageAsDrawer && isInIframe())
    return false

  // When the user switches to the original Bilibili page, BewlyBewly will only show the top bar inside the iframe.
  // This helps prevent the outside top bar from covering the contents.
  // reference: https://github.com/BewlyBewly/BewlyBewly/issues/1235

  // when using original bilibili homepage, show top bar
  return settings.value.useOriginalBilibiliHomepage
  // when on home page and not using original bilibili page, show top bar
    || (isHomePage() && !settingsStore.getDockItemIsUseOriginalBiliPage(activatedPage.value) && !isInIframe())
  // when in iframe and using original bilibili page, show top bar
    || (settingsStore.getDockItemIsUseOriginalBiliPage(activatedPage.value) && isInIframe())
  // when not on home page, show top bar
    || !isHomePage()
})

const isFirstTimeActivatedPageChange = ref<boolean>(true)
watch(
  () => activatedPage.value,
  () => {
    mainStore.setActivatedCover('')

    if (!isFirstTimeActivatedPageChange.value) {
      // Update the URL query parameter when activatedPage changes
      const url = new URL(window.location.href)
      url.searchParams.set('page', activatedPage.value)
      window.history.replaceState({}, '', url.toString())
    }

    if (scrollbarRef.value)
      scrollbarRef.value.scrollTop = 0
    isFirstTimeActivatedPageChange.value = false
  },
  { immediate: true },
)

watch([
  () => showTopBar.value,
  () => activatedPage.value,
], () => {
  // Remove the original Bilibili top bar when using original bilibili page to avoid two top bars showing
  const biliHeader = document.querySelector('.bili-header') as HTMLElement | null
  if (biliHeader && isHomePage()) {
    if (settingsStore.getDockItemIsUseOriginalBiliPage(activatedPage.value) && !isInIframe()) {
      biliHeader.style.visibility = 'hidden'
    }
    else {
      biliHeader.style.visibility = 'visible'
    }
  }
}, { immediate: true })

useKeyboardCardNavigation(() => scrollbarRef.value
  ? {
      elements: () => ({ viewport: scrollbarRef.value, scrollOffsetElement: scrollbarRef.value }),
    }
  : null)
useFocusBrowse()

// Setup necessary settings watchers
watch(() => showBewlyPage.value, () => nextTick(setupReachBottomObserver))

setupNecessarySettingsWatchers()

// #region 清屏模式（Shift+Z）
/** 清屏状态存 sessionStorage：同一标签页刷新保持，新标签页从关闭开始 */
const ZEN_STORAGE_KEY = 'bewly-zen'

function readZenEnabled(): boolean {
  try {
    return sessionStorage.getItem(ZEN_STORAGE_KEY) === '1'
  }
  catch {
    return false
  }
}

function storeZenEnabled(on: boolean): void {
  try {
    sessionStorage.setItem(ZEN_STORAGE_KEY, on ? '1' : '0')
  }
  catch {
    // 隐私模式 / 存储被禁用：本次会话内仍然生效，只是刷新不保持
  }
}

// 初始值直接读存储：避免刷新后先闪一下顶栏 / Dock 再进入清屏
const zenEnabled = ref<boolean>(readZenEnabled())
/** 浮层（设置 / 命令面板 / 帮助 / 抽屉 / 对话框）打开时清屏暂时让位 */
const zenOverlayOpen = ref<boolean>(false)
/** 根节点上的清屏 class：bewly-zen 常驻，bewly-zen--peek 表示「暂时恢复 UI」 */
const zenClasses = computed<Record<string, boolean>>(() => ({
  'bewly-zen': zenEnabled.value,
  'bewly-zen--peek': zenEnabled.value && zenOverlayOpen.value,
}))
/** 清屏时轻量轮询 DOM 浮层（Dialog 等由页面内组件自行渲染，拿不到 ref） */
let zenPollTimer: number | null = null

/**
 * 把清屏状态同步到 <html>：页面级样式（原生页增强层浮层入口）靠它隐藏。
 * 根节点 class 由模板绑定，这里只处理 document 级。
 */
function syncZenDocumentClass(): void {
  const root = document.documentElement
  root.classList.toggle('bewly-zen', zenEnabled.value)
  root.classList.toggle('bewly-zen--peek', zenEnabled.value && zenOverlayOpen.value)
}

function startZenPolling(): void {
  if (zenPollTimer !== null)
    return
  zenPollTimer = window.setInterval(() => {
    if (document.hidden)
      return
    refreshZenOverlayState()
  }, 400)
}

function stopZenPolling(): void {
  if (zenPollTimer === null)
    return
  window.clearInterval(zenPollTimer)
  zenPollTimer = null
}

function setZenEnabled(on: boolean): void {
  if (zenEnabled.value === on)
    return
  zenEnabled.value = on
  storeZenEnabled(on)
  if (on) {
    refreshZenOverlayState()
    startZenPolling()
  }
  else {
    stopZenPolling()
    zenOverlayOpen.value = false
  }
  syncZenDocumentClass()
}

function toggleZenMode(): void {
  setZenEnabled(!zenEnabled.value)
}

/** 当前是否有会遮住内容的浮层（含 Dialog 等直接挂在 shadow root 下的组件） */
function refreshZenOverlayState(): void {
  const shadowRoot = document.querySelector('#bewly')?.shadowRoot
  const hasShadowOverlay = Boolean(shadowRoot?.querySelector('.dialog, .command-palette-mask, .keyboard-help-mask, .bewly-iframe-drawer'))
  const next = Boolean(showSettings.value || showCommandPalette.value || showKeyboardHelp.value || showIframeDrawer.value || hasShadowOverlay)
  if (zenOverlayOpen.value === next)
    return
  zenOverlayOpen.value = next
  syncZenDocumentClass()
}

/** 键盘事件是否发生在输入框 / 可编辑区域（shadow DOM 里 target 会被重定向，必须看 composedPath） */
function isZenEditableTarget(event: KeyboardEvent): boolean {
  for (const node of event.composedPath()) {
    if (!(node instanceof HTMLElement))
      continue
    if (node.isContentEditable || node.matches?.('input, textarea, select'))
      return true
  }
  return false
}

/** 清屏的键盘入口：Shift+Z 切换，Esc 退出（浮层打开时让浮层先处理 Esc） */
function handleZenKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.isComposing)
    return
  if (event.ctrlKey || event.metaKey || event.altKey)
    return

  if (event.key === 'Escape') {
    if (!zenEnabled.value || zenOverlayOpen.value)
      return
    // 原生全屏 / 播放器全屏用 Esc 退出，先让它们处理
    if (document.fullscreenElement)
      return
    // 聚焦浏览 / 其它全屏模式有自己的 Esc 语义，先让它们处理
    if (document.documentElement.classList.contains('bewly-focus-browse'))
      return
    if (isZenEditableTarget(event))
      return
    event.preventDefault()
    event.stopPropagation()
    setZenEnabled(false)
    return
  }

  if (!comboMatches(resolveShortcut('toggleZenMode', settings.value.keyboardShortcuts), event))
    return
  if (isZenEditableTarget(event)) {
    // 输入框里 Shift+Z 就是普通大写字母：不吞按键，但要挡住全局快捷键层再处理一次
    event.stopPropagation()
    return
  }
  event.preventDefault()
  event.stopPropagation()
  toggleZenMode()
}
// #endregion

// 清屏模式：快捷键 / 设置页共用同一个入口
emitter.on('toggle-zen-mode', () => {
  toggleZenMode()
})

// 设置 / 命令面板 / 帮助 / 视频预览抽屉打开时，清屏暂时恢复 UI（关闭后自动回到清屏）
watch(
  [
    showSettings,
    showCommandPalette,
    showKeyboardHelp,
    showIframeDrawer,
  ],
  () => refreshZenOverlayState(),
)

window.addEventListener('keydown', handleZenKeydown, true)

onMounted(() => {
  nextTick(setupReachBottomObserver)
  window.dispatchEvent(new CustomEvent(BEWLY_MOUNTED))

  // 清屏模式：状态已在声明时从 sessionStorage 恢复，这里只同步 document 级 class
  syncZenDocumentClass()
  if (zenEnabled.value) {
    refreshZenOverlayState()
    startZenPolling()
  }

  if (isHomePage()) {
    // Force overwrite Bilibili Evolved body tag & html tag background color
    document.body.style.setProperty('background-color', 'unset', 'important')
  }
  // document.documentElement.style.setProperty('font-size', '14px')

  document.addEventListener('scroll', handleWindowScroll)
})

function handleWindowScroll() {
  reachTop.value = window.scrollY <= 0
}

function handleDockItemClick(dockItem: DockItem) {
  // Opening in a new tab while still on the current tab doesn't require changing the `activatedPage`
  if (dockItem.openInNewTab) {
    openLinkToNewTab(`https://www.bilibili.com/?page=${dockItem.page}`)
  }
  else {
    if (dockItem.useOriginalBiliPage) {
      // It seem like the `activatedPage` watcher above will handle this, so no need to set iframePageURL.value here
      // iframePageURL.value = dockItem.url
      if (!isHomePage()) {
        location.href = `https://www.bilibili.com/?page=${dockItem.page}`
      }
    }
    else {
      if (isHomePage()) {
        nextTick(() => {
          changeActivatePage(dockItem.page)
        })
      }
      else {
        location.href = `https://www.bilibili.com/?page=${dockItem.page}`
      }
    }

    // When not opened in a new tab, change the `activatedPage`
    activatedPage.value = dockItem.page
  }
}

function changeActivatePage(pageName: AppPage) {
  const scrollTop: number = scrollbarRef.value?.scrollTop ?? 0

  if (activatedPage.value === pageName) {
    if (activatedPage.value !== AppPage.Search) {
      if (scrollTop === 0)
        handleThrottledPageRefresh()
      else
        handleThrottledBackToTop()
    }
    return
  }
  activatedPage.value = pageName
}

function handleBackToTop(targetScrollTop = 0 as number) {
  if (scrollbarRef.value) {
    scrollToTop(scrollbarRef.value, targetScrollTop)
    topBarRef.value?.toggleTopBarVisible(true)
  }

  iframePageRef.value?.handleBackToTop()
}

const reachBottomSentinel = ref<HTMLElement | null>(null)
let reachBottomObserver: IntersectionObserver | null = null

function setupReachBottomObserver() {
  reachBottomObserver?.disconnect()
  reachBottomObserver = null
  const root = scrollbarRef.value as HTMLElement | undefined
  const sentinel = reachBottomSentinel.value
  if (!root || !sentinel)
    return
  reachBottomObserver = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting))
      handleThrottledReachBottom()
  }, { root, rootMargin: '0px 0px 300px 0px', threshold: 0 })
  reachBottomObserver.observe(sentinel)
}

let osScrollRaf = 0
function handleOsScroll() {
  if (osScrollRaf)
    return

  osScrollRaf = requestAnimationFrame(() => {
    osScrollRaf = 0
    emitter.emit(OVERLAY_SCROLL_BAR_SCROLL)

    const el = scrollbarRef.value
    if (!el)
      return
    const { scrollTop } = el // get scroll offset

    reachTop.value = scrollTop === 0

    if (isHomePage())
      topBarRef.value?.handleScroll()
  })
}

function openIframeDrawer(url: string) {
  const isSameOrigin = (origin: URL, destination: URL) =>
    origin.protocol === destination.protocol && origin.host === destination.host && origin.port === destination.port

  const currentUrl = new URL(location.href)
  const destination = new URL(url)

  try {
    if (!isSameOrigin(currentUrl, destination)) {
      openLinkToNewTab(url)
      return
    }
  }
  catch {
    openLinkToNewTab(url)
    return
  }

  // 禁止抽屉嵌套：在 iframe 内（抽屉里的视频页）再点视频时，直接在当前 iframe 内导航，
  // 不再叠加第二层抽屉（叠加会让两套 fixed 布局互相干扰、关闭后前一层也失效）。
  if (isInIframe()) {
    location.href = url
    return
  }

  // 抽屉已打开：交给抽屉做内部导航（保留前进/后退栈），不重建 iframe
  if (showIframeDrawer.value) {
    iframeDrawerRef.value?.navigateTo(url)
    return
  }

  iframeDrawerURL.value = url
  showIframeDrawer.value = true
}

/**
 * Checks if the current viewport has a scrollbar.
 * @returns {boolean} Returns true if the viewport has a scrollbar, false otherwise.
 */
async function haveScrollbar() {
  await nextTick()
  const el = scrollbarRef.value
  // If the scrollbarRef is not ready, return false
  if (el)
    return el.scrollHeight > window.innerHeight
  return false
}

// In drawer video, watch btn className changed and post message to parent
watchEffect(async (onCleanUp) => {
  if (!isInIframe())
    return null

  const observer = new MutationObserver(([{ target: el }]) => {
    if (!(el instanceof HTMLElement))
      return null
    if (el.classList.contains('bpx-state-entered')) {
      parent.postMessage(DRAWER_VIDEO_ENTER_PAGE_FULL)
    }
    else {
      parent.postMessage(DRAWER_VIDEO_EXIT_PAGE_FULL)
    }
  })

  const abort = new AbortController()
  queryDomUntilFound('.bpx-player-ctrl-btn.bpx-player-ctrl-web', 500, abort).then((openVideo2WebFullBtn) => {
    if (!openVideo2WebFullBtn)
      return
    observer.observe(openVideo2WebFullBtn, { attributes: true })
  })

  onCleanUp(() => {
    observer.disconnect()
    abort.abort()
  })
})

provide<BewlyAppProvider>('BEWLY_APP', {
  activatedPage,
  mainAppRef,
  scrollbarRef,
  reachTop,
  handleBackToTop,
  handlePageRefresh,
  handleReachBottom,
  openIframeDrawer,
  haveScrollbar,
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleZenKeydown, true)
  stopZenPolling()
  document.documentElement.classList.remove('bewly-zen', 'bewly-zen--peek')
  document.removeEventListener('scroll', handleWindowScroll)
  reachBottomObserver?.disconnect()
  reachBottomObserver = null
  emitter.off('toggle-command-palette')
  emitter.off('toggle-zen-mode')
  emitter.off('command-open-settings')
  emitter.off('open-video-preview')
  emitter.off('focus-browse-reach-end')
  emitter.off('toggle-keyboard-help')
  emitter.off('keyboard-active-card')
  emitter.off('toggle-card-info-detail')
  emitter.off('queue-card')
  emitter.off('ai-filter-start')
  emitter.off('ai-filter-done')
  if (aiFilterTimer)
    clearTimeout(aiFilterTimer)
  emitter.off('api-error')
  if (apiErrorTimer)
    clearTimeout(apiErrorTimer)
})
</script>

<template>
  <div
    id="bewly-wrapper"
    ref="mainAppRef"
    class="bewly-wrapper"
    :class="[{ dark: isDark }, zenClasses]"
    text="$bew-text-1 size-$bew-base-font-size"
  >
    <!-- Background -->
    <template v-if="showBewlyPage">
      <AppBackground :activated-page="activatedPage" />
    </template>

    <!-- Settings -->
    <KeepAlive>
      <!-- 第 42 轮：设置页必须盖住各页面增强层（宿主 z-index 2147483200），
           所以层级不再用 10002，而是抬到增强层之上（用户要求：调高层级而不是隐藏轨道） -->
      <Settings
        v-if="showSettings"
        :style="{ zIndex: 2147483600 }"
        @close="showSettings = false"
      />
    </KeepAlive>

    <!-- Dock & RightSideButtons -->
    <div
      v-if="!isInIframe()"
      pos="absolute top-0 left-0" w-full h-full overflow-hidden
      pointer-events-none
    >
      <Dock
        v-if="!settings.useOriginalBilibiliHomepage && (settings.alwaysUseDock || (showBewlyPage || iframePageURL))"
        pointer-events-auto
        :activated-page="activatedPage"
        @settings-visibility-change="toggleSettings"
        @refresh="handleThrottledPageRefresh"
        @back-to-top="handleThrottledBackToTop"
        @dock-item-click="handleDockItemClick"
      />
      <SideBar
        v-else
        pointer-events-auto
        @settings-visibility-change="toggleSettings"
      />
    </div>

    <!-- TopBar -->
    <div
      v-if="showTopBar"
      m-auto max-w="$bew-page-max-width"
    >
      <BewlyOrBiliTopBarSwitcher v-if="settings.showBewlyOrBiliTopBarSwitcher" />

      <OldTopBar
        v-if="settings.useOldTopBar"
        pos="top-0 left-0" z="99 hover:1001" w-full
      />
      <TopBar
        v-else
        pos="top-0 left-0" z="99 hover:1001" w-full
      />
    </div>

    <div
      v-if="!settings.useOriginalBilibiliHomepage"
      pos="absolute top-0 left-0" w-full h-full
      :style="{
        height: showBewlyPage || iframePageURL ? '100dvh' : '0',
      }"
    >
      <Transition name="fade">
        <template v-if="showBewlyPage">
          <div ref="scrollbarRef" class="bewly-scroll-container" @scroll="handleOsScroll">
            <main m-auto max-w="$bew-page-max-width">
              <div
                p="t-[calc(var(--bew-top-bar-height)+10px)]" m-auto
                w="lg:[calc(100%-200px)] [calc(100%-150px)]"
              >
                <Transition name="page-fade">
                  <Component :is="pages[activatedPage]" />
                </Transition>
              </div>
            </main>
            <div ref="reachBottomSentinel" aria-hidden="true" style="height: 1px" />
          </div>
        </template>
      </Transition>

      <Transition v-if="!showBewlyPage && iframePageURL && !isInIframe()" name="fade">
        <IframePage ref="iframePageRef" :url="iframePageURL" />
      </Transition>
    </div>

    <IframeDrawer
      v-if="showIframeDrawer"
      ref="iframeDrawerRef"
      :url="iframeDrawerURL"
      @close="showIframeDrawer = false"
    />

    <KeyboardShortcutHelp v-if="showKeyboardHelp" @close="showKeyboardHelp = false" />

    <CommandPalette v-if="showCommandPalette" @close="showCommandPalette = false" />

    <div v-if="activeCardInfo" class="bewly-active-info">
      <span class="bewly-active-info-title">{{ activeCardInfo.title }}</span>
      <template v-if="showCardInfoDetail">
        <span v-if="activeCardInfo.author" class="bewly-active-info-meta">{{ activeCardInfo.author }}</span>
        <span v-if="activeCardInfo.view" class="bewly-active-info-meta">{{ activeCardInfo.view }}</span>
        <span v-if="activeCardInfo.duration" class="bewly-active-info-meta">{{ activeCardInfo.duration }}</span>
        <span v-if="activeCardInfo.reason" class="bewly-active-info-meta">{{ activeCardInfo.reason }}</span>
        <span v-if="activeCardInfo.aiScore" class="bewly-active-info-ai">AI {{ activeCardInfo.aiScore }}{{ activeCardInfo.aiCategory ? ` · ${activeCardInfo.aiCategory}` : '' }}</span>
      </template>
      <span v-else-if="activeCardInfo.meta" class="bewly-active-info-meta">{{ activeCardInfo.meta }}</span>
      <span v-if="queuedCards.length" class="bewly-active-info-queue">{{ queuedCards.length }}</span>
    </div>

    <div v-if="aiFilterStatus" class="bewly-ai-status">
      {{ aiFilterStatus }}
    </div>

    <div v-if="apiErrorVisible" class="bewly-api-error">
      {{ $t('common.request_failed') }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
.bewly-wrapper {
  // To fix the filter used in `.bewly-wrapper` that cause the positions of elements become discorded.
  > * > * {
    filter: var(--bew-filter-force-dark);
  }
}
</style>

<style scoped>
.bewly-scroll-container {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
}

.bewly-active-info {
  position: fixed;
  left: 50%;
  bottom: 18px;
  z-index: 10005;
  display: flex;
  gap: 10px;
  align-items: center;
  max-width: min(680px, 80vw);
  padding: 8px 16px;
  border-radius: 999px;
  background: var(--bew-elevated);
  border: 1px solid var(--bew-border-color);
  box-shadow: var(--bew-shadow-1);
  transform: translateX(-50%);
  pointer-events: none;
  font-size: 13px;
  color: var(--bew-text-1);
  animation: bewly-info-in 120ms ease-out;
}

.bewly-active-info-ai {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--bew-theme-color);
  color: #fff;
  font-size: 11px;
}

.bewly-active-info-queue {
  flex-shrink: 0;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--bew-theme-color);
  color: #fff;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}

@keyframes bewly-info-in {
  from {
    opacity: 0;
    transform: translate(-50%, 6px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .bewly-active-info {
    animation: none;
  }
}

.bewly-active-info-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.bewly-active-info-meta {
  flex-shrink: 0;
  color: var(--bew-text-3);
  font-size: 12px;
}

.bewly-ai-status {
  position: fixed;
  left: 50%;
  bottom: 60px;
  z-index: 10005;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--bew-theme-color);
  color: #fff;
  font-size: 12px;
  transform: translateX(-50%);
  pointer-events: none;
  box-shadow: var(--bew-shadow-1);
}

.bewly-api-error {
  position: fixed;
  left: 50%;
  top: 70px;
  z-index: 10005;
  padding: 8px 18px;
  border-radius: 999px;
  background: var(--bew-danger-color, #f53f3f);
  color: #fff;
  font-size: 13px;
  transform: translateX(-50%);
  box-shadow: var(--bew-shadow-1);
  pointer-events: none;
}
</style>
