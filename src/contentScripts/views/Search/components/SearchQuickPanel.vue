<script setup lang="ts">
import type { HistoryItem } from '~/components/SearchBar/searchHistoryProvider'
import { ref } from 'vue'
import { clearAllSearchHistory, getSearchHistory, removeSearchHistory } from '~/components/SearchBar/searchHistoryProvider'

import { useDirectPasteSetting } from '../composables/useDirectPasteSetting'
import { useHotSearch } from '../composables/useHotSearch'
import { useSearchI18n } from '../i18n'
import { labelKeyForKind, parseDirectLink } from '../utils/directLink'
import { navigateToSearch, openDirectLink } from '../utils/navigation'

/**
 * 搜索起始页的快捷入口：最近搜索 / 热门推荐词 / BV 号与链接直达。
 *
 * 最近搜索复用搜索栏同一份 B 站搜索历史（`searchHistoryProvider`），
 * 这里只读 + 清空，不另开存储，保证两处列表一致。
 */
const { t, hotKeywords } = useSearchI18n()
const directPasteEnabled = useDirectPasteSetting()

const history = ref<HistoryItem[]>([])
const directInput = ref<string>('')
const directError = ref<string>('')

const HISTORY_VISIBLE = 8
const HOT_VISIBLE = 8

/**
 * 最近搜索的本地增强：置顶（最多 3 条）。
 *
 * 置顶只存在本地 localStorage（key `bewly-search-pinned`），因为 B 站搜索历史接口
 * 没有「置顶」概念；居前的顺序只影响本面板的展示，不写回 B 站历史。
 */
const PINNED_STORAGE_KEY = 'bewly-search-pinned'
const PINNED_LIMIT = 3
/** 删 / 清后给 B 站 iframe 的写入留一点时间，超时就只做本地删除 */
const HISTORY_WRITE_TIMEOUT = 800

function readPinned(): string[] {
  try {
    const raw = window.localStorage.getItem(PINNED_STORAGE_KEY)
    if (!raw)
      return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed))
      return []
    return parsed
      .filter((value): value is string => typeof value === 'string')
      .slice(0, PINNED_LIMIT)
  }
  catch {
    return []
  }
}

const pinned = ref<string[]>(readPinned())

function persistPinned() {
  try {
    window.localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(pinned.value))
  }
  catch {
    // 隐私模式 / 存储被禁用：本次会话内仍然生效，只是刷新不保持
  }
}

interface RecentItem extends HistoryItem {
  pinned: boolean
}

/**
 * 最近搜索展示列表：置顶项按置顶顺序排最前，其余按原历史顺序补齐；
 * 置顶项即使不在前 8 条里也会被拉出来显示（总条数仍受 HISTORY_VISIBLE 限制）。
 */
const recentItems = computed<RecentItem[]>(() => {
  const pinnedItems = pinned.value
    .map(value => history.value.find(item => item.value === value))
    .filter((item): item is HistoryItem => Boolean(item))

  const pinnedValues = new Set(pinnedItems.map(item => item.value))
  const rest = history.value
    .filter(item => !pinnedValues.has(item.value))
    .slice(0, Math.max(0, HISTORY_VISIBLE - pinnedItems.length))

  return [
    ...pinnedItems.map(item => ({ ...item, pinned: true })),
    ...rest.map(item => ({ ...item, pinned: false })),
  ]
})

const directPreview = computed(() => parseDirectLink(directInput.value))

// 清空二次确认 / 置顶提示的状态与计时器（在 refreshHistory 的卸载清理里也会用到）
const clearConfirming = ref(false)
const recentStatus = ref('')
let clearConfirmTimer: number | null = null
let statusTimer: number | null = null

/**
 * 热门搜索：优先真实热搜（接口一次取 12 条），失败/未登录回落到内置词表。
 * 显示 8 条，「换一批」把窗口在 12 条里轮换一批（保留真实排名序号）。
 */
const {
  items: hotItems,
  source: hotSource,
  loading: hotLoading,
  settled: hotSettled,
  load: loadHotSearch,
} = useHotSearch(() => hotKeywords.value)

const hotWindowStart = ref(0)

const visibleHotItems = computed(() => {
  const pool = hotItems.value
  if (!pool.length)
    return []
  const count = Math.min(HOT_VISIBLE, pool.length)
  return Array.from({ length: count }, (_, offset) => pool[(hotWindowStart.value + offset) % pool.length])
})

