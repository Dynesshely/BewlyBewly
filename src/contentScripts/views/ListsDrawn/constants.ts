/**
 * 列表页（稍后再看 / 历史 / 收藏）改为「API 拉取 + 完全自绘」的常量。
 *
 * # 真机结论（2026-11-19，CDP 9333，登录态 Crequency，mid=1961641805）
 *
 * 任务书里给的路径有两处**与真机不符**，以真机为准（见 {@link HISTORY_PATHS} 注释）：
 *
 *   ✅ GET  /x/v2/history/toview                                稍后再看列表（无需签名）
 *   ⚠️ GET  /x/web-interface/wbi/history/cursor                 真机 **404**；
 *                                                              正确路径是 /x/web-interface/history/cursor，
 *                                                              且它**不是 wbi 路径**：带签名 / 不带签名都 code 0
 *   ⚠️ GET  /x/web-interface/wbi/history/search                 真机 **404**；
 *                                                              正确路径是 /x/web-interface/history/search
 *                                                              （带不带签名都 code 0，本轮不做服务端搜索，只用前端过滤）
 *   ✅ GET  /x/v3/fav/folder/created/list-all?up_mid&web_location=333.1387   收藏夹列表（无需签名）
 *   ✅ GET  /x/v3/fav/resource/list?media_id&pn&ps&platform=web              收藏内容（无需签名）
 *
 * 写操作全部是 POST 表单 + csrf（cookie bili_jct）：
 *
 *   POST /x/v2/history/toview/del        aid + viewed + csrf        移除单条（aid 放 body 或 query 都通）
 *   POST /x/v2/history/toview/clear      csrf                       全部清空
 *   POST /x/v2/history/delete            kid=`${business}_${oid}` + csrf   删除单条历史
 *   POST /x/v2/history/clear             csrf                       清空历史
 *   POST /x/v2/history/shadow/set        switch + csrf              暂停 / 恢复历史
 *   POST /x/v3/fav/folder/add            title + privacy + csrf     新建收藏夹
 *   POST /x/v3/fav/folder/edit           title + media_id + csrf    重命名收藏夹
 *   POST /x/v3/fav/folder/del            media_ids + csrf           删除收藏夹
 *   POST /x/v3/fav/resource/deal         rid + type + add/del_media_ids + csrf   取消收藏
 *
 * 真机参数校验（都用不存在的 id / 空标题探活，**没有改动任何账号数据**）：
 * - `/x/v2/history/toview/del` 传 aid=0 → code 0（对不存在的条目静默成功）；
 * - `/x/v2/history/delete` 的 kid **必须是 `business_oid`**：
 *   `archive_999999999999999` → code 0；裸 id `999999999999999` → -400；`archive-…`（横线）→ -400；
 * - `/x/v3/fav/folder/add` 空标题 → -400（所以前端必须先校验非空，别把空串打上去）；
 * - `/x/v3/fav/resource/deal` rid=0 → -400；`/x/v3/fav/resource/batch-del` resources 为空 → -400。
 */

/** B 站接口根（与 ~/utils/wbi 内部一致；这里的 POST 自己拼绝对地址） */
export const API_ORIGIN = 'https://api.bilibili.com'

/** 单次请求超时（与 views/Space、views/Popular 的 fetcher 保持一致） */
export const REQUEST_TIMEOUT = 12_000

/**
 * 两次请求之间的最小间隔（毫秒）。
 *
 * 真机连发同接口有概率吃风控（-352 / -412），列表接口本身不快，
 * 但「批量删除所选」会连发多条 POST，所以统一给一个 300ms 的串行闸门。
 */
export const REQUEST_MIN_GAP = 300

/** 风控类错误码：稍等重试一次通常就恢复 */
export const RISK_CONTROL_CODES = [-352, -412, -509]

/** 稍后再看列表（全量，接口不分页） */
export const WATCH_LATER_LIST_PATH = '/x/v2/history/toview'
/** 移除单条 / 移除已看完（viewed=true） */
export const WATCH_LATER_DEL_PATH = '/x/v2/history/toview/del'
/** 全部清空 */
export const WATCH_LATER_CLEAR_PATH = '/x/v2/history/toview/clear'
/** 加入稍后再看（历史 / 收藏页的快捷操作复用） */
export const WATCH_LATER_ADD_PATH = '/x/v2/history/toview/add'

/** 历史列表（游标翻页；**不是** wbi 路径，不需要签名） */
export const HISTORY_CURSOR_PATH = '/x/web-interface/history/cursor'
/** 删除单条历史（kid = business_oid） */
export const HISTORY_DELETE_PATH = '/x/v2/history/delete'
/** 清空历史 */
export const HISTORY_CLEAR_PATH = '/x/v2/history/clear'
/** 查询 / 设置历史暂停状态 */
export const HISTORY_SHADOW_PATH = '/x/v2/history/shadow'
export const HISTORY_SHADOW_SET_PATH = '/x/v2/history/shadow/set'

/** 收藏夹列表 */
export const FAV_FOLDER_LIST_PATH = '/x/v3/fav/folder/created/list-all'
/** 收藏内容列表 */
export const FAV_RESOURCE_LIST_PATH = '/x/v3/fav/resource/list'
/** 新建 / 重命名 / 删除收藏夹 */
export const FAV_FOLDER_ADD_PATH = '/x/v3/fav/folder/add'
export const FAV_FOLDER_EDIT_PATH = '/x/v3/fav/folder/edit'
export const FAV_FOLDER_DEL_PATH = '/x/v3/fav/folder/del'
/** 取消收藏（单个资源） */
export const FAV_RESOURCE_DEAL_PATH = '/x/v3/fav/resource/deal'

/** 收藏夹列表接口的 web_location（与原生页面一致） */
export const FAV_FOLDER_WEB_LOCATION = '333.1387'

/**
 * 收藏内容每页条数。
 *
 * 真机：ps=20 返回 19 条（服务端会把失效 / 不可见条目剔除），ps=40 返回 39 条、has_more 仍为 true，
 * 说明接口按 ps 上限正常返回，取 24 是为了「宽屏一屏能填满、又不用每页都请求」。
 */
export const FAV_RESOURCE_PAGE_SIZE = 24

/**
 * 历史每页条数（接口 ps 上限 20；真机传 30 也被接受但只回已有个数）。
 * 与原生页面保持一致用 20。
 */
export const HISTORY_PAGE_SIZE = 20

/** 骨架屏占位卡片数量 */
export const SKELETON_COUNT = 8

/** 列表页作用域（scroll memory 用） */
export const LIST_SCOPE = {
  watchLater: 'watch-later',
  history: 'history',
  favorites: 'favorites',
} as const
