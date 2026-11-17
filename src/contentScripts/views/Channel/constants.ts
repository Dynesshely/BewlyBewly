/**
 * 分区页（自绘）的静态配置。
 *
 * # 真机事实（第 110 轮 CDP dump，2026-11-17）
 *
 * B 站分区页在 2026 年已经整体改版成 **feedchannel** 布局：
 *   - `https://www.bilibili.com/v/douga/`、`/v/game/`、`/v/knowledge/` 全部 **302 到 `/c/<slug>/`**
 *     （`/v/douga/mad/` 这类二级路径同样 302 到 `/c/douga/`，二级分区页已废弃）；
 *   - DOM 骨架：
 *     `#app > div.feedchannel > div.feedchannel-body > (div.channel-header.feedchannel-header + main.feedchannel-main)`
 *     `main.feedchannel-main > div.channel-page > (div.channel-page__head + div.channel-page__body)`
 *     `div.channel-page__body > (div.head-cards + div.feed-cards)`
 *   - 卡片 5 列 grid（`grid-template-columns: 339.6px ×5`、`gap: 63px 20px`），
 *     单卡 `.feed-card > .bili-video-card.video-card`（16:9 封面 + 标题 + UP + 播放量 + 时长）；
 *   - 触底追加 `.bili-skeleton-card.skeleton-card.loading-card` 骨架；
 *   - 一级大分类导航在 `div.bili-header__channel .channel-items__left > a.channel-link`（真机 39 项）；
 *   - **二级分区 tab 与排序 tab（综合 / 最新 / 播放多）在新布局里已不存在**，
 *     `div.channel-page__head` 里只有一个分区图标 + `div.channel-name`。
 *   - `/channel/*` 是真 404（`div.error-container`），`/p/eden/area-tags` 已 302 到 `h.bilibili.com`。
 *
 * # 这份文件做什么
 *
 * 把「路由识别」「一级分区表」「原生 DOM 选择器」集中在一处，页面改版只改这里。
 * 数据接口与渲染在 `fetcher.ts` / 组件里，样式类名统一 `channel-` 前缀。
 */

/** 自绘覆盖层容器 id（调试 / e2e / Lead 接线都可按它定位） */
export const CHANNEL_DRAWN_ROOT_ID = 'bewly-channel-drawn-root'

/**
 * 挂在 `<html>` 上的「本模块已接管」标记。
 *
 * 覆盖层本身在 light DOM，给 `<html>` 打标记是为了：
 *   1. 页面级样式（背景色等）能只在接管时生效；
 *   2. `channelPage` 增强层（路径 /v/*、/channel/*）可以被 Lead 用它判断「已被自绘接管，别再叠一层」。
 */
export const CHANNEL_DRAWN_ACTIVE_CLASS = 'bewly-channel-drawn'

/** 原生 DOM 被隐藏时打的标记属性（只还原本模块动过的节点） */
export const CHANNEL_DRAWN_HIDDEN_ATTR = 'data-bewly-channel-drawn-hidden'

/**
 * 原生分区页需要隐藏的 DOM（类名来自 CDP 真机 dump）。
 *
 * 注意也把原生结果卡单独置为 `display: none`：Bewly 既有的键盘卡片导航
 * （`src/composables/useKeyboardCardNavigation.ts` 的 `NATIVE_CARD_SELECTOR = '.bili-video-card'`）
 * 按「inline display !== 'none'」判断卡片是否可见，只隐藏 `#app` 父节点它仍会枚举到这些卡，
 * 方向键 / Enter 会被已隐藏的原生卡吃掉。
 */
export const NATIVE_PAGE_SELECTOR = [
  '#app',
  '#biliMainHeader',
  '#client-app',
  '#home_footer',
  '.footer.bili-footer',
  '#app .bili-video-card',
  '#app .video-card',
  '#app .video-list-item',
  '#app .bili-skeleton-card',
  '#app .bili-cover-card',
].join(', ')

/** 一级大分类导航（真机 `div.bili-header__channel .channel-items__left` 里的链接） */
export const NATIVE_CHANNEL_NAV_SELECTOR = '.channel-items__left a.channel-link, .channel-items__left .channel-link'

/** 当前所在大分类的高亮类（真机确认） */
export const NATIVE_CHANNEL_CURRENT_CLASS = 'channel-link--current'

/**
 * 二级分区 tab 的原生候选（**当前 /c/* 布局里一个都不存在**，真机 4 个分区页均确认）。
 *
 * 保留这组选择器是为了「页面若把二级入口加回来就自动显示」：
 *   - `.channel-nav-click li`：老版分区页（tv / movie / variety / mooc / documentary）的二级 tab，
 *     仓库 `src/styles/adaptedStyles/pages/channelPage.scss` 里已在用这个类名；
 *   - 其余是 feedchannel 里可能出现的二级容器命名，兜底。
 */
