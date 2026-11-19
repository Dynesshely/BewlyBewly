import type { ApiVideoMeta } from './types'
import { wbiGet } from '~/utils/wbi'

/**
 * 视频信息区改用 **API 拉取**（第 109 轮）。
 *
 * 背景：`videoPage/infoBar.ts` 原来有 3 级数据源，但全部是「从页面取」——
 * page-world 桥推送、解析内联 __INITIAL_STATE__、读原生 DOM 文本。
 * 前两者依赖 B 站注入的脚本结构，后者依赖 DOM 类名，都会随版本改版失效。
 *
 * 本轮加一条**优先级最高的 API 路径**，失败时 infoBar 仍走原来的 3 级回退。
 *
 * # 接口（真机 2026-11-19 验证，BV1GJ411x7h7）
 *
 *   GET /x/web-interface/wbi/view?bvid=<bvid>
 *   → code 0，data: { aid, title, owner{mid,name,face}, stat{view,danmaku,like,coin,favorite,share,reply},
 *                    desc, tname, pubdate, duration, copyright, pages[], tag? }
 *
 * 实测**不带 wbi 签名也能通**，但仍走 `wbiGet` 与仓库统一（签名基建已逐字节对齐 B 站前端）。
 * `desc` 为 `'-'` 时表示作者没填简介，归一化成空串。
 */

const VIEW_API = 'https://api.bilibili.com/x/web-interface/wbi/view'

/** 单个 bvid 的元数据缓存（同一视频不重复请求；切视频时按 bvid 区分） */
const cache = new Map<string, ApiVideoMeta>()
/** 进行中的请求（并发去重） */
const inflight = new Map<string, Promise<ApiVideoMeta | null>>()

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : null
}

function str(value: unknown): string {
  return typeof value === 'string'
    ? value
    : ''
}

/** 把接口返回归一化成组件可直接消费的形状 */
function normalize(bvid: string, raw: any): ApiVideoMeta | null {
  const data = raw?.data ?? raw
  if (!data || typeof data.title !== 'string')
    return null

  const stat = data.stat ?? {}
  const owner = data.owner
  const desc = str(data.desc)

  return {
    bvid: str(data.bvid) || bvid,
    aid: num(data.aid) ?? 0,
    title: str(data.title),
    view: num(stat.view),
    like: num(stat.like),
    coin: num(stat.coin),
    favorite: num(stat.favorite),
    share: num(stat.share),
    danmaku: num(stat.danmaku),
    reply: num(stat.reply),
    pubdate: num(data.pubdate),
    copyright: num(data.copyright),
    tname: str(data.tname),
    desc: desc === '-'
      ? ''
      : desc,
    pages: Array.isArray(data.pages)
      ? data.pages.length
      : null,
    duration: num(data.duration),
    owner: owner && owner.mid
      ? {
          mid: num(owner.mid) ?? 0,
          name: str(owner.name),
          face: str(owner.face),
        }
      : null,
    tags: Array.isArray(data.tag)
      ? data.tag.map((t: any) => { return str(t?.tag_name) }).filter(Boolean)
      : [],
  }
}

/**
 * 拉取视频元数据。
 *
 * 返回 null 表示**本次不可用**（接口失败 / 非视频页 / 归一化失败）——
 * 调用方必须回退到原有的 DOM / 桥 / INITIAL_STATE 路径，绝不能因此让信息栏空白。
 */
export async function fetchVideoMeta(bvid: string): Promise<ApiVideoMeta | null> {
  if (!bvid)
    return null

  const hit = cache.get(bvid)
  if (hit)
    return hit

  const running = inflight.get(bvid)
  if (running)
    return running

  const task = (async (): Promise<ApiVideoMeta | null> => {
    try {
      const raw = await wbiGet<any>(VIEW_API, { bvid })
      const meta = normalize(bvid, raw)
      if (meta)
        cache.set(bvid, meta)
      return meta
    }
    catch {
      // 风控 / 网络 / 权限：静默失败，让 infoBar 走回退链
      return null
    }
    finally {
      inflight.delete(bvid)
    }
  })()

  inflight.set(bvid, task)
  return task
}

/** 同步读取已缓存的元数据（infoBar 的渲染是同步的，用它做「优先级 0」） */
export function peekVideoMeta(bvid: string): ApiVideoMeta | null {
  return cache.get(bvid) ?? null
}

/** 模块卸载 / 切视频时清缓存（可选；缓存按 bvid 键控，不清也不会串数据） */
export function clearVideoMetaCache(): void {
  cache.clear()
}
