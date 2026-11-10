<script setup lang="ts">
import type { GridLayoutIcon } from './types'

import type { GridLayoutType, PageDensity } from '~/logic'
import type { HomeTab } from '~/stores/mainStore'
import { useThrottleFn } from '@vueuse/core'
import { useBewlyApp } from '~/composables/useAppProvider'
import { isFocusBrowseActive } from '~/composables/useFocusBrowse'
import { TOP_BAR_VISIBILITY_CHANGE } from '~/constants/globalEvents'
import { gridLayout, settings } from '~/logic'
import { useMainStore } from '~/stores/mainStore'

import emitter from '~/utils/mitt'
import { useHomeMessages } from './i18n'
import { HomeSubPage } from './types'

const mainStore = useMainStore()
const { handleBackToTop, scrollbarRef } = useBewlyApp()
const handleThrottledBackToTop = useThrottleFn((targetScrollTop: number = 0) => handleBackToTop(targetScrollTop), 1000)
const t = useHomeMessages()

// #region 首页卡片密度（舒适 / 紧凑）
/** 卡片密度读写 settings.homeCardDensity；紧凑档完全靠容器 class + CSS 生效，不碰数据结构 */
const cardDensity = computed<PageDensity>(() => settings.value.homeCardDensity === 'compact'
  ? 'compact'
  : 'comfortable')
/** 聚焦浏览（Cover Flow）会接管卡片尺寸，此时暂停密度样式，避免影响它的布局 */
const focusBrowseActive = ref<boolean>(isFocusBrowseActive())
/** 只给根节点加一个 class，所有网格 / 字号规则都挂在这个 class 下 */
const densityClass = computed<Record<string, boolean>>(() => ({
  'home-density-compact': cardDensity.value === 'compact' && !focusBrowseActive.value,
}))

const CARD_SELECTOR = '[data-video-card]'
const CARD_URL_ATTR = 'data-video-url'

function getHomeShadowRoot(): ShadowRoot | null {
  return document.querySelector('#bewly')?.shadowRoot ?? null
}

/** 当前可见区域第一张卡片：切换密度后用它做滚动锚点，尽量保持阅读位置 */
function findDensityAnchor(): { url: string, top: number } | null {
  const card = Array.from(getHomeShadowRoot()?.querySelectorAll<HTMLElement>(CARD_SELECTOR) ?? [])
    .find(el => el.getBoundingClientRect().bottom > (scrollbarRef.value?.getBoundingClientRect().top ?? 0) + 8)
  if (!card)
    return null
  return {
    url: card.getAttribute(CARD_URL_ATTR) ?? '',
    top: card.getBoundingClientRect().top,
  }
}

function setDensity(density: PageDensity) {
  if (settings.value.homeCardDensity === density)
    return

  // 切换会改变列数 → 先记下当前第一张卡片的位置，重排后再把滚动位置校正回来
  const anchor = focusBrowseActive.value
    ? null
    : findDensityAnchor()

  settings.value.homeCardDensity = density

  if (!anchor)
    return

  nextTick(() => {
    requestAnimationFrame(() => {
      const target = Array.from(getHomeShadowRoot()?.querySelectorAll<HTMLElement>(CARD_SELECTOR) ?? [])
        .find(el => (el.getAttribute(CARD_URL_ATTR) ?? '') === anchor.url)
      if (!target)
        return
      const delta = target.getBoundingClientRect().top - anchor.top
      if (Math.abs(delta) > 1 && scrollbarRef.value)
        scrollbarRef.value.scrollTop += delta
    })
  })
}
// #endregion

// #region 回到顶部（滚动超过两屏出现）
const TWO_SCREENS = 2
/** 首页滚动容器当前的滚动距离 */
const pageScrollTop = ref<number>(0)
/** 滚动容器的可见高度（两屏判定用；窗口尺寸变化时更新） */
const scrollViewportHeight = ref<number>(typeof window !== 'undefined'
  ? window.innerHeight
  : 0)
