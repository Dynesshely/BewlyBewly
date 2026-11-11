import type { MaybeRefOrGetter } from 'vue'
import type { FavoriteFolderOption } from './favoriteFolders'
import type { Video } from '~/components/VideoCard/types'

import { computed, reactive, ref, toValue } from 'vue'
import { useToast } from 'vue-toastification'

import api from '~/utils/api'
import { getCSRF, getUserID } from '~/utils/main'

import { getFavoriteFolders, invalidateFavoriteFolders } from './favoriteFolders'
import { useQuickActionsMessages } from './i18n'
import {
  getCachedFavoriteStatus,
  getCachedLikeStatus,
  resetInteractionStatusCache,
  resolveInteractionAid,
  setLocalFavoriteStatus,
  setLocalLikeStatus,
} from './interactionStatus'
import { migrateLegacyCardQuickActionsSetting } from './preferences'
import {
  getWatchLaterStatus,
  isWatchLaterPending,
  markWatchLaterPending,
  resetWatchLaterState,
  setWatchLaterStatus,
} from './watchLaterState'

/** aid → 已收藏的收藏夹 id 列表（只记录本扩展本次会话成功提交的结果） */
const favoriteMemberships = ref<Map<number, number[]>>(new Map())

/** bvid → aid 的缓存（reactive：解析成功后让 isLiked / isFavorited 立刻反映新 aid） */
const aidByBvid = reactive(new Map<string, number>())
const aidInflight = new Map<string, Promise<number | null>>()

function setMembership(aid: number, folderIds: number[]) {
  const next = new Map(favoriteMemberships.value)
  if (folderIds.length > 0)
    next.set(aid, [...folderIds])
  else
    next.delete(aid)
  favoriteMemberships.value = next
}

function isLoggedIn(): boolean {
  return Boolean(getUserID()) && Boolean(getCSRF())
}

function resolveAidFromVideo(video: Video): number | null {
  const direct = resolveInteractionAid(video)
  if (direct !== null)
    return direct
  if (video.bvid) {
    const cached = aidByBvid.get(video.bvid)
    if (cached)
      return cached
  }
  return null
}

/** 用 bvid 换 aid（带缓存与并发合并）；失败返回 null，不抛错 */
async function fetchAidByBvid(bvid: string): Promise<number | null> {
  const cached = aidByBvid.get(bvid)
  if (cached)
    return cached

  const pending = aidInflight.get(bvid)
  if (pending)
    return pending

  const task = Promise.resolve()
    .then(() => api.video.getVideoInfo({ bvid }))
    .catch(() => undefined)
    .then((result) => {
      const aid = result?.code === 0
        ? Number(result?.data?.aid)
        : Number.NaN
      if (Number.isFinite(aid) && aid > 0) {
        aidByBvid.set(bvid, aid)
        return aid
      }
      return null
    })
    .finally(() => {
      aidInflight.delete(bvid)
    })

  aidInflight.set(bvid, task)
  return task
}

/** 解析卡片对应的 aid；拿不到时返回 null（调用方决定是否提示） */
export async function resolveVideoAid(video: Video): Promise<number | null> {
  const direct = resolveAidFromVideo(video)
  if (direct)
    return direct
  if (!video.bvid)
    return null
  return fetchAidByBvid(video.bvid)
}

function readErrorCode(result: { code?: number } | undefined): number | undefined {
  return typeof result?.code === 'number'
    ? result.code
    : undefined
}

/**
 * 单张卡片的点赞 / 收藏状态与操作。
 *
 * 状态来源（按优先级）：
 * 1. 本会话内本扩展成功提交的操作（写缓存，立即生效）；
 * 2. hover 时懒查询到的真实状态（内存缓存 5 分钟，见 `interactionStatus.ts`）；
 * 3. 都没有时按「未操作」显示。
 *
 * - 点赞：再点即取消；失败回滚；
 * - 收藏：未收藏时打开可多选的收藏夹面板（`add_media_ids` 逗号分隔）；
 *   已收藏（会话记录或服务端查询）时再点直接取消（`del_media_ids`，未知收藏夹时从全部已知收藏夹移除）；
 * - 稍后再看：本会话 Set + 5 分钟缓存记录状态，再点即移除（toggle）；
 * - 收藏夹面板支持「+ 新建收藏夹」（创建成功后刷新列表并自动勾选新夹）；
 * - 收藏夹列表缓存 5 分钟；
 * - 未登录时只 toast，不发送任何请求；
 * - 所有请求都有 try/catch，任何异常都不会冒泡到卡片点击逻辑。
 */
