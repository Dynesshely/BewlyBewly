/**
 * 动态页（自绘）的静态配置。
 *
 * # 为什么改成「API 拉数据 + 完全自绘」
 *
 * 第 93 轮的做法是「逐条替换原生动态卡」：只读解析原生 DOM，再在自己的卡片里重画。
 * 这套方案受 B 站 DOM 结构影响极大（类名一变就全盘失效），而且原生列表的懒加载 /
 * 虚拟化 / 交互都绑在原生 Vue 组件上，无法可靠接管。本轮改为
 * 「/x/polymer/web-dynamic/v1/feed/all 拉数据 + 我们自己的组件渲染 + 覆盖层」，
 * 与 views/Space（第 100 轮）、views/Search（第 101 轮）同一模式。
 *
 * # 真机事实（2026-11-19，CDP 9333，登录态 chromium-wbi）
 *
 * 动态页 https://t.bilibili.com/ 的 DOM 骨架：
 *
 *   body
 *     ├ DIV#bili-header-container        原生 B 站顶栏（64px，Bewly 的 remove-top-bar 已把
 *     │                                  它置为 visibility:hidden 但仍占 64px 高度）
 *     ├ DIV#dyn-home-app                 动态页自己的挂载点
 *     └ DIV#app                          整个动态列表（异步渲染，比文档晚 1–3s 才出现）
 *
 * # 接口真机结论（写进代码的约束）
 *
 *   GET /x/polymer/web-dynamic/v1/feed/all?type=&page=&offset=&platform=web&timezone_offset=
 *   - **可用，code 0**；带 wbi 签名与不带签名都返回 code 0（两条都实测过）。
 *     仍走仓库统一的 `wbiGet` 签名：这是既有基建，且 B 站随时可能收紧风控。
 *   - **未登录直接 -101「账号未登录」** → 未登录必须回退原生（与空间页一致）。
 *   - **翻页必须带上一页返回的 `offset`**：只传 `page=2` 时返回的内容与 page=1
 *     **完全相同**（真机逐条比对 id_str，重叠 20/20）；带上 offset 后重叠 0/20、
 *     且 offset 会继续下传。所以本模块的游标是 `{ page, offset }`。
 *   - **`type` 取值**：all / video / pgc / article 是原生四个 tab 用的值（抓原生请求确认）。
 *     `pgc`（番剧）**恒返回 4101132 请求数据发生错误**，原生页面自己切到该 tab 时
 *     也是 0 条（抓原生响应体确认 code 4101132）—— 这是 B 站服务端的问题，不是参数错。
 *     本模块对该 tab 的错误按「该频道暂无内容」处理，只对它降级成空态。
 *   - **连发会吃风控**：间隔 1s 以上稳定，所以给请求加了最小间隔闸门 + 风控码重试一次。
 */

/** 自绘覆盖层容器 id（调试 / e2e / Lead 接线都按它定位） */
export const DYNAMIC_DRAWN_ROOT_ID = 'bewly-dynamic-drawn-root'

/**
 * 挂在 `<html>` 上的「本模块已接管」标记。
 *
 *   1. 页面级样式（背景色等）只在接管时生效；
 *   2. e2e / 其它模块可用它判断「动态页已被自绘接管」。
 */
export const DYNAMIC_DRAWN_ACTIVE_CLASS = 'bewly-dynamic-drawn'

/** 原生 DOM 被隐藏时打的标记属性（只还原本模块动过的节点） */
export const DYNAMIC_DRAWN_HIDDEN_ATTR = 'data-bewly-dynamic-drawn-hidden'

/**
 * 接管后需要隐藏的原生 DOM。
 *
 * 真机结论：**只隐藏 `#app` 就够**（整个动态流都在它里面），
 * `#bili-header-container` 保持原样 —— 它已经被 Bewly 的 remove-top-bar 置为
 * `visibility: hidden`，并且要靠它那 64px 高度维持页面原本的顶部留白，
 * 把它也隐藏只会带来无关的布局跳动。
 *
 * 页脚选择器保留：动态页当前没有页脚，但站点改版加上时不必再改代码。
 */
export const NATIVE_PAGE_SELECTOR = [
  '#app',
  '#biliMainFooter',
  '.footer.bili-footer',
  '#client-app',
].join(', ')

/** 动态页主机名（t.bilibili.com 本身与可能的子域） */
export const DYNAMIC_HOST_RE = /(?:^|\.)t\.bilibili\.com$/i

