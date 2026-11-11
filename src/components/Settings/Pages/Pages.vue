<script lang="ts" setup>
import { migrateLegacyCardQuickActionsSetting } from '~/components/VideoCardQuickActions/preferences'
import DiagnosticsPanel from '~/contentScripts/diagnostics/DiagnosticsPanel.vue'

import { originalSettings, settings } from '~/logic'
import SettingsGroupSection from '../components/SettingsGroupSection.vue'
import SettingsItem from '../components/SettingsItem.vue'
import { usePagesSettingsMessages } from './i18n'
import PagesSwitch from './PagesSwitch.vue'

/**
 * 「页面增强」设置页。
 *
 * 集中管理各轮新增功能的默认偏好：视频播放页 / 视频卡片 / 列表页 / 搜索页 /
 * 动态页 / 消息页 / 搜索结果页 / 用户空间 / 分区排行页 / 文章页 / 首页。
 * 文案走模块内 i18n（cmn-CN + cmn-TW + jyut + en），不进入全局 _locales。
 *
 * 第 14 轮信息架构：
 *   - 顶部分组胶囊导航：点击平滑滚动到对应分组，当前分组随滚动（IntersectionObserver）高亮；
 *   - 设置搜索：按分组标题 / 说明 / 设置项文案即时过滤，过滤掉空分组，无匹配时给提示与清空；
 *   - 每组「重置本组」：只把该组字段恢复为 originalSettings 里的默认值。
 */
// 打开设置页时也跑一次旧 localStorage 开关迁移（幂等），避免用户先看设置页时看到旧状态
migrateLegacyCardQuickActionsSetting()

const t = usePagesSettingsMessages()

const viewModeOptions = computed(() => [
  { label: t.value.viewModeComfortable, value: 'comfortable' },
  { label: t.value.viewModeCompact, value: 'compact' },
  { label: t.value.viewModeList, value: 'list' },
])

const sortOptions = computed(() => [
  { label: t.value.sortTime, value: 'time' },
  { label: t.value.sortDuration, value: 'duration' },
  { label: t.value.sortTitle, value: 'title' },
])

/** 页面密度：舒适 / 紧凑（动态页、消息页、搜索结果页、用户空间、分区页、首页共用） */
const densityOptions = computed(() => [
  { label: t.value.densityComfortable, value: 'comfortable' },
  { label: t.value.densityCompact, value: 'compact' },
])

/** 视频卡片悬停操作条开关（第 9 轮起直接读写 settings，卡片侧响应式跟随） */
const quickActionsModel = computed({
  get: () => settings.value.enableVideoCardQuickActions !== false,
  set: (value: boolean) => {
    settings.value.enableVideoCardQuickActions = value
  },
})

/** 文章正文字号三档 */
const fontSizeOptions = computed(() => [
  { label: t.value.fontSizeS, value: 's' },
  { label: t.value.fontSizeM, value: 'm' },
  { label: t.value.fontSizeL, value: 'l' },
])

// #region 分组元数据（导航 / 搜索 / 重置共用一份）
type GroupKey
  = | 'videoPage'
    | 'videoCard'
    | 'listPage'
    | 'searchPage'
    | 'moments'
    | 'notification'
    | 'searchResult'
    | 'space'
    | 'channel'
    | 'article'
    | 'home'

interface SettingGroupDef {
  key: GroupKey
  title: string
  desc: string
  /** 该组里参与搜索匹配的设置项 key（与模板中 itemVisible(...) 的参数一致） */
  items: string[]
  /** 只重置本组字段为默认值 */
  reset: () => void
}

