import api from '~/utils/api'
import { getUserID } from '~/utils/main'

/** 收藏夹选项（供收藏面板与默认收藏夹兜底使用） */
export interface FavoriteFolderOption {
  id: number
  title: string
  /** 接口原始 attr：bit0 = 私密，bit1 = 默认收藏夹 */
  attr: number
  isDefault: boolean
  isPrivate: boolean
  mediaCount: number
}

/** 分类缓存 5 分钟，避免每次打开收藏面板都请求一次 */
const CACHE_TTL = 5 * 60 * 1000

let cachedFolders: FavoriteFolderOption[] | null = null
let cachedAt = 0
let inflight: Promise<FavoriteFolderOption[]> | null = null

/** 收藏夹结构变化（新建 / 删除）后可调用，强制下次重新拉取 */
export function invalidateFavoriteFolders(): void {
  cachedFolders = null
  cachedAt = 0
  inflight = null
}

function normalizeFolder(raw: { id?: number, title?: string, attr?: number, media_count?: number }): FavoriteFolderOption | null {
  if (typeof raw?.id !== 'number')
    return null
  const attr = typeof raw.attr === 'number'
    ? raw.attr
    : 0
  return {
    id: raw.id,
    title: raw.title || String(raw.id),
    attr,
    isDefault: (attr & 2) === 2,
    isPrivate: (attr & 1) === 1,
    mediaCount: typeof raw.media_count === 'number'
      ? raw.media_count
      : 0,
  }
}

/** 默认收藏夹：attr bit1；兜底第一个公开收藏夹；再兜底列表首个 */
function pickDefault(folders: FavoriteFolderOption[]): FavoriteFolderOption | undefined {
  return folders.find(folder => folder.isDefault)
    ?? folders.find(folder => !folder.isPrivate)
    ?? folders[0]
}

/**
 * 取当前用户的收藏夹列表。
 *
 * - 结果缓存 5 分钟，并发调用合并成一次请求；
 * - 未登录 / 接口失败返回空数组（调用方给 toast，不发写请求）；
 * - `api` 层自带 3 秒超时与异常吞掉，这里统一按失败处理。
 */
export async function getFavoriteFolders(): Promise<FavoriteFolderOption[]> {
  if (cachedFolders && Date.now() - cachedAt < CACHE_TTL)
    return cachedFolders
  if (inflight)
    return inflight

  const task = (async (): Promise<FavoriteFolderOption[]> => {
    const uid = getUserID()
    if (!uid)
      return []

    const result = await Promise.resolve()
      .then(() => api.favorite.getFavoriteCategories({ up_mid: uid }))
      .catch(() => undefined)

    const rawList = result?.code === 0 && Array.isArray(result?.data?.list)
      ? result.data.list
      : []
    const folders = rawList
      .map((item: { id?: number, title?: string, attr?: number, media_count?: number }) => normalizeFolder(item))
      .filter((folder: FavoriteFolderOption | null): folder is FavoriteFolderOption => folder !== null)

    if (folders.length > 0) {
      cachedFolders = folders
      cachedAt = Date.now()
    }
    return folders
  })()

  inflight = task
  try {
    return await task
  }
  finally {
    inflight = null
  }
}

/** 默认收藏夹 id（用于「一键收藏到默认夹」的场景；拿不到返回 null） */
export async function getDefaultFavoriteFolderId(): Promise<number | null> {
  const folders = await getFavoriteFolders()
  return pickDefault(folders)?.id ?? null
}
