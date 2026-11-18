/**
 * 消息中心（自绘）的静态配置。
 *
 * # 为什么改成「API 拉数据 + 自绘」
 *
 * 第 93/94 轮的 `views/Message` 是「原生 DOM 做数据源 + 自绘覆盖 + CSS 换皮」的混合方案：
 * 会话列表 / 四个互动列表都靠读原生节点，交互全靠点击转发。问题是数据完全受原生 DOM
 * 结构支配（改版就废）、拿不到时间戳与已读游标、也没法做真正的分页。本轮按
 * `views/Space`（第 100 轮）/ `views/Search`（第 101 轮）的模式，改为
 * 「接口拉数据 + 完全自绘 + 覆盖层」，原生 DOM 只在接口全部不可用时保留兜底
 * （见 index.ts 的挂载闸门：预取失败 → 完全不碰原生页面）。
 *
 * # 真机事实（2026-11-19，CDP 9333，登录态 Crequency mid=1961641805）
 *
 * 消息中心 `https://message.bilibili.com/#/<route>` 是 hash 路由的 SPA，DOM 骨架：
 *
 *   body
 *     ├ HEADER#message-pc-header        原生顶栏（64px，position:static）
 *     ├ DIV#app                          原生消息页（message-layout 在这里）
 *     │     ├ .message-aside > .message-sidebar  左栏（我的消息 / 回复我的 / @我的 / 收到的赞 / 系统通知 / 消息设置）
 *     │     └ .message-main                      右栏（whisper / reply / at / love / system 五个子页）
 *     ├ DIV#bewly                        Bewly 自己的浮层（本页高度 0：消息页没有 Bewly 顶栏）
 *     └ DIV#bewly-notification-page      notificationPage 增强层的 shadow 宿主（**盖在原生页之上**，
 *                                        原生页被隐藏后它只剩一个空浮层 + 键盘快捷键，会抢焦点）
 *
 * # 接口验证结论（全部真机发过请求；详见 fetcher.ts 的注释）
 *
 *   ✓ 会话列表  api.vc.bilibili.com/session_svr/v1/session_svr/get_sessions
 *   ✓ 聊天记录  api.vc.bilibili.com/svr_sync/v1/svr_sync/fetch_session_msgs
 *   ✓ 回复我的  api.bilibili.com/x/msgfeed/reply   （不带 wbi 签名直接可用）
 *   ✓ @我的     api.bilibili.com/x/msgfeed/at
 *   ✓ 收到的赞  api.bilibili.com/x/msgfeed/like
 *   ✓ 系统通知  message.bilibili.com/x/sys-msg/query_unified_notify
 *              （**只在 message.bilibili.com 这个 origin 下可用**，本模块本来就只在该站挂载）
 *   ✗ /x/msgfeed/system、/x/msgfeed/like/me、/x/msgfeed/dm 全部 404（不存在，不要用）
 */

/** 自绘覆盖层容器 id（调试 / e2e / Lead 接线都按它定位） */
export const MESSAGE_DRAWN_ROOT_ID = 'bewly-message-drawn-root'

/** 挂在 <html> 上的「本模块已接管」标记（页面级样式与 e2e 靠它判断） */
export const MESSAGE_DRAWN_ACTIVE_CLASS = 'bewly-message-drawn-api'

/** 原生 DOM 被隐藏时打的标记属性（只还原本模块动过的节点） */
export const MESSAGE_DRAWN_HIDDEN_ATTR = 'data-bewly-message-drawn-hidden'

/**
 * 接管后需要隐藏的原生 DOM（选择器来自真机 dump）。
 *
 * **只隐藏原生内容区，保留原生顶栏**（`#message-pc-header`）：
 *   - 与 Space / Search 不同，消息页的 `#bewly` 高度是 0（真机实测），Bewly 自己没有顶栏；
 *   - 如果把 B 站顶栏也隐藏掉，用户在自绘消息页里会失去所有站内导航入口。
 * 所以这里保留顶栏，覆盖层从顶栏下方开始（`--bew-message-shell-top`，见 mount.ts）。
 *
 * `#bewly` 里是 Bewly 自己的浮层（消息页高度 0，但仍承载 toast），不隐藏；
 * `#bewly-notification-page` 是 notificationPage 增强层的 shadow 宿主：它盖在原生页之上、
 * 写自己的 `display:flex`，还会注册全局键盘快捷键 —— 原生内容区被隐藏后它只剩空壳，
 * 一并隐藏（只加本模块的标记属性 + inline display，可逆，与 Search 藏 `#bewly-search-enhance` 同理）。
 */
export const NATIVE_PAGE_SELECTOR = [
  '#app',
  '#bewly-notification-page',
].join(', ')

/** 消息中心主机名 */
export const MESSAGE_HOST = 'message.bilibili.com'

/** 接口域名 */
export const API_ORIGIN = 'https://api.bilibili.com'
export const VC_ORIGIN = 'https://api.vc.bilibili.com'
/** 系统通知接口只挂在消息中心自己的 origin 上（真机确认，跨 origin 之外的域名都 404） */
export const MESSAGE_ORIGIN = 'https://message.bilibili.com'

/** 消息中心路由（hash）→ 自绘 tab */
export type MessageTabId = 'whisper' | 'reply' | 'at' | 'love' | 'system'

/** tab 顺序（与原生左栏「我的消息 / 回复我的 / @ 我的 / 收到的赞 / 系统通知」一致） */
export const MESSAGE_TABS: MessageTabId[] = [
  'whisper',
  'reply',
  'at',
  'love',
  'system',
]

/** 默认 tab（原生默认落点） */
export const DEFAULT_MESSAGE_TAB: MessageTabId = 'whisper'

/** 单页条数：会话列表 / 聊天记录（接口支持任意 size，真机 20/50 都可用） */
export const SESSION_PAGE_SIZE = 20
export const CHAT_PAGE_SIZE = 20
/** 互动列表（回复 / @ / 赞）单页条数：真机 ps=30 有效，ps=50 直接给全量，这里取 20 稳一点 */
export const FEED_PAGE_SIZE = 20
/** 系统通知单页条数（原生 page_size=10 / 20 都可用） */
export const SYSTEM_PAGE_SIZE = 20

/** 首屏骨架条数 */
export const SKELETON_COUNT = 6

/** 请求超时（毫秒） */
export const REQUEST_TIMEOUT = 10_000

/**
 * 两次请求之间的最小间隔（毫秒）。
 *
 * 消息类接口没有 search/type 那么强的风控，但同一接口连发仍可能 -352，
 * 翻页与切 tab 都是用户手动触发，800ms 足够。
 */
export const REQUEST_MIN_GAP = 400

/** 用户名片接口一次最多查多少个 mid（真机 17 个一起查没问题，这里留余量） */
export const USER_CARD_BATCH = 50

/** 消息气泡里图片的最大显示尺寸（px） */
export const CHAT_IMAGE_MAX = 220

/** 原生顶栏高度（真机 #message-pc-header 实测 64px） */
export const NATIVE_HEADER_HEIGHT = 64
/**
 * mount.ts → MessagePage.vue 的 provide/inject 键。
 *
 * 不用 `app.mount()` 的返回值取组件方法：mount 返回的是公共实例代理，能不能读到
 * `defineExpose` 暴露的方法取决于 Vue 内部实现细节；而 provide 一个可变对象、
 * 由组件在 setup 里写入自己的方法，是明确且稳定的通道（与 Search 的 SEARCH_PAGE_BRIDGE_KEY 同）。
 */
export const MESSAGE_PAGE_BRIDGE_KEY = 'BEWLY_MESSAGE_PAGE_BRIDGE'
