/**
 * 动态页（自绘）的数据获取。
 *
 * # 接口与签名（真机 2026-11-19 实测）
 *
 *   GET /x/polymer/web-dynamic/v1/feed/all
 *       ?type=all|video|pgc|article&page=<从 1>&offset=<上一页游标>
 *       &platform=web&timezone_offset=-480&features=<原生同款>
 *
 * 签名不在这里实现：统一调用 `~/utils/wbi` 的 `wbiGet`（返回响应体的 `data`，
 * `code !== 0` 抛 `WbiApiError`，HTTP 非 2xx 抛普通 Error，
 * 内部固定 `credentials: 'include'`）。
 *
 * # 真机要点（写进代码的约束）
 *
 * - **签名不是强制**：带 wbi 签名与不带签名都返回 code 0（两条都实测）；
 *   仍然走签名 —— 这是仓库既有基建，且 B 站随时可能收紧风控；
 * - **必须登录**：未登录（`credentials: 'omit'`）同一请求是 `-101 账号未登录`，
 *   所以挂载闸门里先判登录态，未登录直接回退原生；
 * - **翻页必须带 offset**：只传 `page=2` 时返回内容与 page=1 完全相同
 *   （真机逐条比对 20/20 重叠）；带上一页的 offset 后重叠 0/20。
 *   所以本模块的游标是「page + offset」，`offset` 由调用方从上一页带过来；
 * - **pgc（番剧）频道恒返回 4101132**：抓原生页面切到该 tab 的响应体，
 *   原生自己也是这个 code、也是 0 条 —— 服务端问题，不是参数错。
 *   这里翻译成一句可读错误，页面把它当成「该频道暂无内容」的空态处理；
 * - **连发会吃风控**：间隔 < 1s 连发可能 -352 / -412，所以加了最小间隔闸门，
 *   并对风控码重试一次。
 */
import type { DynamicTabId } from './constants'
import type { DynamicFeedData, DynamicFeedPage } from './types'
import { WbiApiError, wbiGet } from '~/utils/wbi'
import {
  DYNAMIC_FEATURES,
  DYNAMIC_FEED_PATH,
  DYNAMIC_MAX_PAGES,
  DYNAMIC_PGC_EMPTY_CODE,
  DYNAMIC_REQUEST_MIN_GAP,
  DYNAMIC_RISK_CONTROL_CODES,
} from './constants'

/** 上一次请求的发起时间（串行闸门用） */
let lastRequestAt = 0

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

/** 等够最小请求间隔再发请求 */
async function waitForRequestSlot(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt
  if (elapsed < DYNAMIC_REQUEST_MIN_GAP)
    await sleep(DYNAMIC_REQUEST_MIN_GAP - elapsed)
  lastRequestAt = Date.now()
}

/**
 * 番剧频道的「该频道暂无内容」错误。
 *
 * 单独建一个错误类而不是复用 `WbiApiError`：页面要按类型决定「显示空态」还是
 * 「显示错误态 + 重试」，靠 message 字符串匹配太脆。
 */
export class DynamicEmptyChannelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DynamicEmptyChannelError'
  }
}

/** 组装参数（undefined 会被 wbiGet 跳过） */
function buildParams(tab: DynamicTabId, page: number, offset?: string) {
  return {
    type: tab,
    page,
    offset: offset || undefined,
    platform: 'web',
    // 与浏览器时区一致（真机值 -480，即 UTC+8）；接口对它有要求，缺省也能过，带上更稳
    timezone_offset: -new Date().getTimezoneOffset(),
    features: DYNAMIC_FEATURES,
  }
}

/** 真正发一次请求；命中风控码时等一会儿重试一次（只重试一次，避免放大风控） */
async function requestFeed(tab: DynamicTabId, page: number, offset?: string): Promise<DynamicFeedData> {
  await waitForRequestSlot()
  try {
    return await wbiGet<DynamicFeedData>(DYNAMIC_FEED_PATH, buildParams(tab, page, offset))
  }
  catch (error) {
    if (error instanceof WbiApiError && DYNAMIC_RISK_CONTROL_CODES.includes(error.code)) {
      await sleep(1500)
      await waitForRequestSlot()
      return await wbiGet<DynamicFeedData>(DYNAMIC_FEED_PATH, buildParams(tab, page, offset))
    }
    throw error
  }
}

/**
 * 取一页动态。
 *
 * 失败一律抛错（由页面显示错误态 + 原生页回退入口）；番剧频道的 4101132 抛
 * {@link DynamicEmptyChannelError}，页面据此显示空态而不是报错。
 *
 * @param tab 频道（= 接口的 `type`：all / video / pgc / article）
 * @param page 页码（从 1 开始）
 * @param offset 上一页返回的游标；第 1 页不传。**翻页必须带它**，否则会重复拿到第一页。
 */
export async function fetchDynamicFeed(
  tab: DynamicTabId,
  page: number,
  offset?: string,
): Promise<DynamicFeedPage> {
  if (page > DYNAMIC_MAX_PAGES)
    return { items: [], hasMore: false }

  let data: DynamicFeedData
  try {
    data = await requestFeed(tab, page, offset)
  }
  catch (error) {
    // 番剧频道：真机恒定 4101132（原生页面同样 0 条），按「该频道暂无内容」处理
    if (error instanceof WbiApiError && error.code === DYNAMIC_PGC_EMPTY_CODE)
      throw new DynamicEmptyChannelError(error.message || 'channel has no content')
    throw error
  }

  const items = Array.isArray(data?.items)
    ? data.items
    : []
  return {
    items,
    offset: data?.offset,
    hasMore: Boolean(data?.has_more),
  }
}
