import type { MaybeRefOrGetter } from 'vue'
import type { Video } from '~/components/VideoCard/types'

import { computed, reactive, ref, toValue } from 'vue'
import { useToast } from 'vue-toastification'

import api from '~/utils/api'
import { getCSRF, getUserID } from '~/utils/main'

import { getDefaultFavoriteFolderId } from './favoriteFolders'
import { useQuickActionsMessages } from './i18n'

/** 本次会话内已赞 / 已收藏的 aid（服务端返回的成功结果，失败会回滚） */
const likedAids = reactive(new Set<number>())
const favoritedAids = reactive(new Set<number>())

/** bvid → aid 的缓存：卡片数据没有 aid 时用 getVideoInfo 换一次（只在本模块允许额外请求） */
const aidByBvid = new Map<string, number>()
const aidInflight = new Map<string, Promise<number | null>>()

function isLoggedIn(): boolean {
  return Boolean(getUserID()) && Boolean(getCSRF())
}

function resolveAidFromVideo(video: Video): number | null {
  if (typeof video.aid === 'number' && video.aid > 0)
    return video.aid
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
 * - 点赞：同一会话内用内存 Set 记住已赞的 aid，再点即取消；失败回滚；
 * - 收藏：收藏到「默认收藏夹」（分类缓存 5 分钟），失败回滚且不重复请求；
 * - 未登录时只 toast，不发送任何请求；
 * - 所有请求都有 try/catch，任何异常都不会冒泡到卡片点击逻辑。
 */
export function useCardQuickActions(videoSource: MaybeRefOrGetter<Video | undefined>) {
  const toast = useToast()
  const messages = useQuickActionsMessages()

  const likePending = ref<boolean>(false)
  const favoritePending = ref<boolean>(false)

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
    return currentAid !== null && likedAids.has(currentAid)
  })

  const isFavorited = computed(() => {
    const currentAid = aid.value
    return currentAid !== null && favoritedAids.has(currentAid)
  })

  function toastNeedLogin() {
    toast.warning(messages.value.needLogin)
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
    // 乐观更新用的目标状态：未赞 → 赞，已赞 → 取消赞
    let targetLiked = true

    try {
      resolvedAid = await resolveVideoAid(current)
      if (resolvedAid === null) {
        toast.error(messages.value.likeFail)
        return
      }

      const wasLiked = likedAids.has(resolvedAid)
      targetLiked = !wasLiked

      // 乐观更新
      if (targetLiked)
        likedAids.add(resolvedAid)
      else
        likedAids.delete(resolvedAid)

      const result = await api.video.likeVideo({
        aid: resolvedAid,
        like: targetLiked ? 1 : 2,
        csrf: getCSRF(),
      })

      const code = readErrorCode(result)
      if (code !== 0) {
        // 回滚
        if (targetLiked)
          likedAids.delete(resolvedAid)
        else
          likedAids.add(resolvedAid)

        if (code === -101 || code === -111)
          toastNeedLogin()
        else
          toast.error(messages.value.likeFail)
        return
      }

      toast.success(targetLiked ? messages.value.likeOk : messages.value.unlikeOk)
    }
    catch {
      if (resolvedAid !== null) {
        if (targetLiked)
          likedAids.delete(resolvedAid)
        else
          likedAids.add(resolvedAid)
      }
      toast.error(messages.value.likeFail)
    }
    finally {
      likePending.value = false
    }
  }

  async function addToFavorites() {
    if (favoritePending.value)
      return
    if (!isLoggedIn()) {
      toastNeedLogin()
      return
    }

    const current = video.value
    if (!current)
      return

    favoritePending.value = true
    let resolvedAid: number | null = null
    let optimisticallyFavorited = false

    try {
      resolvedAid = await resolveVideoAid(current)
      if (resolvedAid === null) {
        toast.error(messages.value.favoriteFail)
        return
      }

      if (favoritedAids.has(resolvedAid)) {
        toast.info(messages.value.favorited)
        return
      }

      const folderId = await getDefaultFavoriteFolderId()
      if (folderId === null) {
        toast.warning(messages.value.folderMissing)
        return
      }

      favoritedAids.add(resolvedAid)
      optimisticallyFavorited = true

      const result = await api.favorite.dealFavoriteResource({
        rid: resolvedAid,
        type: 2,
        add_media_ids: String(folderId),
        del_media_ids: '',
        csrf: getCSRF(),
      })

      const code = readErrorCode(result)
      if (code !== 0) {
        favoritedAids.delete(resolvedAid)
        optimisticallyFavorited = false

        if (code === -101 || code === -111)
          toastNeedLogin()
        else
          toast.error(messages.value.favoriteFail)
        return
      }

      toast.success(messages.value.favoriteOk)
    }
    catch {
      if (optimisticallyFavorited && resolvedAid !== null)
        favoritedAids.delete(resolvedAid)
      toast.error(messages.value.favoriteFail)
    }
    finally {
      favoritePending.value = false
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
    toggleLike,
    addToFavorites,
  }
}

/** 调试 / 测试用：重置模块级状态 */
export function resetCardQuickActionsState() {
  likedAids.clear()
  favoritedAids.clear()
  aidByBvid.clear()
  aidInflight.clear()
}
