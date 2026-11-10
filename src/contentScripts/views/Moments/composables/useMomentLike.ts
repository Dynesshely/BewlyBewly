/**
 * 动态点赞 / 取消点赞（第 8 轮）。
 *
 * 行为约定：
 * 1. 未登录（没有 `DedeUserID` 或 `bili_jct`）时只 toast 提示，不发请求；
 * 2. 先做乐观更新（高亮 + 计数），按 `api.moment.likeMoment` 的 `up`（1 赞 / 2 取消）请求；
 * 3. 接口失败（含 code !== 0、-101、网络异常）一律回滚高亮与计数，并 toast 说明；
 * 4. 同一张卡在请求期间加锁，重复点击不会并发写。
 *
 * 只做点赞，不碰转发 / 评论等其它写操作。
 */
import type { MomentCard } from '../types'
import { useToast } from 'vue-toastification'
import api from '~/utils/api'
import { getCSRF, getUserID } from '~/utils/main'

import { useMomentsI18n } from '../i18n'

interface LikeMomentOptions {
  dyn_id_str?: string
  up?: 1 | 2
  csrf?: string
}

type LikeMoment = (options?: LikeMomentOptions) => Promise<{ code?: number, message?: string } | undefined>

const likeMoment = api.moment.likeMoment as unknown as LikeMoment

/** 正在请求中的动态 id：跨组件实例共享，避免同一张卡重复提交 */
const pendingLikeIds = reactive(new Set<string>())

/** 未登录 */
const LOGIN_REQUIRED_CODE = -101

export function useMomentLike() {
  const toast = useToast()
  const { t } = useMomentsI18n()

  function isLikePending(id: string): boolean {
    return pendingLikeIds.has(id)
  }

  /**
   * 点赞 / 取消点赞。
   *
   * @param card 列表里的响应式卡片对象（乐观更新直接改它，父级列表与卡片同步刷新）
   * @returns 请求是否成功（用于按需做额外处理；UI 反馈已由内部 toast 负责）
   */
  async function toggleLike(card: MomentCard): Promise<boolean> {
    if (!card?.id || pendingLikeIds.has(card.id))
      return false

    const csrf = getCSRF()
    if (!getUserID() || !csrf) {
      toast.warning(t('like_login_required'))
      return false
    }

    const wasLiked = card.stats.liked
    const previousCount = card.stats.like

    // 乐观更新
    card.stats.liked = !wasLiked
    card.stats.like = Math.max(0, previousCount + (wasLiked
      ? -1
      : 1))
    pendingLikeIds.add(card.id)

    const rollback = () => {
      card.stats.liked = wasLiked
      card.stats.like = previousCount
    }

    try {
      const response = await likeMoment({
        dyn_id_str: card.id,
        up: wasLiked ? 2 : 1,
        csrf,
      })

      const code = Number(response?.code ?? 0)
      if (!response || code !== 0) {
        rollback()
        if (code === LOGIN_REQUIRED_CODE)
          toast.warning(t('like_login_required'))
        else
          toast.error(response?.message || t('like_failed'))
        return false
      }

      toast.success(wasLiked
        ? t('like_cancelled')
        : t('liked'))
      return true
    }
    catch (error) {
      console.warn('[BewlyBewly] 动态点赞失败', error)
      rollback()
      toast.error(t('like_failed'))
      return false
    }
    finally {
      pendingLikeIds.delete(card.id)
    }
  }

  return { toggleLike, isLikePending }
}
