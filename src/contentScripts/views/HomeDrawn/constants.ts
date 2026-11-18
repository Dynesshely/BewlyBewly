/**
 * 首页推荐流（自绘）的静态配置。
 *
 * # 为什么改成「API 拉数据 + 完全自绘」
 *
 * 旧方案 `views/Home/`（保留作回退）依赖 B 站原生 DOM 与自家接口拼装，推荐流的翻页、
 * 去重、骨架都散在各子组件里。本轮改成「/x/web-interface/wbi/index/top/feed/rcmd 拉数据 +
 * 我们自己的 HomeFeed 渲染 + 覆盖层」，与 `views/Space`（第 100 轮）、`views/Search`、
 * `views/MessageDrawn`、`views/Dynamic` 同一模式。
 *
 * # 接口真机结论（2026-11-19，CDP 9333，登录态 chromium-wbi）
 *
 *   GET /x/web-interface/wbi/index/top/feed/rcmd
 *       ?web_location=1430650&y_num=4&fresh_type=4&feed_version=V8
 *       &fresh_idx=1&fresh_idx_1h=1&brush=0&fetch_row=1&homepage_ver=1&ps=12
 *
 *   - **code 0**，`data.item` 12 条；每条字段与任务书一致：
 *     `{ id, bvid, cid, goto, uri, pic, title, duration(秒), pubdate,
 *        owner:{mid,name,face}, stat:{view,like,danmaku}, rcmd_reason:{content}, is_followed }`；
 *   - **`id` 就是 aid**：拿第一条的 bvid 反查 `/x/web-interface/view` 得到
 *     aid === item.id、cid === item.cid（真机逐条比对一致）；
 *   - **签名不是强制**：带 wbi 签名与不带签名都是 code 0（两条都实测）；
 *     仍走 `wbiGet` 签名 —— 这是仓库既有基建，且 B 站随时可能收紧风控；
 *   - **匿名（无 cookie）也能拿到 12 条**：nav 是 -101，但 feed 接口 code 0。
 *     所以本模块**不把「未登录」当回退条件**；只有接口报错 / 返回空才回退原生；
 *   - **`goto` 只有三种**：`av`（视频）、`live`（直播）、`ad`（广告卡片）。
 *     **`ad` 必须过滤**：它的 `id=0`、`bvid=''`、`title=''`，直接把 `business_info` 塞在
 *     同名字段里；不过滤会在网格里留下一个「三无空卡」。
 *   - **翻页无重叠**：`fresh_idx`/`fresh_idx_1h` 递增时，相邻两页的**视频条目重叠 0/12**
 *     （连续翻 30 页不断流、302 条不重复）。改成「同参数连调两次」也重叠 0 ——
 *     说明服务端每次返回一批新的随机推荐，`fresh_idx` 只是给服务端的语义参数，
 *     不是严格游标。因此本模块**不需要 offset 游标**，只用自增的 `fresh_idx`；
 *   - **短时间内连发不吃风控**：无间隔连发 5 次全部 code 0。仍保留 900ms 最小间隔闸门
 *     （与 views/Space / views/Dynamic 一致），避免滚动加载打爆接口。
 */

/** 自绘覆盖层容器 id（调试 / e2e / Lead 接线都按它定位） */
export const HOME_DRAWN_ROOT_ID = 'bewly-home-drawn-root'

/**
 * 挂在 `<html>` 上的「本模块已接管」标记。
 *
 *   1. 页面级样式（背景色等）只在接管时生效；
 *   2. e2e / 其它模块可用它判断「首页已被自绘接管」。
 */
export const HOME_DRAWN_ACTIVE_CLASS = 'bewly-home-drawn'

/**
 * 被隐藏的**旧首页 DOM** 上的标记属性。
 *
 * 关键事实（真机 dump）：**首页没有 `#app`**。`contentScripts/index.ts` 的
 * `changeHomePage` 分支在 DOMContentLoaded 阶段就执行了 `document.body.innerHTML = ''`，
 * 只把原生顶栏 append 回去。所以「隐藏原生 #app」在首页是空操作；要隐藏的是
 * **`#bewly` shadow root 里 App.vue 渲染的旧 Bewly 首页**（`.bewly-scroll-container`
 * 所在的父层），否则自绘覆盖层会把旧网格盖住、但旧网格仍在下面接键盘与滚动。
 */