/** Zen（清屏）模式下隐藏浮动按钮 */
const zenActive = ref<boolean>(false)
let scrollRootEl: HTMLElement | null = null
let scrollFrame = 0
let zenObserver: MutationObserver | null = null

function readZenActive(): boolean {
  return document.documentElement.classList.contains('bewly-zen')
}

function updateViewportHeight(): void {
  scrollViewportHeight.value = scrollRootEl?.clientHeight || window.innerHeight || 0
}

const showBackToTop = computed<boolean>(() =>
  !zenActive.value
  && pageScrollTop.value > scrollViewportHeight.value * TWO_SCREENS,
)

function handleScrollRootScroll(): void {
  if (scrollFrame)
    return
  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = 0
    pageScrollTop.value = scrollRootEl?.scrollTop ?? 0
  })
}

function bindScrollRoot(): void {
  const next = (scrollbarRef.value as HTMLElement | null) ?? null
  if (next === scrollRootEl)
    return
  if (scrollRootEl)
    scrollRootEl.removeEventListener('scroll', handleScrollRootScroll)
  scrollRootEl = next
  if (scrollRootEl) {
    scrollRootEl.addEventListener('scroll', handleScrollRootScroll, { passive: true })
    pageScrollTop.value = scrollRootEl.scrollTop
  }
  updateViewportHeight()
}

function unbindScrollRoot(): void {
  if (scrollRootEl)
    scrollRootEl.removeEventListener('scroll', handleScrollRootScroll)
  scrollRootEl = null
  if (scrollFrame) {
    window.cancelAnimationFrame(scrollFrame)
    scrollFrame = 0
  }
}

