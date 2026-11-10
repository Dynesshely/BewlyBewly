import type { Video } from '~/components/VideoCard/types'
import { reactive } from 'vue'

import api from '~/utils/api'
import { getUserID } from '~/utils/main'

/**
 * 视频卡「真实互动状态」查询：已点赞 / 已收藏。
 *
 * - 只读资源：`api.video.hasLikedVideo({ aid })` / `api.video.hasFavouredVideo({ aid })`，
 *   `data` 为 0 / 1；
 * - 懒查询：只在卡片 hover / 聚焦时触发（由 `VideoCardQuickActions` 挂监听）；
 * - 内存缓存 5 分钟：同一 aid 在有效期内不重复查询；
 * - 并发上限 3，超出排队；卡片卸载时取消尚未发出的排队任务；
 * - 未登录不查询；查询失败静默（保持未操作外观，不 toast，5 分钟内也不再重试该 aid）；
 * - 本地点赞 / 收藏成功后直接写入缓存，不做二次查询。
 */

export type InteractionKind = 'like' | 'favorite'

interface StatusCacheEntry {
  value: boolean
  expiresAt: number
}

interface QueuedTask {
  kind: InteractionKind
  aid: number
}

const CACHE_TTL = 5 * 60 * 1000
/** 查询失败后的冷却时间（避免同一 aid 反复排队） */
const FAILURE_COOLDOWN = 5 * 60 * 1000
/** 同一时刻最多 3 个查询 */
const MAX_CONCURRENCY = 3

/** 用 reactive Map 让读取本身具备响应性（卡片上的 computed 会随查询结果更新） */
const cache: Record<InteractionKind, Map<number, StatusCacheEntry>> = {
  like: reactive(new Map<number, StatusCacheEntry>()),
  favorite: reactive(new Map<number, StatusCacheEntry>()),
}
const failedUntil: Record<InteractionKind, Map<number, number>> = {
  like: new Map(),
  favorite: new Map(),
}

const queue: QueuedTask[] = []
const queuedKeys = new Set<string>()
const inflightKeys = new Set<string>()
let running = 0

function keyOf(kind: InteractionKind, aid: number): string {
  return `${kind}:${aid}`
}

/**
 * 卡片可用于查询的 aid。
 *
 * 写接口/查询接口都需要 aid，而多数页面的卡片数据只有 `bvid` + `id`（`id` 就是 aid，
 * 见首页各子标签与列表页的映射）。这里不额外发 `getVideoInfo` 请求：
 * 拿不到可靠 aid 的卡片（番剧 / 直播 / id 非 aid 的其它卡片）不查询、不显示状态。
 */
export function resolveInteractionAid(video?: Video): number | null {
  if (!video)
    return null
  if (typeof video.aid === 'number' && video.aid > 0)
    return video.aid
  if (!video.bvid || video.type === 'bangumi' || video.liveStatus === 1 || video.roomid)
    return null
  if (typeof video.id === 'number' && video.id > 0)
    return video.id
  return null
}

function readStatus(kind: InteractionKind, aid: number): boolean | undefined {
  const entry = cache[kind].get(aid)
  if (!entry)
    return undefined
  if (entry.expiresAt <= Date.now())
    return undefined
  return entry.value
}

/** 缓存条目上限：超出时清掉已过期项，避免长时间浏览后无限增长 */
const CACHE_LIMIT = 400

function pruneCache(kind: InteractionKind) {
  const target = cache[kind]
  if (target.size <= CACHE_LIMIT)
    return
  const now = Date.now()
  for (const [key, entry] of target) {
    if (entry.expiresAt <= now)
      target.delete(key)
  }
  // 仍然超限时按插入顺序丢弃最旧的条目，保证缓存大小有上界
  while (target.size > CACHE_LIMIT) {
    const oldest = target.keys().next()
    if (oldest.done)
      break
    target.delete(oldest.value)
  }
}

function writeStatus(kind: InteractionKind, aid: number, value: boolean) {
  cache[kind].set(aid, { value, expiresAt: Date.now() + CACHE_TTL })
  failedUntil[kind].delete(aid)
  pruneCache(kind)
}

