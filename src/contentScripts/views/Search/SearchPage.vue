<script setup lang="ts">
/**
 * 搜索结果页（自绘）的页面壳。
 *
 * 由 mount.ts 以「自挂载覆盖层」的方式挂在原生搜索页之上（原生 DOM 已被它隐藏），
 * 所以这里拿到的一切都是挂载时预取好的快照（props），不再读原生 DOM。
 *
 * # 分页策略：页码分页（不是无限滚动）
 *
 * 接口本身就是 page 分页并给了 numPages（真机 keyword=原神：numResults=1000、
 * numPages=34），搜索结果页的心智也是「翻到第 N 页」而不是「一直往下滚」，所以：
 *   - 页码按钮（首尾页 + 当前页左右各 2 页 + 省略号），上一个 / 下一个；
 *   - 每次翻页整体替换列表，DOM 里最多只有 30 张卡片（无限滚动会堆到 1000 张）；
 *   - **页码 / 关键词 / 筛选都写回地址栏**（与原生页同一套参数名），
 *     刷新、前进后退、分享链接都能回到同一个结果页。
 *
 * 写 URL 用 pushState（翻页 / 换关键词）与 replaceState（改筛选，不产生历史记录）。
 * 写完之后浏览器会派发 historyChange（Bewly 的 inject 包装），mount.ts 的监听
 * 会把 URL 再解析一遍交给本组件的 syncRoute —— 由于状态已经一致，
 * isSameRoute() 会直接短路，不会自己触发自己。
 */
import type { SearchDurationId, SearchOrderId } from './constants'
import type { SearchApiItem, SearchFiltersState, SearchPageBridge, SearchRouteState } from './types'
import BackToTopButton from '~/components/BackToTopButton/BackToTopButton.vue'
import { useBewlyApp } from '~/composables/useAppProvider'
import { useBackToTopButton } from '~/composables/useBackToTopButton'
import { useDrawnPageKeyboardNav } from '~/composables/useDrawnPageKeyboardNav'
import { useListPageActions } from '~/composables/useListPageActions'
import { numFormatter } from '~/utils/dataFormatter'
import SearchBar from './components/SearchBar.vue'
import SearchFilters from './components/SearchFilters.vue'
import SearchVideoGrid from './components/SearchVideoGrid.vue'
import { SEARCH_PAGE_BRIDGE_KEY, SEARCH_PAGE_SPAN } from './constants'
import { fetchSearchVideos } from './fetcher'
import { useSearchDrawnI18n } from './searchDrawnI18n'
import {
  buildNativeSearchUrl,
  buildSearchUrl,
  isGapToken,
  isSameRoute,
  parseSearchPage,
  parseSearchRoute,
  toPageTokens,
} from './utils'

const props = defineProps<{
  initialKeyword: string
  initialPage: number
  initialFilters: SearchFiltersState
  /** mount.ts 预取的第一页 */
  initialItems: SearchApiItem[]
  initialTotal: number
  initialNumPages: number
}>()

const { t } = useSearchDrawnI18n()
const { handleBackToTop } = useBewlyApp()

/** 命中数的接口上限：超过 1000 条时接口只回 1000，展示成「1000 条以上」 */
const RESULT_CAP = 1000

const keyword = ref<string>(props.initialKeyword)
const order = ref<SearchOrderId>(props.initialFilters.order)
const duration = ref<SearchDurationId>(props.initialFilters.duration)
const tid = ref<string>(props.initialFilters.tid)

const page = ref<number>(props.initialPage)
const loadedPage = ref<number>(props.initialPage)
const items = ref<SearchApiItem[]>([...props.initialItems])
const total = ref<number>(props.initialTotal)
const numPages = ref<number>(props.initialNumPages)
const isLoading = ref<boolean>(false)
const errorMessage = ref<string>('')

const filters = computed<SearchFiltersState>(() => ({
  order: order.value,
  duration: duration.value,
  tid: tid.value,
}))

const route = computed<SearchRouteState>(() => ({
  keyword: keyword.value,
  page: page.value,
  filters: filters.value,
}))

const pageTokens = computed(() => toPageTokens(page.value, numPages.value, SEARCH_PAGE_SPAN))
const nativeUrl = computed(() => buildNativeSearchUrl(keyword.value, loadedPage.value))

/** 命中数文案：接口上限 1000 时用「以上」措辞，避免显示成精确值 */
const resultCountText = computed(() => {
  if (total.value >= RESULT_CAP)
    return t.value.resultCountCapped.replace('{count}', String(RESULT_CAP))
  return t.value.resultCount.replace('{count}', numFormatter(total.value).trim())
})

