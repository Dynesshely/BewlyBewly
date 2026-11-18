/**
 * 搜索结果页（自绘）的静态配置。
 *
 * # 为什么改成「API 拉数据 + 自绘」
 *
 * 第 92–94 轮试过「改造原生搜索结果 DOM（网格 + 样式）」，结论是**不可行**：
 * 只要给 <html> 加状态类并注入页面级样式，42 张原生结果卡就全部塌成 0 高
 * （B 站搜索卡用 `__wrap` 绝对定位，任何布局影响都会塌）。所以本轮改为
 * 「/x/web-interface/wbi/search/type 拉数据 + 我们自己的 VideoCard 渲染 +
 * 覆盖层」，与 views/Space / views/Channel / views/Popular 同一模式。
 *
 * # 真机事实（2026-11-18，CDP 9333，登录态 Crequency）
 *
 * 搜索结果页 `https://search.bilibili.com/all?keyword=…` 的 DOM 骨架：
 *
 *   body
 *     ├ DIV#bili-header-container        原生 B 站顶栏（64px）
 *     ├ DIV#app                          原生搜索页（search-layout / search-header /
 *     │                                  search-content.search-page-wrapper）
 *     ├ DIV#biliMainFooter               页脚
 *     ├ DIV#bewly                        Bewly 自己的浮层（顶栏在这里，不能隐藏）
 *     └ DIV#bewly-search-enhance         searchPage 增强层的 shadow 宿主（右下角工具条）
 *
 * 原生筛选栏在 `.search-conditions`，文案「综合排序 / 最多播放 / 最新发布 /
 * 最多弹幕 / 最多收藏 / 更多筛选」，分页是 `.vui_pagenation`（页码式，不是无限滚动）。
 *
 * # 真机验证过的 URL 参数（原生搜索页自身也吃这套）
 *
 *   ?keyword=原神&page=2&order=pubdate&duration=2&tids_1=4
 *
 * duration=2 时原生结果卡时长全部落在 10–30 分钟（真机抽查 10 条：10:26…29:57），
 * 说明参数名与取值都和接口一致；分区分档用的是 `tids_1`（一级分区），
 * 所以本模块写 URL 时也用 `tids_1`，保证原生页与自绘页能互相接力。
 */

/** 自绘覆盖层容器 id（调试 / e2e / Lead 接线都按它定位） */
export const SEARCH_DRAWN_ROOT_ID = 'bewly-search-drawn-root'

/** 挂在 <html> 上的「本模块已接管」标记（页面级样式与 e2e 靠它判断） */
export const SEARCH_DRAWN_ACTIVE_CLASS = 'bewly-search-drawn'

/** 原生 DOM 被隐藏时打的标记属性（只还原本模块动过的节点） */
export const SEARCH_DRAWN_HIDDEN_ATTR = 'data-bewly-search-drawn-hidden'

/**
 * 接管后需要隐藏的原生 DOM（类名来自真机 dump）。
 *
 * `#bewly` 里是 Bewly 自己的顶栏，**不能**隐藏；
 * `#bewly-search-enhance` 是 searchPage 增强层的浮层，它操作的是原生结果卡，
 * 原生卡被隐藏后它只剩一个空工具条，所以一并隐藏（可逆，只改本模块打标记的节点）。
 * 原生结果卡单独列出：Bewly 的键盘卡片导航按「inline display !== 'none'」判断可见性，
 * 只隐藏父节点时它仍会枚举到这些卡，方向键 / Enter 会被看不见的原生卡吃掉。
 */
export const NATIVE_PAGE_SELECTOR = [
  '#bili-header-container',
  '#app',
  '#biliMainFooter',
  '.biliMainFooterWrapper',
  '.footer.bili-footer',
  '#client-app',
  '#bewly-search-enhance',
  '#app .bili-video-card',
  '#app .video-list-item',
  '#app .b-user-video-card',
  '#app .search-page-video',
].join(', ')

/** 搜索页主机名（含 search.bilibili.com 本身与可能的子域） */
export const SEARCH_HOST_RE = /(?:^|\.)search\.bilibili\.com$/i

/**
 * 本模块接管的路径。
 *
 * 只接管「视频结果为主」的两个 tab：`/all`（综合）与 `/video`（视频），
 * 以及去掉路径的根地址。番剧 / 影视 / 直播 / 专栏 / 用户这些 tab 的数据源完全不同
 * （search_type 不是 video），一律不接管，原生页保持完整可用。
 */
