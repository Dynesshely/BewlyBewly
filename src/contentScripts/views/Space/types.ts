/**
 * 空间页（自绘）的数据类型。
 *
 * 字段来自 2026-11-18 真机实测（`GET /x/space/wbi/arc/search` 与 `/x/space/wbi/acc/info`，
 * 带 cookie + wbi 签名，响应 code 0）。这里只声明用到的字段，其余保持宽松。
 */

/** `arc/search` 返回的一条稿件（真机字段名） */
export interface ArcSearchItem {
  aid?: number
  bvid?: string
  title?: string
  /** 封面，真机返回 `http://i1.hdslb.com/...`（`//` 与 `http` 两种都要兼容） */
  pic?: string
  description?: string
  author?: string
  mid?: number
  /** 播放量 */
  play?: number
  /** 弹幕数 */
  video_review?: number
  /** 发布时间（Unix 秒） */
  created?: number
  /** 时长文本，真机形如 `"24:11"` / `"00:22"`（没有数字时长字段） */
  length?: string
  /** 付费 / 充电等标记（本轮不展示，留字段避免以后再加） */
  is_pay?: number
  is_charging_arc?: boolean
}

/** `arc/search` 的 `data` */
export interface ArcSearchData {
  list?: {
    vlist?: ArcSearchItem[]
  }
  page?: {
    pn?: number
    ps?: number
    /** 该 UP 的全部投稿数，用来判断是否还有下一页 */
    count?: number
  }
}

/** 一页视频（已归一化） */
export interface SpaceVideoPage {
  items: ArcSearchItem[]
  /** 总投稿数（接口没给时退化为「已拿到的数量」） */
  total: number
  pn: number
  ps: number
}

/** `acc/info` 的 `data`（只声明用到的字段） */
export interface SpaceUpInfo {
  mid: number
  name: string
  face: string
  /** 签名 */
  sign?: string
  /** 等级 0–6 */
  level?: number
  /** 是否年度大会员（level 6 且有闪电标识时为资深会员） */
  is_senior_member?: number
  /** 认证信息 */
  official?: {
    /** 0 未认证 / 1 个人认证 / 2 机构认证 */
    type?: number
    /** 认证角色（1–3 为特殊角色） */
    role?: number
    title?: string
    desc?: string
  }
  vip?: {
    /** 0 不是大会员 / 1 大会员 / 2 年度大会员 */
    type?: number
    status?: number
  }
  /** 当前登录用户是否已关注该 UP（未登录时为 false） */
  is_followed?: boolean
  /**
   * 头图（真机：`bfs/space/<hash>.png` 这种相对路径，要补 `https://i0.hdslb.com/`）。
   *
   * `top_photo` 是旧字段（相对路径），`top_photo_v2` 是新字段（带绝对地址，
   * 且单独给了 200 高度的裁切版本）。两者都可能为空。
   */
  top_photo?: string
  top_photo_v2?: {
    sid?: number
    /** 原始尺寸（可能是很大的长图） */
    l_img?: string
    /** 200 高度裁切版（空间页原生头图就用这个，省流量） */
    l_200h_img?: string
  }
}

/** 粉丝 / 关注数（`/x/relation/stat`，不需要签名） */
export interface SpaceRelationStat {
  follower: number
  following: number
}

/** 粉丝 / 关注数拉取结果：失败不阻断接管，只是不显示这两项 */
export type SpaceRelationStatResult = SpaceRelationStat | null