onMounted(() => {
  void refreshHistory()
  void loadHotSearch()
})

async function refreshHistory() {
  try {
    // 原生搜索页没有 B 站的 search_history iframe 时不会回消息，这里加超时兜底
    const items = await Promise.race([
      getSearchHistory(),
      new Promise<HistoryItem[]>((resolve) => {
        setTimeout(resolve, 600, [])
      }),
    ])
    history.value = Array.isArray(items)
      ? items
      : []
  }
  catch {
    history.value = []
  }
  // 历史来源可能已经在别处删过条目：把失效的置顶清掉（历史为空时不清理，避免读取失败误删）
  if (history.value.length)
    prunePinned()
}

onBeforeUnmount(() => {
  resetClearConfirm()
  if (statusTimer !== null) {
    window.clearTimeout(statusTimer)
    statusTimer = null
  }
})

function resetClearConfirm() {
  clearConfirming.value = false
  if (clearConfirmTimer !== null) {
    window.clearTimeout(clearConfirmTimer)
    clearConfirmTimer = null
  }
}

function showRecentStatus(message: string) {
  recentStatus.value = message
  if (statusTimer !== null)
    window.clearTimeout(statusTimer)
  statusTimer = window.setTimeout(() => {
    statusTimer = null
    recentStatus.value = ''
  }, 2200)
}

/** 清空按钮：第一次点进入「确认清空」（3 秒有效），3 秒内再点才真正执行 */
function requestClearHistory() {
  if (!clearConfirming.value) {
    clearConfirming.value = true
    if (clearConfirmTimer !== null)
      window.clearTimeout(clearConfirmTimer)
    clearConfirmTimer = window.setTimeout(() => {
      clearConfirmTimer = null
      clearConfirming.value = false
    }, 3000)
    return
  }

  resetClearConfirm()
  void clearHistory()
}

async function clearHistory() {
  // 置顶也一起清掉：记录都没了，留着置顶只会得到一堆无效引用
  pinned.value = []
  persistPinned()
  recentStatus.value = ''
  try {
    await Promise.race([
      clearAllSearchHistory(),
      new Promise<void>(resolve => window.setTimeout(resolve, HISTORY_WRITE_TIMEOUT)),
    ])
  }
  catch {
    // 清空失败时仍然把本地视图清掉，避免按钮看起来没反应
  }
  history.value = []
}

/** 置顶 / 取消置顶（最多 3 条）；超出上限时给一条提示 */
function togglePin(keyword: string) {
  const index = pinned.value.indexOf(keyword)
  if (index >= 0) {
    pinned.value = pinned.value.filter(value => value !== keyword)
  }
  else {
    if (pinned.value.length >= PINNED_LIMIT) {
      showRecentStatus(t('recent_pin_limit'))
      return
    }
    pinned.value = [...pinned.value, keyword]
  }
  persistPinned()
}

/**
 * 单条删除：先改本地视图（即时反馈），再尽力从 B 站搜索历史里删；
 * iframe 不存在 / 不回应时超时后只保留本地删除（文档已说明）。
 */
async function deleteRecent(keyword: string) {
  history.value = history.value.filter(item => item.value !== keyword)
  if (pinned.value.includes(keyword)) {
    pinned.value = pinned.value.filter(value => value !== keyword)
    persistPinned()
  }
  try {
    await Promise.race([
      removeSearchHistory(keyword),
      new Promise<void>(resolve => window.setTimeout(resolve, HISTORY_WRITE_TIMEOUT)),
    ])
  }
  catch {
    // 只删本地记录即可，不打扰用户
  }
}

/** 历史变了（含在搜索栏那边删过）时把失效的置顶清掉 */
function prunePinned() {
  const next = pinned.value.filter(value => history.value.some(item => item.value === value))
  if (next.length === pinned.value.length)
    return
  pinned.value = next
  persistPinned()
}

/** 换一批：在 12 条热词池里把展示窗口后移 8 条（并循环），序号仍是真实排名 */
function rotateHotKeywords() {
  const poolLength = hotItems.value.length
  if (poolLength <= HOT_VISIBLE)
    return
  hotWindowStart.value = (hotWindowStart.value + HOT_VISIBLE) % poolLength
}