function scrollHomeToTop(): void {
  const root = scrollRootEl
  // reduced-motion 下直接跳，不做平滑动画
  const reducedMotion = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (!root) {
    window.scrollTo({
      top: 0,
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }
  else if (reducedMotion) {
    root.scrollTop = 0
  }
  else {
    root.scrollTo({ top: 0, behavior: 'smooth' })
  }
  pageScrollTop.value = 0
}

/** 回到顶部按钮的位置：避开 Dock / 侧边栏（二者可配置在左 / 右 / 底部） */
const backToTopStyle = computed<Record<string, string>>(() => {
  // 首页可见时右下角是 Dock（SideBar 只在非 Bewly 首页时出现），位置以 Dock 设置为准
  const dockPosition = settings.value.dockPosition
  const barOnRightEdge = dockPosition === 'right'
  const barOnBottomEdge = dockPosition === 'bottom'
  const edge = 24
  const barGap = 72
  return {
    right: `${barOnRightEdge
      ? edge + barGap
      : edge}px`,
    bottom: `${barOnBottomEdge
      ? edge + barGap
      : edge}px`,
  }
})
// #endregion

const activatedPage = ref<HomeSubPage>(HomeSubPage.ForYou)
const pages = {
  [HomeSubPage.ForYou]: defineAsyncComponent(() => import('./components/ForYou.vue')),
  [HomeSubPage.Following]: defineAsyncComponent(() => import('./components/Following.vue')),
  [HomeSubPage.SubscribedSeries]: defineAsyncComponent(() => import('./components/SubscribedSeries.vue')),
  [HomeSubPage.Trending]: defineAsyncComponent(() => import('./components/Trending.vue')),
  [HomeSubPage.Ranking]: defineAsyncComponent(() => import('./components/Ranking.vue')),
  [HomeSubPage.Live]: defineAsyncComponent(() => import('./components/Live.vue')),
}
const showSearchPageMode = ref<boolean>(false)
const shouldMoveTabsUp = ref<boolean>(false)
const tabContentLoading = ref<boolean>(false)
const currentTabs = ref<HomeTab[]>([])
const tabPageRef = ref()
const topBarVisibility = ref<boolean>(false)
/** 当前 Tab 的布局（未单独设置时回退到全局默认） */
const currentLayout = computed((): GridLayoutType => gridLayout.value.byTab?.[activatedPage.value] ?? gridLayout.value.home)

function setCurrentLayout(value: GridLayoutType) {
  gridLayout.value.byTab = {
    ...(gridLayout.value.byTab ?? {}),
    [activatedPage.value]: value,
  }
}

const gridLayoutIcons = computed((): GridLayoutIcon[] => {
  return [
    { icon: 'i-mingcute:table-3-line', iconActivated: 'i-mingcute:table-3-fill', value: 'adaptive' },
    { icon: 'i-mingcute:layout-grid-line', iconActivated: 'i-mingcute:layout-grid-fill', value: 'twoColumns' },
    { icon: 'i-mingcute:list-check-3-line', iconActivated: 'i-mingcute:list-check-3-fill', value: 'oneColumn' },
  ]
})

/** 密度分段控件：两档，图标沿用首页已有的 mingcute 图标集 */
const densityOptions = computed(() => [
  {
    value: 'comfortable' as PageDensity,
    label: t.value.densityComfortable,
    hint: t.value.densityComfortableHint,
    icon: 'i-mingcute:layout-grid-line',
    iconActivated: 'i-mingcute:layout-grid-fill',
  },
  {
    value: 'compact' as PageDensity,
    label: t.value.densityCompact,
    hint: t.value.densityCompactHint,
    icon: 'i-mingcute:table-3-line',
    iconActivated: 'i-mingcute:table-3-fill',
  },
])

// use Json stringify to watch the changes of the array item properties
watch(() => JSON.stringify(settings.value.homePageTabVisibilityList), () => {
  currentTabs.value = computeTabs()
})

function computeTabs(): HomeTab[] {
  // if homePageTabVisibilityList not fresh , set it to default
  if (!settings.value.homePageTabVisibilityList.length || settings.value.homePageTabVisibilityList.length !== mainStore.homeTabs.length)
    settings.value.homePageTabVisibilityList = mainStore.homeTabs.map(tab => ({ page: tab.page, visible: true }))

  const targetTabs: HomeTab[] = []

  for (const tab of settings.value.homePageTabVisibilityList) {
    tab.visible && targetTabs.push({
      i18nKey: (mainStore.homeTabs.find(defaultTab => defaultTab.page === tab.page) || {})?.i18nKey || tab.page,
      page: tab.page,
    })
  }

  return targetTabs
}

onMounted(() => {
  showSearchPageMode.value = true
  emitter.off(TOP_BAR_VISIBILITY_CHANGE)
  emitter.on(TOP_BAR_VISIBILITY_CHANGE, (val) => {
    topBarVisibility.value = val
    shouldMoveTabsUp.value = false

    // Allow moving tabs up only when the top bar is not hidden & is set to auto-hide
    // This feature is primarily designed to compatible with the Bilibili Evolved's top bar
    // Even when the BewlyBewly top bar is hidden, the Bilibili Evolved top bar still exists, so not moving up
    if (settings.value.autoHideTopBar && settings.value.showTopBar) {
      if (!settings.value.useSearchPageModeOnHomePage) {
        if (val)
          shouldMoveTabsUp.value = false

        else
          shouldMoveTabsUp.value = true
      }
      else {
        // fix #349
        const osInstance = scrollbarRef.value?.osInstance()
        const scrollTop = osInstance.elements().viewport.scrollTop as number

        if (val)
          shouldMoveTabsUp.value = false

        else if (scrollTop > 510 + 40)
          shouldMoveTabsUp.value = true
      }
    }
  })

  currentTabs.value = computeTabs()
  activatedPage.value = currentTabs.value[0].page

  emitter.on('switch-home-tab', (index: number) => {
    const tab = currentTabs.value[index]
    if (tab)
      handleChangeTab(tab)
  })

  // 聚焦浏览进入 / 退出时暂停再恢复密度（Cover Flow 自己接管卡片尺寸）
  emitter.on('focus-browse-change', (payload: { active: boolean }) => {
    focusBrowseActive.value = payload.active
  })

  // 回到顶部：绑定滚动容器 + 监听 Zen（清屏）模式开关
  bindScrollRoot()
  window.addEventListener('resize', updateViewportHeight)
  zenActive.value = readZenActive()
  zenObserver = new MutationObserver(() => {
    zenActive.value = readZenActive()
  })
  zenObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
})

// 滚动容器可能在页面内容挂载后才出现 / 被替换（切子标签、从 iframe 模式切换回来）
watch(scrollbarRef, () => nextTick(bindScrollRoot))

onUnmounted(() => {
  emitter.off(TOP_BAR_VISIBILITY_CHANGE)
  emitter.off('switch-home-tab')
  emitter.off('focus-browse-change')
  unbindScrollRoot()
  window.removeEventListener('resize', updateViewportHeight)
  zenObserver?.disconnect()
  zenObserver = null
})

function handleChangeTab(tab: HomeTab) {
  if (activatedPage.value === tab.page) {
    const scrollTop = (scrollbarRef.value?.scrollTop ?? 0) as number

    if ((!settings.value.useSearchPageModeOnHomePage && scrollTop > 0) || (settings.value.useSearchPageModeOnHomePage && scrollTop > 510)) {
      handleThrottledBackToTop(settings.value.useSearchPageModeOnHomePage ? 510 : 0)
    }
    else {
      if (tabContentLoading.value)
        return
      tabPageRef.value && tabPageRef.value.initData()
    }
    return
  }
  else {
    handleThrottledBackToTop(settings.value.useSearchPageModeOnHomePage ? 510 : 0)
  }

  if (tabContentLoading.value)
    toggleTabContentLoading(false)

  activatedPage.value = tab.page
}

function toggleTabContentLoading(loading: boolean) {
  tabContentLoading.value = loading
}
</script>

<template>
  <div :class="densityClass">
    <!-- Home search page mode background -->
    <Transition name="bg">
      <div
        v-if="settings.useSearchPageModeOnHomePage && settings.individuallySetSearchPageWallpaper && showSearchPageMode"
        pos="absolute left-0 top-0" w-full h-580px
      >
        <div
          pos="absolute left-0 top-0" w-full h-inherit bg="cover center" z-1
          pointer-events-none
          :style="{
            backgroundImage: `url('${settings.searchPageWallpaper}')`,
            backgroundAttachment: settings.searchPageModeWallpaperFixed ? 'fixed' : 'unset',
          }"
        />
        <!-- background mask -->
        <Transition name="fade">
          <div
            v-if="(!settings.individuallySetSearchPageWallpaper && settings.enableWallpaperMasking) || (settings.searchPageEnableWallpaperMasking)"
            pos="relative left-0 top-0" w-full h-inherit pointer-events-none duration-300
            z-1
            :style="{
              backdropFilter: `blur(${settings.individuallySetSearchPageWallpaper ? settings.searchPageWallpaperBlurIntensity : settings.wallpaperBlurIntensity}px)`,
            }"
          >
            <div
              bg="$bew-homepage-bg" pos="absolute top-0 left-0" w-full h-full
              :style="{
                opacity: `${settings.searchPageWallpaperMaskOpacity}%`,
              }"
            />
          </div>
        </Transition>
      </div>
    </Transition>

    <main>
      <!-- Home search page mode content -->
      <Transition name="content">
        <div
          v-if="settings.useSearchPageModeOnHomePage && showSearchPageMode"
          flex="~ col"
          justify-center
          items-center relative
          w-full z-10 mb-4
          h-500px
        >
          <Logo
            v-if="settings.searchPageShowLogo" :size="180" :color="settings.searchPageLogoColor === 'white' ? 'white' : 'var(--bew-theme-color)'"
            :glow="settings.searchPageLogoGlow"
            m="t--70px b-12" z-1
          />
          <SearchBar
            :darken-on-focus="settings.searchPageDarkenOnSearchFocus"
            :blurred-on-focus="settings.searchPageBlurredOnSearchFocus"
            :focused-character="settings.searchPageSearchBarFocusCharacter"
          />
        </div>
      </Transition>

      <header
        pos="sticky top-[calc(var(--bew-top-bar-height)+10px)]" w-full z-9 m="b-4" duration-300
        ease-in-out flex="~ justify-between items-start gap-4"
        :class="{ hide: shouldMoveTabsUp }"
      >
        <section
          v-if="!(!settings.alwaysShowTabsOnHomePage && currentTabs.length === 1)"
          style="backdrop-filter: var(--bew-filter-glass-1)"
          bg="$bew-elevated" p-1
          w="[calc(100vw-280px)]" max-w="fit"
          h-38px rounded-full
          text="sm"
          shadow="[var(--bew-shadow-1),var(--bew-shadow-edge-glow-1)]"
          box-border border="1 $bew-border-color"
        >
          <OverlayScrollbarsComponent
            class="home-tabs-inside"
            element="div" defer
            :options="{
              x: 'scroll',
              y: 'hidden',
            }"
            h-full of-hidden
          >
            <button
              v-for="tab in currentTabs" :key="tab.page"
              :class="{ 'tab-activated': activatedPage === tab.page }"
              px-3 h-inherit
              bg="transparent hover:$bew-fill-2" text="$bew-text-2 hover:$bew-text-1" fw-bold rounded-full
              cursor-pointer duration-300
              flex="~ gap-2 items-center shrink-0" relative
              @click="handleChangeTab(tab)"
            >
              <span class="text-center">{{ $t(tab.i18nKey) }}</span>

              <Transition name="fade">
                <div
                  v-show="activatedPage === tab.page && tabContentLoading"
                  i-svg-spinners:ring-resize
                  pos="absolute right-4px top-4px" duration-300
                  text="8px white"
                />
              </Transition>
            </button>
          </OverlayScrollbarsComponent>
        </section>

        <div ml-auto flex="~ gap-1 shrink-0 items-center">
          <!-- 卡片密度：舒适 / 紧凑（写 settings.homeCardDensity，设置页同源） -->
          <div
            style="backdrop-filter: var(--bew-filter-glass-1)"
            flex="~ gap-1 shrink-0" p-1 h-38px bg="$bew-elevated" transform-gpu
            rounded-full
            shadow="[var(--bew-shadow-1),var(--bew-shadow-edge-glow-1)]"
            box-border border="1 $bew-border-color"
            role="group"
            :aria-label="t.densityGroup"
          >
            <button
              v-for="option in densityOptions" :key="option.value"
              type="button"
              :class="{ 'grid-layout-item-activated': cardDensity === option.value }"
              :aria-pressed="cardDensity === option.value"
              :aria-label="option.label"
              :title="option.hint"
              flex="~ justify-center items-center"
              h-full aspect-square text="$bew-text-2 hover:$bew-text-1"
              rounded-full bg="hover:$bew-fill-2" duration-300
              cursor-pointer
              @click="setDensity(option.value)"
            >
              <div :class="cardDensity === option.value ? option.iconActivated : option.icon" text-base />
            </button>
          </div>

          <div
            v-if="settings.enableGridLayoutSwitcher"
            style="backdrop-filter: var(--bew-filter-glass-1)"
            flex="~ gap-1 shrink-0" p-1 h-38px bg="$bew-elevated" transform-gpu
            rounded-full
            shadow="[var(--bew-shadow-1),var(--bew-shadow-edge-glow-1)]"
            box-border border="1 $bew-border-color"
          >
            <div
              v-for="icon in gridLayoutIcons" :key="icon.value"
              :class="{ 'grid-layout-item-activated': currentLayout === icon.value }"
              flex="~ justify-center items-center"
              h-full aspect-square text="$bew-text-2 hover:$bew-text-1"
              rounded-full bg="hover:$bew-fill-2" duration-300
              cursor-pointer
              @click="setCurrentLayout(icon.value)"
            >
              <div :class="currentLayout === icon.value ? icon.iconActivated : icon.icon" text-base />
            </div>
          </div>
        </div>
      </header>

      <Transition name="page-fade">
        <KeepAlive include="ForYou">
          <Component
            :is="pages[activatedPage]" :key="activatedPage"
            ref="tabPageRef"
            :grid-layout="currentLayout"
            :top-bar-visibility="topBarVisibility"
            @before-loading="toggleTabContentLoading(true)"
            @after-loading="toggleTabContentLoading(false)"
          />
        </KeepAlive>
      </Transition>
    </main>

    <!-- 回到顶部：滚过两屏出现；Zen 清屏模式下隐藏 -->
    <Transition name="fade">
      <button
        v-if="showBackToTop"
        type="button"
        class="home-back-to-top"
        :style="backToTopStyle"
        :aria-label="t.backToTop"
        :title="`${t.backToTop} · ${t.backToTopHint}`"
        @click="scrollHomeToTop"
      >
        <span class="i-tabler:arrow-up" aria-hidden="true" />
      </button>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.bg-enter-active,