const pageStatusText = computed(() =>
  t.value.pageStatus
    .replace('{page}', String(page.value))
    .replace('{total}', String(numPages.value)),
)

/**
 * 把当前状态写回地址栏。
 *
 * push=true 用于翻页 / 换关键词（产生历史记录，后退可以回到上一页）；
 * push=false 用于筛选条件（只是同一个结果集的视图变化，不该污染历史）。
 * 写地址栏失败（极少数沙箱 / 只读历史场景）不影响页面本身，因此吞掉异常。
 */
function writeUrl(push: boolean) {
  const url = buildSearchUrl(location.pathname, keyword.value, page.value, filters.value)
  try {
    if (push)
      history.pushState(history.state, '', url)
    else
      history.replaceState(history.state, '', url)
  }
  catch {
    // 地址栏不是必须的：写不进去只影响刷新后的落点，页面照常用
  }
}

/**
 * 拉取指定页并替换列表。
 *
 * 失败时回退页码到「上一次成功加载的页」，避免地址栏 / 页码显示成没拉到的那一页。
 */
async function load(targetPage: number) {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const result = await fetchSearchVideos(keyword.value, targetPage, filters.value)
    items.value = result.items
    total.value = result.total
    numPages.value = result.numPages
    loadedPage.value = result.page || targetPage
    page.value = loadedPage.value
    errorMessage.value = ''
    // 页码被接口钳制（请求页超出 numPages）时，把地址栏也改回真实页，
    // 否则刷新 / 分享链接会一直指向一个不存在的页码
    if (targetPage !== loadedPage.value)
      writeUrl(false)
  }
  catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : String(error)
    // 翻页失败：退回上一次成功加载的页（列表内容还是那一页的）
    if (page.value !== loadedPage.value) {
      page.value = loadedPage.value
      writeUrl(false)
    }
  }
  finally {
    isLoading.value = false
  }
}

/** 跳页（页码按钮 / 上一页 / 下一页） */
function goPage(target: number) {
  if (isLoading.value || target === page.value)
    return
  const max = numPages.value > 0
    ? numPages.value
    : target
  if (target < 1 || target > max)
    return

  page.value = target
  writeUrl(true)
  handleBackToTop()
  void load(target)
}

/** 换关键词：整表重置后从第 1 页拉 */
function submitKeyword(next: string) {
  const value = next.trim()
  if (!value || value === keyword.value)
    return

  keyword.value = value
  page.value = 1
  loadedPage.value = 1
  items.value = []
  total.value = 0
  numPages.value = 0
  writeUrl(true)
  handleBackToTop()
  void load(1)
}

/** 改筛选：同样是整表重置，但不进历史记录 */
function resetForFilters() {
  page.value = 1
  loadedPage.value = 1
  items.value = []
  total.value = 0
  numPages.value = 0
  writeUrl(false)
  handleBackToTop()
  void load(1)
}

function changeOrder(next: SearchOrderId) {
  if (next === order.value)
    return
  order.value = next
  resetForFilters()
}

function changeDuration(next: SearchDurationId) {
  if (next === duration.value)
    return
  duration.value = next
  resetForFilters()
}

function changeTid(next: string) {
  if (next === tid.value)
    return
  tid.value = next
  resetForFilters()
}

/** 重试当前页（错误态 / 行内错误都走它） */
function retry() {
  void load(page.value)
}

/**
 * 空态 / 错误态的「放宽条件」：把排序 / 时长 / 分区一次性恢复默认并重拉第 1 页。
 *
 * 搜索页最常见的「没有结果」其实是筛选条件太窄（例如选了 60 分钟以上 + 冷门分区），
 * 让用户自己一个个点回去是纯粹的额外心智负担，这里给一个「一键放宽」。
 */
function clearFilters() {
  const changed = order.value !== 'totalrank' || duration.value !== '' || tid.value !== ''
  order.value = 'totalrank'
  duration.value = ''
  tid.value = ''
  if (!changed)
    return
  resetForFilters()
}

/** 覆盖层的「刷新」动作 / 外部调用：重拉当前页 */
function reload() {
  void load(page.value)
}

/**
 * 外部路由变化（前进 / 后退 / 别的脚本改了 URL）时由 mount.ts 调用。
 *
 * 与当前状态等价时直接返回 —— 我们自己写 URL 也会触发 historyChange，
 * 靠这个短路避免回环。
 */
