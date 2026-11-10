import type { Video } from '~/components/VideoCard/types'
import { computed, onBeforeUnmount, ref } from 'vue'

import api from '~/utils/api'

import { CARD_PREVIEW_MAX_DURATION, getCardPreviewDelay, isCardPreviewEnabled, isCardPreviewSupported } from './previewSettings'

interface PreviewSession {
  cardId: string
  /** 该次预览对应的视频缓存 key，用于播放失败时加入黑名单 */
  key: string
  phase: 'pending' | 'playing'
  generation: number
  /** 是否已经对齐过 6 秒计时（避免缓冲抖动反复触发 playing 而延长） */
  started?: boolean
  timer?: ReturnType<typeof setTimeout>
}

interface CachedPreview {
  url: string
  expiresAt: number
}

/** playurl 链接带签名与有效期，缓存时间不宜过长 */
const PREVIEW_URL_TTL = 5 * 60 * 1000
const PREVIEW_URL_CACHE_LIMIT = 50

let generation = 0
let session: PreviewSession | null = null

const activeCardId = ref<string | null>(null)
const previewUrl = ref<string>('')

/** 本次会话内请求 / 播放失败的卡片，避免反复请求 */
const failedCardKeys = new Set<string>()
/** playurl 结果缓存，避免同一张卡片反复请求 */
const urlCache = new Map<string, CachedPreview>()
/** 同一视频正在进行的请求，避免并发重复请求 */
const inflight = new Map<string, Promise<string>>()

function clearTimer() {
  if (session?.timer !== undefined) {
    clearTimeout(session.timer)
    session.timer = undefined
  }
}

/** 停止预览：清空状态后组件卸载 <video>，随即可释放播放资源 */
function stop() {
  generation++
  clearTimer()
  session = null
  if (activeCardId.value !== null)
    activeCardId.value = null
  if (previewUrl.value !== '')
    previewUrl.value = ''
}

function cardKey(video: Video): string {
  return String(video.cid
    ? `${video.bvid ?? ''}-${video.cid}`
    : (video.bvid ?? video.aid ?? ''))
}

function readCachedUrl(key: string): string {
  const cached = urlCache.get(key)
  if (!cached)
    return ''
  if (cached.expiresAt <= Date.now()) {
    urlCache.delete(key)
    return ''
  }
  return cached.url
}

function writeCachedUrl(key: string, url: string) {
  if (urlCache.size >= PREVIEW_URL_CACHE_LIMIT) {
    const oldest = urlCache.keys().next()
    if (!oldest.done)
      urlCache.delete(oldest.value)
  }
  urlCache.set(key, { url, expiresAt: Date.now() + PREVIEW_URL_TTL })
}

/** 请求预览地址；失败一律返回空串（静默） */
function fetchPreviewUrl(video: Video): Promise<string> {
  const key = cardKey(video)
  const cached = readCachedUrl(key)
  if (cached)
    return Promise.resolve(cached)

  const pending = inflight.get(key)
  if (pending)
    return pending

  const task = Promise.resolve()
    // api 层 3 秒超时后返回 undefined，这里统一按「失败静默」处理
    .then(() => api.video.getVideoPreview({ bvid: video.bvid, cid: video.cid }))
    .catch(() => undefined)
    .then((result) => {
      const url = result?.code === 0
        ? (result?.data?.durl?.[0]?.url ?? '')
        : ''
      if (url)
        writeCachedUrl(key, url)
      return url
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, task)
  return task
}

function canPreview(video?: Video): video is Video {
  if (!video || !video.bvid || !video.cid)
    return false
  return !failedCardKeys.has(cardKey(video))
}

async function loadPreview(cardId: string, video: Video, currentGeneration: number) {
  const key = cardKey(video)
  const url = await fetchPreviewUrl(video)

  // 等待期间已离开 / 已切换到别的卡片，丢弃结果
  if (currentGeneration !== generation)
    return

  if (!url) {
    failedCardKeys.add(key)
    stop()
    return
  }

  activeCardId.value = cardId
  previewUrl.value = url
  session = {
    cardId,
    key,
    phase: 'playing',
    generation: currentGeneration,
    timer: setTimeout(stop, CARD_PREVIEW_MAX_DURATION),
  }
}

/** 悬停开始：满足条件才挂 900ms 计时器；先停掉上一个预览，保证同时最多 1 个 */
function schedule(cardId: string, video?: Video) {
  stop()

  if (!isCardPreviewSupported() || !isCardPreviewEnabled())
    return
  if (!canPreview(video))
    return
  // 后台标签页或离线时不做预览（离线还会触发全局 API 错误提示，直接跳过）
  if (document.visibilityState === 'hidden' || navigator.onLine === false)
    return

  const currentGeneration = ++generation
  const target = video
  const pending: PreviewSession = {
    cardId,
    key: cardKey(video),
    phase: 'pending',
    generation: currentGeneration,
  }
  pending.timer = setTimeout(() => {
    if (currentGeneration !== generation)
      return
    void loadPreview(cardId, target, currentGeneration)
  }, getCardPreviewDelay())
  session = pending
}

/** 悬停结束 / 卡片卸载：只取消属于这张卡片的那次预览 */
function cancel(cardId: string) {
  if (session?.cardId !== cardId && activeCardId.value !== cardId)
    return
  stop()
}

/** 播放自然结束：静默回到封面 */
function handleEnded(cardId: string) {
  if (activeCardId.value === cardId)
    stop()
}

/** 播放失败（解码错误 / 自动播放被拦截）：静默回到封面，并让这张卡片本次会话不再重试 */
function handleFailed(cardId: string) {
  if (session?.cardId !== cardId && activeCardId.value !== cardId)
    return
  if (session)
    failedCardKeys.add(session.key)
  stop()
}

/** 播放真正开始：首次播放时把 6 秒上限对齐到实际播放起点 */
function handlePlaying(cardId: string) {
  if (session?.cardId !== cardId || session.phase !== 'playing' || session.started)
    return
  session.started = true
  clearTimer()
  session.timer = setTimeout(stop, CARD_PREVIEW_MAX_DURATION)
}

/**
 * 单张卡片的预览句柄。
 *
 * - 全局只保留一个预览，任何卡片开始悬停都会先停掉上一个；
 * - 900ms（可选延迟模式 1200ms）后才请求，离开立即取消，快速划过不发请求；
 * - 请求失败静默回退，同一张卡片本次会话不再重试；
 * - 最多播放 6 秒后自动回到封面。
 *
 * 卡片需要提供 cid 才可能预览（cid 由接口数据带入，缺失时不发请求）。
 */
export function useCardPreview(cardId: string) {
  const isActive = computed(() => activeCardId.value === cardId)
  const src = computed(() => (isActive.value ? previewUrl.value : ''))

  onBeforeUnmount(() => cancel(cardId))

  return {
    isActive,
    src,
    schedule: (video?: Video) => schedule(cardId, video),
    cancel: () => cancel(cardId),
    handlePlaying: () => handlePlaying(cardId),
    handleEnded: () => handleEnded(cardId),
    handleFailed: () => handleFailed(cardId),
  }
}

/** 调试 / 测试用：重置模块级状态 */
export function resetCardPreviewState() {
  failedCardKeys.clear()
  urlCache.clear()
  inflight.clear()
  stop()
}