/**
 * 本模块不接管的路径（t.bilibili.com 下的独立子页）。
 *
 * 只接管列表首页 `/`（含 `?tab=…`）。动态详情页 `/<id>`、投票页 `/vote/…`、
 * 分享页 `/share/…` 都是完全不同的布局，一律不接管，保证原生页可用。
 */
export const DYNAMIC_EXCLUDED_PATH_RE = /^\/(?:vote|share|opus)(?:\/|$)|^\/\d+/

/** 四个 tab（= 接口的 `type` 参数，真机抓原生请求确认） */
export type DynamicTabId = 'all' | 'video' | 'pgc' | 'article'

/** tab 顺序与原生一致：全部 / 视频投稿 / 追番追剧 / 专栏 */
export const DYNAMIC_TABS: DynamicTabId[] = ['all', 'video', 'pgc', 'article']

/** 默认 tab：全部 */
export const DEFAULT_DYNAMIC_TAB: DynamicTabId = 'all'

/** 接口路径（相对 https://api.bilibili.com，交给 wbiGet 拼） */
export const DYNAMIC_FEED_PATH = '/x/polymer/web-dynamic/v1/feed/all'

/**
 * 接口的 `features` 参数。
 *
 * 取的是原生页面自己发的那一串（CDP 抓包逐字对齐）。真机验证过「只传 type + page」
 * 也能 code 0 且条目结构一致，但 features 会影响返回字段（opus 大图 / 转发列表隐藏等），
 * 用原生同款能保证拿到的字段和页面渲染时看到的一致。
 */
export const DYNAMIC_FEATURES = [
  'itemOpusStyle',
  'listOnlyfans',
  'opusBigCover',
  'onlyfansVote',
  'decorationCard',
  'onlyfansAssetsV2',
  'forwardListHidden',
  'ugcDelete',
  'onlyfansQaCard',
  'commentsNewVersion',
  'avatarAutoTheme',
  'sunflowerStyle',
  'cardsEnhance',
  'eva3CardOpus',
  'eva3CardVideo',
  'eva3CardComment',
  'eva3CardVote',
  'eva3CardUser',
].join(',')

/**
 * 两次 feed 请求之间的最小间隔（毫秒）。
 *
 * 真机：同一接口间隔 < 1s 连发会吃风控（-352 / -412），间隔 1s 以上稳定。
 * 滚动加载自然不会比这更快，但快速连点 tab / 刷新时会用到。
 */
export const DYNAMIC_REQUEST_MIN_GAP = 900

/** 首屏骨架数量（动态卡比视频卡高得多，4 条就够铺满一屏） */
export const DYNAMIC_SKELETON_COUNT = 4

/**
 * 单次会话最多连续翻页数（安全阀）。
 *
 * 接口 `has_more` 为 false 时就停，这个上限只防「接口异常地永远说还有下一页」
 * 把请求打成死循环。
 */
export const DYNAMIC_MAX_PAGES = 80

/** 番剧频道真机恒定错误码（原生页面同样返回它，见文件头说明） */
export const DYNAMIC_PGC_EMPTY_CODE = 4101132

/** 风控类错误码（稍等重试一次通常就恢复） */
export const DYNAMIC_RISK_CONTROL_CODES = [-352, -412, -509]

/** 动态详情页根地址（卡片里的「打开详情」与错误态回退链接用） */
export const DYNAMIC_DETAIL_BASE_URL = 'https://t.bilibili.com'

/** 视频地址根（archive.jump_url 是 `//www.bilibili.com/video/BV…` 这种协议相对地址） */
export const DYNAMIC_VIDEO_BASE_URL = 'https://www.bilibili.com'

/** 头像尺寸参数（真机原生用 128 圆图） */
export const DYNAMIC_AVATAR_SIZE = 128

/**
 * mount.ts → DynamicPage.vue 的 provide/inject 键。
 *
 * 不用 `app.mount()` 的返回值取组件方法：mount 返回的是公共实例代理，能不能读到
 * `defineExpose` 暴露的方法取决于 Vue 内部实现细节（`_instance.exposed` 是私有字段）。
 * provide 一个可变对象、由组件在 setup 里写入自己的方法，是明确且稳定的通道
 * —— 与 views/Search 的 SEARCH_PAGE_BRIDGE_KEY 同一做法。
 */
export const DYNAMIC_PAGE_BRIDGE_KEY = 'BEWLY_DYNAMIC_PAGE_BRIDGE'