function isCoolingDown(kind: InteractionKind, aid: number): boolean {
  const until = failedUntil[kind].get(aid)
  if (until === undefined)
    return false
  if (until <= Date.now()) {
    failedUntil[kind].delete(aid)
    return false
  }
  return true
}

async function runQuery(task: QueuedTask): Promise<void> {
  let succeeded = false
  try {
    // api 层自带 3 秒超时与异常吞掉，失败时返回 undefined
    const result = await Promise.resolve()
      .then(() => task.kind === 'like'
        ? api.video.hasLikedVideo({ aid: task.aid })
        : api.video.hasFavouredVideo({ aid: task.aid }))
      .catch(() => undefined)

    if (result?.code === 0) {
      const raw = Number(result?.data)
      if (raw === 0 || raw === 1) {
        writeStatus(task.kind, task.aid, raw === 1)
        succeeded = true
      }
    }
  }
  catch {
    // 查询失败静默：保持未操作外观
  }
  if (!succeeded)
    failedUntil[task.kind].set(task.aid, Date.now() + FAILURE_COOLDOWN)
}

function pump() {
  while (running < MAX_CONCURRENCY) {
    const candidate = queue.shift()
    if (!candidate)
      return

    const task = candidate
    const key = keyOf(task.kind, task.aid)
    inflightKeys.add(key)
    running++
    void runQuery(task).finally(() => {
      inflightKeys.delete(key)
      running--
      pump()
    })
  }
}

/** 已缓存的点赞状态（undefined = 尚未查询 / 已过期） */
export function getCachedLikeStatus(aid: number): boolean | undefined {
  return readStatus('like', aid)
}

/** 已缓存的收藏状态（undefined = 尚未查询 / 已过期） */
export function getCachedFavoriteStatus(aid: number): boolean | undefined {
  return readStatus('favorite', aid)
}

/** 本地点赞成功后同步缓存，避免二次查询 */
export function setLocalLikeStatus(aid: number, liked: boolean) {
  writeStatus('like', aid, liked)
}

/** 本地收藏 / 取消收藏成功后同步缓存，避免二次查询 */
export function setLocalFavoriteStatus(aid: number, favorited: boolean) {
  writeStatus('favorite', aid, favorited)
}

/**
 * 卡片 hover / 聚焦时调用：按需查询点赞与收藏状态。
 *
 * 已缓存、冷却中或已在队列 / 请求中的不会再排队。
 */
export function ensureInteractionStatus(video?: Video): void {
  if (!getUserID())
    return

  const aid = resolveInteractionAid(video)
  if (aid === null)
    return

  for (const kind of ['like', 'favorite'] as const) {
    const key = keyOf(kind, aid)
    if (readStatus(kind, aid) !== undefined)
      continue
    if (isCoolingDown(kind, aid))
      continue
    if (queuedKeys.has(key) || inflightKeys.has(key))
      continue

    queue.push({ kind, aid })
    queuedKeys.add(key)
  }

  pump()
}

/** 卡片卸载 / 取消悬停时调用：取消尚未发出的排队任务（已在请求中的照常完成并进缓存） */
export function cancelQueuedInteractionStatus(video?: Video): void {
  const aid = resolveInteractionAid(video)
  if (aid === null)
    return

  for (const kind of ['like', 'favorite'] as const) {
    const key = keyOf(kind, aid)
    if (!queuedKeys.has(key) || inflightKeys.has(key))
      continue
    for (let index = queue.length - 1; index >= 0; index--) {
      const task = queue[index]
      if (keyOf(task.kind, task.aid) === key)
        queue.splice(index, 1)
    }
    queuedKeys.delete(key)
  }
}

/** 调试 / 测试用：清空缓存与队列 */
export function resetInteractionStatusCache() {
  for (const kind of ['like', 'favorite'] as const) {
    cache[kind].clear()
    failedUntil[kind].clear()
  }
  queue.length = 0
  queuedKeys.clear()
  inflightKeys.clear()
}
