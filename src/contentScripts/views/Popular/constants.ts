/**
 * 热门 / 排行榜页（自绘）的静态配置。
 *
 * 路径与 B 站原生页面一致（CDP 真机 dump 确认）：
 *   - 热门顶层 tab：/v/popular/all、/v/popular/weekly、/v/popular/precious、/v/popular/rank/all
 *   - 排行榜分区 tab 的 slug 沿用哔哩哔哩排行榜的旧路径（/v/popular/rank/<slug>）
 * 这样即使本视图没挂载，页面里的 `<a href>` 依然指向原生页面，点击可回退原生。
 */

/** 热门页顶层 tab */
export type PopularTabId = 'popular' | 'weekly' | 'precious' | 'rank'

export interface PopularTabDef {
  id: PopularTabId
  /** 原生路径（同时用于 URL 同步与回退链接） */
  path: string
}

export const POPULAR_TABS: PopularTabDef[] = [
  { id: 'popular', path: '/v/popular/all' },
  { id: 'weekly', path: '/v/popular/weekly' },
  { id: 'precious', path: '/v/popular/precious' },
  { id: 'rank', path: '/v/popular/rank/all' },
]

/** 排行榜分区 tab */
export type RankRegionId
  = | 'all'
    | 'anime'
    | 'guochuang'
    | 'documentary'
    | 'movie'
    | 'tv'
    | 'variety'
    | 'animation'
    | 'game'
    | 'kichiku'
    | 'music'
    | 'dance'
    | 'cinephile'
    | 'entertainment'
    | 'knowledge'
    | 'tech'
    | 'food'
    | 'car'
    | 'fashion'
    | 'sports'
    | 'animal'

export interface RankRegionDef {
  id: RankRegionId
  /** 视频分区 rid（交给 `api.ranking.getRankingVideos`） */
  rid?: number
  /** 番剧类榜单的 season_type（交给 `api.ranking.getRankingPgc`） */
  seasonType?: number
  /** 原生路径（与 B 站排行榜完全一致） */
  path: string
}

/**
 * 分区 tab 顺序与 CDP 真机 dump 出来的 `.rank-tab > li` 完全一致：
 * 全部 / 番剧 / 国创 / 纪录片 / 电影 / 电视剧 / 综艺 / 动画 / 游戏 / 鬼畜 /
 * 音乐 / 舞蹈 / 影视 / 娱乐 / 知识 / 科技数码 / 美食 / 汽车 / 时尚美妆 / 体育运动 / 动物
 */
export const RANK_REGIONS: RankRegionDef[] = [
  { id: 'all', rid: 0, path: '/v/popular/rank/all' },
  { id: 'anime', seasonType: 1, path: '/v/popular/rank/bangumi' },
  { id: 'guochuang', seasonType: 4, path: '/v/popular/rank/guochuang' },
  { id: 'documentary', seasonType: 3, path: '/v/popular/rank/documentary' },
  { id: 'movie', seasonType: 2, path: '/v/popular/rank/movie' },
  { id: 'tv', seasonType: 5, path: '/v/popular/rank/tv' },
  { id: 'variety', seasonType: 7, path: '/v/popular/rank/variety' },
  { id: 'animation', rid: 1, path: '/v/popular/rank/douga' },
  { id: 'game', rid: 4, path: '/v/popular/rank/game' },
  { id: 'kichiku', rid: 119, path: '/v/popular/rank/kichiku' },
  { id: 'music', rid: 3, path: '/v/popular/rank/music' },
  { id: 'dance', rid: 129, path: '/v/popular/rank/dance' },
  { id: 'cinephile', rid: 181, path: '/v/popular/rank/cinephile' },
  { id: 'entertainment', rid: 5, path: '/v/popular/rank/ent' },
  { id: 'knowledge', rid: 36, path: '/v/popular/rank/knowledge' },
  { id: 'tech', rid: 188, path: '/v/popular/rank/technology' },
  { id: 'food', rid: 211, path: '/v/popular/rank/food' },
  { id: 'car', rid: 223, path: '/v/popular/rank/car' },
  { id: 'fashion', rid: 155, path: '/v/popular/rank/fashion' },
  { id: 'sports', rid: 234, path: '/v/popular/rank/sports' },
  { id: 'animal', rid: 217, path: '/v/popular/rank/animal' },
]

/** 排行榜分区 slug → 配置（原生路径里没有的 slug 一律当作「全部」） */
export function getRegionBySlug(slug?: string): RankRegionDef {
  const found = slug
    ? RANK_REGIONS.find(region => region.path.endsWith(`/${slug}`))
    : undefined
  return found ?? RANK_REGIONS[0]
}

/** 自挂载覆盖层生效时加在 <html> 上的标记（页面背景样式与 e2e 都靠它） */
export const POPULAR_PAGE_ACTIVE_CLASS = 'bewly-popular-active'

/** 热门页原版地址（错误态里的回退链接） */
export const NATIVE_POPULAR_URL = 'https://www.bilibili.com/v/popular/all'
export const NATIVE_RANK_URL = 'https://www.bilibili.com/v/popular/rank/all'
