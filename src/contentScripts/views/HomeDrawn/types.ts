/**
 * 首页推荐流（自绘）的数据类型。
 *
 * 字段来自 2026-11-19 真机实测（`GET /x/web-interface/wbi/index/top/feed/rcmd`，
 * 带 cookie + wbi 签名，响应 code 0）。这里只声明用到的字段，其余保持宽松。
 */

/** `data.item[]` 里的一条（真机字段名） */
export interface HomeFeedItem {
  /** **就是 aid**（真机用 bvid 反查 /x/web-interface/view 逐条比对一致） */
  id?: number
  bvid?: string
  cid?: number
  /** 'av' 视频 / 'live' 直播 / 'ad' 广告 / 'bangumi' 番剧 */
  goto?: string
  /** 完整跳转地址（真机形如 `https://www.bilibili.com/video/BV…`） */
  uri?: string
  /** 封面，真机返回 `http://` 绝对地址（也兼容 `//` 协议相对地址） */
  pic?: string
  title?: string
  /** 时长（**秒**，真机是数字，不是 `arc/search` 那种 "24:11" 文本） */
  duration?: number
  /** 发布时间（Unix 秒） */
  pubdate?: number
  owner?: {
    mid?: number
    name?: string
    face?: string
  }
  stat?: {
    view?: number
    like?: number
    danmaku?: number
  }
  /** 推荐理由（真机可能只有 `reason_type` 而没有 `content`） */
  rcmd_reason?: {
    content?: string
    reason_type?: number
  }
  /** 当前登录用户是否已关注该 UP（匿名恒为 0） */
  is_followed?: number
  /** 直播卡片专用：房间信息（goto === 'live' 时才有） */
  room_info?: {
    room_id?: number
    uid?: number
    live_status?: number
    show?: {
      title?: string
      cover?: string
      popularity_count?: number
    }
  }
  /** 广告卡片专用（goto === 'ad' 时才有；本模块会过滤掉这类条目） */
  business_info?: {
    name?: string
    pic?: string
    url?: string
    title?: string
  }
}

/** `data` 的顶层结构（只声明用到的字段） */
export interface HomeFeedData {
  item?: HomeFeedItem[]
  /** 服务端可能回带的用户 mid（匿名时为 0） */
  mid?: number
}

/** 一页推荐（已归一化） */
export interface HomeFeedPage {
  /** 归一化后的条目（已过滤广告 / 补齐地址） */
  items: HomeFeedItem[]
  /** 这一页的 `fresh_idx`（下一页 = 它 + 1） */
  freshIdx: number
  /** 接口原始条目数（含广告；用于判断「整页都是广告」） */
  rawCount: number
}
