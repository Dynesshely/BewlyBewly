import type { SpaceSortId } from './constants'
/**
 * 空间页（自绘）的数据获取。
 *
 * # 接口与签名
 *
 * 三个接口都在 `api.bilibili.com`，其中两个 **必须 wbi 签名**（真机 2026-11-18 实测）：
 *
 *   GET /x/space/wbi/arc/search?mid&pn&ps&order&platform=web   投稿列表（签名）
 *   GET /x/space/wbi/acc/info?mid&platform=web                  UP 信息（签名）
 *   GET /x/relation/stat?vmid                                  粉丝 / 关注数（不需签名）
 *   POST /x/relation/modify                                    关注 / 取关（csrf 放表单体）
 *
 * 签名本身不在这里实现：本模块统一调用 `~/utils/wbi` 的 `wbiGet`（另一路 agent 的基建）。
 * `wbiGet` 返回响应体的 `data`，`code !== 0` 抛 `WbiApiError`（带 `code`），
 * HTTP 非 2xx / data 缺失抛普通 `Error`；内部固定 `credentials: 'include'`。
 *
 * # 真机要点（写进代码的约束）
 *
 * - **最小参数集就够**：`mid/pn/ps/order/platform`，不需要 `dm_img_*` 指纹、
 *   不需要 `x-bili-locale-json`（两者都测过，结果一致）；
 * - **连续快速请求会 -352 风控**：间隔 1s 以上就恢复，所以这里给 arc/search 加了一个
 *   「最小请求间隔」串行闸门，滚动加载自然不会更快，但排序切换连点时会用到；
 * - **必须带 cookie**：无 cookie 时同一请求是 -403（登录态）/ -352（未登录），
 *   由 `wbiGet` 内部的 `credentials: 'include'` 保证；
 * - 未登录时 `is_followed` 恒为 false，关注按钮会先检查 csrf 再决定是否可点。
 */
import type { ArcSearchData, SpaceRelationStat, SpaceRelationStatResult, SpaceUpInfo, SpaceVideoPage } from './types'
import { getCSRF } from '~/utils/cookie'
import { wbiGet } from '~/utils/wbi'
import {
  ACC_INFO_PATH,
  ARC_SEARCH_PATH,
  RELATION_ACT_FOLLOW,
  RELATION_ACT_UNFOLLOW,
  RELATION_MODIFY_PATH,
  RELATION_RE_SRC,
  RELATION_STAT_PATH,
  SPACE_PAGE_SIZE,
} from './constants'
import { normalizeRelationStat } from './utils'

/** 两次 arc/search 之间的最小间隔（真机：低于 ~600ms 连发会 -352） */
const ARC_SEARCH_MIN_GAP = 900

/** 串行闸门用的时间戳 */
let lastArcSearchAt = 0

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

/** 等够最小间隔再发请求（只作用于 arc/search） */
async function waitForArcSearchSlot(): Promise<void> {
  const elapsed = Date.now() - lastArcSearchAt
  if (elapsed < ARC_SEARCH_MIN_GAP)
    await sleep(ARC_SEARCH_MIN_GAP - elapsed)
  lastArcSearchAt = Date.now()
}

/** 取一页投稿列表 */
export async function fetchSpaceVideos(
  mid: number,
  sort: SpaceSortId,
  pn: number,
  ps: number = SPACE_PAGE_SIZE,
): Promise<SpaceVideoPage> {
  await waitForArcSearchSlot()

  const data = await wbiGet<ArcSearchData>(ARC_SEARCH_PATH, {
    mid,
    pn,
    ps,
    order: sort,
    platform: 'web',
  })

  const items = Array.isArray(data?.list?.vlist)
    ? data.list.vlist
    : []
  const total = Number(data?.page?.count) || 0
  return {
    items,
    total,
    pn: Number(data?.page?.pn) || pn,
    ps: Number(data?.page?.ps) || ps,
  }
}

/** 取 UP 信息（失败由调用方决定是否回退原生） */
export async function fetchSpaceUpInfo(mid: number): Promise<SpaceUpInfo> {
  const data = await wbiGet<SpaceUpInfo>(ACC_INFO_PATH, { mid, platform: 'web' })
  if (!data || !data.mid)
    throw new Error('API returned no up info')
  return data
}

/**
 * 取粉丝 / 关注数。
 *
 * **不是 wbi 接口**，显式传 `{ sign: false }`（多带 w_rid / wts 不会 -400，
 * 但没必要赌，且 wts 会被计入风控时间窗）。
 *
 * 这个请求是「可选增强」：失败返回 null，页面隐藏这两项而不是整页回退。
 */
export async function fetchSpaceRelationStat(mid: number): Promise<SpaceRelationStatResult> {
  try {
    const data = await wbiGet<SpaceRelationStat>(RELATION_STAT_PATH, { vmid: mid }, { sign: false })
    return normalizeRelationStat(data)
  }
  catch (error) {
    console.warn('[bewly] space drawn: relation/stat failed, skip follower counts', error)
    return null
  }
}

/** 关注动作的结果 */
export type FollowActionResult
  = | { ok: true, followed: boolean }
    | { ok: false, reason: 'login' | 'api', message: string }

/**
 * 关注 / 取消关注。
 *
 * 直接用同源 POST：B 站这个接口是表单提交 + `csrf=bili_jct`，
 * 与页面自身的请求完全一致（`views/videoPage` 的 UP 卡也转发给原生按钮，
 * 但空间页自绘后原生按钮已被隐藏，只能自己发）。
 *
 * 未登录（拿不到 csrf）时**不发请求**，返回 `login` 让 UI 提示。
 */
export async function modifySpaceRelation(mid: number, followed: boolean): Promise<FollowActionResult> {
  const csrf = getCSRF()
  if (!csrf)
    return { ok: false, reason: 'login', message: 'login required' }

  const body = new URLSearchParams({
    fid: String(mid),
    act: String(followed ? RELATION_ACT_UNFOLLOW : RELATION_ACT_FOLLOW),
    re_src: String(RELATION_RE_SRC),
    csrf,
  })

  try {
    const response = await fetch(`https://api.bilibili.com${RELATION_MODIFY_PATH}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: body.toString(),
    })
    if (!response.ok)
      return { ok: false, reason: 'api', message: `HTTP ${response.status}` }

    const payload = await response.json() as { code?: number, message?: string }
    if (payload.code !== 0)
      return { ok: false, reason: 'api', message: payload.message || `API code ${String(payload.code)}` }

    return { ok: true, followed: !followed }
  }
  catch (error) {
    return {
      ok: false,
      reason: 'api',
      message: error instanceof Error
        ? error.message
        : String(error),
    }
  }
}