export const OWNED_SEARCH_PATHS = ['/', '/all', '/video']

/** 写 URL 时的默认路径 */
export const SEARCH_DEFAULT_PATH = '/all'

/** 每页条数（真机：page_size=30 → data.pagesize=30；50 也可用，100 直接 -400） */
export const SEARCH_PAGE_SIZE = 30

/** 首屏骨架数量（铺满常见 4–6 列 × 2–3 行） */
export const SEARCH_SKELETON_COUNT = 12

/** 接口路径（相对 https://api.bilibili.com，交给 wbiGet 拼） */
export const SEARCH_API_PATH = '/x/web-interface/wbi/search/type'

/** 原生搜索页根地址（错误态里的回退链接拼接用） */
export const NATIVE_SEARCH_BASE_URL = 'https://search.bilibili.com'

/**
 * 两次搜索请求之间的最小间隔（毫秒）。
 *
 * 真机：同一接口间隔 < 1s 连发会吃风控（-352 / -412），Space 的 arc/search 已验证；
 * 这里翻页是用户手动点页码，正常不会触发，但快速连点 / 筛选连切时会用到。
 */
export const SEARCH_REQUEST_MIN_GAP = 800

/** 排序方式（= 接口的 `order` 参数，真机确认全部可用） */
export type SearchOrderId = 'totalrank' | 'click' | 'pubdate' | 'dm' | 'stow'

/** 排序顺序与原生筛选栏一致：综合 / 最多播放 / 最新发布 / 最多弹幕 / 最多收藏 */
export const SEARCH_ORDERS: SearchOrderId[] = [
  'totalrank',
  'click',
  'pubdate',
  'dm',
  'stow',
]

/** 默认排序：综合（native 默认，且真机 order 缺省等价 totalrank） */
export const DEFAULT_SEARCH_ORDER: SearchOrderId = 'totalrank'

/**
 * 时长档位（= 接口的 `duration` 参数）。
 *
 * 真机验证区间（每档抽查 30 条的时长最小值 / 最大值）：
 *   1 → 52s … 533s（10 分钟内）、2 → 602s … 1764s（10–30 分钟）、
 *   3 → 1801s … 3561s（30–60 分钟）、4 → 3647s …（60 分钟以上）。
 */
export type SearchDurationId = '' | '1' | '2' | '3' | '4'

export const SEARCH_DURATIONS: SearchDurationId[] = ['', '1', '2', '3', '4']

/** 一级分区（`tids` 参数）的选项；名称用 B 站自己的中文分区名（原生页也不翻译） */
export interface SearchTidOption {
  id: number
  name: string
}

/**
 * 真机逐个验证过的一级分区（每个 id 都请求了一次，检查返回条目的 `typename`
 * 是否落在该分区下）。`tids=23`（电影）与 `tids=11`（电视剧）在
 * `search_type=video` 下返回空列表，因此不列入。
 */
export const SEARCH_TIDS: SearchTidOption[] = [
  { id: 1, name: '动画' },
  { id: 13, name: '番剧' },
  { id: 167, name: '国创' },
  { id: 3, name: '音乐' },
  { id: 129, name: '舞蹈' },
  { id: 4, name: '游戏' },
  { id: 36, name: '知识' },
  { id: 188, name: '科技' },
  { id: 234, name: '运动' },
  { id: 223, name: '汽车' },
  { id: 160, name: '生活' },
  { id: 211, name: '美食' },
  { id: 217, name: '动物圈' },
  { id: 119, name: '鬼畜' },
  { id: 155, name: '时尚' },
  { id: 202, name: '资讯' },
  { id: 5, name: '娱乐' },
  { id: 181, name: '影视' },
  { id: 177, name: '纪录片' },
]

/**
 * mount.ts → SearchPage.vue 的 provide/inject 键。
 *
 * 不用 `app.mount()` 的返回值取组件方法：mount 返回的是公共实例代理，能不能读到
 * `defineExpose` 暴露的方法取决于 Vue 内部实现细节；而 provide 一个可变对象、
 * 由组件在 setup 里写入自己的方法，是明确且稳定的通道。
 */
export const SEARCH_PAGE_BRIDGE_KEY = 'BEWLY_SEARCH_PAGE_BRIDGE'

/** 分页页码窗口：当前页左右各显示 2 个页码，首尾页码始终显示 */
export const SEARCH_PAGE_SPAN = 2