export const NATIVE_SUB_REGION_SELECTORS = [
  '.channel-nav-click li',
  '.channel-page__sub a',
  '.channel-page__sub-region a',
  '.sub-region a',
  '.sub-region-tabs a',
  '.channel-sub-nav a',
].join(', ')

/** 原生排序 tab 的容器候选（同样：当前布局里不存在） */
export const NATIVE_SORT_SELECTOR = '.channel-page__sort, .sort-tabs, .channel-sort'

/** `<a href>` 上有效的分区路径：`/c/<slug>/`、`/v/<slug>/`（含无尾斜杠） */
export const REGION_PATH_RE = /^\/(?:c|v)\/(\w+)(?:\/|$)/

/** `/v/*` 下不是「视频分区页」的路径（热门 / 话题 / 榜单等由别的模块接管） */
const NON_REGION_SLUGS = new Set([
  'popular',
  'topic',
  'show',
  'article',
  'read',
  'bangumi',
  'music-center',
  'live',
])

/** 一级分类（pill 行的一项） */
export interface ChannelNavItem {
  /** 原生 slug（`/c/<slug>/` 或 PGC 的 `/anime/`）；用来算当前项 */
  slug: string
  /** 展示名 */
  label: string
  /** 原生链接（回退与无 JS 场景都靠它） */
  href: string
  /** 是否是 /c/* 视频分区（只有这些有 feedchannel 布局、能被本模块接管） */
  region: boolean
  /** 分区图标色（pill 左侧小圆点，取自 `div.channel-page__head` 的 svg 主色） */
  color?: string
}

/**
 * 一级分类列表。
 *
 * 顺序与真机 `div.channel-items__left` 完全一致（2026-11-17 dump）：
 * 番剧 / 电影 / 国创 / 电视剧 / 综艺 / 纪录片 是 PGC 路径，其余是 `/c/<slug>/`。
 * PGC 六个走原生页面（布局完全不同，不在本模块接管范围），点击就是原生跳转。
 */
export const CHANNEL_NAV: ChannelNavItem[] = [
  {
    slug: 'anime',
    label: '番剧',
    href: '//www.bilibili.com/anime/',
    region: false,
  },
  {
    slug: 'movie',
    label: '电影',
    href: '//www.bilibili.com/movie/',
    region: false,
  },
  {
    slug: 'guochuang',
    label: '国创',
    href: '//www.bilibili.com/guochuang/',
    region: false,
  },
  {
    slug: 'tv',
    label: '电视剧',
    href: '//www.bilibili.com/tv/',
    region: false,
  },
  {
    slug: 'variety',
    label: '综艺',
    href: '//www.bilibili.com/variety/',
    region: false,
  },
  {
    slug: 'documentary',
    label: '纪录片',
    href: '//www.bilibili.com/documentary/',
    region: false,
  },
  {
    slug: 'douga',
    label: '动画',
    href: '//www.bilibili.com/c/douga/',
    region: true,
    color: '#6D69E4',
  },
  {
    slug: 'game',
    label: '游戏',
    href: '//www.bilibili.com/c/game/',
    region: true,
    color: '#57D587',
  },
  {
    slug: 'kichiku',
    label: '鬼畜',
    href: '//www.bilibili.com/c/kichiku/',
    region: true,
  },
  {
    slug: 'music',
    label: '音乐',
    href: '//www.bilibili.com/c/music/',
    region: true,
  },
  {
    slug: 'dance',
    label: '舞蹈',
    href: '//www.bilibili.com/c/dance/',
    region: true,
  },
  {
    slug: 'cinephile',
    label: '影视',
    href: '//www.bilibili.com/c/cinephile/',
    region: true,
  },
  {
    slug: 'ent',
    label: '娱乐',
    href: '//www.bilibili.com/c/ent/',
    region: true,
  },
  {
    slug: 'knowledge',
    label: '知识',
    href: '//www.bilibili.com/c/knowledge/',
    region: true,
    color: '#FF8834',
  },
  {
    slug: 'tech',
    label: '科技数码',
    href: '//www.bilibili.com/c/tech/',
    region: true,
  },
  {
    slug: 'information',
    label: '资讯',
    href: '//www.bilibili.com/c/information/',
    region: true,
  },
  {
    slug: 'food',
    label: '美食',
    href: '//www.bilibili.com/c/food/',
    region: true,
  },
  {
    slug: 'shortplay',
    label: '小剧场',
    href: '//www.bilibili.com/c/shortplay/',
    region: true,
  },
  {
    slug: 'car',
    label: '汽车',
    href: '//www.bilibili.com/c/car',
    region: true,
  },
  {
    slug: 'fashion',
    label: '时尚美妆',
    href: '//www.bilibili.com/c/fashion/',
    region: true,
  },
  {
    slug: 'sports',
    label: '体育运动',
    href: '//www.bilibili.com/c/sports/',
    region: true,
  },
  {
    slug: 'animal',
    label: '动物',
    href: '//www.bilibili.com/c/animal/',
    region: true,
  },
  {
    slug: 'vlog',
    label: 'vlog',
    href: '//www.bilibili.com/c/vlog/',
    region: true,
  },
  {
    slug: 'painting',
    label: '绘画',
    href: '//www.bilibili.com/c/painting/',
    region: true,
  },
  {
    slug: 'ai',
    label: '人工智能',
    href: '//www.bilibili.com/c/ai/',
    region: true,
  },
  {
    slug: 'home',
    label: '家装房产',
    href: '//www.bilibili.com/c/home/',
    region: true,
  },
  {
    slug: 'outdoors',
    label: '户外潮流',
    href: '//www.bilibili.com/c/outdoors/',
    region: true,
  },
  {
    slug: 'gym',
    label: '健身',
    href: '//www.bilibili.com/c/gym/',
    region: true,
  },
  {
    slug: 'handmake',
    label: '手工',
    href: '//www.bilibili.com/c/handmake/',
    region: true,
  },
  {
    slug: 'travel',
    label: '旅游出行',
    href: '//www.bilibili.com/c/travel/',
    region: true,
  },
  {
    slug: 'rural',
    label: '三农',
    href: '//www.bilibili.com/c/rural/',
    region: true,
  },
  {
    slug: 'parenting',
    label: '亲子',
    href: '//www.bilibili.com/c/parenting/',
    region: true,
  },
  {
    slug: 'health',
    label: '健康',
    href: '//www.bilibili.com/c/health/',
    region: true,
  },
  {
    slug: 'emotion',
    label: '情感',
    href: '//www.bilibili.com/c/emotion/',
    region: true,
  },
  {
    slug: 'life_joy',
    label: '生活兴趣',
    href: '//www.bilibili.com/c/life_joy/',
    region: true,
  },
  {
    slug: 'life_experience',
    label: '生活经验',
    href: '//www.bilibili.com/c/life_experience/',
    region: true,
  },
]

