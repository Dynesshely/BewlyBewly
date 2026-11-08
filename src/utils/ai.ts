import { settings } from '~/logic'

export interface CardMeta {
  id: string
  title: string
  author?: string
  duration?: string
  view?: string
  reason?: string
}

export interface AiScore {
  id: string
  score: number
  category: string
  reason: string
}

const CACHE_KEY = 'bewly-ai-card-scores'
const CACHE_TTL = 7 * 24 * 3600 * 1000

interface CacheEntry {
  score: AiScore
  at: number
}

async function readCache(): Promise<Record<string, CacheEntry>> {
  try {
    const data = await browser.storage.local.get(CACHE_KEY)
    return (data[CACHE_KEY] as Record<string, CacheEntry>) ?? {}
  }
  catch {
    return {}
  }
}

async function writeCache(cache: Record<string, CacheEntry>) {
  try {
    await browser.storage.local.set({ [CACHE_KEY]: cache })
  }
  catch {
    // ignore quota errors
  }
}

export function isAiFilterReady(): boolean {
  return !!(settings.value.aiFilterEnabled && settings.value.aiBaseURL && settings.value.aiModel)
}

/** 对一批卡片做 AI 初筛；返回按 id 的评分（含缓存） */
export async function scoreCards(cards: CardMeta[]): Promise<Record<string, AiScore>> {
  const result: Record<string, AiScore> = {}
  if (!cards.length || !isAiFilterReady())
    return result

  const cache = await readCache()
  const now = Date.now()
  const pending: CardMeta[] = []
  for (const card of cards) {
    const hit = cache[card.id]
    if (hit && now - hit.at < CACHE_TTL)
      result[card.id] = hit.score
    else
      pending.push(card)
  }
  if (!pending.length)
    return result

  try {
    const response = await browser.runtime.sendMessage({
      contentScriptQuery: 'aiFilterCards',
      baseURL: settings.value.aiBaseURL,
      apiKey: settings.value.aiApiKey,
      model: settings.value.aiModel,
      userPrompt: settings.value.aiUserPrompt,
      cards: pending,
    }) as { ok: boolean, content?: string, error?: string }

    if (!response?.ok || !response.content)
      return result

    const parsed = JSON.parse(response.content) as { results?: AiScore[] }
    for (const item of parsed.results ?? []) {
      if (typeof item?.id !== 'string' || typeof item.score !== 'number')
        continue
      const score: AiScore = {
        id: item.id,
        score: Math.max(0, Math.min(100, item.score)),
        category: String(item.category ?? '普通'),
        reason: String(item.reason ?? ''),
      }
      result[item.id] = score
      cache[item.id] = { score, at: now }
    }
    await writeCache(cache)
  }
  catch {
    // 静默降级：保持原顺序
  }
  return result
}

const HISTORY_KEY = 'bewly-ai-history'
const HISTORY_LIMIT = 20

export interface AiHistoryEntry {
  at: number
  total: number
  scored: number
  kept: number
}

export async function readAiHistory(): Promise<AiHistoryEntry[]> {
  try {
    const data = await browser.storage.local.get(HISTORY_KEY)
    return (data[HISTORY_KEY] as AiHistoryEntry[]) ?? []
  }
  catch {
    return []
  }
}

export async function recordAiHistory(entry: AiHistoryEntry): Promise<void> {
  try {
    const history = await readAiHistory()
    history.unshift(entry)
    await browser.storage.local.set({
      [HISTORY_KEY]: history.slice(0, HISTORY_LIMIT),
    })
  }
  catch {
    // ignore
  }
}