function retryHotSearch() {
  hotWindowStart.value = 0
  void loadHotSearch(true)
}

async function searchKeyword(keyword: string) {
  await navigateToSearch(keyword)
  await refreshHistory()
}

function submitDirect() {
  directError.value = ''
  const target = directPreview.value
  if (!target) {
    directError.value = t('direct_invalid')
    return
  }
  openDirectLink(target)
  directInput.value = ''
}

function handlePaste(event: ClipboardEvent) {
  // 直达输入框自己负责预览与提交，不再冒泡到页面级的「粘贴直达」逻辑
  event.stopPropagation()
}
</script>

<template>
  <div class="quick-panel">
    <!-- 最近搜索 -->
    <section class="quick-section" aria-labelledby="bewly-search-recent-title">
      <header class="quick-head">
        <h2 id="bewly-search-recent-title" class="quick-title">
          {{ t('recent_title') }}
        </h2>
        <button
          v-if="recentItems.length"
          type="button"
          class="quick-action"
          :class="{ 'is-confirming': clearConfirming }"
          :aria-label="clearConfirming ? t('recent_clear_hint') : t('recent_clear')"
          :title="clearConfirming ? t('recent_clear_hint') : t('recent_clear')"
          @click="requestClearHistory"
          @keydown.esc.stop.prevent="resetClearConfirm"
        >
          {{ clearConfirming ? t('recent_clear_confirm') : t('recent_clear') }}
        </button>
      </header>
      <p v-if="!recentItems.length" class="quick-empty">
        {{ t('recent_empty') }}
      </p>
      <ul v-else class="chip-list chip-list--recent">
        <li
          v-for="item in recentItems"
          :key="item.value"
          class="recent-item"
          :class="{ 'is-pinned': item.pinned }"
        >
          <button type="button" class="chip chip--recent" @click="searchKeyword(item.value)">
            <span :class="item.pinned ? 'i-tabler:pin-filled' : 'i-tabler:history'" aria-hidden="true" />
            <span class="chip-text">{{ item.value }}</span>
          </button>
          <span class="recent-item__actions">
            <button
              type="button"
              class="chip-action"
              :class="{ 'is-active': item.pinned }"
              :aria-label="item.pinned ? t('recent_unpin_named', { keyword: item.value }) : t('recent_pin_named', { keyword: item.value })"
              :aria-pressed="item.pinned"
              :title="item.pinned ? t('recent_unpin') : t('recent_pin')"
              @click="togglePin(item.value)"
            >
              <span :class="item.pinned ? 'i-tabler:pin-filled' : 'i-tabler:pin'" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="chip-action chip-action--danger"
              :aria-label="t('recent_delete_named', { keyword: item.value })"
              :title="t('recent_delete')"
              @click="deleteRecent(item.value)"
            >
              <span class="i-tabler:x" aria-hidden="true" />
            </button>
          </span>
        </li>
      </ul>
      <p v-if="recentStatus" class="quick-note quick-status" role="status">
        {{ recentStatus }}
      </p>
    </section>

    <!-- 热门搜索（真实热搜，失败回落内置词表） -->
    <section class="quick-section" aria-labelledby="bewly-search-hot-title">
      <header class="quick-head">
        <h2 id="bewly-search-hot-title" class="quick-title">
          {{ t('hot_title') }}
        </h2>
        <button
          type="button"
          class="quick-action"
          :disabled="hotLoading || hotItems.length <= HOT_VISIBLE"
          :title="t('hot_refresh')"
          @click="rotateHotKeywords"
        >
          <span class="i-tabler:refresh" aria-hidden="true" />
          <span>{{ t('hot_refresh') }}</span>
        </button>
      </header>
      <ul v-if="visibleHotItems.length" class="chip-list">
        <li v-for="item in visibleHotItems" :key="item.keyword">
          <button
            type="button"
            class="chip chip--hot"
            :class="{ 'chip--top': item.rank <= 3 }"
            :title="item.keyword"
            @click="searchKeyword(item.keyword)"
          >
            <span class="chip-rank" aria-hidden="true">{{ item.rank }}</span>
            <span class="chip-text">{{ item.keyword }}</span>
          </button>
        </li>
      </ul>
      <p class="quick-note">
        <template v-if="hotSource === 'remote'">
          {{ t('hot_source_remote') }}
        </template>
        <template v-else>
          {{ t('hot_source_fallback') }}
          <button
            v-if="hotSettled && !hotLoading"
            type="button"
            class="quick-inline-link"
            @click="retryHotSearch"
          >
            {{ t('hot_retry') }}
          </button>
        </template>
      </p>
    </section>

    <!-- BV 号 / 链接直达 -->
    <section class="quick-section" aria-labelledby="bewly-search-direct-title">
      <header class="quick-head">
        <h2 id="bewly-search-direct-title" class="quick-title">
          {{ t('direct_title') }}
        </h2>
        <label class="quick-switch">
          <input
            v-model="directPasteEnabled"
            type="checkbox"
            class="quick-switch-input"
          >
          <span class="quick-switch-track" aria-hidden="true" />
          <span class="quick-switch-text">{{ t('direct_paste_switch') }}</span>
        </label>
      </header>

      <form class="direct-form" @submit.prevent="submitDirect">
        <input
          v-model="directInput"
          class="direct-input"
          type="text"
          spellcheck="false"
          :placeholder="t('direct_placeholder')"
          :aria-label="t('direct_placeholder')"
          @input="directError = ''"
          @paste="handlePaste"
        >
        <button type="submit" class="direct-submit">
          <span class="i-tabler:corner-down-left" aria-hidden="true" />
          <span>{{ t('direct_go') }}</span>
        </button>
      </form>

      <p v-if="directError" class="quick-error" role="alert">
        {{ directError }}
      </p>
      <p v-else-if="directPreview" class="quick-preview">
        <span class="i-tabler:circle-check" aria-hidden="true" />
        <span>{{ t('direct_detected', { label: t(labelKeyForKind(directPreview.kind)), id: directPreview.id }) }}</span>
      </p>
      <p v-else class="quick-note">
        {{ t('direct_hint') }}
      </p>
    </section>
  </div>
