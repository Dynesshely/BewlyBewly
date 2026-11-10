/**
 * 搜索起始页的「热门搜索」数据源。
 *
 * 接口：`api.search.getHotSearchWords()`（只读，background 已提供）
 *   → `https://s.search.bilibili.com/main/hotword`
 *   → 实际结构 `data.trending.list[]`，条目里是 `keyword` / `show_name` 等字段。
 * 该接口字段在不同端上偶有差异，所以这里**防御式解析**：
 *   - list 不是数组、条目缺 keyword/show_name、重复词都直接跳过；
 *   - 只要一个有效词都没解析出来，就当作失败处理。
 *
 * 缓存：模块级内存缓存 10 分钟（同一页面生命周期内不重复请求）。
 * 失败 / 未登录 / 返回空：不缓存失败结果，返回内置词表（调用方保证「不空白」）。
 */
import api from '~/utils/api'

export interface HotSearchItem {
  /** 展示用序号（真实热搜排名，从 1 开始） */
  rank: number
  /** 搜索词 */
  keyword: string
}

export type HotSearchSource = 'remote' | 'fallback'

/** 最多收录 12 条（页面显示 8 条，可「换一批」轮换） */
export const HOT_SEARCH_POOL_SIZE = 12
/** 内存缓存 10 分钟 */
export const HOT_SEARCH_CACHE_TTL = 10 * 60 * 1000

interface HotCache {
  at: number
  items: HotSearchItem[]
}

let hotCache: HotCache | null = null

/** 测试 / 调试用：清掉内存缓存 */
export function clearHotSearchCache(): void {
  hotCache = null
}

function readString(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : ''
}

/** 防御式解析接口返回：优先 show_name（展示名），回退 keyword */
export function parseHotSearchResponse(response: unknown): HotSearchItem[] {
  const data = (response as { data?: unknown } | undefined)?.data as
    | { trending?: { list?: unknown } }
    | undefined
  const rawList = data?.trending?.list
  if (!Array.isArray(rawList))
    return []

  const items: HotSearchItem[] = []
  const seen = new Set<string>()

  for (const raw of rawList) {
    if (!raw || typeof raw !== 'object')
      continue
    const record = raw as { keyword?: unknown, show_name?: unknown }
    const keyword = readString(record.show_name) || readString(record.keyword)
    if (!keyword || seen.has(keyword))
      continue
    seen.add(keyword)
    items.push({ rank: items.length + 1, keyword })
    if (items.length >= HOT_SEARCH_POOL_SIZE)
      break
  }

  return items
}

export function useHotSearch(fallbackWords: () => string[]) {
  /** 当前热词池（成功时是真实热搜前 12，失败时是内置词表前 12） */
  const items = ref<HotSearchItem[]>([])
  /** 当前数据来源，用于面板底部提示 */
  const source = ref<HotSearchSource>('fallback')
  const loading = ref(false)
  /** 至少完成过一次请求（失败也算），用于决定是否显示「重试」 */
  const settled = ref(false)

  const fallbackItems = computed<HotSearchItem[]>(() =>
    fallbackWords()
      .slice(0, HOT_SEARCH_POOL_SIZE)
      .map((keyword, index) => ({ rank: index + 1, keyword })),
  )

  function applyFallback(): void {
    items.value = fallbackItems.value
    source.value = 'fallback'
  }

  // 切换界面语言时，如果当前正用内置词表，立刻换成对应语言的词（真实热搜与语言无关）
  watch(fallbackItems, (next) => {
    if (source.value === 'fallback')
      items.value = next
  })

  async function load(force = false): Promise<void> {
    if (loading.value)
      return

    if (!force && hotCache && Date.now() - hotCache.at < HOT_SEARCH_CACHE_TTL) {
      items.value = hotCache.items
      source.value = 'remote'
      settled.value = true
      return
    }

    // 先放内置词表，避免面板在请求期间空着
    if (!items.value.length)
      applyFallback()

    loading.value = true
    try {
      const response = await api.search.getHotSearchWords()
      const parsed = parseHotSearchResponse(response)
      if (parsed.length) {
        hotCache = {
          at: Date.now(),
          items: parsed,
        }
        items.value = parsed
        source.value = 'remote'
      }
      else {
        // 失败结果不缓存，下次进入搜索页会重试
        hotCache = null
        applyFallback()
      }
    }
    catch {
      hotCache = null
      applyFallback()
    }
    finally {
      loading.value = false
      settled.value = true
    }
  }

  return {
    items,
    source,
    loading,
    settled,
    load,
  }
}