/** 按 slug 取一级分类项 */
export function getNavItemBySlug(slug: string): ChannelNavItem | undefined {
  return CHANNEL_NAV.find(item => item.slug === slug)
}

/** `/v/` 下这些 slug 不是分区页（交回原生 / 由别的模块接管） */
export function isNonRegionSlug(slug: string): boolean {
  return NON_REGION_SLUGS.has(slug)
}

/** 接口地址（真机抓包确认：页面世界与内容脚本都走同源 fetch，需带 cookie） */
export const REGION_FEED_API = 'https://api.bilibili.com/x/web-interface/region/feed/rcmd'

/** 单页卡片数：真机原生固定 15（5 列 × 3 行） */
export const FEED_REQUEST_COUNT = 15

/** 首屏 `display_id`：真机原生首屏就是 2，之后每翻一页 +1 */
export const FEED_FIRST_DISPLAY_ID = 2

/**
 * slug → 分区 feed 编号（`from_region`）。
 *
 * 这是**主路径**，不是兜底：`from_region` 只在原生页的 `region/feed/rcmd` 请求 URL 上出现，
 * 而那个请求是**滚到底才发**的（真机：首屏 15 条是服务端直出，接口在触底后才调），
 * 所以接管时页面上还读不到它。若原生已经滚动过（`performance` 里留了请求），
 * `dom.ts` 的 `discoverFromRegion()` 会优先用页面自己的值（永远和当次页面一致），
 * 读不到才用这份表。
 *
 * 编号不是 tid（动画 tid = 1，而 feed 编号 = 1005），也没有公开接口能查，
 * 表内 30 个数字是 2026-11-17 逐个 `/c/<slug>/` 真机滚动抓包得到。
 */
export const FROM_REGION_FALLBACK: Record<string, number> = {
  cinephile: 1001,
  ent: 1002,
  music: 1003,
  dance: 1004,
  douga: 1005,
  painting: 1006,
  kichiku: 1007,
  game: 1008,
  information: 1009,
  knowledge: 1010,
  ai: 1011,
  tech: 1012,
  car: 1013,
  fashion: 1014,
  home: 1015,
  outdoors: 1016,
  gym: 1017,
  sports: 1018,
  handmake: 1019,
  food: 1020,
  shortplay: 1021,
  travel: 1022,
  rural: 1023,
  animal: 1024,
  parenting: 1025,
  health: 1026,
  emotion: 1027,
  vlog: 1029,
  life_joy: 1030,
  life_experience: 1031,
}
