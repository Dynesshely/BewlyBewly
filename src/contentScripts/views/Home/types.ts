import type { GridLayoutType } from '~/logic'

export enum HomeSubPage {
  ForYou = 'ForYou',
  Following = 'Following',
  SubscribedSeries = 'SubscribedSeries',
  Trending = 'Trending',
  Ranking = 'Ranking',
  Live = 'Live',
}

export interface RankingType {
  id: number
  name: string
  rid?: number
  seasonType?: number
  type?: string
}

/** 网格列表项：视频/动态/直播等的通用外壳，避免各页面重复声明同样结构 */
export interface GridVideoElement<T = unknown> {
  uniqueId: string
  item?: T
}

export interface GridLayoutIcon {
  icon: string
  iconActivated: string
  value: GridLayoutType
}