.bg-leave-active {
  --uno: "duration-1000 ease-in-out";
}
.bg-enter-from,
.bg-leave-to {
  --uno: "h-100vh";
}
.bg-leave-to {
  --uno: "hidden";
}

.content-enter-active,
.content-leave-active {
  --uno: "duration-1000 ease-in-out";
}
.content-enter-from,
.content-leave-to {
  --uno: "opacity-0 h-100vh";
}
.content-leave-to {
  --uno: "hidden";
}

.hide {
  --uno: "important-translate-y--70px";
}

.home-tabs-inside {
  :deep([data-overlayscrollbars-contents]) {
    --uno: "flex items-center gap-1 h-inherit rounded-$bew-radius-half";
  }
  :deep(.os-scrollbar) {
    --uno: "mb--4px";
  }
}

.tab-activated {
  --uno: "bg-$bew-theme-color-auto text-$bew-text-auto";
}

.grid-layout-item-activated {
  --uno: "bg-$bew-theme-color-auto text-$bew-text-auto";
}

/* #region 回到顶部 */
.home-back-to-top {
  position: fixed;
  z-index: 98;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--bew-theme-color);
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  box-shadow: var(--bew-shadow-2);
  transition:
    transform 180ms cubic-bezier(0.22, 0.61, 0.36, 1),
    box-shadow 180ms cubic-bezier(0.22, 0.61, 0.36, 1);

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--bew-shadow-3);
  }

  &:active {
    transform: scale(0.94);
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 3px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-back-to-top {
    transition: none;

    &:hover,
    &:active {
      transform: none;
    }
  }
}
/* #endregion */