const groups = computed<SettingGroupDef[]>(() => [
  {
    key: 'videoPage',
    title: t.value.groupVideoPage,
    desc: t.value.groupVideoPageDesc,
    items: [
      'videoPageCinemaMode',
      'videoPageMiniPlayer',
      'videoPageShortcuts',
      'videoPageComments',
    ],
    reset: () => {
      settings.value.videoPageCinemaMode = originalSettings.videoPageCinemaMode
      settings.value.videoPageMiniPlayer = originalSettings.videoPageMiniPlayer
      settings.value.videoPageShortcuts = originalSettings.videoPageShortcuts
      settings.value.videoPageComments = originalSettings.videoPageComments
    },
  },
  {
    key: 'videoCard',
    title: t.value.groupVideoCard,
    desc: t.value.groupVideoCardDesc,
    items: ['cardPreview', 'cardQuickActions'],
    reset: () => {
      settings.value.enableVideoCardPreview = originalSettings.enableVideoCardPreview
      settings.value.enableVideoCardQuickActions = originalSettings.enableVideoCardQuickActions
    },
  },
  {
    key: 'listPage',
    title: t.value.groupListPage,
    desc: t.value.groupListPageDesc,
    items: [
      'historyViewMode',
      'watchLaterViewMode',
      'favoritesViewMode',
      'defaultSort',
      'listScrollMemory',
    ],
    reset: () => {
      settings.value.historyViewMode = originalSettings.historyViewMode
      settings.value.watchLaterViewMode = originalSettings.watchLaterViewMode
      settings.value.favoritesViewMode = originalSettings.favoritesViewMode
      settings.value.listDefaultSort = originalSettings.listDefaultSort
      settings.value.enableListScrollMemory = originalSettings.enableListScrollMemory
    },
  },
  {
    key: 'searchPage',
    title: t.value.groupSearchPage,
    desc: t.value.groupSearchPageDesc,
    items: ['directPaste'],
    reset: () => {
      settings.value.searchPageDirectPasteEnabled = originalSettings.searchPageDirectPasteEnabled
    },
  },
  {
    key: 'moments',
    title: t.value.groupMoments,
    desc: '',
    items: ['momentsDensity', 'momentsOptimize'],
    reset: () => {
      settings.value.momentsDensity = originalSettings.momentsDensity
      settings.value.momentsOptimizeEnabled = originalSettings.momentsOptimizeEnabled
    },
  },
  {
    key: 'notification',
    title: t.value.groupNotification,
    desc: t.value.groupNotificationDesc,
    items: ['notificationOnlyUnread', 'notificationDensity'],
    reset: () => {
      settings.value.notificationOnlyUnread = originalSettings.notificationOnlyUnread
      settings.value.notificationDensity = originalSettings.notificationDensity
    },
  },
  {
    key: 'searchResult',
    title: t.value.groupSearchResult,
    desc: t.value.groupSearchResultDesc,
    items: ['searchDensity'],
    reset: () => {
      settings.value.searchDensity = originalSettings.searchDensity
    },
  },
  {
    key: 'space',
    title: t.value.groupSpace,
    desc: t.value.groupSpaceDesc,
    items: ['spaceDensity'],
    reset: () => {
      settings.value.spaceDensity = originalSettings.spaceDensity
    },
  },
  {
    key: 'channel',
    title: t.value.groupChannel,
    desc: t.value.groupChannelDesc,
    items: ['channelDensity'],
    reset: () => {
      settings.value.channelDensity = originalSettings.channelDensity
    },
  },
  {
    key: 'article',
    title: t.value.groupArticle,
    desc: t.value.groupArticleDesc,
    items: ['articleReadingMode', 'articleFontSize'],
    reset: () => {
      settings.value.articleReadingMode = originalSettings.articleReadingMode
      settings.value.articleFontSize = originalSettings.articleFontSize
    },
  },
  {
    key: 'home',
    title: t.value.groupHome,
    desc: t.value.groupHomeDesc,
    items: ['homeCardDensity'],
    reset: () => {
      settings.value.homeCardDensity = originalSettings.homeCardDensity
    },
  },
])

/**
 * 设置项的搜索文案（标题 + 说明 + 选项名）。
 * 用 getter 而不是固定字符串：切换语言后搜索索引立刻跟着变。
 */
const itemSearchText: Record<string, () => string[]> = {
  videoPageCinemaMode: () => [t.value.videoPageCinemaMode, t.value.videoPageCinemaModeDesc],
  videoPageMiniPlayer: () => [t.value.videoPageMiniPlayer, t.value.videoPageMiniPlayerDesc],
  videoPageShortcuts: () => [t.value.videoPageShortcuts, t.value.videoPageShortcutsDesc],
  videoPageComments: () => [t.value.videoPageComments, t.value.videoPageCommentsDesc],
  cardPreview: () => [t.value.cardPreview, t.value.cardPreviewDesc],
  cardQuickActions: () => [t.value.cardQuickActions, t.value.cardQuickActionsDesc],
  historyViewMode: () => [
    t.value.historyViewMode,
    t.value.viewModeComfortable,
    t.value.viewModeCompact,
    t.value.viewModeList,
  ],
  watchLaterViewMode: () => [
    t.value.watchLaterViewMode,
    t.value.viewModeComfortable,
    t.value.viewModeCompact,
    t.value.viewModeList,
  ],
  favoritesViewMode: () => [
    t.value.favoritesViewMode,
    t.value.viewModeComfortable,
    t.value.viewModeCompact,
    t.value.viewModeList,
  ],
  defaultSort: () => [
    t.value.defaultSort,
    t.value.defaultSortDesc,
    t.value.sortTime,
    t.value.sortDuration,
    t.value.sortTitle,
  ],
  listScrollMemory: () => [t.value.listScrollMemory, t.value.listScrollMemoryDesc],
  directPaste: () => [t.value.directPaste, t.value.directPasteDesc],
  momentsDensity: () => [
    t.value.momentsDensity,
    t.value.momentsDensityDesc,
    t.value.densityComfortable,
    t.value.densityCompact,
  ],
  momentsOptimize: () => [t.value.momentsOptimize, t.value.momentsOptimizeDesc],
  notificationOnlyUnread: () => [t.value.notificationOnlyUnread, t.value.notificationOnlyUnreadDesc],
  notificationDensity: () => [t.value.notificationDensity, t.value.densityComfortable, t.value.densityCompact],
  searchDensity: () => [t.value.searchDensity, t.value.densityComfortable, t.value.densityCompact],
  spaceDensity: () => [t.value.spaceDensity, t.value.densityComfortable, t.value.densityCompact],
  channelDensity: () => [
    t.value.channelDensity,
    t.value.channelDensityDesc,
    t.value.densityComfortable,
    t.value.densityCompact,
  ],
  articleReadingMode: () => [t.value.articleReadingMode, t.value.articleReadingModeDesc],
  articleFontSize: () => [
    t.value.articleFontSize,
    t.value.fontSizeS,
    t.value.fontSizeM,
    t.value.fontSizeL,
  ],
  homeCardDensity: () => [
    t.value.homeCardDensity,
    t.value.homeCardDensityDesc,
    t.value.densityComfortable,
    t.value.densityCompact,
  ],
}
// #endregion

