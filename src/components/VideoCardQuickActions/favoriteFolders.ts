import api from '~/utils/api'
import { getUserID } from '~/utils/main'

interface FavoriteFolder {
  id: number
  attr?: number
  title?: string
}

/** 分类缓存 5 分钟，避免每次收藏都请求一次 */
const CACHE_TTL = 5 * 60 * 1000

let cachedFolderId: number | null = null
let cachedAt = 0
let inflight: Promise<number | null> | null = null

/** 收藏夹结构变化（新建 / 删除）后可调用，强制下次重新拉取 */
export function invalidateDefaultFavoriteFolder(): void {
  cachedFolderId = null
  cachedAt = 0
  inflight = null
}

/** attr 的 bit1 表示「默认收藏夹」 */
function isDefaultFolder(folder: FavoriteFolder): boolean {
  return typeof folder.attr === 'number' && (folder.attr & 2) === 2
}

/** 兜底：优先公开收藏夹（bit0 = 1 表示私密），最后退回第一个 */
function pickFolder(list: FavoriteFolder[]): FavoriteFolder | undefined {
  return list.find(isDefaultFolder)
    ?? list.find(folder => (typeof folder.attr === 'number'
      ? (folder.attr & 1) === 0
      : true))
    ?? list[0]
}

/**
 * 取默认收藏夹 id（用于 `dealFavoriteResource` 的 `add_media_ids`）。
 *
 * 结果缓存 5 分钟；未登录、接口失败或没有收藏夹时返回 `null`（调用方给 toast，不发写请求）。
 */
export async function getDefaultFavoriteFolderId(): Promise<number | null> {
  if (cachedFolderId !== null && Date.now() - cachedAt < CACHE_TTL)
    return cachedFolderId
  if (inflight)
    return inflight

  const task = (async (): Promise<number | null> => {
    const uid = getUserID()
    if (!uid)
      return null

    // api 层自带 3 秒超时与异常吞掉，这里统一按失败处理
    const result = await Promise.resolve()
      .then(() => api.favorite.getFavoriteCategories({ up_mid: uid }))
      .catch(() => undefined)

    const list: FavoriteFolder[] = result?.code === 0 && Array.isArray(result?.data?.list)
      ? result.data.list
      : []
    const folder = pickFolder(list)
    if (!folder || typeof folder.id !== 'number')
      return null

    cachedFolderId = folder.id
    cachedAt = Date.now()
    return folder.id
  })()

  inflight = task
  try {
    return await task
  }
  finally {
    inflight = null
  }
}