/* #region 首页卡片密度（紧凑档） */
/*
 * 密度完全靠容器 class（.home-density-compact）+ CSS 生效，不改数据结构、不重新请求接口。
 * 网格类来自各子组件的 scoped 样式，这里用 :deep() + !important 覆盖：
 * 子组件里还有 UnoCSS 的响应式列数，同级选择器压不住，只有 !important 能保证覆盖。
 *
 * 列数：舒适档沿用原自适应断点（2xl 5 列 …）；紧凑档改成按容器宽度自动填充、最小卡片宽 240px，
 * 宽屏下自然比舒适档多 1 列（见 docs/home-density.md 的实测公式）。
 * 其它两种布局（单列 / 双列）是用户显式选择的，只缩间距与字号，不再叠加列数。
 */
.home-density-compact {
  :deep(.grid-adaptive),
  :deep(.grid-adaptive-video) {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)) !important;
    gap: 12px !important;
  }

  :deep(.grid-adaptive-bangumi) {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)) !important;
    gap: 12px !important;
  }

  :deep(.grid-two-columns),
  :deep(.grid-one-column) {
    gap: 12px !important;
  }

  /* 标题字号降一档：VideoCard 的标题统一带 .keep-two-lines，不改卡片组件本身 */
  :deep(.keep-two-lines) {
    font-size: calc(var(--bew-base-font-size) * 0.93) !important;
  }
}
/* #endregion */
</style>
