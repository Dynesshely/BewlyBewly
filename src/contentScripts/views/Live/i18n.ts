import type { ModuleLocale } from '~/utils/moduleI18n'

import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

/** 直播页自绘模块的文案（不进入 `src/_locales`，与其它模块一致） */
export interface LiveMessages {
  /** 首页标题 */
  homeTitle: string
  /** 首页副标题 */
  homeSubtitle: string
  /** 分区导航的无障碍名称 */
  areaNavAria: string
  /** 直播中徽标 */
  liveBadge: string
  /** 人气单位 */
  onlineLabel: string
  /** 看过人数单位 */
  watchedLabel: string
  /** 点赞单位 */
  likeLabel: string
  /** 粉丝单位 */
  followerLabel: string
  /** 关注按钮 */
  follow: string
  /** 已关注按钮 */
  followed: string
  /** 侧栏推荐列表标题 */
  recommendTitle: string
  /** 侧栏推荐列表的「更多」链接文案 */
  recommendMore: string
  /** 载入中 */
  loading: string
  /** 加载更多 */
  loadMore: string
  /** 重试 */
  retry: string
  /** 错误标题 */
  errorTitle: string
  /** 错误态里的原生页回退链接 */
  errorNative: string
  /** 空态标题 */
  emptyTitle: string
  /** 空态说明 */
  emptyDescription: string
  /** 自绘失败、回退原生页的提示 */
  fallbackToast: string
  /** 直播间信息栏的无障碍名称 */
  roomBarAria: string
  /** 未开播文案 */
  offline: string
}

const CMN_CN: LiveMessages = {
  homeTitle: '推荐直播',
  homeSubtitle: '正在开播的直播间，按人气推荐',
  areaNavAria: '直播分区',
  liveBadge: '直播中',
  onlineLabel: '人气',
  watchedLabel: '看过',
  likeLabel: '点赞',
  followerLabel: '粉丝',
  follow: '关注',
  followed: '已关注',
  recommendTitle: '推荐直播',
  recommendMore: '更多',
  loading: '载入中…',
  loadMore: '加载更多',
  retry: '重试',
  errorTitle: '内容加载失败',
  errorNative: '在原版页面打开',
  emptyTitle: '暂无直播',
  emptyDescription: '当前没有可展示的直播间，稍后再看看吧。',
  fallbackToast: '自绘直播页加载失败，已回退原版页面',
  roomBarAria: '直播间信息',
  offline: '未开播',
}

const CMN_TW: LiveMessages = {
  homeTitle: '推薦直播',
  homeSubtitle: '正在開播的直播間，依人氣推薦',
  areaNavAria: '直播分區',
  liveBadge: '直播中',
  onlineLabel: '人氣',
  watchedLabel: '看過',
  likeLabel: '點讚',
  followerLabel: '粉絲',
  follow: '關注',
  followed: '已關注',
  recommendTitle: '推薦直播',
  recommendMore: '更多',
  loading: '載入中…',
  loadMore: '載入更多',
  retry: '重試',
  errorTitle: '內容載入失敗',
  errorNative: '在原版頁面開啟',
  emptyTitle: '暫無直播',
  emptyDescription: '目前沒有可展示的直播間，稍後再看看吧。',
  fallbackToast: '自繪直播頁載入失敗，已回退原版頁面',
  roomBarAria: '直播間資訊',
  offline: '未開播',
}

const JYUT: LiveMessages = {
  ...CMN_TW,
  homeTitle: '推薦直播',
  homeSubtitle: '而家開緊播嘅直播間，按人氣推薦',
  loading: '載入緊…',
  loadMore: '載入多啲',
  emptyDescription: '而家未有直播間可以睇，遲啲再嚟啦。',
  fallbackToast: '自繪直播頁載入失敗，已經返去原版頁面',
}

const EN: LiveMessages = {
  homeTitle: 'Live now',
  homeSubtitle: 'Live rooms recommended by popularity',
  areaNavAria: 'Live categories',
  liveBadge: 'LIVE',
  onlineLabel: 'viewers',
  watchedLabel: 'watched',
  likeLabel: 'likes',
  followerLabel: 'followers',
  follow: 'Follow',
  followed: 'Following',
  recommendTitle: 'Recommended live',
  recommendMore: 'More',
  loading: 'Loading…',
  loadMore: 'Load more',
  retry: 'Retry',
  errorTitle: 'Failed to load',
  errorNative: 'Open the original page',
  emptyTitle: 'No live rooms',
  emptyDescription: 'No live rooms to show right now. Check back later.',
  fallbackToast: 'Failed to draw the live page, reverted to the original page',
  roomBarAria: 'Live room info',
  offline: 'Offline',
}

export const MESSAGES: Record<ModuleLocale, LiveMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  'jyut': JYUT,
  'en': EN,
}

/** 按语言取词典（简中 → 英文 → 简中兜底） */
export function getLiveMessages(language?: string): LiveMessages {
  const locale = resolveModuleLocale(language ?? settings.value.language)
  return getModuleMessages(MESSAGES, locale, CMN_CN)
}

/** 响应 settings.language 的文案 */
export function useLiveI18n() {
  const t = computed(() => getLiveMessages(settings.value.language))
  const locale = computed(() => resolveModuleLocale(settings.value.language))
  return { t, locale }
}