function syncRoute(next?: SearchRouteState) {
  const target = next ?? parseSearchRoute()
  if (isSameRoute(target, route.value))
    return

  const keywordChanged = target.keyword !== keyword.value
  keyword.value = target.keyword
  order.value = target.filters.order
  duration.value = target.filters.duration
  tid.value = target.filters.tid
  page.value = target.page

  if (keywordChanged) {
    // 换了关键词就是另一份结果集，先清空避免旧内容闪在下面
    items.value = []
    total.value = 0
    numPages.value = 0
    loadedPage.value = 1
    handleBackToTop()
  }

  void load(target.page)
}

// #region 键盘导航（J ↓ / K ↑ / Enter / Esc / Home / End）
//
// 注册表 search scope 登记了这四个动作、命令面板也标了「当前页可用」，
// 但此前没有任何实现（真机按 J / ↓ 高亮不动）。翻页 / 换关键词 / 换筛选都会整体替换
// 列表，下标会越界，所以三处状态变化后都收敛一次。
const pageNav = useDrawnPageKeyboardNav()

watch([
  () => page.value,
  () => keyword.value,
], () => pageNav.reconcile())
// #endregion

// #region 回到顶部
//
// 搜索结果按页码分页、单页 30 张卡也要滚两屏以上；此前这一页没有回顶入口。
const { showTop, scrollToTop } = useBackToTopButton()
// #endregion

useListPageActions({
  isLoading,
  reachBottom: () => goPage(page.value + 1),
  refresh: () => reload(),
})

/**
 * 把「外部驱动」的两个方法交给 mount.ts（provide/inject 通道，见 constants.ts）。
 *
 * mount.ts 在路由变化（前进 / 后退 / 别的脚本改 URL）时调 syncRoute，
 * 覆盖层的刷新动作调 reload。两者都是幂等的：状态已一致时 syncRoute 直接返回。
 */
const bridge = inject<SearchPageBridge | null>(SEARCH_PAGE_BRIDGE_KEY, null)
if (bridge) {
  bridge.syncRoute = syncRoute
  bridge.reload = reload
}

onMounted(() => {
  // 挂载时的预取已经把页码钳制到 numPages 内（见 fetcher），这里只把地址栏对齐，
  // 不触发任何请求
  if (page.value !== parseSearchPage())
    writeUrl(false)
})

defineExpose({ syncRoute, reload })
</script>

<template>
  <div class="search-drawn-page">
    <header class="search-drawn-head">
      <SearchBar :model-value="keyword" @submit="submitKeyword" />
    </header>

    <SearchFilters
      :order="order"
      :duration="duration"
      :tid="tid"
      @change-order="changeOrder"
      @change-duration="changeDuration"
      @change-tid="changeTid"
    />

    <p v-if="total > 0" class="search-drawn-summary" role="status">
      {{ resultCountText }}
    </p>

    <SearchVideoGrid
      :items="items"
      :is-loading="isLoading"
      :error-message="errorMessage"
      :native-url="nativeUrl"
      @retry="retry"
      @clear-filters="clearFilters"
    />

    <!-- 翻页失败但已有列表：保留卡片，只在下方提示 + 重试 -->
    <p v-if="items.length && errorMessage" class="search-drawn-inline-error" role="alert">
      {{ errorMessage }}
      <button class="search-drawn-inline-error__retry" type="button" @click="retry">
        {{ t.retry }}
      </button>
    </p>

    <nav v-if="numPages > 1" class="search-pagination" :aria-label="t.pageAria">
      <button
        class="search-pagination__step"
        type="button"
        :disabled="page <= 1 || isLoading"
        @click="goPage(page - 1)"
      >
        {{ t.prevPage }}
      </button>

      <template v-for="token in pageTokens" :key="typeof token === 'string' ? token : token">
        <span v-if="isGapToken(token)" class="search-pagination__gap" aria-hidden="true">…</span>
        <button
          v-else
          class="search-pagination__page"
          :class="{ 'is-active': token === page }"
          type="button"
          :aria-current="token === page ? 'page' : undefined"
          :aria-label="t.goPage.replace('{page}', String(token))"
          :disabled="isLoading"
          @click="goPage(Number(token))"
        >
          {{ token }}
        </button>
      </template>

      <button
        class="search-pagination__step"
        type="button"
        :disabled="page >= numPages || isLoading"
        @click="goPage(page + 1)"
      >
        {{ t.nextPage }}
      </button>

      <span class="search-pagination__status">{{ pageStatusText }}</span>
    </nav>

    <BackToTopButton :show-top="showTop" @top="scrollToTop" />
  </div>
</template>