export function useCardQuickActions(videoSource: MaybeRefOrGetter<Video | undefined>) {
  // 旧 localStorage 开关在首次挂载时一次性迁移到 settings（内部有幂等守卫）
  migrateLegacyCardQuickActionsSetting()

  const toast = useToast()
  const messages = useQuickActionsMessages()

  const likePending = ref<boolean>(false)
  const favoritePending = ref<boolean>(false)

  const favoritePanelOpen = ref<boolean>(false)
  const favoriteFolderOptions = ref<FavoriteFolderOption[]>([])
  const favoriteFolderLoading = ref<boolean>(false)
  const favoriteFolderFailed = ref<boolean>(false)
  const selectedFolderIds = ref<number[]>([])
  /** 「+ 新建收藏夹」请求在途 */
  const favoriteCreatePending = ref<boolean>(false)
  /** 最近一次成功创建的收藏夹 id（面板据此收起输入框并高亮新夹） */
  const createdFolderId = ref<number | null>(null)

  const video = computed(() => toValue(videoSource))
  const aid = computed(() => {
    const current = video.value
    return current
      ? resolveAidFromVideo(current)
      : null
  })

  /** 直播卡片没有点赞 / 收藏语义，直接不显示这两个按钮 */
  const isOperable = computed(() => {
    const current = video.value
    if (!current || current.liveStatus === 1 || current.roomid)
      return false
    return Boolean(current.bvid) || typeof current.aid === 'number'
  })

  const canLike = computed(() => isOperable.value)
  const canFavorite = computed(() => isOperable.value)

  const isLiked = computed(() => {
    const currentAid = aid.value
    if (currentAid === null)
      return false
    return getCachedLikeStatus(currentAid) === true
  })

  const isFavorited = computed(() => {
    const currentAid = aid.value
    if (currentAid === null)
      return false
    if ((favoriteMemberships.value.get(currentAid)?.length ?? 0) > 0)
      return true
    return getCachedFavoriteStatus(currentAid) === true
  })

  /** 稍后再看状态：本会话记录优先；没有记录时返回 undefined（调用方回落到父组件传入的初始值） */
  const isInWatchLater = computed<boolean | undefined>(() => {
    const currentAid = aid.value
    if (currentAid === null)
      return undefined
    return getWatchLaterStatus(currentAid)
  })

  /** 稍后再看请求在途（同一视频的多张卡片共享） */
  const watchLaterPending = computed(() => {
    const currentAid = aid.value
    return currentAid !== null && isWatchLaterPending(currentAid)
  })

  function toastNeedLogin() {
    toast.warning(messages.value.needLogin)
  }

  function pickFallbackFolder(folders: FavoriteFolderOption[]): FavoriteFolderOption | undefined {
    return folders.find(folder => folder.isDefault)
      ?? folders.find(folder => !folder.isPrivate)
      ?? folders[0]
  }

  /** 面板里的勾选状态：已收藏则回显所属收藏夹，否则预选默认收藏夹 */
  function syncSelectedFolders() {
    const currentAid = aid.value
    const known = currentAid !== null
      ? (favoriteMemberships.value.get(currentAid) ?? [])
      : []
    if (known.length > 0) {
      selectedFolderIds.value = [...known]
      return
    }
    const fallback = pickFallbackFolder(favoriteFolderOptions.value)
    selectedFolderIds.value = fallback
      ? [fallback.id]
      : []
  }

  async function loadFavoriteFolders(force = false) {
    if (force)
      invalidateFavoriteFolders()
    favoriteFolderLoading.value = true
    favoriteFolderFailed.value = false
    try {
      const folders = await getFavoriteFolders()
      favoriteFolderOptions.value = folders
      if (!folders.length) {
        favoriteFolderFailed.value = true
        toast.warning(messages.value.folderEmpty)
      }
      syncSelectedFolders()
    }
    catch {
      favoriteFolderFailed.value = true
      toast.error(messages.value.folderLoadFailed)
    }
    finally {
      favoriteFolderLoading.value = false
    }
  }

  async function openFavoritePanel() {
    if (!isLoggedIn()) {
      toastNeedLogin()
      return
    }
    if (!video.value)
      return

    favoritePanelOpen.value = true
    if (favoriteFolderOptions.value.length > 0) {
      syncSelectedFolders()
      return
    }
    await loadFavoriteFolders()
  }

  function closeFavoritePanel() {
    favoritePanelOpen.value = false
  }

  function toggleFolderSelection(folderId: number) {
    const selected = selectedFolderIds.value
    selectedFolderIds.value = selected.includes(folderId)
      ? selected.filter(id => id !== folderId)
      : [...selected, folderId]
  }

  /**
   * 提交收藏夹变更（差异提交：新增走 add_media_ids，移除走 del_media_ids）。
   *
   * - `removalCandidates` 用于「服务端显示已收藏但本会话不知道在哪些收藏夹」时，
   *   把已知收藏夹整体作为移除候选（取消收藏）。
   * - 失败时回滚会话内的收藏归属、真实状态缓存与图标。
   */
  async function commitFavorite(nextFolderIds: number[], removalCandidates: number[] = []): Promise<boolean> {
    if (favoritePending.value)
      return false
    if (!isLoggedIn()) {
      toastNeedLogin()
      return false
    }

    const current = video.value
    if (!current)
      return false

    favoritePending.value = true
    let resolvedAid: number | null = null
    let previousIds: number[] = []
    let previousStatus = false
    let optimistic = false

    try {
      resolvedAid = await resolveVideoAid(current)
      if (resolvedAid === null) {
        toast.error(messages.value.favoriteFail)
        return false
      }

      previousIds = [
        ...(favoriteMemberships.value.get(resolvedAid) ?? []),
      ]
      previousStatus = favoriteMemberships.value.get(resolvedAid)?.length
        ? true
        : getCachedFavoriteStatus(resolvedAid) === true

      const candidates = removalCandidates.length > 0
        ? removalCandidates
        : previousIds
      const toAdd = nextFolderIds.filter(id => !previousIds.includes(id))
      const toRemove = candidates.filter(id => !nextFolderIds.includes(id))

      if (toAdd.length === 0 && toRemove.length === 0 && previousStatus === (nextFolderIds.length > 0)) {
        toast.info(messages.value.favoriteNoChange)
        return true
      }

      // 乐观更新：归属 + 状态缓存
      setMembership(resolvedAid, nextFolderIds)
      setLocalFavoriteStatus(resolvedAid, nextFolderIds.length > 0)
      optimistic = true

      if (toAdd.length === 0 && toRemove.length === 0) {
        // 只有状态需要对齐（例如服务端已收藏、本次仅确认）
        toast.success(messages.value.favoriteOk)
        return true
      }

      const result = await api.favorite.dealFavoriteResource({
        rid: resolvedAid,
        type: 2,
        add_media_ids: toAdd.join(','),
        del_media_ids: toRemove.join(','),
        csrf: getCSRF(),
      })

      const code = readErrorCode(result)
      if (code !== 0) {
        setMembership(resolvedAid, previousIds)
        setLocalFavoriteStatus(resolvedAid, previousStatus)
        if (code === -101 || code === -111)
          toastNeedLogin()
        else
          toast.error(messages.value.favoriteFail)
        return false
      }

      if (toRemove.length > 0 && toAdd.length === 0)
        toast.success(messages.value.favoriteRemoved)
      else if (toAdd.length > 0 && toRemove.length === 0)
        toast.success(messages.value.favoriteOk)
      else
        toast.success(messages.value.favoriteUpdated)
      return true
    }
    catch {
      if (resolvedAid !== null && optimistic) {
        setMembership(resolvedAid, previousIds)
        setLocalFavoriteStatus(resolvedAid, previousStatus)
      }
      toast.error(messages.value.favoriteFail)
      return false
    }
    finally {
      favoritePending.value = false
    }
  }

  /** 面板里的「收藏」按钮：提交当前多选 */
  async function submitFavoriteSelection() {
    if (selectedFolderIds.value.length === 0) {
      toast.warning(messages.value.folderSelectRequired)
      return
    }
    const succeeded = await commitFavorite([...selectedFolderIds.value])
    if (succeeded)
      closeFavoritePanel()
  }

  /**
   * 取消收藏：
   * - 本会话记录过收藏夹 → 从这些收藏夹移除；
   * - 只有服务端状态（在 B 站或其它地方收藏的）→ 从全部已知收藏夹移除。
   */
  async function removeFromFavorites() {
    const currentAid = aid.value
    const knownIds = currentAid !== null
      ? [
          ...(favoriteMemberships.value.get(currentAid) ?? []),
        ]
      : []

    if (knownIds.length > 0) {
      const succeeded = await commitFavorite([])
      if (succeeded)
        closeFavoritePanel()
      else
        syncSelectedFolders()
      return
    }

    const folders = await getFavoriteFolders()
    const allFolderIds = folders.map(folder => folder.id)
    if (allFolderIds.length === 0) {
      toast.warning(messages.value.folderEmpty)
      return
    }
    await commitFavorite([], allFolderIds)
  }

  /**
   * 收藏按钮点击：
   * 未收藏 → 打开收藏夹多选面板；已收藏（会话记录或服务端查询）→ 再点直接取消收藏。
   */
  async function handleFavoriteButton() {
    if (!isLoggedIn()) {
      toastNeedLogin()
      return
    }
    if (isFavorited.value) {
      await removeFromFavorites()
      return
    }
    await openFavoritePanel()
  }

  /**
   * 稍后再看开关（第 19 轮）：
   *
   * - 未加入 / 无记录 → `saveToWatchLater` 加入；
   * - 已加入（本会话加入过，或缓存记为已加入）→ `removeFromWatchLater` 移除；
   * - 先乐观更新状态，失败回滚并 toast；同一 aid 请求在途时直接忽略；
   * - 未登录只 toast，不发请求。
   */
  async function toggleWatchLater() {
    const current = video.value
    if (!current)
      return

    if (!isLoggedIn()) {
      toastNeedLogin()
      return
    }

    // 卡片数据只有 bvid 时需要先把 aid 解析出来（与点赞 / 收藏同一条路径）
    let resolvedAid: number | null = resolveAidFromVideo(current)
    if (resolvedAid === null) {
      try {
        resolvedAid = await resolveVideoAid(current)
      }
      catch {
        resolvedAid = null
      }
    }
    if (resolvedAid === null) {
      toast.error(messages.value.watchLaterFail)
      return
    }
    if (isWatchLaterPending(resolvedAid))
      return

    const previous = getWatchLaterStatus(resolvedAid)
    const target = !(previous ?? false)

    markWatchLaterPending(resolvedAid, true)
    setWatchLaterStatus(resolvedAid, target)

    try {
      const result = target
        ? await api.watchlater.saveToWatchLater({
            aid: resolvedAid,
            csrf: getCSRF(),
          })
        : await api.watchlater.removeFromWatchLater({
            aid: resolvedAid,
            csrf: getCSRF(),
          })

      const code = readErrorCode(result)
      if (code !== 0) {
        setWatchLaterStatus(resolvedAid, previous ?? false)
        if (code === -101 || code === -111)
          toastNeedLogin()
        else
          toast.error(messages.value.watchLaterFail)
        return
      }

      toast.success(target ? messages.value.watchLaterOk : messages.value.watchLaterRemoved)
    }
    catch {
      setWatchLaterStatus(resolvedAid, previous ?? false)
      toast.error(messages.value.watchLaterFail)
    }
    finally {
      markWatchLaterPending(resolvedAid, false)
    }
  }

  /** 从接口返回值里防御式解析新建收藏夹的 id（不同接口版本字段可能是 id / fid / media_id） */
  function readCreatedFolderId(result: { code?: number, data?: unknown } | undefined): number | null {
    const data = result?.data as Record<string, unknown> | undefined
    if (!data)
      return null
    for (const key of ['id', 'fid', 'media_id', 'folder_id']) {
      const value = Number(data[key])
      if (Number.isFinite(value) && value > 0)
        return value
    }
    return null
  }

  /**
   * 新建收藏夹（第 19 轮）：成功后强制刷新收藏夹列表，并把新夹加入当前勾选。
   *
   * - 空标题不提交（面板侧也会禁用提交按钮）；
   * - 失败 toast，输入内容由面板保留，便于重试；
   * - 未登录只 toast，不发请求。
   */
  async function createFavoriteFolder(title: string): Promise<boolean> {
    const name = title.trim()
    if (!name)
      return false
    if (favoriteCreatePending.value)
      return false
    if (!isLoggedIn()) {
      toastNeedLogin()
      return false
    }

    favoriteCreatePending.value = true
    try {
      const result = await api.favorite.createFavoriteFolder({
        title: name,
        privacy: 0,
        csrf: getCSRF(),
      })

      const code = readErrorCode(result)
      if (code !== 0) {
        if (code === -101 || code === -111)
          toastNeedLogin()
        else
          toast.error(messages.value.createFolderFail)
        return false
      }

      invalidateFavoriteFolders()
      const folders = await getFavoriteFolders()
      favoriteFolderOptions.value = folders
      favoriteFolderFailed.value = folders.length === 0

      // 接口没返回 id 时按标题在刷新后的列表里兜底匹配（同名时取第一个）
      const newId = readCreatedFolderId(result)
        ?? folders.find(folder => folder.title === name)?.id
        ?? null

      if (newId === null) {
        // 接口成功但既没返回 id 也匹配不到：列表已刷新，提示用户手动勾选新夹
        toast.success(messages.value.createFolderOk)
        return true
      }

      createdFolderId.value = newId
      if (!selectedFolderIds.value.includes(newId))
        selectedFolderIds.value = [...selectedFolderIds.value, newId]
      toast.success(messages.value.createFolderOk)
      return true
    }
    catch {
      toast.error(messages.value.createFolderFail)
      return false
    }
    finally {
      favoriteCreatePending.value = false
    }
  }

  async function toggleLike() {
    if (likePending.value)
      return
    if (!isLoggedIn()) {
      toastNeedLogin()
      return
    }

    const current = video.value
    if (!current)
      return

    likePending.value = true
    let resolvedAid: number | null = null
    const previousLiked = isLiked.value
    const targetLiked = !previousLiked

    try {
      resolvedAid = await resolveVideoAid(current)
      if (resolvedAid === null) {
        toast.error(messages.value.likeFail)
        return
      }

      // 乐观更新（写缓存，图标立即更新；同时避免下一次 hover 再查）
      setLocalLikeStatus(resolvedAid, targetLiked)

      const result = await api.video.likeVideo({
        aid: resolvedAid,
        like: targetLiked ? 1 : 2,
        csrf: getCSRF(),
      })

      const code = readErrorCode(result)
      if (code !== 0) {
        setLocalLikeStatus(resolvedAid, previousLiked)
        if (code === -101 || code === -111)
          toastNeedLogin()
        else
          toast.error(messages.value.likeFail)
        return
      }

      toast.success(targetLiked ? messages.value.likeOk : messages.value.unlikeOk)
    }
    catch {
      if (resolvedAid !== null)
        setLocalLikeStatus(resolvedAid, previousLiked)
      toast.error(messages.value.likeFail)
    }
    finally {
      likePending.value = false
    }
  }

  return {
    messages,
    canLike,
    canFavorite,
    isLiked,
    isFavorited,
    likePending,
    favoritePending,
    favoritePanelOpen,
    favoriteFolderOptions,
    favoriteFolderLoading,
    favoriteFolderFailed,
    selectedFolderIds,
    favoriteCreatePending,
    createdFolderId,
    isInWatchLater,
    watchLaterPending,
    toggleWatchLater,
    createFavoriteFolder,
    toggleLike,
    handleFavoriteButton,
    closeFavoritePanel,
    toggleFolderSelection,
    submitFavoriteSelection,
    reloadFavoriteFolders: () => loadFavoriteFolders(true),
  }
}

/** 调试 / 测试用：重置模块级状态 */
export function resetCardQuickActionsState() {
  favoriteMemberships.value = new Map()
  resetWatchLaterState()
  aidByBvid.clear()
  aidInflight.clear()
  resetInteractionStatusCache()
}
