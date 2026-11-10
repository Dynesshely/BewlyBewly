/**
 * 动态流数据层：首屏加载、触底加载更多、刷新、失败重试。
 *
 * 接口：`api.moment.getMoments({ type: 'all', offset, update_baseline })`
 * （`src/background/messageListeners/api/moment.ts`），返回 `{ code, message, data }`。
 */
import type { MomentCard, RawMomentResult } from '../types'
import api from '~/utils/api'

import { normalizeMoments } from '../utils/normalize'
import { useMomentLike } from './useMomentLike'

/** 接口方法未在 it 里声明类型，这里只收窄参数签名 */
interface GetMomentsOptions {
  type?: string
  offset?: string
  update_baseline?: string
}

type GetMoments = (options?: GetMomentsOptions) => Promise<RawMomentResult | undefined>

const getMoments = api.moment.getMoments as unknown as GetMoments

export type MomentsFeedStatus = 'idle' | 'loading' | 'ready' | 'error'

/** 未登录 */
const LOGIN_REQUIRED_CODE = -101

interface FetchOutcome {
  cards: MomentCard[]
  hasMore: boolean
  /** 接口 code（0 = 成功） */
  code: number
  message: string
}

export function useMomentsFeed() {
  const cards = ref<MomentCard[]>([])
  const status = ref<MomentsFeedStatus>('idle')
  const loadingMore = ref<boolean>(false)
  const hasMore = ref<boolean>(true)
  const moreFailed = ref<boolean>(false)
  const errorCode = ref<number>(0)
  const errorMessage = ref<string>('')

  const offset = ref<string>('')
  const updateBaseline = ref<string>('')
  /** 请求序号：翻页期间刷新时丢弃过期响应 */
  let requestSeq = 0

  async function fetchPage(nextOffset?: string): Promise<FetchOutcome | null> {
    try {
      const response = await getMoments({
        type: 'all',
        offset: nextOffset ?? offset.value,
        update_baseline: updateBaseline.value || undefined,
      })

      if (!response) {
        return {
          cards: [],
          hasMore: false,
          code: -1,
          message: '',
        }
      }

      const code = Number(response.code) || 0
      if (code !== 0) {
        return {
          cards: [],
          hasMore: false,
          code,
          message: response.message ?? '',
        }
      }

      const data = response.data
      offset.value = data?.offset ?? ''
      if (data?.update_baseline)
        updateBaseline.value = data.update_baseline

      return {
        cards: normalizeMoments(data?.items ?? []),
        hasMore: data?.has_more !== false,
        code,
        message: response.message ?? '',
      }
    }
    catch (error) {
      console.warn('[BewlyBewly] 动态流加载失败', error)
      return null
    }
  }

  /** 首屏加载 / 刷新：清空列表重新拉第一页 */
  async function loadFirst() {
    const seq = ++requestSeq
    status.value = 'loading'
    moreFailed.value = false
    loadingMore.value = false
    errorCode.value = 0
    errorMessage.value = ''
    offset.value = ''
    updateBaseline.value = ''

    let outcome = await fetchPage('')

    // 接口偶尔会返回整页可见性为 false 的条目，这里最多再补一页，避免误判成空列表
    for (let attempt = 0; attempt < 2; attempt++) {
      if (seq !== requestSeq)
        break
      if (!outcome || outcome.code !== 0 || outcome.cards.length || !outcome.hasMore)
        break
      outcome = await fetchPage()
    }

    if (seq !== requestSeq)
      return

    if (!outcome) {
      errorCode.value = -1
      errorMessage.value = ''
      status.value = 'error'
      return
    }

    if (outcome.code !== 0) {
      errorCode.value = outcome.code
      errorMessage.value = outcome.message
      status.value = 'error'
      return
    }

    cards.value = outcome.cards
    hasMore.value = outcome.hasMore
    status.value = 'ready'
  }

  /** 触底加载更多 */
  async function loadMore() {
    // 上一次加载更多失败后不再自动重试，等用户点「重试」
    if (status.value !== 'ready' || loadingMore.value || !hasMore.value || moreFailed.value)
      return

    loadingMore.value = true
    moreFailed.value = false
    const outcome = await fetchPage()
    loadingMore.value = false

    if (!outcome) {
      moreFailed.value = true
      return
    }

    if (outcome.code !== 0) {
      // 登录态失效等硬错误：首屏已加载过内容，这里只标记失败，不打断浏览
      moreFailed.value = true
      return
    }

    const existing = new Set(cards.value.map(card => card.id))
    const fresh = outcome.cards.filter(card => !existing.has(card.id))
    if (fresh.length)
      cards.value.push(...fresh)
    hasMore.value = outcome.hasMore

    // 接口偶尔返回空页但 has_more 仍为 true，避免立刻再次请求造成抖动
    if (!outcome.cards.length && outcome.hasMore)
      moreFailed.value = false
  }

  /** 加载更多失败后手动重试 */
  function retryMore() {
    if (loadingMore.value)
      return
    moreFailed.value = false
    void loadMore()
  }

  function refresh() {
    void loadFirst()
  }

  /**
   * 点赞 / 取消点赞（第 8 轮写操作）。
   *
   * 直接操作列表里的响应式卡片对象：乐观更新、失败回滚、防重复提交与 toast
   * 都在 `useMomentLike` 里实现，这里只做一层列表侧的入口。
   */
  const { toggleLike: toggleCardLike, isLikePending } = useMomentLike()

  /**
   * @param cardOrId 要操作的卡片，或它的动态 id（会在当前列表里查找）
   */
  async function toggleLike(cardOrId: MomentCard | string): Promise<boolean> {
    const card = typeof cardOrId === 'string'
      ? cards.value.find(item => item.id === cardOrId)
      : cardOrId
    if (!card)
      return false
    return toggleCardLike(card)
  }

  return {
    cards,
    status,
    loadingMore,
    hasMore,
    moreFailed,
    errorCode,
    errorMessage,
    loadFirst,
    loadMore,
    retryMore,
    refresh,
    toggleLike,
    isLikePending,
    LOGIN_REQUIRED_CODE,
  }
}
