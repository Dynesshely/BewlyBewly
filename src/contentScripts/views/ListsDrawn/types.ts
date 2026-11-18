/**
 * 三个列表页（稍后再看 / 历史 / 收藏）的数据类型。
 *
 * 字段名全部来自 2026-11-19 真机实测的响应体（登录态 Crequency），只声明用到的字段，
 * 其余保持宽松（接口会不断加字段，声明过严会在类型层面误伤）。
 */

/** 稍后再看的一条（`GET /x/v2/history/toview` 的 data.list[]） */
export interface WatchLaterApiItem {
  aid?: number
  bvid?: string
  title?: string
  /** 封面：真机是 `http://i0.hdslb.com/bfs/archive/xxx.jpg`（也有 `//` 开头的） */
  pic?: string
  /** 时长（秒） */
  duration?: number
  /** 所在分区名（真机：科学科普 / 软件应用…） */
  tname?: string
  owner?: {
    mid?: number
    name?: string
    face?: string
  }
  stat?: {
    view?: number
    danmaku?: number
  }
  /** 已看秒数；**-1 表示已看完**（真机确认） */
  progress?: number
  /** 加入稍后再看的时间（Unix 秒） */
  add_at?: number
  /** 投稿时间（Unix 秒） */
  pubdate?: number
  /** 首个分 P 的 cid（悬停预览直接用，不需要额外请求） */
  cid?: number
  page?: {
    cid?: number
  }
  /** 分 P 数 */
  videos?: number
  /** 移动端 uri（真机：`bilibili://music/playlist/playpage/...`）—— **不要**当播放地址用 */
  uri?: string
}

/** `/x/v2/history/toview` 的 data */
export interface WatchLaterApiData {
  /** 服务端给的总数（可能与 list.length 不同，list 是全量） */
  count?: number
  list?: WatchLaterApiItem[]
}

/** 历史的一条（`GET /x/web-interface/history/cursor` 的 data.list[]） */
export interface HistoryApiItem {
  title?: string
  /** 分 P 的分标题（真机：`WorkBuddy序章`） */
  show_title?: string
  cover?: string
  /** 专栏用：多张封面（可能为 null） */
  covers?: string[] | null
  /** 原生页面用的跳转地址（真机：`https://www.bilibili.com/video/BVxxx`） */
  uri?: string
  history?: {
    oid?: number
    epid?: number
    bvid?: string
    page?: number
    cid?: number
    part?: string
    /** archive / live / article / article-list / pgc */
    business?: string
    dt?: number
  }
  /** 分 P 数 */
  videos?: number
  author_name?: string
  author_face?: string
  author_mid?: number
  /** 观看时间（Unix 秒）—— 时间分组就用它 */
  view_at?: number
  /** 已看秒数；**-1 表示已看完 */
  progress?: number
  badge?: string
  duration?: number
  new_desc?: string
  is_finish?: number
  is_fav?: number
  /** 删除历史时用作 kid 的数字部分（真机：等于 history.oid） */
  kid?: number
  tag_name?: string
  live_status?: number
  long_title?: string
}

/** `/x/web-interface/history/cursor` 的 data */
export interface HistoryApiData {
  /** 下一次请求要原样带回去的三个游标字段 */
  cursor?: {
    max?: number
    view_at?: number
    business?: string
    ps?: number
  }
  list?: HistoryApiItem[]
  /** 顶部 tab（archive / live / article），本轮不做筛选，仅留字段 */
  tab?: Array<{ type?: string, name?: string }>
}

/** 收藏夹（`GET /x/v3/fav/folder/created/list-all` 的 data.list[]） */
export interface FavFolderApiItem {
  id?: number
  fid?: number
  mid?: number
  /** 0 公开 / 1 私密（真机 attr=1 的「默认收藏夹」是公开夹） */
  attr?: number
  title?: string
  fav_state?: number
  media_count?: number
  is_kid_playlist?: boolean
}

/** `/x/v3/fav/folder/created/list-all` 的 data */
export interface FavFolderApiData {
  count?: number
  list?: FavFolderApiItem[]
}

/** 收藏内容的一条（`GET /x/v3/fav/resource/list` 的 data.medias[]） */
export interface FavResourceApiItem {
  id?: number
  /** 2 = 视频（音频 / 专栏是别的值） */
  type?: number
  title?: string
  cover?: string
  intro?: string
  page?: number
  duration?: number
  upper?: {
    mid?: number
    name?: string
    face?: string
  }
  /** 真机：0 正常，9 = 已失效视频（标题是「已失效视频」，没有可播地址） */
  attr?: number
  cnt_info?: {
    collect?: number
    play?: number
    danmaku?: number
  }
  /** 移动端 link（`bilibili://video/...`），**不要**当播放地址用 */
  link?: string
  ctime?: number
  pubtime?: number
  /** 收藏时间（Unix 秒）—— 排序 / 时间分组用它 */
  fav_time?: number
  bv_id?: string
  bvid?: string
  /** 首个分 P 的 cid（悬停预览用，不额外请求） */
  ugc?: {
    first_cid?: number
  }
}

/** `/x/v3/fav/resource/list` 的 data */
export interface FavResourceApiData {
  info?: {
    id?: number
    title?: string
    media_count?: number
    cover?: string
    upper?: { mid?: number, name?: string, face?: string }
  }
  medias?: FavResourceApiItem[] | null
  has_more?: boolean
}

/** 三个列表页统一的分页状态（页面据此渲染骨架 / 错误 / 空态 / 加载更多） */
export interface ListPageState {
  loading: boolean
  loadingMore: boolean
  /** 接口失败（含 message），页面显示错误态 + 重试 */
  error: string
  /** 已经拉过至少一次（决定是否显示空态而不是骨架） */
  loaded: boolean
  /** 是否还有下一页 */
  hasMore: boolean
}
