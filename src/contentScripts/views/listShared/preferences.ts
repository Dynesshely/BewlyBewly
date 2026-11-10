import type { ListSortMode, ListViewMode } from './types'

import { computed } from 'vue'

import { settings } from '~/logic'

export const LIST_VIEW_MODES: ListViewMode[] = ['comfortable', 'compact', 'list']
export const LIST_SORT_MODES: ListSortMode[] = ['time', 'duration', 'title']

const DEFAULT_VIEW_MODE: ListViewMode = 'comfortable'
const DEFAULT_SORT_MODE: ListSortMode = 'time'

const VIEW_KEY_PREFIX = 'bewly-list-view-'
const SORT_KEY_PREFIX = 'bewly-list-sort-'

type ListViewModeField = 'historyViewMode' | 'watchLaterViewMode' | 'favoritesViewMode'

/** 页面作用域 → 各自独立的 settings 视图字段 */
const VIEW_MODE_FIELD_BY_SCOPE: Record<string, ListViewModeField> = {
  history: 'historyViewMode',
  'watch-later': 'watchLaterViewMode',
  favorites: 'favoritesViewMode',
}

/** 已经做过一次性迁移的作用域，避免每次调用都读 localStorage */
const migratedScopes = new Set<string>()

function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  }
  catch {
    return null
  }
}

function removePreference(key: string) {
  try {
    window.localStorage.removeItem(key)
  }
  catch {
    // 隐私模式或存储被禁用时忽略
  }
}

function pick<T extends string>(raw: string | null, allowed: readonly T[]): T | null {
  return raw && (allowed as readonly string[]).includes(raw)
    ? raw as T
    : null
}

/**
 * 把第 1 轮写在 localStorage 里的视图 / 排序偏好一次性迁移到 settings。
 *
 * 迁移只在「当前 settings 仍等于默认值」时覆盖，避免用户已经在设置页改过之后又被旧值覆盖；
 * 不管是否覆盖，读完就删掉旧 key，保证只迁移一次。
 */
function migrateLegacyPreferences(scope: string, viewModeField: ListViewModeField) {
  if (migratedScopes.has(scope))
    return
  migratedScopes.add(scope)

  const viewKey = VIEW_KEY_PREFIX + scope
  const sortKey = SORT_KEY_PREFIX + scope

  const legacyViewMode = pick(readPreference(viewKey), LIST_VIEW_MODES)
  const legacySortMode = pick(readPreference(sortKey), LIST_SORT_MODES)

  if (legacyViewMode && settings.value[viewModeField] === DEFAULT_VIEW_MODE)
    settings.value[viewModeField] = legacyViewMode

  if (legacySortMode && settings.value.listDefaultSort === DEFAULT_SORT_MODE)
    settings.value.listDefaultSort = legacySortMode

  removePreference(viewKey)
  removePreference(sortKey)
}

/**
 * 列表页偏好：视图模式与排序方式。
 *
 * 视图模式按页面作用域存进各自的 settings 字段（historyViewMode / watchLaterViewMode /
 * favoritesViewMode），排序统一存 listDefaultSort。旧版本写在 localStorage 里的
 * 「bewly-list-view-*」/「bewly-list-sort-*」会在首次调用时迁移一次。
 */
export function useListPreferences(scope: string) {
  const viewModeField = VIEW_MODE_FIELD_BY_SCOPE[scope] ?? 'historyViewMode'

  migrateLegacyPreferences(scope, viewModeField)

  const viewMode = computed<ListViewMode>({
    get: () => settings.value[viewModeField] ?? DEFAULT_VIEW_MODE,
    set: (value) => {
      settings.value[viewModeField] = value
    },
  })

  // 排序是三个列表页共用的设置，因此只落在 listDefaultSort 上
  const sortMode = computed<ListSortMode>({
    get: () => settings.value.listDefaultSort ?? DEFAULT_SORT_MODE,
    set: (value) => {
      settings.value.listDefaultSort = value
    },
  })

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
