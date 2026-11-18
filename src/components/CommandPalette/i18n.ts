import type { ModuleLocale } from '~/utils/moduleI18n'
import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

/**
 * 命令面板新增命令（跳转 / 搜索 / 打开空间）的模块内文案。
 *
 * 按项目约定不写进 `src/_locales`（那是 Lead 的写入范围）；四种模块语言：
 * cmn-CN / cmn-TW / jyut / en，语言解析统一走 `~/utils/moduleI18n`。
 */
export interface CommandPaletteMessages {
  /** 分组标题：直接跳转 */
  groupGo: string
  /** 分组标题：搜索与打开 */
  groupSearch: string
  /** 打开历史记录 */
  openHistory: string
  /** 打开稍后再看 */
  openWatchLater: string
  /** 打开收藏夹 */
  openFavorites: string
  /** 打开动态 */
  openMoments: string
  /** 打开消息中心 */
  openMessage: string
  /** 打开热门 */
  openPopular: string
  /** 回到顶部（滚动超过两屏时才出现） */
  backToTop: string
  /** 搜索视频，`{query}` 是用户输入 */
  searchVideo: string
  /** 搜索视频的补充说明 */
  searchVideoHint: string
  /** 打开 UP 主空间，`{mid}` 是用户输入的 UID */
  openSpace: string
  openSpaceHint: string
}

const CMN_CN: CommandPaletteMessages = {
  groupGo: '直接跳转',
  groupSearch: '搜索与打开',
  openHistory: '打开历史记录',
  openWatchLater: '打开稍后再看',
  openFavorites: '打开收藏夹',
  openMoments: '打开动态',
  openMessage: '打开消息中心',
  openPopular: '打开热门',
  backToTop: '回到顶部',
  searchVideo: '搜索视频：{query}',
  searchVideoHint: '回车在 B 站搜索这个关键词',
  openSpace: '打开 UP 主空间：{mid}',
  openSpaceHint: '回车打开这个 UID 的用户空间',
}

const CMN_TW: CommandPaletteMessages = {
  groupGo: '直接跳轉',
  groupSearch: '搜尋與開啟',
  openHistory: '開啟觀看紀錄',
  openWatchLater: '開啟稍後再看',
  openFavorites: '開啟收藏夾',
  openMoments: '開啟動態',
  openMessage: '開啟訊息中心',
  openPopular: '開啟熱門',
  backToTop: '回到頂部',
  searchVideo: '搜尋影片：{query}',
  searchVideoHint: '按 Enter 在 B 站搜尋這個關鍵字',
  openSpace: '開啟 UP 主空間：{mid}',
  openSpaceHint: '按 Enter 開啟這個 UID 的使用者空間',
}

const JYUT: CommandPaletteMessages = {
  ...CMN_TW,
  groupGo: '直接跳去',
  groupSearch: '搵嘢同開啟',
  openHistory: '開返觀看紀錄',
  openWatchLater: '開返稍後再看',
  searchVideo: '搵片：{query}',
  searchVideoHint: '撳 Enter 喺 B 站搵呢個關鍵詞',
  openSpace: '開 UP 主空間：{mid}',
  openSpaceHint: '撳 Enter 開呢個 UID 嘅用戶空間',
  backToTop: '返到頂部',
}

const EN: CommandPaletteMessages = {
  groupGo: 'Jump to',
  groupSearch: 'Search & open',
  openHistory: 'Open watch history',
  openWatchLater: 'Open Watch Later',
  openFavorites: 'Open favorites',
  openMoments: 'Open Moments',
  openMessage: 'Open messages',
  openPopular: 'Open Popular',
  backToTop: 'Back to top',
  searchVideo: 'Search videos: {query}',
  searchVideoHint: 'Press Enter to search this on Bilibili',
  openSpace: 'Open creator space: {mid}',
  openSpaceHint: 'Press Enter to open this UID\'s space',
}

const MESSAGES: Record<ModuleLocale, CommandPaletteMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  jyut: JYUT,
  en: EN,
}

/** 响应 settings.language 的文案（切语言后立即生效） */
export function useCommandPaletteMessages() {
  const t = computed(() =>
    getModuleMessages<CommandPaletteMessages>(MESSAGES, resolveModuleLocale(settings.value.language), CMN_CN),
  )
  return { t }
}
