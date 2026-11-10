import type { ListSortMode, ListViewMode } from './types'

import { ref, watch } from 'vue'

export const LIST_VIEW_MODES: ListViewMode[] = ['comfortable', 'compact', 'list']
export const LIST_SORT_MODES: ListSortMode[] = ['time', 'duration', 'title']

const DEFAULT_VIEW_MODE: ListViewMode = 'comfortable'
const DEFAULT_SORT_MODE: ListSortMode = 'time'

const VIEW_KEY_PREFIX = 'bewly-list-view-'
const SORT_KEY_PREFIX = 'bewly-list-sort-'

function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  }
  catch {
    return null
  }
}

function writePreference(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  }
  catch {
    // 隐私模式或存储配额不足时忽略，页面依然可用
  }
}

function pick<T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T {
  return raw && (allowed as readonly string[]).includes(raw)
    ? raw as T
    : fallback
}

/**
 * 列表页偏好：视图模式与排序方式，按页面作用域持久化到 localStorage。
 * 视图模式 key 形如 bewly-list-view-history，排序 key 形如 bewly-list-sort-history。
 */
export function useListPreferences(scope: string) {
  const viewKey = VIEW_KEY_PREFIX + scope
  const sortKey = SORT_KEY_PREFIX + scope

  const viewMode = ref<ListViewMode>(pick(readPreference(viewKey), LIST_VIEW_MODES, DEFAULT_VIEW_MODE))
  const sortMode = ref<ListSortMode>(pick(readPreference(sortKey), LIST_SORT_MODES, DEFAULT_SORT_MODE))

  watch(viewMode, value => writePreference(viewKey, value))
  watch(sortMode, value => writePreference(sortKey, value))

  function cycleViewMode() {
    viewMode.value = LIST_VIEW_MODES[(LIST_VIEW_MODES.indexOf(viewMode.value) + 1) % LIST_VIEW_MODES.length]
  }

  function cycleSortMode() {
    sortMode.value = LIST_SORT_MODES[(LIST_SORT_MODES.indexOf(sortMode.value) + 1) % LIST_SORT_MODES.length]
  }

  return {
    viewMode,
    sortMode,
    cycleViewMode,
    cycleSortMode,
  }
}
