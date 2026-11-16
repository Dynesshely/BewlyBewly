/**
 * 热门 / 排行榜页的数据获取。
 *
 * 两类来源：
 *   1. 走仓库统一的 background 代理（`api.*`）—— 综合热门、排行榜、番剧类排行榜；
 *   2. 「每周必看」「入站必刷」两个接口 `src/background/messageListeners/api` 里没有，
 *      而本轮写入范围不允许改 api 层，所以在模块内用页面同源的 `fetch`（带 cookie）直连。
 *      B 站页面自身就是用同样的 origin + credentials 调这些接口的，CDP 真机已验证可用；
 *      失败时由调用方展示错误态并提供「在原版页面打开」的回退链接。
 */
import type { PopularVideoItem, PreciousData, WeeklyIssue, WeeklyIssueConfig } from './types'
import type { List as RankVideoItem } from '~/models/video/ranking'

import api from '~/utils/api'

const API_ORIGIN = 'https://api.bilibili.com'
const REQUEST_TIMEOUT = 12_000

interface JsonResponse<T> {
  code: number
  message?: string
  data?: T
}

/** 直连 B 站 Web 接口（带 cookie），超时 / 非 0 code / 空 data 一律抛错 */
async function requestJson<T>(path: string): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    const response = await fetch(`${API_ORIGIN}${path}`, {
      credentials: 'include',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok)
      throw new Error(`HTTP ${response.status}`)
    const payload = await response.json() as JsonResponse<T>
    if (payload.code !== 0)
      throw new Error(payload.message || `API code ${payload.code}`)
    if (payload.data === undefined)
      throw new Error('API returned no data')
    return payload.data
  }
  finally {
    window.clearTimeout(timer)
  }
}

function assertData<T>(value: any, fallback: string): T {
  if (value === undefined || value === null)
    throw new Error(fallback)
  return value as T
}

export interface PopularFeedPage {
  list: PopularVideoItem[]
  /** 接口明确说没有下一页 */
  noMore: boolean
}

/** 综合热门（无限流，`no_more` 由接口给出） */
export async function getPopularFeed(pn: number, ps: number): Promise<PopularFeedPage> {
  const response = await api.video.getPopularVideos({ pn, ps })
  const data = assertData<{ list?: PopularVideoItem[], no_more?: boolean }>(response?.data, 'popular feed failed')
  if (response?.code !== 0)
    throw new Error(response?.message || `API code ${response?.code}`)
  return {
    list: data.list ?? [],
    noMore: Boolean(data.no_more),
  }
}

/** 排行榜（视频分区） */
export async function getRankVideos(rid: number): Promise<RankVideoItem[]> {
  const response = await api.ranking.getRankingVideos({ rid, type: 'all' })
  const data = assertData<{ list?: RankVideoItem[] }>(response?.data, 'ranking failed')
  if (response?.code !== 0)
    throw new Error(response?.message || `API code ${response?.code}`)
  return data.list ?? []
}

/** 排行榜（番剧 / 国创 / 纪录片 / 电影 / 电视剧 / 综艺） */
export async function getRankPgc(seasonType: number): Promise<any[]> {
  const response = await api.ranking.getRankingPgc({ season_type: seasonType })
  const data = assertData<{ list?: any[] }>(response?.data, 'pgc ranking failed')
  if (response?.code !== 0)
    throw new Error(response?.message || `API code ${response?.code}`)
  return data.list ?? []
}

/** 每周必看：全部期号 */
export async function getWeeklyIssues(): Promise<WeeklyIssue[]> {
  const data = await requestJson<{ list?: WeeklyIssue[] }>('/x/web-interface/popular/series/list')
  return (data.list ?? []).slice().sort((a, b) => b.number - a.number)
}

export interface WeeklyIssueData {
  config: WeeklyIssueConfig
  list: PopularVideoItem[]
}

/** 每周必看：单期详情 */
export async function getWeeklyIssue(number: number): Promise<WeeklyIssueData> {
  const data = await requestJson<{ config: WeeklyIssueConfig, list?: unknown[] }>(
    `/x/web-interface/popular/series/one?number=${number}`,
  )
  return {
    config: data.config,
    list: (data.list ?? []) as PopularVideoItem[],
  }
}

export interface PreciousViewData {
  title: string
  explain: string
  list: PopularVideoItem[]
}

/** 入站必刷 */
export async function getPrecious(): Promise<PreciousViewData> {
  const data = await requestJson<PreciousData>('/x/web-interface/popular/precious')
  return {
    title: data.title,
    explain: data.explain,
    list: (data.list ?? []) as PopularVideoItem[],
  }
}
