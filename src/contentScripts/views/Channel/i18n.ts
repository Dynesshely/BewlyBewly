/**
 * 分区页（自绘）的模块内文案（简中 / 繁中 / 粤语 / 英文）。
 *
 * 不进 `src/_locales`（本轮不允许改），沿用 `views/Popular/i18n.ts` 的模块内 i18n 方案：
 * 语言由 `resolveModuleLocale(settings.language)` 解析，四种语言键集合必须完全一致。
 */
import type { ModuleLocale } from '~/utils/moduleI18n'

import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

export interface ChannelMessages {
  /** 一级分区 pill 行的无障碍名称 */
  navAria: string
  /** 二级分区 tab 行的无障碍名称 */
  subTabsAria: string
  /** 页面主标题模板，形如「{name} 分区」 */
  pageTitle: string
  loading: string
  loadMore: string
  retry: string
  errorTitle: string
  /** 错误态里的回退按钮：在原版页面打开 */
  errorNative: string
  emptyTitle: string
  emptyDescription: string
}

const CMN_CN: ChannelMessages = {
  navAria: '分区导航',
  subTabsAria: '二级分区',
  pageTitle: '{name}分区',
  loading: '载入中…',
  loadMore: '加载更多',
  retry: '重试',
  errorTitle: '内容加载失败',
  errorNative: '在原版页面打开',
  emptyTitle: '暂无内容',
  emptyDescription: '这个分区暂时没有可展示的内容，稍后再看看吧。',
}

const CMN_TW: ChannelMessages = {
  navAria: '分區導覽',
  subTabsAria: '二級分區',
  pageTitle: '{name}分區',
  loading: '載入中…',
  loadMore: '載入更多',
  retry: '重試',
  errorTitle: '內容載入失敗',
  errorNative: '在原版頁面開啟',
  emptyTitle: '暫無內容',
  emptyDescription: '這個分區暫時沒有可展示的內容，稍後再看看吧。',
}

const JYUT: ChannelMessages = {
  ...CMN_TW,
  navAria: '分區導覽',
  loading: '載入緊…',
  loadMore: '載入更多',
  retry: '再試一次',
  errorNative: '喺原版頁面開啟',
  emptyDescription: '呢個分區暫時冇嘢可以睇，遲啲再嚟睇下。',
}

const EN: ChannelMessages = {
  navAria: 'Channel navigation',
  subTabsAria: 'Sub-channels',
  pageTitle: '{name} channel',
  loading: 'Loading…',
  loadMore: 'Load more',
  retry: 'Retry',
  errorTitle: 'Failed to load content',
  errorNative: 'Open in the original page',
  emptyTitle: 'Nothing here yet',
  emptyDescription: 'This channel has no content to show right now. Check back later.',
}

const MESSAGES: Record<ModuleLocale, ChannelMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  'jyut': JYUT,
  'en': EN,
}

/** 当前界面语言下的分区页文案（跟随设置实时变化） */
export function useChannelI18n() {
  const t = computed<ChannelMessages>(() =>
    getModuleMessages(MESSAGES, resolveModuleLocale(settings.value.language)),
  )
  return { t }
}
