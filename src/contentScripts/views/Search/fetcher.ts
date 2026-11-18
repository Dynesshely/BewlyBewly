/**
 * 搜索结果页（自绘）的数据获取。
 *
 * # 接口与签名（真机 2026-11-18 实测）
 *
 *   GET /x/web-interface/wbi/search/type?search_type=video&keyword&page&page_size
 *       &order&duration&tids                                 视频结果（wbi 签名）
 *
 * 签名不在这里实现：统一调用 `~/utils/wbi` 的 `wbiGet`（返回响应体的 `data`，
 * `code !== 0` 抛 `WbiApiError`，HTTP 非 2xx 抛普通 Error，
 * 内部固定 `credentials: 'include'`）。
 *
 * # 真机要点（写进代码的约束）
 *
 * - **签名不是强制**：同一请求带签名或不带签名都返回 code 0（两者都测过）。
 *   仍然走签名：这是仓库既有的统一基建，且 B 站随时可能收紧风控；
 * - **不要求登录**：未登录同样 code 0（登录态实测 Crequency，匿名请求参数一致），
 *   所以本模块不像空间页那样把「没登录」当回退条件 —— 搜索结果对匿名用户本来可见；
 * - **page_size 上限**：30 / 42 / 50 都可用，100 直接 `-400 请求错误`；
 * - **空 keyword 返回 -400**：调用方必须先判空（本模块在挂载闸门里就判了）；
 * - **numResults 上限 1000**：命中超过 1000 条时接口只回 1000，`numPages` 也按 1000 算
 *   （真机 keyword=原神：numResults=1000、numPages=34）；翻到 numPages 之后接口
 *   会重复返回最后一页内容，所以页面必须按 `numPages` 钳制，不能无限翻；
 * - **连发会吃风控**：同一接口间隔 < 1s 连发可能 -352 / -412，这里用「最小请求间隔」
 *   串行闸门 + 风控码单次重试兜住。
 */
import type { SearchApiData, SearchApiItem, SearchFiltersState, SearchVideoPage } from './types'
import { WbiApiError, wbiGet } from '~/utils/wbi'
import { SEARCH_API_PATH, SEARCH_PAGE_SIZE, SEARCH_REQUEST_MIN_GAP } from './constants'

/** 上一次请求的发起时间（串行闸门用） */
let lastRequestAt = 0

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

/** 等够最小请求间隔再发请求 */
async function waitForRequestSlot(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt
  if (elapsed < SEARCH_REQUEST_MIN_GAP)
    await sleep(SEARCH_REQUEST_MIN_GAP - elapsed)
  lastRequestAt = Date.now()
}

/** 风控类错误码：稍等重试一次通常就恢复 */
const RISK_CONTROL_CODES = new Set([-352, -412, -509])

/** 组装参数（undefined 会被 wbiGet 跳过，所以空筛选直接传 undefined） */
function buildParams(keyword: string, page: number, filters: SearchFiltersState, pageSize: number) {
  return {
    search_type: 'video',
    keyword,
    page,
    page_size: pageSize,
    order: filters.order,
    duration: filters.duration === ''
      ? undefined
      : filters.duration,
    tids: filters.tid === ''
      ? undefined
      : filters.tid,
  }
}

/** 真正发一次请求；命中风控码时等一会儿重试一次（只重试一次，避免放大风控） */
async function requestSearch(
  keyword: string,
  page: number,
  filters: SearchFiltersState,
  pageSize: number,
): Promise<SearchApiData> {
  await waitForRequestSlot()
  try {
    return await wbiGet<SearchApiData>(SEARCH_API_PATH, buildParams(keyword, page, filters, pageSize))
  }
  catch (error) {
    if (error instanceof WbiApiError && RISK_CONTROL_CODES.has(error.code)) {
      await sleep(1500)
      await waitForRequestSlot()
      return await wbiGet<SearchApiData>(SEARCH_API_PATH, buildParams(keyword, page, filters, pageSize))
    }
    throw error
  }
}

/** 只保留真正是视频的条目（混排时可能夹带直播 / 课程卡片，它们没有 bvid / aid） */
function normalizeItems(raw: SearchApiItem[] | undefined): SearchApiItem[] {
  if (!Array.isArray(raw))
    return []
  return raw.filter(item => Boolean(item?.bvid) || Number(item?.aid) > 0)
}

/**
 * 取一页搜索结果。
 *
 * 失败一律抛错（由页面显示错误态 + 原生页回退入口）；**空关键词直接抛**，
 * 因为接口对它返回 -400，而且空关键词本来也不该走到这里。
 */
export async function fetchSearchVideos(
  keyword: string,
  page: number,
  filters: SearchFiltersState,
  pageSize: number = SEARCH_PAGE_SIZE,
): Promise<SearchVideoPage> {
  const trimmed = keyword.trim()
  if (!trimmed)
    throw new Error('search keyword is empty')

  const data = await requestSearch(trimmed, page, filters, pageSize)
  const items = normalizeItems(data?.result)
  const resolvedPageSize = Number(data?.pagesize) || pageSize
  const total = Number(data?.numResults) || 0
  const numPages = Number(data?.numPages)
    || (total > 0
      ? Math.ceil(total / resolvedPageSize)
      : 0)

  // 页码钳制：真机里 page > numPages 时接口会**重复返回最后一页**（page=35 与 page=34
  // 内容完全相同）。不钳制的话地址栏 / 分页条会显示成「第 999 / 34 页」，
  // 所以这里把返回页收紧到 numPages，页面据此把地址栏也改回来。
  const requestedPage = Number(data?.page) || page
  const resolvedPage = numPages > 0
    ? Math.min(requestedPage, numPages)
    : requestedPage

  return {
    items,
    total,
    numPages,
    page: resolvedPage,
    pageSize: resolvedPageSize,
  }
}
