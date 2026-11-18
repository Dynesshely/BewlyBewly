/**
 * 空间页（自绘）的模块内文案（简中 / 繁中 / 粤语 / 英文）。
 *
 * 不进 `src/_locales`（本轮写入范围不允许改），沿用 `views/Channel` / `views/Popular`
 * 的模块内 i18n 方案：语言由 `resolveModuleLocale(settings.language)` 解析，
 * 四种语言的键集合必须完全一致。
 */
import type { ModuleLocale } from '~/utils/moduleI18n'

import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

export interface SpaceMessages {
  /** 排序分组无障碍名称 */
  sortAria: string
  sortLatest: string
  sortPlay: string
  sortFav: string
  /** 视频总数文案，`{count}` 是已格式化数字 */
  videoCount: string
  loading: string
  loadMore: string
  retry: string
  errorTitle: string
  /** 错误态里的回退入口：在原版页面打开 */
  errorNative: string
  emptyTitle: string
  emptyDescription: string
  /** 空态主按钮：在原版页面打开（空态也给一个明确的下一步） */
  emptyNative: string
  /** 空态次按钮：重新加载 */
  emptyReload: string
  /** 错误态二级出路说明（重试之外还能做什么） */
  errorFallbackHint: string
  /** 关注 / 已关注 / 互相关注 */
  follow: string
  followed: string
  followMutual: string
  /** 关注失败提示 */
  followLogin: string
  followFailed: string
  /** 粉丝 / 关注 标签 */
  fans: string
  following: string
  /** 等级前缀，`{level}` 为数字 */
  level: string
  /** 大会员徽标文案 */
  vip: string
  /** 列表到底了 */
  end: string
}

const CMN_CN: SpaceMessages = {
  sortAria: '视频排序',
  sortLatest: '最新发布',
  sortPlay: '最多播放',
  sortFav: '最多收藏',
  videoCount: '{count} 个视频',
  loading: '载入中…',
  loadMore: '加载更多',
  retry: '重试',
  errorTitle: '内容加载失败',
  errorNative: '在原版页面打开',
  emptyTitle: '还没有投稿',
  emptyDescription: '这个 UP 主暂时没有可展示的视频，稍后再来看看吧。',
  emptyNative: '在原版页面打开',
  emptyReload: '重新加载',
  errorFallbackHint: '重试还是不行？可以切到原版页面查看，或稍后再回来。',
  follow: '关注',
  followed: '已关注',
  followMutual: '互相关注',
  followLogin: '需要先登录 B 站账号',
  followFailed: '操作失败',
  fans: '粉丝',
  following: '关注',
  level: 'LV{level}',
  vip: '大会员',
  end: '没有更多了',
}

const CMN_TW: SpaceMessages = {
  sortAria: '影片排序',
  sortLatest: '最新發佈',
  sortPlay: '最多播放',
  sortFav: '最多收藏',
  videoCount: '{count} 個影片',
  loading: '載入中…',
  loadMore: '載入更多',
  retry: '重試',
  errorTitle: '內容載入失敗',
  errorNative: '在原版頁面開啟',
  emptyTitle: '還沒有投稿',
  emptyDescription: '這個 UP 主暫時沒有可展示的影片，稍後再來看看吧。',
  emptyNative: '在原版頁面開啟',
  emptyReload: '重新載入',
  errorFallbackHint: '重試還是不行？可以切到原版頁面查看，或稍後再回來。',
  follow: '關注',
  followed: '已關注',
  followMutual: '互相關注',
  followLogin: '需要先登入 B 站帳號',
  followFailed: '操作失敗',
  fans: '粉絲',
  following: '關注',
  level: 'LV{level}',
  vip: '大會員',
  end: '沒有更多了',
}

const JYUT: SpaceMessages = {
  ...CMN_TW,
  sortAria: '影片排序',
  sortLatest: '最新發佈',
  loading: '載入緊…',
  retry: '再試一次',
  errorNative: '喺原版頁面開啟',
  emptyDescription: '呢個 UP 主暫時冇嘢可以睇，遲啲再嚟睇下。',
  emptyNative: '喺原版頁面開啟',
  emptyReload: '再載入一次',
  errorFallbackHint: '再試都唔得？可以切去原版頁面睇，或者遲啲再返嚟。',
  followLogin: '要登入咗 B 站帳號先得',
  followFailed: '搞唔到',
  fans: '粉絲',
  following: '關注',
}

const EN: SpaceMessages = {
  sortAria: 'Video sorting',
  sortLatest: 'Latest',
  sortPlay: 'Most played',
  sortFav: 'Most favorited',
  videoCount: '{count} videos',
  loading: 'Loading…',
  loadMore: 'Load more',
  retry: 'Retry',
  errorTitle: 'Failed to load content',
  errorNative: 'Open in the original page',
  emptyTitle: 'No uploads yet',
  emptyDescription: 'This creator has no videos to show right now. Check back later.',
  emptyNative: 'Open in the original page',
  emptyReload: 'Reload',
  errorFallbackHint: 'Still failing? Try the original page, or come back later.',
  follow: 'Follow',
  followed: 'Following',
  followMutual: 'Mutual',
  followLogin: 'Please sign in to Bilibili first',
  followFailed: 'Action failed',
  fans: 'Followers',
  following: 'Following',
  level: 'LV{level}',
  vip: 'Premium',
  end: 'No more videos',
}

const MESSAGES: Record<ModuleLocale, SpaceMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  'jyut': JYUT,
  'en': EN,
}

/** 当前界面语言下的空间页文案（跟随设置实时变化） */
export function useSpaceI18n() {
  const t = computed<SpaceMessages>(() =>
    getModuleMessages(MESSAGES, resolveModuleLocale(settings.value.language)),
  )
  const levelText = (level?: number) => {
    if (!level || level <= 0)
      return ''
    return t.value.level.replace('{level}', String(level))
  }
  return { t, levelText }
}