</template>

<style scoped lang="scss">
.quick-panel {
  --quick-ease: cubic-bezier(0.22, 0.61, 0.36, 1);
  --quick-duration: 180ms;

  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 720px;
  padding: 20px;
  border: 1px solid var(--bew-border-color);
  border-radius: var(--bew-radius);
  background: var(--bew-elevated);
  box-shadow: var(--bew-shadow-1);
  text-align: left;
}

.quick-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quick-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.quick-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--bew-text-1);
}

.quick-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--bew-text-3);
  font-size: 12px;
  line-height: 20px;
  cursor: pointer;
  transition:
    background var(--quick-duration) var(--quick-ease),
    color var(--quick-duration) var(--quick-ease);

  &:hover:not(:disabled) {
    background: var(--bew-fill-1);
    color: var(--bew-text-1);
  }

  &:disabled {
    cursor: default;
    opacity: 0.45;
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 2px;
  }
}

.quick-empty,
.quick-note {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--bew-text-3);
}

.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 220px;
  padding: 4px 10px;
  border: 1px solid var(--bew-border-color);
  border-radius: 10px;
  background: var(--bew-fill-1);
  color: var(--bew-text-2);
  font-size: 12px;
  line-height: 20px;
  cursor: pointer;
  transition:
    background var(--quick-duration) var(--quick-ease),
    color var(--quick-duration) var(--quick-ease),
    border-color var(--quick-duration) var(--quick-ease);

  &:hover {
    border-color: var(--bew-theme-color-40);
    background: var(--bew-fill-2);
    color: var(--bew-text-1);
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 2px;
  }

  &--hot:hover {
    color: var(--bew-theme-color);
  }
}

.chip-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 最近搜索：每条 = 主按钮（点词直接搜索）+ 置顶 / 删除两个小动作 */
.chip-list--recent {
  gap: 8px;
}

.recent-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  max-width: 100%;
}

.chip--recent {
  max-width: 220px;
}

.recent-item.is-pinned .chip--recent {
  border-color: var(--bew-theme-color-40);
  color: var(--bew-theme-color);
}

/* 动作按钮默认隐藏在 hover / focus-within 时出现；触屏设备常显 */
.recent-item__actions {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 2px;
  margin-left: 2px;
  opacity: 0;
  transition: opacity var(--quick-duration) var(--quick-ease);
}

.recent-item:hover .recent-item__actions,
.recent-item:focus-within .recent-item__actions {
  opacity: 1;
}