// #region 搜索过滤
const searchQuery = ref('')
const hasQuery = computed(() => Boolean(searchQuery.value.trim()))

function textMatches(texts: Array<string | undefined>): boolean {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q)
    return true
  return texts.some(text => Boolean(text) && (text as string).toLowerCase().includes(q))
}

/** 设置项 → 所属分组：分组标题 / 说明命中时，组内所有项都显示 */
const itemGroupKey = computed<Record<string, GroupKey>>(() => {
  const map: Record<string, GroupKey> = {}
  for (const group of groups.value) {
    for (const item of group.items)
      map[item] = group.key
  }
  return map
})

/** 单个设置项是否命中搜索词（分组标题 / 说明命中时整组显示） */
function itemVisible(item: string): boolean {
  const group = groups.value.find(entry => entry.key === itemGroupKey.value[item])
  if (group && textMatches([group.title, group.desc]))
    return true
  return textMatches(itemSearchText[item]?.() ?? [])
}

/** 分组是否还有可见项：分组标题 / 说明命中，或任意子项命中 */
function groupVisible(key: GroupKey): boolean {
  if (!hasQuery.value)
    return true
  const group = groups.value.find(item => item.key === key)
  if (!group)
    return true
  if (textMatches([group.title, group.desc]))
    return true
  return group.items.some(item => itemVisible(item))
}

const navItems = computed(() => groups.value.filter(group => groupVisible(group.key)))
const showEmptyState = computed(() => hasQuery.value && navItems.value.length === 0)

function clearSearch() {
  searchQuery.value = ''
}
// #endregion

// #region 分组导航（滚动定位 + IntersectionObserver 高亮）
const rootRef = ref<HTMLElement | null>(null)
const navTrackRef = ref<HTMLElement | null>(null)
const activeGroup = ref<GroupKey>('videoPage')

let observer: IntersectionObserver | null = null
let scrollRoot: HTMLElement | null = null
let resetDoneTimer: number | null = null

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function getSections(): HTMLElement[] {
  const root = rootRef.value
  if (!root)
    return []
  return Array.from(root.querySelectorAll<HTMLElement>('[data-settings-group]'))
}

/** 找到设置面板内部的滚动容器（OverlayScrollbars 的 viewport） */
function findScrollRoot(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null
  while (node) {
    const style = window.getComputedStyle(node)
    if (/auto|scroll|overlay/.test(style.overflowY) && node.scrollHeight > node.clientHeight)
      return node
    node = node.parentElement
  }
  return null
}

function scrollToGroup(key: GroupKey) {
  activeGroup.value = key
  const shadow = rootRef.value?.querySelector<HTMLElement>(`[data-settings-group="${key}"]`)
  if (!shadow)
    return
  shadow.scrollIntoView({
    behavior: prefersReducedMotion()
      ? 'auto'
      : 'smooth',
    block: 'start',
  })
}

/** 底部兜底：按分组顶部位置判断当前分组（过滤后 / IO 不可用时用） */
function syncActiveGroupFromScroll() {
  const sections = getSections().filter(section => section.offsetParent !== null)
  if (!sections.length)
    return
  const threshold = (scrollRoot?.getBoundingClientRect().top ?? 0) + 176
  let current = sections[0]
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= threshold)
      current = section
    else break
  }
  const key = current.getAttribute('data-settings-group') as GroupKey | null
  if (key)
    activeGroup.value = key
}

/** 把当前高亮的胶囊滚进导航条可视区（横向，尽量少动） */
function revealActiveNavPill() {
  void nextTick(() => {
    const track = navTrackRef.value
    const pill = track?.querySelector<HTMLElement>(`[data-nav-key="${activeGroup.value}"]`)
    if (!track || !pill)
      return
    // pill 与 track 用同一个 offsetParent，相减得到它在导航条内的位置
    const offset = pill.offsetLeft - track.offsetLeft
    const left = offset - (track.clientWidth - pill.clientWidth) / 2
    track.scrollTo({
      left: Math.max(0, left),
      behavior: prefersReducedMotion()
        ? 'auto'
        : 'smooth',
    })
  })
}

function setupGroupObserver() {
  observer?.disconnect()
  observer = null
  if (typeof IntersectionObserver === 'undefined') {
    syncActiveGroupFromScroll()
    return
  }

  observer = new IntersectionObserver((entries) => {
    const visible = entries.filter(entry => entry.isIntersecting)
    if (!visible.length)
      return
    // 同一批里取最靠上的可见分组作为当前分组
    const top = visible.reduce((prev, entry) =>
      entry.boundingClientRect.top < prev.boundingClientRect.top
        ? entry
        : prev,
    )
    const key = top.target.getAttribute('data-settings-group') as GroupKey | null
    if (key && key !== activeGroup.value)
      activeGroup.value = key
  }, {
    root: scrollRoot,
    // 吸顶导航 + 面板标题占掉顶部约 176px，剩下的可见区用来判定「当前分组」
    rootMargin: '-176px 0px -45% 0px',
    threshold: 0,
  })

  getSections().forEach(section => observer?.observe(section))
}

watch(activeGroup, revealActiveNavPill)

watch(searchQuery, () => {
  void nextTick(() => {
    const items = navItems.value
    if (!items.length)
      return
    if (!items.some(item => item.key === activeGroup.value))
      activeGroup.value = items[0].key
    else
      syncActiveGroupFromScroll()
  })
})

