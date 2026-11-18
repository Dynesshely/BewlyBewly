/**
 * 搜索结果页（自绘）的数据类型。
 *
 * 字段来自 2026-11-18 真机实测（`GET /x/web-interface/wbi/search/type`，
 * 带 cookie + wbi 签名，响应 code 0）。这里只声明用到的字段，其余保持宽松 ——
 * 真机返回的条目有 70+ 个键（含直播 / 番剧 / 课程等混排字段），全部声明没有意义。
 */
import type { SearchDurationId, SearchOrderId } from './constants'

/** search/type 返回的一条视频结果（真机字段名） */
export interface SearchApiItem {
  /** 结果类型，video 搜索下恒为 `video` */
  type?: string
  /** 分区 id（字符串或数字，真机是字符串 "253"） */
  typeid?: string | number
  /** 分区名（展示用，如「动漫杂谈」） */
  typename?: string
  aid?: number
  bvid?: string
  /** 标题，**含 `<em class="keyword">` 高亮标签**，必须清理后再交给 VideoCard */
  title?: string
  /** 简介，同样可能含高亮标签 */
  description?: string
  /** 封面，真机返回 `//i0.hdslb.com/...`（`//` 开头要补 https:） */
  pic?: string
  /** 播放量 */
  play?: number
  /** 弹幕数（`danmaku` 与 `video_review` 真机同值，两个都收） */
  video_review?: number
  danmaku?: number
  /** 收藏数 */
  favorites?: number
  /** 点赞数 */
  like?: number
  /** UP 主昵称 / mid / 头像（真机 upic 是 https 绝对地址） */
  author?: string
  mid?: number
  upic?: string
  /** 发布时间（Unix 秒） */
  pubdate?: number
  /** 时长文本，真机形如 `"137:7"` / `"0:12"`（分钟不补零、秒也不补零，没有小时段） */
  duration?: string
  /** 标签串（逗号分隔） */
  tag?: string
  /** 付费 / 充电标记（本轮不展示，留字段） */
  is_pay?: number
  is_charge_video?: number
  arcurl?: string
}

/** search/type 的 `data` */
export interface SearchApiData {
  /** 当前页（真机 = 请求的 page） */
  page?: number
  /** 每页条数 */
  pagesize?: number
  /** 命中总数；**真机上限 1000**（超过的部分不返回，也不翻页） */
  numResults?: number
  /** 总页数 = ceil(numResults / pagesize) */
  numPages?: number
  result?: SearchApiItem[]
}

/** 一页结果（已归一化，字段名统一成 camelCase 语义） */
export interface SearchVideoPage {
  items: SearchApiItem[]
  /** 命中总数（接口上限 1000，见 `SearchApiData.numResults`） */
  total: number
  /** 总页数 */
  numPages: number
  page: number
  pageSize: number
}

/** 筛选条件（排序 / 时长 / 一级分区） */
export interface SearchFiltersState {
  order: SearchOrderId
  duration: SearchDurationId
  /** 一级分区 id 的字符串形式；空串 = 全部分区 */
  tid: string
}

/** mount.ts 与 SearchPage.vue 之间的调用通道（provide/inject） */
export interface SearchPageBridge {
  /** 外部路由变化时把新状态推给页面（由页面在 setup 里填充） */
  syncRoute?: (next?: SearchRouteState) => void
  /** 重拉当前页 */
  reload?: () => void
}

/** 从 URL 解析出来的「当前视图状态」 */
export interface SearchRouteState {
  keyword: string
  page: number
  filters: SearchFiltersState
}
