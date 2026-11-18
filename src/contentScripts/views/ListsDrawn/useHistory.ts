/**
 * 历史记录（API 自绘）的数据与写操作。
 *
 * # 接口（真机 2026-11-19 验证 —— 任务书路径有误，这里以真机为准）
 *
 *   GET  /x/web-interface/history/cursor?max&view_at&business&ps&type=all
 *   GET  /x/v2/history/shadow                查暂停状态（data 是布尔）
 *   POST /x/v2/history/delete                kid=`${business}_${oid}` + csrf
 *   POST /x/v2/history/clear                 csrf
 *   POST /x/v2/history/shadow/set            switch + csrf
 *
 * **历史接口不是 wbi 路径**：任务书给的 `/x/web-interface/wbi/history/cursor` 与
 * `/x/web-interface/wbi/history/search` 真机是 HTTP 404；正确路径没有 `wbi` 前缀。
 * 带 wbi 签名与不带签名都返回 code 0，原生页面自己发请求也不带 w_rid / wts ——
 * 所以本模块统一走无签名的 {@link fetchHistoryPage}。
 *
 * # 翻页（真机）
 *
 * 必须把上一页 `data.cursor` 里的 **max + view_at + business 三个字段一起**带回去；
 * 只传 max 会重复拿到第一页。翻到末尾时服务端回 `cursor = {max:0,view_at:0,business:'',ps:0}`
 * 与空 list，据此判定没有更多。
 *
 * # 日期分组
 *
 * 按 `view_at` 分「今天 / 昨天 / 更早」三段（需求指定），分组是**纯前端**计算，
 * 不额外发请求。
 */
import type { HistoryApiItem } from './types'
import { computed, ref } from 'vue'
import { HISTORY_PAGE_SIZE, LIST_SCOPE } from './constants'
import {
  clearHistory,
  deleteHistoryItem,
  fetchHistoryPage,
  fetchHistoryPaused,
  isLoginRequiredError,
  setHistoryPaused,
  toErrorMessage,
} from './fetcher'
import { groupByDate, historyToCard, matchesKeyword } from './utils'

export function useHistory() {
  const items = ref<HistoryApiItem[]>([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const loaded = ref(false)
  const error = ref('')
  const needLogin = ref(false)
  const hasMore = ref(true)
  /** 是否暂停记录观看历史（接口 /x/v2/history/shadow） */
  const paused = ref(false)

  /** 前端过滤词（不请求服务端；需求里历史只要「按日期分组 + 单条删除」） */
  const keyword = ref('')
  const pending = ref(false)

  /** 下一页游标；第一页是 undefined */
  let cursor: { max: number, viewAt: number, business: string } | undefined
  /** 请求序号：切页 / 重试时丢弃上一轮迟到的响应 */
  let requestSeq = 0

  const cards = computed(() => items.value.map(historyToCard))

  /** 过滤后的卡片（前端过滤已加载项） */
  const filteredCards = computed(() => {
    const word = keyword.value.trim()
    if (!word)
      return cards.value
    return cards.value.filter((card) => {
      const raw = card.raw as HistoryApiItem | undefined
      return matchesKeyword(
        [
          raw?.title,
          raw?.show_title,
          raw?.author_name,
          raw?.tag_name,
          raw?.new_desc,
        ],
        word,
      )
    })
  })

  /** 按日期分组（今天 / 昨天 / 更早），空组不出现 */
  const groups = computed(() => groupByDate(filteredCards.value, card => card.timestamp))

  function resetState() {
    items.value = []
    cursor = undefined
    hasMore.value = true
    loaded.value = false
    error.value = ''
    needLogin.value = false
    keyword.value = ''
  }

  /** 拉一页；isFirst 决定是替换还是追加 */
  async function loadPage(isFirst: boolean) {
    const seq = ++requestSeq
    if (isFirst) {
      loading.value = true
      error.value = ''
      needLogin.value = false
    }
    else {
      loadingMore.value = true
    }

    try {
      const page = await fetchHistoryPage(isFirst ? undefined : cursor)
      if (seq !== requestSeq)
        return
      if (isFirst) {
        items.value = page.items
      }
      else {
        items.value = [
          ...items.value,
          ...page.items,
        ]
      }

      cursor = page.cursor
      // 服务端翻到末尾时回全 0 游标 + 空 list：两者任一命中都判定「没有更多」。
      // 接口没有 has_more 字段，正常页恒为 ps 条（真机 ps=20 时每页 20 条），
      // 所以「本页不足 ps 条」也当作最后一页（与原生页面的判定一致）。
      const reachedEnd = page.items.length === 0
        || (page.cursor.max === 0 && page.cursor.viewAt === 0)
      hasMore.value = !reachedEnd && page.items.length >= HISTORY_PAGE_SIZE
      loaded.value = true
    }
    catch (err) {
      if (seq !== requestSeq)
        return
      error.value = toErrorMessage(err)
      needLogin.value = isLoginRequiredError(err)
      loaded.value = true
    }
    finally {
      if (seq === requestSeq) {
        loading.value = false
        loadingMore.value = false
      }
    }
  }

  /** 首次加载 / 重试 */
  async function load() {
    cursor = undefined
    hasMore.value = true
    await loadPage(true)
  }

  /** 加载更多（滚动到底触发） */
  async function loadMore() {
    if (loading.value || loadingMore.value || !hasMore.value)
      return
    await loadPage(false)
  }

  async function refreshPausedState() {
    try {
      paused.value = await fetchHistoryPaused()
    }
    catch {
      // 暂停状态是可选增强：失败时保持原值，不影响列表
    }
  }

  /** 删除单条；返回 null 表示成功 */
  async function removeOne(key: string): Promise<string | null> {
    const card = cards.value.find(entry => entry.key === key)
    const item = card?.raw as HistoryApiItem | undefined
    if (!item)
      return 'missing item'
    const result = await deleteHistoryItem(item)
    if (!result.ok)
      return result.reason
    items.value = items.value.filter(entry => entry !== item)
    return null
  }

  /** 清空历史 */
  async function clearAll(): Promise<string | null> {
    pending.value = true
    try {
      const result = await clearHistory()
      if (!result.ok)
        return result.reason
      items.value = []
      cursor = undefined
      hasMore.value = false
      keyword.value = ''
      return null
    }
    finally {
      pending.value = false
    }
  }

  /** 暂停 / 恢复记录 */
  async function togglePaused(next: boolean): Promise<string | null> {
    pending.value = true
    try {
      const result = await setHistoryPaused(next)
      if (!result.ok)
        return result.reason
      paused.value = next
      return null
    }
    finally {
      pending.value = false
    }
  }

  return {
    items,
    cards,
    filteredCards,
    groups,
    loading,
    loadingMore,
    loaded,
    error,
    needLogin,
    hasMore,
    paused,
    keyword,
    pending,
    load,
    loadMore,
    resetState,
    refreshPausedState,
    removeOne,
    clearAll,
    togglePaused,
    scope: LIST_SCOPE.history,
  }
}
