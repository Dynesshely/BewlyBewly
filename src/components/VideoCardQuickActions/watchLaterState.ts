import { reactive } from 'vue'

/**
 * 视频卡「稍后再看」的会话内状态记录。
 *
 * 设计取舍（与第 10 轮的互动状态查询一致，但不额外发请求）：
 * - **会话内 Set**：本会话内本扩展成功加入过稍后再看的 aid，立刻显示为「已加入」；
 * - **5 分钟内存缓存**：记录最近一次操作的最终状态（加入 / 移除），让同一页面里的多张同视频卡片
 *   在短时间内保持一致，避免「A 卡点移除、B 卡还显示已加入」；
 * - 不查询服务端稍后再看状态：那需要额外接口（详见 docs/video-card-quick-actions.md 已知限制），
 *   未在本轮范围内；因此「已在 B 站原生页面加入过」的视频，卡片仍按未加入显示。
 */

/** 缓存有效期：与收藏夹 / 互动状态一致，5 分钟 */
const CACHE_TTL = 5 * 60 * 1000

interface CacheEntry {
  value: boolean
  expiresAt: number
}

/** 本会话内本扩展成功加入过稍后再看的 aid */
const sessionAdded = reactive(new Set<number>())
/** 最近一次操作的最终状态（加入 / 移除），5 分钟有效 */
const statusCache = reactive(new Map<number, CacheEntry>())
/** 请求在途的 aid：同一视频的多张卡片共享「处理中」状态 */
const pending = reactive(new Set<number>())

function pruneIfNeeded(): void {
  if (statusCache.size <= 400)
    return
  const now = Date.now()
  for (const [aid, entry] of statusCache) {
    if (entry.expiresAt <= now)
      statusCache.delete(aid)
  }
  while (statusCache.size > 400) {
    const oldest = statusCache.keys().next()
    if (oldest.done)
      break
    statusCache.delete(oldest.value)
  }
}

/** 读取缓存状态；undefined = 本会话没有可靠记录 */
export function getWatchLaterStatus(aid: number): boolean | undefined {
  if (sessionAdded.has(aid))
    return true
  const entry = statusCache.get(aid)
  if (!entry)
    return undefined
  if (entry.expiresAt <= Date.now()) {
    statusCache.delete(aid)
    return undefined
  }
  return entry.value
}

/** 写入状态（乐观更新 / 成功确认 / 失败回滚都用它） */
export function setWatchLaterStatus(aid: number, value: boolean): void {
  if (value)
    sessionAdded.add(aid)
  else
    sessionAdded.delete(aid)
  statusCache.set(aid, { value, expiresAt: Date.now() + CACHE_TTL })
  pruneIfNeeded()
}

/** 该 aid 的稍后再看请求是否在途 */
export function isWatchLaterPending(aid: number): boolean {
  return pending.has(aid)
}

export function markWatchLaterPending(aid: number, value: boolean): void {
  if (value)
    pending.add(aid)
  else
    pending.delete(aid)
}

/** 调试 / 测试用：清空会话记录与缓存 */
export function resetWatchLaterState(): void {
  sessionAdded.clear()
  statusCache.clear()
  pending.clear()
}
