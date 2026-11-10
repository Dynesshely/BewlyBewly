<script setup lang="ts">
import type { HistoryItem } from '~/components/SearchBar/searchHistoryProvider'
import { ref } from 'vue'
import { clearAllSearchHistory, getSearchHistory } from '~/components/SearchBar/searchHistoryProvider'

import { useDirectPasteSetting } from '../composables/useDirectPasteSetting'
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
const visibleHotKeywords = ref<string[]>([])

const HISTORY_VISIBLE = 8
const HOT_VISIBLE = 8

const recentKeywords = computed<string[]>(() => history.value.slice(0, HISTORY_VISIBLE).map(item => item.value))
const directPreview = computed(() => parseDirectLink(directInput.value))

onMounted(() => {
  void refreshHistory()
  shuffleHotKeywords()
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
}

async function clearHistory() {
  try {
    await clearAllSearchHistory()
  }
  catch {
    // 清空失败时仍然把本地视图清掉，避免按钮看起来没反应
  }
  history.value = []
}

function shuffleHotKeywords() {
  const pool = [...hotKeywords.value]
  for (let index = pool.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1))
    const current = pool[index]
    pool[index] = pool[swap]
    pool[swap] = current
  }
  visibleHotKeywords.value = pool.slice(0, HOT_VISIBLE)
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
        <button v-if="recentKeywords.length" type="button" class="quick-action" @click="clearHistory">
          {{ t('recent_clear') }}
        </button>
      </header>
      <p v-if="!recentKeywords.length" class="quick-empty">
        {{ t('recent_empty') }}
      </p>
      <ul v-else class="chip-list">
        <li v-for="keyword in recentKeywords" :key="keyword">
          <button type="button" class="chip" @click="searchKeyword(keyword)">
            <span class="i-tabler:history" aria-hidden="true" />
            <span class="chip-text">{{ keyword }}</span>
          </button>
        </li>
      </ul>
    </section>

    <!-- 热门推荐词 -->
    <section class="quick-section" aria-labelledby="bewly-search-hot-title">
      <header class="quick-head">
        <h2 id="bewly-search-hot-title" class="quick-title">
          {{ t('hot_title') }}
        </h2>
        <button type="button" class="quick-action" @click="shuffleHotKeywords">
          <span class="i-tabler:refresh" aria-hidden="true" />
          <span>{{ t('hot_refresh') }}</span>
        </button>
      </header>
      <ul class="chip-list">
        <li v-for="keyword in visibleHotKeywords" :key="keyword">
          <button type="button" class="chip chip--hot" @click="searchKeyword(keyword)">
            <span class="i-tabler:flame" aria-hidden="true" />
            <span class="chip-text">{{ keyword }}</span>
          </button>
        </li>
      </ul>
      <p class="quick-note">
        {{ t('hot_hint') }}
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

  &:hover {
    background: var(--bew-fill-1);
    color: var(--bew-text-1);
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
