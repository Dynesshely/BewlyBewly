/**
 * 收藏夹（API 自绘）的数据与写操作。
 *
 * # 接口（真机 2026-11-19 验证）
 *
 *   GET  /x/v3/fav/folder/created/list-all?up_mid=<mid>&web_location=333.1387   收藏夹列表（无需签名）
 *   GET  /x/v3/fav/resource/list?media_id&pn&ps&platform=web                    收藏内容（无需签名）
 *   POST /x/v3/fav/folder/add     title + privacy + csrf                        新建收藏夹
 *   POST /x/v3/fav/folder/edit    title + media_id + csrf                       重命名
 *   POST /x/v3/fav/folder/del     media_ids + csrf                              删除
 *   POST /x/v3/fav/resource/deal  rid + type + del_media_ids + csrf             取消收藏
 *
 * 真机要点：
 * - `medias` 可能是 **null**（空收藏夹），必须用 Array.isArray 兜住；
 * - `has_more` 是布尔，pn 翻页与第 1 页 0 重叠（ps=20 时 pn=1 回 19 条、pn=2 回 20 条，
 *   服务端会剔除失效 / 不可见条目，所以「条数 < ps」不能当作最后一页）；
 * - 失效视频 `attr=9`，标题就是「已失效视频」，保留卡片但不给播放地址；
 * - 新建收藏夹空标题服务端 -400，前端必须先校验非空；
 * - 删除收藏夹 `media_ids` 传单个 id 即可（真机 code 0）。
 *
 * # 搜索
 *
 * 需求要「搜索框（前端过滤已加载项）」：`GET resource/list` 本身支持 keyword，
 * 但那是**服务端**搜索（要重新请求、与「前端过滤已加载项」不同）。这里按需求做纯前端过滤，
 * `keyword` 只作用于已加载的卡片。
 */
import type { FavFolderApiItem, FavResourceApiItem } from './types'
import { computed, ref } from 'vue'
import { LIST_SCOPE } from './constants'
import {
  createFavFolder,
  deleteFavFolder,
  fetchFavFolders,
  fetchFavResources,
  isLoginRequiredError,
  renameFavFolder,
  toErrorMessage,
  unfavoriteResource,
} from './fetcher'
import { favResourceToCard, isFavResourceAudio, matchesKeyword } from './utils'

