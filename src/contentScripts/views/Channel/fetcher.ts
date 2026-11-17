/**
 * 分区页（自绘）的数据获取。
 *
 * 只有一个接口，但它是**真机抓包确认**的那个：
 *
 *   GET https://api.bilibili.com/x/web-interface/region/feed/rcmd
 *       ?display_id=<从 2 开始，每页 +1>
 *       &request_cnt=15
 *       &from_region=<分区 feed 编号>
 *       &device=web&plat=30&web_location=333.40138
 *
 * 实测要点（2026-11-17，CDP 真机）：
 *   - **不需要 wbi 签名**：页面自己发的请求带 w_rid/wts，但去掉这两个参数照样
 *     `code: 0` 且返回 15 条，所以本模块不引 WBI 签名（少 80 行 md5 + 密钥表）；
 *   - `from_region` 必须是页面自己用的那个编号（动画 = 1005），
 *     传 tid（动画 = 1）会 `-400 请求错误`，见 dom.ts 的 discoverFromRegion()；
 *   - 返回的 `archives[]` 里 stat / duration / author / rec_reason 都是真值，
 *     足够渲染「16:9 封面 / 时长 / 标题 / UP / 播放量 / 角标」。
 *
 * 接口不在 `src/background/messageListeners/api` 的代理清单里，而本轮写入范围不允许改 api 层，
 * 所以在页面同源直连（与 `views/Popular/fetcher.ts` 对「每周必看」的处理一致）。
 */
import type { BiliResponse, RegionFeedPage } from './types'
import { FEED_REQUEST_COUNT, REGION_FEED_API } from './constants'

/** 单次请求超时：超过就报错，由页面显示「重试 / 在原版页面打开」 */
const REQUEST_TIMEOUT = 12_000

/**
 * 取一页分区 feed。
 *
 * 失败一律抛错（HTTP 非 2xx / code !== 0 / data 缺失 / 超时），
 * 由调用方决定「重试」还是「回退原生页面」。
 */
export async function fetchRegionFeed(
  fromRegion: number,
  displayId: number,
  requestCount: number = FEED_REQUEST_COUNT,
): Promise<RegionFeedPage> {
  const params = new URLSearchParams({
    display_id: String(displayId),
    request_cnt: String(requestCount),
    from_region: String(fromRegion),
    device: 'web',
    plat: '30',
    web_location: '333.40138',
  })

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    const response = await fetch(`${REGION_FEED_API}?${params.toString()}`, {
      credentials: 'include',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok)
      throw new Error(`HTTP ${response.status}`)

    const payload = await response.json() as BiliResponse<{ archives?: unknown[] }>
    if (payload.code !== 0)
      throw new Error(payload.message || `API code ${payload.code}`)
    if (!payload.data)
      throw new Error('API returned no data')

    const archives = Array.isArray(payload.data.archives)
      ? payload.data.archives as RegionFeedPage['archives']
      : []
    return {
      archives,
      // 接口没有 no_more 字段：这一页为空就当到底了（真机连续请求到空页即结束）
      noMore: archives.length === 0,
    }
  }
  finally {
    window.clearTimeout(timer)
  }
}
