/**
 * 清理 URL 追踪参数（第 40 轮，内化自油猴脚本 «Make BiliBili Great Again»）。
 *
 * 参数清单：`buvid / is_story_h5 / launch_id / live_from / mid / session_id / timestamp /
 * up_id / vd_source / share* / spm*`。
 *
 * 分工：
 * - **页面世界**（`src/inject/index.js`）包装 `history.pushState / replaceState`，在入参阶段清理；
 * - **本文件**负责两件补充：
 *   1. 页面首次加载时对当前 URL 做一次 `replaceState` 清理；
 *   2. 监听页面世界派发的 `historyChange` 事件（既有注入通道已有），在路由变化后再兜一次。
 *
 * 之所以还要兜底：B 站有些路由会先 pushState 再由异步逻辑二次 replaceState，
 * 只靠入参清理可能漏掉后一次写入。
 */

/** 需要清掉的参数（与 src/inject/index.js 里的 TRACKING_PARAMS 保持同一份清单） */
const TRACKING_PARAMS = [
  'buvid',
  'is_story_h5',
  'launch_id',
  'live_from',
  'mid',
  'session_id',
  'timestamp',
  'up_id',
  'vd_source',
] as const

/** 前缀类参数：`share_* / shareFrom / spm_id_from / spm* …` */
const TRACKING_PREFIXES = ['share', 'spm'] as const

let bound = false

function isTrackingParam(name: string): boolean {
  const key = name.toLowerCase()
  if ((TRACKING_PARAMS as readonly string[]).includes(key))
    return true
  return TRACKING_PREFIXES.some(prefix => key.startsWith(prefix))
}

/** 清理当前地址栏 URL（只处理同源、只删追踪参数，其它原样保留） */
export function cleanCurrentUrl(): boolean {
  let url: URL
  try {
    url = new URL(location.href)
  }
  catch {
    return false
  }

  const removals: string[] = []
  url.searchParams.forEach((_value, key) => {
    if (isTrackingParam(key))
      removals.push(key)
  })
  if (!removals.length)
    return false

  removals.forEach(key => url.searchParams.delete(key))
  try {
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)
    return true
  }
  catch {
    return false
  }
}

/** 页面世界在每次 pushState / replaceState 后派发（既有注入通道） */
function onHistoryChange(): void {
  // 放到下一拍：让页面世界的 pushState 先落定，再清理最终 URL
  window.setTimeout(cleanCurrentUrl, 0)
}

/** 开启：清理一次当前 URL + 监听路由变化（幂等） */
export function setupUrlCleaner(): void {
  cleanCurrentUrl()
  if (bound)
    return
  window.addEventListener('historyChange', onHistoryChange)
  bound = true
}

/** 关闭：只解绑监听，已经清理掉的 URL 无需还原（还原反而会写回追踪参数） */
export function teardownUrlCleaner(): void {
  if (!bound)
    return
  window.removeEventListener('historyChange', onHistoryChange)
  bound = false
}