onMounted(() => {
  void nextTick(() => {
    scrollRoot = findScrollRoot(rootRef.value)
    setupGroupObserver()
    syncActiveGroupFromScroll()
  })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  if (resetDoneTimer !== null) {
    window.clearTimeout(resetDoneTimer)
    resetDoneTimer = null
  }
})
// #endregion

// #region 重置本组（只重置该组字段，不动其他组）
const resetDoneGroup = ref<GroupKey | null>(null)

function resetGroup(key: GroupKey) {
  const group = groups.value.find(item => item.key === key)
  if (!group)
    return
  group.reset()
  resetDoneGroup.value = key
  if (resetDoneTimer !== null)
    window.clearTimeout(resetDoneTimer)
  resetDoneTimer = window.setTimeout(() => {
    resetDoneTimer = null
    resetDoneGroup.value = null
  }, 1800)
}
// #endregion

// #region 数据导入 / 导出（第 22 轮）
/**
 * 导出的 JSON 结构：
 * {
 *   "version": 1,
 *   "exportedAt": "2025-01-01T00:00:00.000Z",
 *   "settings": { ...与 originalSettings 同构的字段... }
 * }
 *
 * 导入时只接受 version === 1；未知字段忽略；已知字段的类型必须与默认值一致；
 * 校验全部通过后才允许在面板内二次确认，确认后整体覆盖 settings。
 */
const SETTINGS_EXPORT_VERSION = 1

type ImportParseResult
  = | { ok: true, data: Record<string, unknown>, count: number }
    | { ok: false, message: string }

const fileInputRef = ref<HTMLInputElement | null>(null)
const importButtonRef = ref<HTMLButtonElement | null>(null)
const confirmImportButtonRef = ref<HTMLButtonElement | null>(null)

const pendingImport = ref<{ data: Record<string, unknown>, count: number } | null>(null)
const dataStatus = ref('')
const dataStatusTone = ref<'success' | 'error' | ''>('')
let dataStatusTimer: number | null = null

function settingsRecord(): Record<string, unknown> {
  return settings.value as unknown as Record<string, unknown>
}

function defaultSettingsRecord(): Record<string, unknown> {
  return originalSettings as unknown as Record<string, unknown>
}

