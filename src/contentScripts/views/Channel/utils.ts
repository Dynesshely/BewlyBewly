/**
 * 分区页（自绘）的数据转换与格式化。
 */
import type { RegionArchive } from './types'
import type { Video } from '~/components/VideoCard/types'

/**
 * 接口条目 → `VideoCard` 需要的结构。
 *
 * 卡片要的六件事都在这里给全：
 *   封面（`cover`，VideoCard 自己按 16:9 裁切）/ 标题（`title`，两行截断由组件负责）/
 *   UP（`author`）/ 播放量（`view`，组件里走 `numFormatter` 出「万 / 亿」）/
 *   时长（`duration` 秒，组件里转 `mm:ss`）/ 角标（`tag`，B 站自己的推荐理由）。
 */
export function toVideoCard(archive: RegionArchive): Video {
  const reason = archive.rec_reason?.trim()
  return {
    id: archive.aid,
    aid: archive.aid,
    bvid: archive.bvid,
    cid: archive.cid,
    title: archive.title,
    cover: archive.cover,
    duration: archive.duration,
    publishedTimestamp: archive.pubdate,
    view: archive.stat?.view,
    danmaku: archive.stat?.danmaku,
    author: archive.author
      ? {
          name: archive.author.name,
          mid: archive.author.mid,
          // 分区 feed 不带头像（`author.face` 不在接口返回里），留空由组件降级成默认头像
          authorFace: '',
        }
      : undefined,
    tag: reason || undefined,
    // 右键菜单会读这个字段；分区 feed 没有三连点数据来源，给空数组即可
    threePointV2: [],
  }
}

/** 条目的稳定键（去重用：优先 bvid，其次 aid） */
export function archiveKey(archive: RegionArchive): string {
  return archive.bvid || `av${archive.aid}`
}

/** 追加去重：B 站 feed 偶发在相邻两页回同一条 */
export function appendArchives(
  current: RegionArchive[],
  incoming: RegionArchive[],
): RegionArchive[] {
  const seen = new Set(current.map(archiveKey))
  const merged = [...current]
  for (const archive of incoming) {
    const key = archiveKey(archive)
    if (seen.has(key))
      continue
    seen.add(key)
    merged.push(archive)
  }
  return merged
}
