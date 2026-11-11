import type { ModuleLocale } from '~/utils/moduleI18n'

import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

/** 快捷键说明（与 keyboard.ts 的行为一一对应） */
export interface ShortcutLabels {
  cinema: string
  aside: string
  danmaku: string
  fullscreen: string
  help: string
  exitCinema: string
}

export interface LivePageMessages {
  controls: string
  openPanel: string
  panelTitle: string
  close: string

  cinema: string
  cinemaOn: string
  cinemaOff: string
  cinemaUnavailable: string

  hideAside: string
  asideOn: string
  asideOff: string
  asideUnavailable: string

  danmaku: string
  danmakuOn: string
  danmakuOff: string
  danmakuUnavailable: string

  fullscreen: string
  fullscreenFailed: string
  fullscreenUnavailable: string

  shortcutsTitle: string
  hint: string
  playerNotFound: string

  shortcut: ShortcutLabels
}

const CMN_CN: LivePageMessages = {
  controls: '直播增强',
  openPanel: '打开直播增强面板',
  panelTitle: '直播页增强',
  close: '关闭',

  cinema: '影院模式',
  cinemaOn: '已进入影院模式',
  cinemaOff: '已退出影院模式',
  cinemaUnavailable: '没有找到直播播放器',

  hideAside: '隐藏下方推荐 / 榜单',
  asideOn: '已隐藏下方推荐 / 榜单',
  asideOff: '已显示下方推荐 / 榜单',
  asideUnavailable: '未识别到可隐藏的下方区块（本页可能没有推荐 / 榜单）',

  danmaku: '弹幕开关',
  danmakuOn: '弹幕已开启',
  danmakuOff: '弹幕已关闭',
  danmakuUnavailable: '没有找到原生弹幕开关',

  fullscreen: '全屏',
  fullscreenFailed: '无法进入全屏',
  fullscreenUnavailable: '没有找到播放器',

  shortcutsTitle: '快捷键',
  hint: '面板与快捷键只作用于本页，状态在本标签页内保持',
  playerNotFound: '没有找到直播播放器，稍后自动重试',

  shortcut: {
    cinema: '影院模式',
    aside: '隐藏下方推荐 / 榜单',
    danmaku: '弹幕开关',
    fullscreen: '全屏',
    help: '打开 / 关闭面板',
    exitCinema: '退出影院模式 / 关闭面板',
  },
}

const EN: LivePageMessages = {
  controls: 'Live enhancements',
  openPanel: 'Open live enhancements',
  panelTitle: 'Live page enhancements',
  close: 'Close',

  cinema: 'Cinema mode',
  cinemaOn: 'Cinema mode on',
  cinemaOff: 'Cinema mode off',
  cinemaUnavailable: 'Live player not found',

  hideAside: 'Hide below feed / ranking',
  asideOn: 'Below feed hidden',
  asideOff: 'Below feed shown',
  asideUnavailable: 'No hideable below section detected on this page',

  danmaku: 'Danmaku',
  danmakuOn: 'Danmaku on',
  danmakuOff: 'Danmaku off',
  danmakuUnavailable: 'Native danmaku toggle not found',

  fullscreen: 'Fullscreen',
  fullscreenFailed: 'Could not enter fullscreen',
  fullscreenUnavailable: 'Player not found',

  shortcutsTitle: 'Shortcuts',
  hint: 'The panel and shortcuts only affect this page; state is kept for this tab',
  playerNotFound: 'Live player not found yet — retrying',

  shortcut: {
    cinema: 'Cinema mode',
    aside: 'Hide below feed / ranking',
    danmaku: 'Toggle danmaku',
    fullscreen: 'Fullscreen',
    help: 'Toggle the panel',
    exitCinema: 'Exit cinema mode / close panel',
  },
}

const CMN_TW: LivePageMessages = {
  controls: '直播增強',
  openPanel: '開啟直播增強面板',
  panelTitle: '直播頁增強',
  close: '關閉',

  cinema: '影院模式',
  cinemaOn: '已進入影院模式',
  cinemaOff: '已退出影院模式',
  cinemaUnavailable: '找不到直播播放器',

  hideAside: '隱藏下方推薦 / 榜單',
  asideOn: '已隱藏下方推薦 / 榜單',
  asideOff: '已顯示下方推薦 / 榜單',
  asideUnavailable: '未識別到可隱藏的下方區塊（本頁可能沒有推薦 / 榜單）',

  danmaku: '彈幕開關',
  danmakuOn: '彈幕已開啟',
  danmakuOff: '彈幕已關閉',
  danmakuUnavailable: '找不到原生彈幕開關',

  fullscreen: '全螢幕',
  fullscreenFailed: '無法進入全螢幕',
  fullscreenUnavailable: '找不到播放器',

  shortcutsTitle: '快速鍵',
  hint: '面板與快速鍵只作用於本頁，狀態在本分頁內保持',
  playerNotFound: '找不到直播播放器，稍後自動重試',

  shortcut: {
    cinema: '影院模式',
    aside: '隱藏下方推薦 / 榜單',
    danmaku: '彈幕開關',
    fullscreen: '全螢幕',
    help: '開啟 / 關閉面板',
    exitCinema: '退出影院模式 / 關閉面板',
  },
}

const JYUT: LivePageMessages = {
  ...CMN_TW,
  openPanel: '打開直播增強面板',
  cinemaUnavailable: '搵唔到直播播放器',
  asideOn: '收埋咗下面嘅推薦 / 榜單',
  asideOff: '顯示返下面嘅推薦 / 榜單',
  asideUnavailable: '搵唔到可以收埋嘅下面區塊（呢頁可能冇推薦 / 榜單）',
  danmakuUnavailable: '搵唔到原生彈幕開關',
  fullscreenFailed: '入唔到全螢幕',
  hint: '面板同快速鍵淨係影響呢一頁，狀態喺呢個分頁入面保持',
  playerNotFound: '搵唔到直播播放器，轉頭自動再試',
  shortcut: {
    cinema: '影院模式',
    aside: '收埋下面推薦 / 榜單',
    danmaku: '彈幕開關',
    fullscreen: '全螢幕',
    help: '打開 / 關閉面板',
    exitCinema: '退出影院模式 / 關閉面板',
  },
}

/** 模块自建 i18n：四种语言键集合完全一致（缺键回退简中 / 英文，不会出现空串） */
export const MESSAGES: Record<ModuleLocale, LivePageMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  jyut: JYUT,
  en: EN,
}

export function normalizeLanguage(language?: string): ModuleLocale {
  return resolveModuleLocale(language)
}

export function getMessages(language?: string): LivePageMessages {
  return getModuleMessages<LivePageMessages>(MESSAGES, resolveModuleLocale(language ?? settings.value.language), CMN_CN)
}

/** 响应 settings.language 的文案（切换语言后立即生效，不需要重建 UI） */
export function useMessages() {
  return computed(() => getMessages(settings.value.language))
}
