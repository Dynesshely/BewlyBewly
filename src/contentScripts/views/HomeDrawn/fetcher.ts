/**
 * 首页推荐流（自绘）的数据获取。
 *
 * # 接口（真机 2026-11-19 实测）
 *
 *   GET /x/web-interface/wbi/index/top/feed/rcmd
 *       ?web_location=1430650&y_num=4&fresh_type=4&feed_version=V8
 *       &fresh_idx=<页码>&fresh_idx_1h=<页码>&brush=0&fetch_row=1&homepage_ver=1&ps=12
 *
 * 签名不在这里实现：统一调用 `~/utils/wbi` 的 `wbiGet`（返回响应体的 `data`，
 * `code !== 0` 抛 `WbiApiError`，HTTP 非 2xx 抛普通 Error，内部固定
 * `credentials: 'include'`）。
 *
 * # 真机要点（写进代码的约束）
 *
 * - **签名不是强制**：带 wbi 签名与不带签名都 code 0（两条都实测）；仍走 `wbiGet`，
 *   与仓库其它 fetcher 一致；
 * - **匿名也能用**：无 cookie 时 nav 是 -101，但 feed 接口照常 code 0、12 条。
 *   所以**未登录不是回退条件** —— 只有接口报错 / 过滤后一条都没有才回退原生；
 * - **`fresh_idx` 递增即可翻页**：相邻页视频条目重叠 0/12（连续 30 页、302 条不重复），
 *   不需要 offset 游标；
 * - **必须过滤 `goto === 'ad'`**：广告条目 `id=0`/`bvid=''`/`title=''`，
 *   不过滤会渲染出三无空卡（每页恒有约 2 条广告，所以过滤后一页只有 10 条）；
 * - **连发不吃风控**（无间隔连发 5 次仍 code 0），但仍保留 900ms 最小间隔闸门，
 *   与 views/Space / views/Dynamic 保持一致，避免滚动加载打爆接口。
 */
import type { HomeFeedData, HomeFeedItem, HomeFeedPage } from './types'
import { wbiGet } from '~/utils/wbi'
import {
  HOME_FEED_BASE_PARAMS,
  HOME_FEED_PATH,
  HOME_PAGE_SIZE,
  HOME_REQUEST_MIN_GAP,
} from './constants'
import { nextFreshIdx, normalizePageItems } from './utils'

/** 上一次请求的发起时间（串行闸门用） */
let lastRequestAt = 0

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

/** 等够最小请求间隔再发请求 */
async function waitForRequestSlot(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt
  if (elapsed < HOME_REQUEST_MIN_GAP)
    await sleep(HOME_REQUEST_MIN_GAP - elapsed)
  lastRequestAt = Date.now()
}

/** 组装参数（`fresh_idx` / `fresh_idx_1h` 同步递增，真机原生就是这样翻页） */
function buildParams(freshIdx: number, ps: number) {
  return {
    ...HOME_FEED_BASE_PARAMS,
    ps,
    fresh_idx: freshIdx,
    fresh_idx_1h: freshIdx,
  }
}

/**
 * 取一页推荐。
 *
 * @param freshIdx 页码（从 1 开始；下一页 = 当前 + 1，见 {@link nextFreshIdx}）
 * @param ps 每页请求条数（默认 12；接口支持 6/10/12/20/30，真机都 code 0）
 *
 * 失败一律抛错（由页面显示错误态 + 原生页回退入口）；
 * **广告条目在这里就被过滤掉**，返回的 `items` 全部可展示。
 */
export async function fetchHomeFeed(freshIdx: number, ps: number = HOME_PAGE_SIZE): Promise<HomeFeedPage> {
  await waitForRequestSlot()

  const data = await wbiGet<HomeFeedData>(HOME_FEED_PATH, buildParams(freshIdx, ps))

  const rawItems: HomeFeedItem[] = Array.isArray(data?.item)
    ? data.item
    : []
  return {
    items: normalizePageItems(rawItems),
    freshIdx,
    rawCount: rawItems.length,
  }
}

/**
 * 预取首屏：拉第 1 页，**内容不足一屏时自动补 1 页**。
 *
 * 为什么需要补：`ps=12` 里恒有约 2 条广告，过滤后首屏只有 10 张卡；
 * 大屏（5 列 × 2 行 = 10）刚好铺满，更宽的屏会露白。
 * 这里最多补 1 页（合计 ≤ 24 条原始 / ≤ 20 张卡），再多就交给页面的
 * 「首屏不足一屏自动补」逻辑，避免预取阶段拖慢接管。
 *
 * 返回值给 mount.ts：成功才接管，失败返回 null（此时**还没有动过任何原生 DOM**）。
 */
export async function prefetchHomeFeed(): Promise<HomeFeedPage | null> {
  const first = await fetchHomeFeed(1)
  if (first.items.length === 0)
    return first

  try {
    const second = await fetchHomeFeed(nextFreshIdx(first.freshIdx))
    const merged: HomeFeedItem[] = [...first.items]
    const seen = new Set(merged.map(item => item.bvid || String(item.id)))
    for (const item of second.items) {
      const key = item.bvid || String(item.id)
      if (seen.has(key))
        continue
      seen.add(key)
      merged.push(item)
    }
    return {
      items: merged,
      freshIdx: second.freshIdx,
      rawCount: first.rawCount + second.rawCount,
    }
  }
  catch {
    // 第 2 页失败不影响接管：第 1 页有内容就够了
    return first
  }
}