function setDataStatus(message: string, tone: 'success' | 'error') {
  dataStatus.value = message
  dataStatusTone.value = tone
  if (dataStatusTimer !== null)
    window.clearTimeout(dataStatusTimer)
  dataStatusTimer = window.setTimeout(() => {
    dataStatusTimer = null
    dataStatus.value = ''
    dataStatusTone.value = ''
  }, 4000)
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** 文件名用的日期戳：YYYYMMDD（本地时区） */
function todayStamp(): string {
  const now = new Date()
  return String(now.getFullYear()) + pad2(now.getMonth() + 1) + pad2(now.getDate())
}

/** 只导出 settings 字段（不含其它 storage key） */
function buildExportPayload(): Record<string, unknown> {
  const exported: Record<string, unknown> = {}
  for (const key of Object.keys(defaultSettingsRecord()))
    exported[key] = settingsRecord()[key]

  return {
    version: SETTINGS_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    settings: exported,
  }
}

function exportSettings() {
  try {
    const blob = new Blob([
      JSON.stringify(buildExportPayload(), null, 2),
    ], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `bewly-settings-${todayStamp()}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setDataStatus(t.value.exportSuccess, 'success')
  }
  catch {
    setDataStatus(t.value.exportError, 'error')
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 字段类型与默认值一致：数组 / 普通对象 / 其它按 typeof 比较 */
function fieldTypeMatches(defaultValue: unknown, value: unknown): boolean {
  if (Array.isArray(defaultValue))
    return Array.isArray(value)
  if (isPlainObject(defaultValue))
    return isPlainObject(value)
  return typeof value === typeof defaultValue
}

function parseImportPayload(text: string): ImportParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  }
  catch {
    return { ok: false, message: t.value.importErrorJson }
  }

  if (!isPlainObject(parsed))
    return { ok: false, message: t.value.importErrorShape }

  const version = parsed.version
  if (version !== SETTINGS_EXPORT_VERSION) {
    return {
      ok: false,
      message: t.value.importErrorVersion.replace('{version}', version == null
        ? '?'
        : String(version)),
    }
  }

  const rawSettings = parsed.settings
  if (!isPlainObject(rawSettings))
    return { ok: false, message: t.value.importErrorShape }

  const defaults = defaultSettingsRecord()
  const data: Record<string, unknown> = {}
  for (const key of Object.keys(defaults)) {
    if (!(key in rawSettings))
      continue
    const value = rawSettings[key]
    if (!fieldTypeMatches(defaults[key], value)) {
      return {
        ok: false,
        message: t.value.importErrorField.replace('{field}', key),
      }
    }
    data[key] = value
  }

  const count = Object.keys(data).length
  if (count === 0)
    return { ok: false, message: t.value.importErrorEmpty }

  return { ok: true, data, count }
}

function triggerImport() {
  pendingImport.value = null
  fileInputRef.value?.click()
}

async function onImportFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // 允许连续两次选择同一个文件
  input.value = ''
  if (!file)
    return

  let text = ''
  try {
    text = await file.text()
  }
  catch {
    setDataStatus(t.value.importErrorJson, 'error')
    importButtonRef.value?.focus()
    return
  }

  const result = parseImportPayload(text)
  if (!result.ok) {
    pendingImport.value = null
    setDataStatus(result.message, 'error')
    importButtonRef.value?.focus()
    return
  }

  dataStatus.value = ''
  dataStatusTone.value = ''
  pendingImport.value = { data: result.data, count: result.count }
}

/** 二次确认后整体覆盖 settings（只覆盖文件里出现的字段） */
function confirmImport() {
  const pending = pendingImport.value
  if (!pending)
    return

  try {
    const target = settingsRecord()
    for (const [key, value] of Object.entries(pending.data))
      target[key] = value
  }
  catch {
    setDataStatus(t.value.importErrorShape, 'error')
    return
  }

  pendingImport.value = null
  setDataStatus(t.value.importSuccess.replace('{count}', String(pending.count)), 'success')
  importButtonRef.value?.focus()
}

function cancelImport() {
  pendingImport.value = null
  importButtonRef.value?.focus()
}

/** 二次确认面板里的 Esc：只在确认态拦截，避免吞掉设置面板自己的 Esc */
function handleDataKeydown(event: KeyboardEvent) {
  if (!pendingImport.value || event.key !== 'Escape')
    return
  event.preventDefault()
  event.stopPropagation()
  cancelImport()
}

watch(pendingImport, async (value) => {
  if (!value)
    return
  await nextTick()
  confirmImportButtonRef.value?.focus()
})

onBeforeUnmount(() => {
  if (dataStatusTimer !== null) {
    window.clearTimeout(dataStatusTimer)
    dataStatusTimer = null
  }
})
// #endregion
</script>

<template>
  <div ref="rootRef" class="pages-settings">
    <div class="pages-toolbar">
      <nav class="pages-nav" :aria-label="t.nav">
        <div ref="navTrackRef" class="pages-nav__track">
          <button
            v-for="item in navItems"
            :key="item.key"
            type="button"
            class="pages-nav__pill"
            :class="{ 'is-active': activeGroup === item.key }"
            :data-nav-key="item.key"
            :aria-current="activeGroup === item.key ? 'true' : undefined"
            @click="scrollToGroup(item.key)"
          >
            {{ item.title }}
          </button>
        </div>
      </nav>

      <div class="pages-search" role="search" :aria-label="t.searchPlaceholder">
        <Input v-model="searchQuery" :placeholder="t.searchPlaceholder">
          <template #prefix>
            <div i-mingcute:search-line class="pages-search__icon" />
          </template>
          <template #suffix>
            <button
              v-if="searchQuery"
              type="button"
              class="pages-search__clear"
              @click="clearSearch()"
            >
              {{ t.searchClear }}
            </button>
          </template>
        </Input>
      </div>
    </div>

    <div v-if="showEmptyState" class="pages-empty" role="status">
      <p class="pages-empty__title">
        {{ t.searchEmpty }}
      </p>
      <p class="pages-empty__desc">
        {{ t.searchEmptyDesc }}
      </p>
      <button type="button" class="pages-empty__clear" @click="clearSearch()">
        {{ t.searchClear }}
      </button>
    </div>

    <SettingsGroupSection
      v-show="groupVisible('videoPage')"
      group-key="videoPage"
      :title="t.groupVideoPage"
      :desc="t.groupVideoPageDesc"
      :reset-label="t.resetGroup"
      :reset-done-label="t.resetGroupDone"
      :reset-done="resetDoneGroup === 'videoPage'"
      @reset="resetGroup('videoPage')"
    >
      <SettingsItem v-if="itemVisible('videoPageCinemaMode')" :title="t.videoPageCinemaMode" :desc="t.videoPageCinemaModeDesc">
        <Radio v-model="settings.videoPageCinemaMode" />
      </SettingsItem>

      <SettingsItem v-if="itemVisible('videoPageMiniPlayer')" :title="t.videoPageMiniPlayer" :desc="t.videoPageMiniPlayerDesc">
        <Radio v-model="settings.videoPageMiniPlayer" />
      </SettingsItem>

      <SettingsItem v-if="itemVisible('videoPageShortcuts')" :title="t.videoPageShortcuts" :desc="t.videoPageShortcutsDesc">
        <Radio v-model="settings.videoPageShortcuts" />
      </SettingsItem>

      <SettingsItem v-if="itemVisible('videoPageComments')" :title="t.videoPageComments">
        <template #desc>
          <span id="pages-desc-video-comments">{{ t.videoPageCommentsDesc }}</span>
        </template>
        <PagesSwitch v-model="settings.videoPageComments" describedby="pages-desc-video-comments" />
      </SettingsItem>
    </SettingsGroupSection>

    <SettingsGroupSection
      v-show="groupVisible('videoCard')"
      group-key="videoCard"
      :title="t.groupVideoCard"
      :desc="t.groupVideoCardDesc"
      :reset-label="t.resetGroup"
      :reset-done-label="t.resetGroupDone"
      :reset-done="resetDoneGroup === 'videoCard'"
      @reset="resetGroup('videoCard')"
    >
      <SettingsItem v-if="itemVisible('cardPreview')" :title="t.cardPreview" :desc="t.cardPreviewDesc">
        <Radio v-model="settings.enableVideoCardPreview" />
      </SettingsItem>

      <SettingsItem v-if="itemVisible('cardQuickActions')" :title="t.cardQuickActions" :desc="t.cardQuickActionsDesc">
        <Radio v-model="quickActionsModel" />
      </SettingsItem>
    </SettingsGroupSection>

    <SettingsGroupSection
      v-show="groupVisible('listPage')"
      group-key="listPage"
      :title="t.groupListPage"
      :desc="t.groupListPageDesc"
      :reset-label="t.resetGroup"
      :reset-done-label="t.resetGroupDone"
      :reset-done="resetDoneGroup === 'listPage'"
      @reset="resetGroup('listPage')"
    >
      <SettingsItem v-if="itemVisible('historyViewMode')" :title="t.historyViewMode">
        <Select v-model="settings.historyViewMode" :options="viewModeOptions" w="full" />
      </SettingsItem>

      <SettingsItem v-if="itemVisible('watchLaterViewMode')" :title="t.watchLaterViewMode">
        <Select v-model="settings.watchLaterViewMode" :options="viewModeOptions" w="full" />
      </SettingsItem>

      <SettingsItem v-if="itemVisible('favoritesViewMode')" :title="t.favoritesViewMode">
        <Select v-model="settings.favoritesViewMode" :options="viewModeOptions" w="full" />
      </SettingsItem>

      <SettingsItem v-if="itemVisible('defaultSort')" :title="t.defaultSort" :desc="t.defaultSortDesc">
        <Select v-model="settings.listDefaultSort" :options="sortOptions" w="full" />
      </SettingsItem>

      <SettingsItem v-if="itemVisible('listScrollMemory')" :title="t.listScrollMemory">
        <template #desc>
          <span id="pages-desc-list-scroll-memory">{{ t.listScrollMemoryDesc }}</span>
        </template>
        <PagesSwitch v-model="settings.enableListScrollMemory" describedby="pages-desc-list-scroll-memory" />
      </SettingsItem>
    </SettingsGroupSection>

    <SettingsGroupSection
      v-show="groupVisible('searchPage')"
      group-key="searchPage"
      :title="t.groupSearchPage"
      :desc="t.groupSearchPageDesc"
      :reset-label="t.resetGroup"
      :reset-done-label="t.resetGroupDone"
      :reset-done="resetDoneGroup === 'searchPage'"
      @reset="resetGroup('searchPage')"
    >
      <SettingsItem v-if="itemVisible('directPaste')" :title="t.directPaste" :desc="t.directPasteDesc">
        <Radio v-model="settings.searchPageDirectPasteEnabled" />
      </SettingsItem>
    </SettingsGroupSection>

    <SettingsGroupSection
      v-show="groupVisible('moments')"
      group-key="moments"
      :title="t.groupMoments"
      :reset-label="t.resetGroup"
      :reset-done-label="t.resetGroupDone"
      :reset-done="resetDoneGroup === 'moments'"
      @reset="resetGroup('moments')"
    >
      <SettingsItem v-if="itemVisible('momentsDensity')" :title="t.momentsDensity" :desc="t.momentsDensityDesc">
        <Select v-model="settings.momentsDensity" :options="densityOptions" w="full" />
      </SettingsItem>

      <SettingsItem v-if="itemVisible('momentsOptimize')" :title="t.momentsOptimize" :desc="t.momentsOptimizeDesc">
        <Radio v-model="settings.momentsOptimizeEnabled" />
      </SettingsItem>
    </SettingsGroupSection>

    <SettingsGroupSection
      v-show="groupVisible('notification')"
      group-key="notification"
      :title="t.groupNotification"
      :desc="t.groupNotificationDesc"
      :reset-label="t.resetGroup"
      :reset-done-label="t.resetGroupDone"
      :reset-done="resetDoneGroup === 'notification'"
      @reset="resetGroup('notification')"
    >
      <SettingsItem v-if="itemVisible('notificationOnlyUnread')" :title="t.notificationOnlyUnread" :desc="t.notificationOnlyUnreadDesc">
        <Radio v-model="settings.notificationOnlyUnread" />
      </SettingsItem>

      <SettingsItem v-if="itemVisible('notificationDensity')" :title="t.notificationDensity">
        <Select v-model="settings.notificationDensity" :options="densityOptions" w="full" />
      </SettingsItem>
    </SettingsGroupSection>

    <SettingsGroupSection
      v-show="groupVisible('searchResult')"
      group-key="searchResult"
      :title="t.groupSearchResult"
      :desc="t.groupSearchResultDesc"
      :reset-label="t.resetGroup"
      :reset-done-label="t.resetGroupDone"
      :reset-done="resetDoneGroup === 'searchResult'"
      @reset="resetGroup('searchResult')"
    >
      <SettingsItem v-if="itemVisible('searchDensity')" :title="t.searchDensity">
        <Select v-model="settings.searchDensity" :options="densityOptions" w="full" />
      </SettingsItem>
    </SettingsGroupSection>

    <SettingsGroupSection
      v-show="groupVisible('space')"
      group-key="space"
      :title="t.groupSpace"
      :desc="t.groupSpaceDesc"
      :reset-label="t.resetGroup"
      :reset-done-label="t.resetGroupDone"
      :reset-done="resetDoneGroup === 'space'"
      @reset="resetGroup('space')"
    >
      <SettingsItem v-if="itemVisible('spaceDensity')" :title="t.spaceDensity">
        <Select v-model="settings.spaceDensity" :options="densityOptions" w="full" />
      </SettingsItem>
    </SettingsGroupSection>

    <SettingsGroupSection
      v-show="groupVisible('channel')"
      group-key="channel"
      :title="t.groupChannel"
      :desc="t.groupChannelDesc"
      :reset-label="t.resetGroup"
      :reset-done-label="t.resetGroupDone"
      :reset-done="resetDoneGroup === 'channel'"
      @reset="resetGroup('channel')"
    >
      <SettingsItem v-if="itemVisible('channelDensity')" :title="t.channelDensity" :desc="t.channelDensityDesc">
        <Select v-model="settings.channelDensity" :options="densityOptions" w="full" />
      </SettingsItem>
    </SettingsGroupSection>

    <SettingsGroupSection
      v-show="groupVisible('article')"
      group-key="article"
      :title="t.groupArticle"
      :desc="t.groupArticleDesc"
      :reset-label="t.resetGroup"
      :reset-done-label="t.resetGroupDone"
      :reset-done="resetDoneGroup === 'article'"
      @reset="resetGroup('article')"
    >
      <SettingsItem v-if="itemVisible('articleReadingMode')" :title="t.articleReadingMode" :desc="t.articleReadingModeDesc">
        <Radio v-model="settings.articleReadingMode" />
      </SettingsItem>

      <SettingsItem v-if="itemVisible('articleFontSize')" :title="t.articleFontSize">
        <Select v-model="settings.articleFontSize" :options="fontSizeOptions" w="full" />
      </SettingsItem>
    </SettingsGroupSection>

    <SettingsGroupSection
      v-show="groupVisible('home')"
      group-key="home"
      :title="t.groupHome"
      :desc="t.groupHomeDesc"
      :reset-label="t.resetGroup"
      :reset-done-label="t.resetGroupDone"
      :reset-done="resetDoneGroup === 'home'"
      @reset="resetGroup('home')"
    >
      <SettingsItem v-if="itemVisible('homeCardDensity')" :title="t.homeCardDensity" :desc="t.homeCardDensityDesc">
        <Select v-model="settings.homeCardDensity" :options="densityOptions" w="full" />
      </SettingsItem>
    </SettingsGroupSection>

    <!-- 第 24 轮：页面自检（只读、不发请求、不参与顶部导航与搜索过滤） -->
    <SettingsGroupSection
      group-key="diagnostics"
      :title="t.groupDiagnostics"
      :desc="t.groupDiagnosticsDesc"
      :show-reset="false"
    >
      <DiagnosticsPanel />
    </SettingsGroupSection>

    <!-- 第 22 轮：数据导入 / 导出（不属于单页偏好，不进顶部导航与搜索过滤） -->
    <SettingsGroupSection
      group-key="data"
      :title="t.groupData"
      :desc="t.groupDataDesc"
      :show-reset="false"
    >
      <div class="pages-data" @keydown="handleDataKeydown">
        <div class="pages-data__actions">
          <button
            type="button"
            class="pages-data__button"
            :title="t.exportSettingsHint"
            @click="exportSettings"
          >
            <span class="i-tabler:download" aria-hidden="true" />
            <span>{{ t.exportSettings }}</span>
          </button>

          <button
            ref="importButtonRef"
            type="button"
            class="pages-data__button"
            :title="t.importSettingsHint"
            @click="triggerImport"
          >
            <span class="i-tabler:upload" aria-hidden="true" />
            <span>{{ t.importSettings }}</span>
          </button>

          <input
            ref="fileInputRef"
            type="file"
            accept="application/json,.json"
            class="pages-data__file"
            tabindex="-1"
            :aria-label="t.importSettings"
            @change="onImportFileChange"
          >
        </div>

        <p class="pages-data__hint">
          {{ t.exportSettingsHint }} · {{ t.importSettingsHint }}
        </p>

        <p
          v-if="dataStatus"
          class="pages-data__status"
          :class="`is-${dataStatusTone}`"
          role="status"
          aria-live="polite"
        >
          {{ dataStatus }}
        </p>

        <div
          v-if="pendingImport"
          class="pages-data__confirm"
          role="alertdialog"
          aria-modal="false"
          :aria-label="t.importConfirmTitle"
        >
          <p class="pages-data__confirm-title">
            {{ t.importConfirmTitle }}
          </p>
          <p class="pages-data__confirm-desc">
            {{ t.importConfirmDesc.replace('{count}', String(pendingImport.count)) }}
          </p>
          <div class="pages-data__confirm-actions">
            <button
              ref="confirmImportButtonRef"
              type="button"
              class="pages-data__button is-primary"
              @click="confirmImport"
            >
              <span class="i-tabler:check" aria-hidden="true" />
              <span>{{ t.importConfirm }}</span>
            </button>
            <button
              type="button"
              class="pages-data__button"
              @click="cancelImport"
            >
              {{ t.importCancel }}
            </button>
          </div>
        </div>
      </div>
    </SettingsGroupSection>
  </div>
</template>

<style lang="scss" scoped>
.pages-toolbar {
  position: sticky;
  // 设置面板顶部标题条固定占 80px，导航贴在它下面
  top: 5rem;
  z-index: 2;
  // 与 main 的左右内边距（p="x-12"）对齐：负边距 + 同值内边距，让吸顶时背景铺满
  margin: 0 -3rem 1rem;
  padding: 0.5rem 3rem;
  background: var(--bew-elevated-alt);
}

.pages-nav__track {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.pages-nav__track::-webkit-scrollbar {
  display: none;
}

.pages-nav__pill {
  flex: none;
  padding: 0.125rem 0.75rem;
  border: 1px solid var(--bew-border-color);
  border-radius: 999px;
  font-size: 0.75rem;
  line-height: 1.6;
  color: var(--bew-text-2);
  background: var(--bew-fill-1);
  cursor: pointer;
  transition:
    color var(--bew-motion-fast, 120ms) var(--bew-ease-out, ease),
    background-color var(--bew-motion-fast, 120ms) var(--bew-ease-out, ease),
    border-color var(--bew-motion-fast, 120ms) var(--bew-ease-out, ease);
}

.pages-nav__pill:hover {
  color: var(--bew-theme-color);
  background: var(--bew-fill-2);
}

.pages-nav__pill:focus-visible {
  outline: 2px solid var(--bew-theme-color);
  outline-offset: 2px;
}

.pages-nav__pill.is-active {
  color: var(--bew-text-auto);
  background: var(--bew-theme-color);
  border-color: var(--bew-theme-color);
}

.pages-search {
  margin-top: 0.5rem;
}

.pages-search__icon {
  color: var(--bew-text-3);
  font-size: 1rem;
}

.pages-search__clear,
.pages-empty__clear {
  flex: none;
  padding: 0 0.375rem;
  border: 0;
  color: var(--bew-text-3);
  background: transparent;
  font-size: 0.75rem;
  cursor: pointer;
}

.pages-search__clear:hover,
.pages-empty__clear:hover {
  color: var(--bew-theme-color);
}

.pages-search__clear:focus-visible,
.pages-empty__clear:focus-visible {
  outline: 2px solid var(--bew-theme-color);
  outline-offset: 2px;
}

.pages-empty {
  padding: 3rem 1rem;
  text-align: center;
  border: 1px dashed var(--bew-border-color);
  border-radius: var(--bew-radius);
  background: var(--bew-fill-alt);
}

.pages-empty__title {
  font-size: var(--bew-base-font-size);
  font-weight: 600;
  color: var(--bew-text-1);
}

.pages-empty__desc {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--bew-text-2);
}

.pages-empty__clear {
  margin-top: 0.75rem;
  padding: 0.25rem 0.875rem;
  border: 1px solid var(--bew-border-color);
  border-radius: 999px;
  background: var(--bew-fill-1);
  color: var(--bew-text-2);
  font-size: 0.75rem;
}

.pages-empty__clear:hover {
  color: var(--bew-theme-color);
  background: var(--bew-fill-2);
}

@media screen and (max-width: 640px) {
  .pages-toolbar {
    margin: 0 -1.5rem 1rem;
    padding: 0.5rem 1.5rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pages-nav__pill {
    transition: none;
  }
}

/* 第 19 轮：设置页搜索框 / 分组导航的键盘焦点可见性（暗色同样使用主题色描边） */
.pages-search :deep(input:focus-visible) {
  outline: 2px solid var(--bew-theme-color);
  outline-offset: 2px;
  border-radius: 6px;
}

/* 第 22 轮：数据导入 / 导出 */
.pages-data {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 0;
}

.pages-data__actions {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pages-data__button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--bew-border-color);
  border-radius: 999px;
  background: var(--bew-fill-1);
  color: var(--bew-text-1);
  font-size: 12px;
  line-height: 1.5;
  cursor: pointer;
  transition:
    color var(--bew-motion-fast, 120ms) var(--bew-ease-out, ease),
    background-color var(--bew-motion-fast, 120ms) var(--bew-ease-out, ease),
    border-color var(--bew-motion-fast, 120ms) var(--bew-ease-out, ease);
}

.pages-data__button:hover {
  color: var(--bew-theme-color);
  background: var(--bew-fill-2);
  border-color: var(--bew-theme-color-40);
}

.pages-data__button:focus-visible {
  outline: 2px solid var(--bew-theme-color);
  outline-offset: 2px;
}

.pages-data__button.is-primary {
  color: var(--bew-text-auto);
  background: var(--bew-theme-color);
  border-color: var(--bew-theme-color);
}

.pages-data__button.is-primary:hover {
  color: var(--bew-text-auto);
  opacity: 0.9;
}

/* 隐藏的原生 file input：仍可被读屏聚焦，但视觉上不占位 */
.pages-data__file {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.pages-data__hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--bew-text-3);
}

.pages-data__status {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}

.pages-data__status.is-success {
  color: var(--bew-success-color);
}

.pages-data__status.is-error {
  color: var(--bew-error-color);
}

.pages-data__confirm {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--bew-border-color);
  border-radius: var(--bew-radius);
  background: var(--bew-fill-alt);
}

.pages-data__confirm-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--bew-text-1);
}

.pages-data__confirm-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--bew-text-2);
}

.pages-data__confirm-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .pages-data__button {
    transition: none;
  }
}

/* 高对比度模式：用系统色，避免主题色 / 透明度对比不足 */
@media (forced-colors: active) {
  .pages-data__button {
    border-color: ButtonText;
    color: ButtonText;
    background: ButtonFace;
  }

  .pages-data__button.is-primary {
    border-color: Highlight;
    color: HighlightText;
    background: Highlight;
  }

  .pages-data__button:focus-visible {
    outline: 2px solid Highlight;
  }

  .pages-data__confirm {
    border-color: ButtonText;
  }

  .pages-data__status.is-success,
  .pages-data__status.is-error {
    color: CanvasText;
  }
}
</style>