export function useFavorites() {
  /** 收藏夹列表 */
  const folders = ref<FavFolderApiItem[]>([])
  /** 收藏内容（当前收藏夹） */
  const medias = ref<FavResourceApiItem[]>([])
  const selectedId = ref<number | undefined>()

  const loading = ref(false)
  const loadingMore = ref(false)
  const loadedFolders = ref(false)
  const loaded = ref(false)
  const error = ref('')
  const needLogin = ref(false)
  const hasMore = ref(true)
  /** 收藏夹自身的封面（resource/list 的 data.info.cover；真机 info 里有 title / media_count） */
  const folderCover = ref('')
  const folderCount = ref(0)

  /** 前端过滤词（只作用于已加载项） */
  const keyword = ref('')
  const pending = ref(false)
  /** 新建收藏夹输入框 */
  const creating = ref(false)
  const createDraft = ref('')

  /** 当前页码（从 1 开始） */
  let pn = 1
  /** 请求序号：切收藏夹时丢弃上一轮迟到响应 */
  let requestSeq = 0

  const cards = computed(() => medias.value.map(favResourceToCard))

  const filteredCards = computed(() => {
    const word = keyword.value.trim()
    if (!word)
      return cards.value
    return cards.value.filter((card) => {
      const raw = card.raw as FavResourceApiItem | undefined
      return matchesKeyword([raw?.title, raw?.upper?.name, raw?.intro], word)
    })
  })

  const selectedFolder = computed(() =>
    folders.value.find(folder => folder.id === selectedId.value),
  )

  const selectedTitle = computed(() => selectedFolder.value?.title ?? '')
  const selectedTotal = computed(() => Number(selectedFolder.value?.media_count) || folderCount.value)

  /** 展开「新建收藏夹」输入 */
  function openCreate() {
    creating.value = true
    createDraft.value = ''
  }

  /** 收起「新建收藏夹」输入并清空草稿 */
  function closeCreate() {
    creating.value = false
    createDraft.value = ''
  }

  /** 收藏夹列表（侧栏用） */
  const folderList = computed(() => folders.value.map(folder => ({
    id: Number(folder.id) || 0,
    title: folder.title ?? '',
    count: Number(folder.media_count) || 0,
  })))

  function resetContent() {
    medias.value = []
    pn = 1
    hasMore.value = true
    loaded.value = false
    error.value = ''
    folderCover.value = ''
    keyword.value = ''
  }

  /** 拉收藏夹列表 */
  async function loadFolders(mid: string): Promise<void> {
    try {
      folders.value = await fetchFavFolders(mid)
      loadedFolders.value = true
      error.value = ''
    }
    catch (err) {
      error.value = toErrorMessage(err)
      needLogin.value = isLoginRequiredError(err)
      loadedFolders.value = true
    }
  }

  /** 拉一页收藏内容 */
  async function loadPage(isFirst: boolean): Promise<void> {
    if (selectedId.value === undefined)
      return
    const seq = ++requestSeq
    if (isFirst)
      loading.value = true
    else
      loadingMore.value = true
    error.value = ''

    try {
      const page = await fetchFavResources(selectedId.value, isFirst ? 1 : pn)
      if (seq !== requestSeq)
        return

      if (isFirst) {
        medias.value = page.items
      }
      else {
        medias.value = [
          ...medias.value,
          ...page.items,
        ]
      }

      pn = (isFirst ? 1 : pn) + 1
      hasMore.value = page.hasMore
      if (page.info) {
        folderCover.value = page.info.cover ?? ''
        folderCount.value = Number(page.info.media_count) || 0
      }
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

  /** 选一个收藏夹（切换时清空内容重新拉第一页） */
  async function selectFolder(id: number) {
    if (selectedId.value === id && loaded.value)
      return
    selectedId.value = id
    resetContent()
    await loadPage(true)
  }

  /** 首次加载：先拉收藏夹，再选中第一个 */
  async function load(mid: string) {
    loading.value = true
    needLogin.value = false
    error.value = ''
    try {
      await loadFolders(mid)
      const first = folders.value[0]
      if (first?.id !== undefined) {
        selectedId.value = first.id
        resetContent()
        await loadPage(true)
      }
      else {
        loaded.value = true
        hasMore.value = false
      }
    }
    finally {
      loading.value = false
    }
  }

  /** 加载更多收藏内容 */
  async function loadMore() {
    if (loading.value || loadingMore.value || !hasMore.value || !loaded.value)
      return
    await loadPage(false)
  }

  /** 是否是音频收藏（音频的 id 不是 aid，不能加稍后再看） */
  function isAudioKey(key: string): boolean {
    const card = cards.value.find(entry => entry.key === key)
    const item = card?.raw as FavResourceApiItem | undefined
    return item
      ? isFavResourceAudio(item)
      : false
  }

  /** 取消收藏单条 */
  async function unfavorite(key: string): Promise<string | null> {
    const card = cards.value.find(entry => entry.key === key)
    const item = card?.raw as FavResourceApiItem | undefined
    if (!item || selectedId.value === undefined)
      return 'missing item'
    const result = await unfavoriteResource(item, selectedId.value)
    if (!result.ok)
      return result.reason
    medias.value = medias.value.filter(entry => entry !== item)
    folderCount.value = Math.max(0, folderCount.value - 1)
    const folder = selectedFolder.value
    if (folder && typeof folder.media_count === 'number')
      folder.media_count = Math.max(0, folder.media_count - 1)
    return null
  }

  /** 新建收藏夹（成功后刷新列表并选中新夹） */
  async function createFolder(mid: string): Promise<{ ok: boolean, reason?: string }> {
    const name = createDraft.value.trim()
    if (!name)
      return { ok: false, reason: 'empty' }
    if (folders.value.some(folder => folder.title === name))
      return { ok: false, reason: 'exists' }

    pending.value = true
    const beforeIds = new Set(folders.value.map(folder => folder.id))
    try {
      const result = await createFavFolder(name)
      if (!result.ok)
        return { ok: false, reason: result.reason }

      await loadFolders(mid)
      const created = folders.value.find(folder => !beforeIds.has(folder.id))
        ?? folders.value.find(folder => folder.title === name)
      creating.value = false
      createDraft.value = ''
      if (created?.id !== undefined)
        await selectFolder(created.id)
      return { ok: true }
    }
    finally {
      pending.value = false
    }
  }

  /** 重命名收藏夹 */
  async function renameFolder(id: number, title: string): Promise<string | null> {
    const name = title.trim()
    if (!name)
      return 'empty'
    if (folders.value.some(folder => folder.id !== id && folder.title === name))
      return 'exists'
    pending.value = true
    try {
      const result = await renameFavFolder(id, name)
      if (!result.ok)
        return result.reason
      const folder = folders.value.find(entry => entry.id === id)
      if (folder)
        folder.title = name
      return null
    }
    finally {
      pending.value = false
    }
  }

  /** 删除收藏夹（删的是当前夹时回退到第一个） */
  async function removeFolder(id: number): Promise<string | null> {
    pending.value = true
    try {
      const result = await deleteFavFolder(id)
      if (!result.ok)
        return result.reason

      const wasSelected = selectedId.value === id
      folders.value = folders.value.filter(folder => folder.id !== id)
      if (wasSelected) {
        const next = folders.value[0]
        if (next?.id !== undefined) {
          selectedId.value = next.id
          resetContent()
          await loadPage(true)
        }
        else {
          selectedId.value = undefined
          medias.value = []
          loaded.value = true
          hasMore.value = false
          loadedFolders.value = true
        }
      }
      return null
    }
    finally {
      pending.value = false
    }
  }

  /** 全部播放地址（原生收藏夹页） */
  function playAllUrl(): string {
    if (selectedId.value === undefined)
      return 'https://www.bilibili.com/account/favlist'
    return `https://www.bilibili.com/list/ml${selectedId.value}`
  }

  return {
    folders,
    folderList,
    medias,
    selectedId,
    selectedFolder,
    selectedTitle,
    selectedTotal,
    folderCover,
    cards,
    filteredCards,
    loading,
    loadingMore,
    loadedFolders,
    loaded,
    error,
    needLogin,
    hasMore,
    keyword,
    pending,
    creating,
    createDraft,
    openCreate,
    closeCreate,
    load,
    loadFolders,
    loadMore,
    selectFolder,
    isAudioKey,
    unfavorite,
    createFolder,
    renameFolder,
    removeFolder,
    playAllUrl,
    resetContent,
    scope: LIST_SCOPE.favorites,
  }
}
