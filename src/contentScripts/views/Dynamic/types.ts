/**
 * 动态页（自绘）的数据类型。
 *
 * 字段全部来自 2026-11-19 真机实测（`GET /x/polymer/web-dynamic/v1/feed/all`，
 * 带 cookie + wbi 签名，响应 code 0，跨 5 页共 100 条样本）。只声明用到的字段，
 * 其余保持宽松 —— 真机条目有 6 个顶层键、`modules` 下有 10 个模块、
 * `major` 下有 18 种 subtype，全部声明没有意义。
 *
 * # 真机样本的类型分布（100 条）
 *
 *   DYNAMIC_TYPE_AV      58   major = MAJOR_TYPE_ARCHIVE
 *   DYNAMIC_TYPE_FORWARD 27   major = none（内容在 orig 里）
 *   DYNAMIC_TYPE_DRAW    14   major = MAJOR_TYPE_OPUS（图文 / 九宫格）
 *   DYNAMIC_TYPE_ARTICLE  1   major = MAJOR_TYPE_OPUS（专栏，形态与 DRAW 相同）
 *
 * `DYNAMIC_TYPE_WORD`（纯文字）在真机样本里没有出现：新版动态把纯文字也包成了
 * `MAJOR_TYPE_OPUS`（desc 为空、内容在 opus.summary 里）。本模块按「desc 有文字就渲染
 * desc，否则渲染 opus.summary」处理，两种形态都能出正文，不依赖具体 type 字符串。
 */

/** 一条动态的顶层结构（真机字段名） */
export interface DynamicApiItem {
  /** 动态 id（19 位数字的**字符串**，JS number 会精度丢失，必须保持字符串） */
  id_str: string
  /** `DYNAMIC_TYPE_AV` / `DYNAMIC_TYPE_DRAW` / `DYNAMIC_TYPE_FORWARD` / `DYNAMIC_TYPE_ARTICLE` … */
  type: string
  basic?: DynamicBasic
  /** 是否可见（折叠 / 审核中时为 false） */
  visible?: boolean
  modules?: {
    module_author?: DynamicAuthor
    module_dynamic?: DynamicModuleDynamic | null
    module_stat?: DynamicModuleStat | null
    module_tag?: { text?: string } | null
  }
  /** 被转发的原动态（仅 DYNAMIC_TYPE_FORWARD 有） */
  orig?: DynamicApiItem | null
}

/** `basic`：点赞 / 评论时要用到的 rid（本轮操作栏只跳详情，字段留全以备扩展） */
export interface DynamicBasic {
  rid_str?: string
  comment_type?: number
  comment_id_str?: string
  jump_url?: string
  is_only_fans?: boolean
}

/** `module_author`：作者信息 */
export interface DynamicAuthor {
  mid: number
  name: string
  /** 头像，真机有 `http://`（无 s）与 `https://` 两种写法 */
  face?: string
  /** 发布时间文案，真机形如 `"5小时前"` / `"3天前"` */
  pub_time?: string
  /** 发布时间的 Unix 秒，**真机是字符串**（`"1795003502"`） */
  pub_ts?: string
  /** 头像挂件（真机多为空串，非空时叠在头像右上角） */
  pendant?: {
    image?: string
    name?: string
  } | null
  /** 大会员信息（type 2 = 年度大会员，label.text 是「年度大会员」这类文案） */
  vip?: {
    type?: number
    status?: number
    label?: { text?: string } | null
  } | null
  /** 认证（type -1 未认证 / 0 个人认证 / 1 机构认证） */
  official_verify?: {
    type?: number
    desc?: string
  } | null
  /** 作者空间动态页地址，真机是协议相对地址 `//space.bilibili.com/<mid>/dynamic` */
  jump_url?: string
  /** 发布动作（「投稿了视频」这类），真机多为空串 */
  pub_action?: string
  /** 发布位置（真机多为空串） */
  pub_location_text?: string
  /** 当前用户是否已关注（未登录恒 false） */
  following?: boolean
}

/** 富文本片段（正文里的 @ / 话题 / 表情 / 视频链接都被拆成节点） */
export interface DynamicRichTextNode {
  /** 节点类型，真机见过：TEXT / TOPIC / EMOJI / VIEW_PICTURE / AT / WEB / BV / LOTTERY / … */
  type: string
  /** 展示文本（表情是 `[tv_微笑]` 这类占位文案） */
  text?: string
  /** 原始文本（WEB 节点是真实 URL，BV 节点是 BV 号） */
  orig_text?: string
  /** 点击跳转地址（协议相对的有 `//` 开头） */
  jump_url?: string
  /** 表情图（仅 EMOJI 节点有；`.png` 原图不能用 Picture 组件的 `.avif` 探测） */
  emoji?: {
    icon_url?: string
    text?: string
    type?: number
  } | null
  /** AT / VIEW_PICTURE 节点的 rid（mid 或动态 id） */
  rid?: string
}

