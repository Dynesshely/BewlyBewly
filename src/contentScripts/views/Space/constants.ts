/**
 * 空间页（自绘）的静态配置。
 *
 * # 真机事实（2026-11-18 CDP 只读 dump，`https://space.bilibili.com/2`）
 *
 * 空间页是 Vue SPA，DOM 骨架：
 *
 *   body
 *     ├ HEADER#biliMainHeader           原生 B 站顶栏（64px）
 *     ├ DIV#app                          整个空间页
 *     │   ├ DIV.space-theme-bg           fixed z-index:-1 背景层
 *     │   ├ DIV.header.space-header      头图 + UP 信息（200px）
 *     │   ├ DIV.nav-bar.space-navbar     sticky top:0 z-index:99 的 tab 行（64px）
 *     │   └ MAIN.space-main.route_home
 *     │       ├ DIV.space-home → section.home-section → .section-wrap.video-section
 *     │       │     └ .items.full > .items__item > .bili-video-card
 *     │       └ DIV.space-float
 *     └ DIV#bewly                        Bewly 自己的 shadow root 浮层（顶栏在这里）
 *
 * 视频列表本身**没有任何接口不可达的理由**，但 B 站列表的懒加载 / 虚拟化 / 排序
 * 都绑在原生 Vue 组件上，无法可靠接管 DOM（第 99 轮已经踩过一次网格化的坑），
 * 所以本模块改为「API 拉数据 + 我们自己的 VideoCard 渲染 + 覆盖层」，与
 * `views/Channel` / `views/Popular` 同一模式。
 */

/** 自绘覆盖层容器 id（调试 / e2e / Lead 接线都按它定位） */
export const SPACE_DRAWN_ROOT_ID = 'bewly-space-drawn-root'

/**
 * 挂在 `<html>` 上的「本模块已接管」标记。
 *
 *   1. 页面级样式（背景色等）只在接管时生效；
 *   2. `spacePage` 增强层与其它模块可用它判断「已被自绘接管，别再叠一层」。
 */
export const SPACE_DRAWN_ACTIVE_CLASS = 'bewly-space-drawn'

/** 原生 DOM 被隐藏时打的标记属性（只还原本模块动过的节点） */
export const SPACE_DRAWN_HIDDEN_ATTR = 'data-bewly-space-drawn-hidden'

/**
 * 接管后需要隐藏的原生 DOM（类名来自真机 dump）。
 *
 * 除了页面容器与原生顶栏，也把原生视频卡本身置为 `display: none`：
 * Bewly 既有的键盘卡片导航（`useKeyboardCardNavigation` 的 `NATIVE_CARD_SELECTOR`）
 * 按「inline display !== 'none'」判断卡片是否可见，只隐藏 `#app` 父节点时它仍会枚举到
 * 这些卡，方向键 / Enter 会被看不见的原生卡吃掉。
 */
export const NATIVE_PAGE_SELECTOR = [
  '#app',
  '#biliMainHeader',
  '.footer.bili-footer',
  '#client-app',
  '#app .bili-video-card',
  '#app .items__item',
  '#app .bili-skeleton-card',
  '#app .bili-cover-card',
].join(', ')

/** 每页视频数（真机原生首屏 25 条，这里用 20，接口支持任意 ps） */
export const SPACE_PAGE_SIZE = 20

/** 首屏骨架数量（刚好铺满常见 4–6 列 × 2–3 行） */
export const SPACE_SKELETON_COUNT = 12

/** 排序方式（= 接口的 `order` 参数，真机确认三个值都可用） */
export type SpaceSortId = 'pubdate' | 'click' | 'stow'

export const SPACE_SORTS: SpaceSortId[] = ['pubdate', 'click', 'stow']

/** 默认排序：最新发布（与原生「视频」区块默认一致） */
export const DEFAULT_SPACE_SORT: SpaceSortId = 'pubdate'

/** 原生空间页根地址（错误态里的回退链接拼接用） */
export const NATIVE_SPACE_BASE_URL = 'https://space.bilibili.com'

/** 接口路径（相对 `https://api.bilibili.com`，交给 `wbiGet` 拼） */
export const ARC_SEARCH_PATH = '/x/space/wbi/arc/search'
export const ACC_INFO_PATH = '/x/space/wbi/acc/info'
/** 粉丝 / 关注数：非 wbi 接口，不需要签名 */
export const RELATION_STAT_PATH = '/x/relation/stat'
/** 关注 / 取关：POST，csrf 放表单体里（与页面自身请求一致） */
export const RELATION_MODIFY_PATH = '/x/relation/modify'

/** 关注动作（`act` 参数，B 站约定） */
export const RELATION_ACT_FOLLOW = 1
export const RELATION_ACT_UNFOLLOW = 2
/** 关注来源（`re_src`，11 = 个人空间页，与原生一致） */
export const RELATION_RE_SRC = 11