.chip-action {
  display: inline-flex;
  flex: none;
  justify-content: center;
  align-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--bew-text-3);
  font-size: 12px;
  cursor: pointer;
  transition:
    background var(--quick-duration) var(--quick-ease),
    color var(--quick-duration) var(--quick-ease);

  &:hover {
    background: var(--bew-fill-2);
    color: var(--bew-text-1);
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 1px;
  }

  &.is-active {
    color: var(--bew-theme-color);
  }

  &--danger:hover {
    color: var(--bew-error-color);
  }
}

.quick-action.is-confirming {
  color: var(--bew-error-color);
  background: var(--bew-fill-2);
}

.quick-status {
  color: var(--bew-theme-color);
}

@media (hover: none) {
  .recent-item__actions {
    opacity: 1;
  }
}

/* 热搜序号徽标：前三名用主题色 */
.chip-rank {
  display: inline-flex;
  flex: none;
  justify-content: center;
  align-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 6px;
  background: var(--bew-fill-2);
  color: var(--bew-text-3);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.chip--top {
  border-color: var(--bew-theme-color-40);
}

.chip--top .chip-rank {
  background: var(--bew-theme-color-10);
  color: var(--bew-theme-color);
  font-weight: 700;
}

/* 底部提示里的小动作（热搜失败后的「重试」） */
.quick-inline-link {
  margin-left: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--bew-theme-color);
  font-size: inherit;
  line-height: inherit;
  cursor: pointer;
  text-decoration: underline;

  &:hover {
    opacity: 0.8;
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 2px;
    border-radius: 4px;
  }
}

.quick-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--bew-text-2);
  font-size: 12px;
  cursor: pointer;
}

.quick-switch-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;

  &:checked + .quick-switch-track {
    background: var(--bew-theme-color);
  }

  &:checked + .quick-switch-track::after {
    transform: translateX(14px);
  }

  &:focus-visible + .quick-switch-track {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 2px;
  }
}

.quick-switch-track {
  position: relative;
  flex: none;
  width: 30px;
  height: 16px;
  border-radius: 8px;
  background: var(--bew-fill-3);
  transition: background var(--quick-duration) var(--quick-ease);

  &::after {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--bew-elevated);
    content: "";
    transition: transform var(--quick-duration) var(--quick-ease);
  }
}

.direct-form {
  display: flex;
  gap: 8px;
}

.direct-input {
  flex: 1;
  min-width: 0;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--bew-border-color);
  border-radius: 10px;
  outline: none;
  background: var(--bew-fill-1);
  color: var(--bew-text-1);
  font-size: 13px;
  transition: border-color var(--quick-duration) var(--quick-ease);

  &::placeholder {
    color: var(--bew-text-3);
  }

  &:focus {
    border-color: var(--bew-theme-color);
    background: var(--bew-elevated);
  }
}

.direct-submit {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
  height: 36px;
  padding: 0 14px;
  border: none;
  border-radius: 10px;
  background: var(--bew-theme-color);
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition:
    opacity var(--quick-duration) var(--quick-ease),
    transform var(--quick-duration) var(--quick-ease);

  &:hover {
    opacity: 0.88;
  }

  &:active {
    transform: scale(0.97);
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 2px;
  }
}

.quick-preview,
.quick-error {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}

.quick-preview {
  color: var(--bew-success-color);
}

.quick-error {
  color: var(--bew-error-color);
}

/* 窄屏：不溢出、表单可换行、正文可截断 */
@media (max-width: 640px) {
  .quick-panel {
    max-width: 100%;
    padding: 16px;
  }

  .chip-list--recent {
    gap: 6px;
  }

  .recent-item {
    max-width: 100%;
  }

  .chip--recent {
    max-width: 100%;
  }

  .recent-item__actions {
    opacity: 1;
  }

  .quick-head {
    align-items: flex-start;
  }

  .quick-switch {
    flex-wrap: wrap;
    max-width: 100%;
  }

  .chip {
    max-width: 100%;
  }

  .direct-form {
    flex-wrap: wrap;
  }

  .direct-input {
    flex: 1 1 100%;
  }

  .direct-submit {
    flex: 1 1 auto;
    justify-content: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .quick-panel *,
  .quick-panel *::before,
  .quick-panel *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    transform: none !important;
  }
}
</style>