/** 一段带富文本的正文（desc 与 opus.summary 同构） */
export interface DynamicRichText {
  text?: string
  rich_text_nodes?: DynamicRichTextNode[]
  /** 真机恒为 `[]`（新版用 rich_text_nodes，paragraphs 是旧字段） */
  paragraphs?: unknown[]
  /** 是否被截断（真机为 false；为 true 时说明要跳详情看全文） */
  has_more?: boolean
}

/** `module_dynamic`：正文 + 主内容 */
export interface DynamicModuleDynamic {
  /** 作者自己写的正文（转发动态里是「转发理由」） */
  desc?: DynamicRichText | null
  /** 主内容（视频 / 图文 / 专栏 / 直播预约…），转发动态里为 null */
  major?: DynamicMajor | null
  /** 话题（渲染成正文下方的一行话题标签） */
  topic?: {
    id?: string
    name?: string
    jump_url?: string
  } | null
}

/** `major`：18 个 subtype 的联合体，本模块只实现其中 4 种 */
export interface DynamicMajor {
  /** `MAJOR_TYPE_ARCHIVE` / `MAJOR_TYPE_OPUS` / `MAJOR_TYPE_DRAW` / `MAJOR_TYPE_ARTICLE` / … */
  type: string
  /** 视频卡（DYNAMIC_TYPE_AV 的全部内容都在这里） */
  archive?: DynamicArchive | null
  /** 图文 / 九宫格（新版把纯文字、图文、专栏都收进了 opus） */
  opus?: DynamicOpus | null
  /** 旧版九宫格图集（真机 DRAW 动态里也可能走这个 subtype） */
  draw?: DynamicDraw | null
  /** 旧版专栏卡 */
  article?: DynamicArticle | null
  /** 通用卡片（直播预约 / 商品 / 充电等），本轮只渲染标题 + 封面 */
  common?: DynamicCommon | null
}

/** 视频卡（真机字段名） */
export interface DynamicArchive {
  aid?: string
  bvid?: string
  /** 封面，真机是 `http://i2.hdslb.com/…` */
  cover?: string
  /** 跳转地址，真机是协议相对地址 `//www.bilibili.com/video/BV…` */
  jump_url?: string
  title?: string
  desc?: string
  /** 时长文本，真机形如 `"02:21"`（没有数字时长字段） */
  duration_text?: string
  /** 统计（真机里 play / danmaku 都是**字符串**） */
  stat?: {
    play?: string
    danmaku?: string
  } | null
  /** 角标文案（「投稿视频」这类） */
  badge?: {
    text?: string
  } | null
}

/** opus（图文 / 纯文字 / 专栏的共同体） */
export interface DynamicOpus {
  jump_url?: string
  /** 专栏标题（图文动态为空串） */
  title?: string
  /** 正文（纯文字动态的全部内容都在这里） */
  summary?: DynamicRichText | null
  /** 图片（真机给原始宽高，用于单图按比例展示） */
  pics?: DynamicOpusPic[]
}

/** opus 里的一张图 */
export interface DynamicOpusPic {
  /** 图片地址，真机是 `http://i0.hdslb.com/bfs/new_dyn/…jpg` */
  url?: string
  width?: number
  height?: number
}

/** 旧版九宫格图集 */
export interface DynamicDraw {
  id?: string
  items?: {
    src?: string
    width?: string
    height?: string
  }[]
}

/** 旧版专栏卡 */
export interface DynamicArticle {
  id?: string
  title?: string
  desc?: string
  covers?: string[]
  jump_url?: string
}

/** 通用卡片：只取能安全展示的字段 */
export interface DynamicCommon {
  cover?: string
  title?: string
  desc?: string
  jump_url?: string
}

/** `module_stat`：互动计数 */
export interface DynamicModuleStat {
  forward?: DynamicStatCounter | null
  comment?: DynamicStatCounter | null
  like?: DynamicStatCounter | null
}

/** 单个计数（真机 count 是 number，status 表示「我是否已点赞」） */
export interface DynamicStatCounter {
  count?: number
  status?: boolean
  /** 该操作是否被禁止（禁评 / 已删除时为 true） */
  forbidden?: boolean
}

