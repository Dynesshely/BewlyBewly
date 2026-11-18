/**
 * 稍后再看（API 自绘）的数据与写操作。
 *
 * # 接口（真机 2026-11-19 验证）
 *
 *   GET  /x/v2/history/toview                全量列表，**不分页**，无需签名
 *   POST /x/v2/history/toview/del            aid + viewed + csrf（viewed=true 时移除全部已看完）
 *   POST /x/v2/history/toview/clear          csrf → 全部清空
 *
 * 真机：`data.count`(7) 与 `data.list` 长度一致，没有游标字段 —— 一次拿全，
 * 页面上的「加载更多」对稍后再看是 no-op。
 *
 * # 失败回退
 *
 * 本模块跑在 Bewly 自己的 shadow DOM 页面里，**从不读写原生 B 站 DOM**
 * （原生页在这套 dock 页面体系里本来就被 Bewly 自己的页面盖住），
 * 所以接口失败时「完全不碰原生页面」是结构性保证，不需要额外回滚代码：
 * 失败只把页面切成错误态 + 重试按钮，账号数据不受影响。
 */
import type { WatchLaterApiItem } from './types'
import { computed, ref } from 'vue'
import { LIST_SCOPE } from './constants'
import {
  clearWatchLater,
  fetchWatchLaterList,
  isLoginRequiredError,
  removeWatchedFromWatchLater,
  removeWatchLater,
  toErrorMessage,
} from './fetcher'
import { watchLaterToCard } from './utils'

export function useWatchLater() {
  const items = ref<WatchLaterApiItem[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')
  const needLogin = ref(false)
  /** 失败时用于「在原版页面打开」的兜底地址 */
  const nativeUrl = 'https://www.bilibili.com/watchlater/#/list'

  /** 批量选择模式 */
  const selectMode = ref(false)
  /** 已选卡片的 key（`wl-<aid>`） */
  const selectedKeys = ref<string[]>([])
  /** 正在提交的写操作（禁用按钮，防重复点击） */
  const pending = ref(false)

  const cards = computed(() => items.value.map(watchLaterToCard))

  const selectedCount = computed(() => selectedKeys.value.length)
  const allSelected = computed(() => cards.value.length > 0 && selectedKeys.value.length === cards.value.length)

  /** 已看完的条数（progress === -1 或已看满；用于「移除已看完」按钮的可用性） */
  const watchedCount = computed(() => items.value.filter(item =>
    item.progress === -1 || (item.duration
      ? Number(item.progress) >= item.duration
      : false),
  ).length)

  function resetState() {
    items.value = []
    loaded.value = false
    error.value = ''
    needLogin.value = false
    selectedKeys.value = []
  }

  /** 首次加载 / 重试：清空后重新拉全量 */
  async function load() {
    loading.value = true
    error.value = ''
    needLogin.value = false
    try {
      items.value = await fetchWatchLaterList()
      loaded.value = true
    }
    catch (err) {
      error.value = toErrorMessage(err)
      needLogin.value = isLoginRequiredError(err)
      loaded.value = true
    }
    finally {
      loading.value = false
    }
  }

  /** 静默刷新（删除单条后不整页骨架，只重拉一次保证与服务端一致） */
  async function refresh() {
    try {
      items.value = await fetchWatchLaterList()
      loaded.value = true
      error.value = ''
    }
    catch (err) {
      error.value = toErrorMessage(err)
    }
  }

  function exitSelectMode() {
    selectMode.value = false
    selectedKeys.value = []
  }

  function toggleSelectMode() {
    if (selectMode.value)
      exitSelectMode()
    else
      selectMode.value = true
  }

  function toggleSelect(key: string) {
    const index = selectedKeys.value.indexOf(key)
    if (index === -1)
      selectedKeys.value.push(key)
    else
      selectedKeys.value.splice(index, 1)
  }

  function selectAll() {
    selectedKeys.value = cards.value.map(card => String(card.key))
  }

  function clearSelection() {
    selectedKeys.value = []
  }

  /** 从本地列表移除（写操作成功后调用，避免整页重排） */
  function removeLocal(key: string) {
    const target = cards.value.find(card => card.key === key)
    const raw = target?.raw as WatchLaterApiItem | undefined
    if (!raw)
      return
    items.value = items.value.filter(item => item !== raw)
    selectedKeys.value = selectedKeys.value.filter(item => item !== key)
  }

  /** 移除单条；返回 null 表示成功，否则是失败原因 */
  async function removeOne(key: string): Promise<string | null> {
    const target = cards.value.find(card => card.key === key)
    const item = target?.raw as WatchLaterApiItem | undefined
    if (!item || !item.aid)
      return 'missing aid'
    const result = await removeWatchLater(item.aid)
    if (result.ok) {
      removeLocal(key)
      return null
    }
    return result.reason
  }

  /** 批量移除所选；返回失败条数 */
  async function removeSelected(): Promise<{ removed: number, failed: number }> {
    const keys = [...selectedKeys.value]
    if (!keys.length)
      return { removed: 0, failed: 0 }

    pending.value = true
    let removed = 0
    let failed = 0
    try {
      for (const key of keys) {
        const reason = await removeOne(key)
        if (reason)
          failed++
        else
          removed++
      }
      exitSelectMode()
    }
    finally {
      pending.value = false
    }
    return { removed, failed }
  }

  /** 全部清空 */
  async function clearAll(): Promise<string | null> {
    pending.value = true
    try {
      const result = await clearWatchLater()
      if (!result.ok)
        return result.reason
      items.value = []
      selectedKeys.value = []
      selectMode.value = false
      loaded.value = true
      return null
    }
    finally {
      pending.value = false
    }
  }

  /** 移除所有已看完 */
  async function removeWatched(): Promise<string | null> {
    pending.value = true
    try {
      const result = await removeWatchedFromWatchLater()
      if (!result.ok)
        return result.reason
      await refresh()
      return null
    }
    finally {
      pending.value = false
    }
  }

  /** 全部打开（原生播放列表页）：稍后再看的「全部播放」入口 */
  function playAllUrl(): string {
    return nativeUrl
  }

  return {
    // 状态
    items,
    cards,
    loading,
    loaded,
    error,
    needLogin,
    nativeUrl,
    // 选择
    selectMode,
    selectedKeys,
    selectedCount,
    allSelected,
    watchedCount,
    pending,
    // 动作
    load,
    refresh,
    resetState,
    toggleSelectMode,
    exitSelectMode,
    toggleSelect,
    selectAll,
    clearSelection,
    removeOne,
    removeSelected,
    clearAll,
    removeWatched,
    playAllUrl,
    scope: LIST_SCOPE.watchLater,
  }
}
