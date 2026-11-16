/**
 * 直播页（live.bilibili.com）自绘模块的固定标识与原生结构选择器。
 *
 * 所有选择器都来自 2026-11 CDP 真机 dump（见交付说明里的「真机 dump」一节）：
 *   - 直播首页（新版 v2 布局）：`#app` 内是「站点头栏 64px → 分区行 → 滚动容器」；
 *     滚动容器为 `.v2-main-scroll`，其直接子节点是 `main.mx-20px`（banner / 小播放器 / 我的关注 / 推荐直播）；
 *     分区行是 `nav[aria-label="直播分区"]`，内含 12 个 pill（娱乐 / 虚拟主播 / …）。
 *   - 直播间（新版布局）：`.player-ctnr`（`p-relative`）里依次是
 *     `#head-info-vm.head-info-section`（52px 主播信息栏）与 `.fullscreen-container-paddingbox`（播放器）；
 *     侧栏 `#aside-area-vm`（300px，弹幕 / 礼物 / 输入框，**本模块不碰**）；
 *     舞台下方 `#sections-vm` 的 `.right-container`（300px 侧列，原生只放「主播公告」）。
 *
 * 选择器一旦失效，模块整体降级为「不接管、保留原生页面」，不会把页面改坏。
 */

/** 直播站域名 */
export const LIVE_HOST_RE = /(?:^|\.)live\.bilibili\.com$/i

/** 直播首页浮层的容器 id（`fixed` 覆盖层，只覆盖顶栏以下区域） */
export const HOME_HOST_ID = 'bewly-live-home-root'
/** 直播间顶部信息栏的容器 id */
export const ROOM_BAR_HOST_ID = 'bewly-live-room-bar'
/** 直播间侧栏推荐列表的容器 id */
export const ROOM_RECOMMEND_HOST_ID = 'bewly-live-room-recommend'

/** 首页已自绘（挂在 <html> 上，页面级样式靠它隐藏原生 DOM） */
export const ROOT_CLASS_HOME_DRAWN = 'bewly-live-home-drawn'
/** 直播间顶部信息栏已自绘（原生信息栏靠它改成 visibility:hidden） */
export const ROOT_CLASS_ROOM_DRAWN = 'bewly-live-room-drawn'

/** 模块自行注入的页面级 <style> 的 id */
export const PAGE_STYLE_ID = 'bewly-live-drawn-page-style'

/** 被模块隐藏的原生节点标记（卸载时按它逐个还原） */
export const NATIVE_HIDDEN_ATTR = 'data-bewly-live-drawn-hidden'
/** 直播间原生信息栏里要被自绘栏盖住的子节点标记 */
export const NATIVE_MUTED_ATTR = 'data-bewly-live-drawn-muted'

/** 站点头栏（保留原生，自绘内容从它下面开始） */
export const NAVBAR_SELECTORS = [
  '.link-navbar-wrap',
  '.link-navbar',
  '#biliMainHeader',
]

/** 首页滚动容器（只用来兜底判断「这是不是首页新版布局」） */
export const HOME_SCROLL_SELECTORS = [
  '.v2-main-scroll',
  '#app .main-content',
]

/** 首页需要隐藏的原生内容：滚动容器里的 `main` + 分区行 */
export const HOME_CONTENT_SELECTORS = [
  '.v2-main-scroll > main',
  '.v2-main-scroll > .container',
  '.v2-main-scroll > main.mx-20px',
]
export const HOME_AREA_NAV_SELECTORS = [
  'nav[aria-label="直播分区"]',
  '.area-list nav',
]
/** 分区行的外层包装（只包分区行时一起隐藏，避免留下 60px 空白条） */
export const HOME_AREA_ROW_SELECTORS = [
  'nav[aria-label="直播分区"]',
]

/** 直播间：播放器列容器（顶部信息栏的父级，`position: relative`） */
export const ROOM_PLAYER_SELECTORS = [
  '.player-and-aside-area .player-ctnr',
  '.player-ctnr',
  '#player-ctnr',
]
/** 直播间：原生顶部信息栏（自绘栏用 visibility 盖住它的内容） */
export const ROOM_HEAD_INFO_SELECTORS = [
  '#head-info-vm',
  '.head-info-section',
]
/** 直播间：原生关注控件（自绘关注按钮转发点击给它） */
export const ROOM_FOLLOW_SELECTORS = [
  '.follow-ctnr > .not-yet-follow',
  '.follow-ctnr > div',
  '.follow-ctnr',
]
/** 直播间：舞台下方区块容器 */
export const ROOM_SECTION_SELECTORS = [
  '#sections-vm',
  '.section-block',
]
/** 直播间：右侧列（原生只放主播公告，推荐列表挂在它下面） */
export const ROOM_RIGHT_COLUMN_SELECTORS = [
  '#sections-vm .right-container',
  '.section-block .right-container',
]

/** 首页每页卡片数（真机 `getListV2` 默认 15） */
export const HOME_PAGE_SIZE = 15
/** 首页最多翻页数，避免无限流失控 */
export const HOME_MAX_PAGES = 20
/** 侧栏推荐列表取几条（真机 recList 返回 7 条） */
export const ROOM_RECOMMEND_LIMIT = 7
/** 直播间人气 / 点赞的刷新间隔 */
export const ROOM_REFRESH_INTERVAL = 30_000
/** 关注后的状态回读延迟 */
export const FOLLOW_RECHECK_DELAY = 1_500