/** feed 接口的 `data` */
export interface DynamicFeedData {
  /** 下一页游标（**必须原样回传**，只传 page 会重复返回第一页） */
  offset?: string
  /** 是否还有下一页 */
  has_more?: boolean
  items?: DynamicApiItem[]
  /** 新动态数量（本轮不展示小红点） */
  update_num?: number
}

/**
 * 一页动态（已归一化）。
 *
 * `offset` 是下一页游标：调用方必须把它原样带到下一次请求里。
 */
export interface DynamicFeedPage {
  items: DynamicApiItem[]
  /** 下一页游标；`has_more` 为 false 时是 undefined */
  offset?: string
  hasMore: boolean
}

/* #region 渲染层的数据模型（与接口字段解耦） */

/** 卡片里的一张图片 */
export interface DynamicPicture {
  /** 已补好尺寸参数的图片地址（交给 Picture 组件再补 .avif/.webp 后缀） */
  src: string
  /** 原图地址（去掉 @ 参数），点击查看原图用 */
  href: string
  /** 宽高比（width / height），单图大图布局用；未知时按 1 */
  ratio: number
}

/** 卡片里的视频 */
export interface DynamicVideo {
  href: string
  cover: string
  duration: string
  title: string
  /** 简介（真机 video desc 常是一大段，卡片里折成两行） */
  desc: string
  /** 角标文案（「投稿视频」），为空时不渲染 */
  badge: string
  /** 播放 / 弹幕文案（已格式化） */
  stats: string[]
}

/** 正文里的一个富文本片段（渲染层用，已把跳转地址补成绝对地址） */
export interface DynamicTextNode {
  /** text / emoji / link 三种即可覆盖真机出现过的全部节点 */
  kind: 'text' | 'emoji' | 'link'
  text: string
  href: string
  /** 表情图地址（仅 kind === 'emoji'） */
  icon: string
}

/** 一段正文（按节点渲染，保证 @ 与话题可点） */
export interface DynamicParagraph {
  nodes: DynamicTextNode[]
  /** 纯文本形式（用于「展开 / 收起」的行数测量与无障碍朗读） */
  plain: string
}

/** 主内容块 */
export type DynamicContentKind = 'video' | 'opus' | 'common'

export interface DynamicContent {
  kind: DynamicContentKind
  video?: DynamicVideo
  /** 专栏 / 图文标题 */
  title?: string
  /** 正文段落（图文动态的正文，或纯文字动态的全部内容） */
  paragraphs: DynamicParagraph[]
  /** 图片网格 */
  pictures: DynamicPicture[]
  /** 跳转地址（点标题 / 图片之外的区域时用；可能为空） */
  href: string
}

/** 互动计数（渲染层用，已格式化） */
export interface DynamicStats {
  forward: string
  comment: string
  like: string
  /** 我是否已点赞（真机 status 字段） */
  liked: boolean
}

/** 一条动态（渲染层模型） */
export interface DynamicItem {
  /** 动态 id（字符串，去重与 key 用） */
  id: string
  /** 作者昵称 / 头像 */
  authorName: string
  authorFace: string
  /** 作者空间动态页地址 */
  authorHref: string
  /** 发布时间文案（直接用接口给的「5小时前」，与原生一致） */
  time: string
  /** 发布时间戳（秒），时间文案缺失时兜底格式化用 */
  timestamp: number
  /** 作者头像挂件 */
  pendant: string
  /** 大会员文案（空串不渲染） */
  vipLabel: string
  /** 认证文案（空串不渲染） */
  official: string
  /** 转发理由 / 正文（原动态为空） */
  paragraphs: DynamicParagraph[]
  /** 主内容（转发动态为空） */
  content?: DynamicContent
  /** 被转发的原动态 */
  quote?: {
    authorName: string
    authorFace: string
    authorHref: string
    /** 原动态正文（转发理由在 DynamicItem.paragraphs 里） */
    paragraphs: DynamicParagraph[]
    content?: DynamicContent
  }
  stats: DynamicStats
  /** 详情页地址 */
  href: string
  /** 话题文案（空串不渲染） */
  topic: string
  /** 话题跳转地址 */
  topicHref: string
}

/* #endregion */

/** mount.ts 与 DynamicPage.vue 之间的调用通道（provide/inject，见 constants 里的说明） */
export interface DynamicPageBridge {
  /** 外部路由变化时切到指定频道（切 tab / 前进后退时由 mount 调用） */
  selectTab?: (tab: 'all' | 'video' | 'pgc' | 'article') => void
  /** 重拉当前频道第 1 页 */
  reload?: () => void
}