export const HOME_DRAWN_HIDDEN_ATTR = 'data-bewly-home-drawn-hidden'

/**
 * 接管后需要隐藏的旧首页节点（light DOM + shadow root 两处）。
 *
 * - light DOM：`#app` 保留（其它 SPA 路由可能会重建它）、页脚；
 * - shadow root：`.bewly-scroll-container` 的父层（旧 Home 页面区）。
 */
export const NATIVE_PAGE_SELECTOR = [
  '#app',
  '.footer.bili-footer',
  '#biliMainFooter',
  '#client-app',
].join(', ')

/** 接口路径（相对 https://api.bilibili.com，交给 wbiGet 拼） */
export const HOME_FEED_PATH = '/x/web-interface/wbi/index/top/feed/rcmd'

/**
 * 接口的固定参数（2026-11-19 真机抓原生首页请求逐字对齐）。
 *
 * `fresh_idx` / `fresh_idx_1h` 每页递增 1，由 fetcher 传进来；
 * 其余参数固定不变（少传也能 code 0，但保持与原生一致能拿到同样的字段集）。
 */
export const HOME_FEED_BASE_PARAMS = {
  web_location: 1430650,
  y_num: 4,
  fresh_type: 4,
  feed_version: 'V8',
  brush: 0,
  fetch_row: 1,
  homepage_ver: 1,
  ps: 12,
} as const

/** 每页条数（接口 `ps`；接口支持 6/10/12/20/30，真机都 code 0） */
export const HOME_PAGE_SIZE = 12

/** 首屏骨架数量（12 张，刚好铺满常见 4–6 列 × 2–3 行） */
export const HOME_SKELETON_COUNT = 12

/**
 * 两次 feed 请求之间的最小间隔（毫秒）。
 *
 * 真机：无间隔连发 5 次仍是 code 0（没有吃到风控），但 B 站首页的推荐接口在
 * 高频请求下可能收紧，保留一个与 views/Space（900ms）/ views/Dynamic（900ms）
 * 一致的最小间隔，滚动加载自然不会比这更快。
 */
export const HOME_REQUEST_MIN_GAP = 900

/**
 * 单次会话最多连续翻页数（安全阀）。
 *
 * 接口没有「到底」信号（真机翻 30 页不断流），所以「无更多时停止」靠这个上限
 * 兜底：达到上限后不再请求，并显示「没有更多了」。
 */
export const HOME_MAX_PAGES = 40

/** 广告卡片的 `goto` 值（必须过滤，否则会渲染出三无空卡） */
export const HOME_GOTO_AD = 'ad'

/** 直播卡片的 `goto` 值 */
export const HOME_GOTO_LIVE = 'live'

/** 番剧卡片的 `goto` 值 */
export const HOME_GOTO_BANGUMI = 'bangumi'

/** 视频详情地址前缀（错误态 / 卡片链接兜底用） */
export const HOME_VIDEO_BASE_URL = 'https://www.bilibili.com/video'

/** 直播地址前缀 */
export const HOME_LIVE_BASE_URL = 'https://live.bilibili.com'

/** 本站其它页面入口（顶部 tab 行右侧的「去其它页」链接） */
export const HOME_SIBLING_LINKS = [
  {
    id: 'moments',
    url: 'https://t.bilibili.com/',
    i18nKey: 'linkMoments',
    icon: 'i-tabler:windmill',
  },
  {
    id: 'popular',
    url: 'https://www.bilibili.com/v/popular/all',
    i18nKey: 'linkPopular',
    icon: 'i-mingcute:fire-line',
  },
  {
    id: 'search',
    url: 'https://search.bilibili.com/all',
    i18nKey: 'linkSearch',
    icon: 'i-mingcute:search-2-line',
  },
  {
    id: 'watch-later',
    url: 'https://www.bilibili.com/watchlater/list',
    i18nKey: 'linkWatchLater',
    icon: 'i-mingcute:carplay-line',
  },
  {
    id: 'history',
    url: 'https://www.bilibili.com/history',
    i18nKey: 'linkHistory',
    icon: 'i-mingcute:time-line',
  },
] as const

/** 滚动位置记忆在 sessionStorage 里的 key（不参与恢复判断，只用于排查 / 调试） */
export const HOME_SCROLL_STORAGE_KEY = 'bewly-home-drawn-scroll'
