import { computed } from 'vue'

import { LanguageType } from '~/enums/appEnums'
import { settings } from '~/logic'

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

  hideAside: '隐藏侧栏',
  asideOn: '已隐藏右侧栏',
  asideOff: '已显示右侧栏',
  asideUnavailable: '当前页没有可隐藏的侧栏',

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
    aside: '隐藏右侧栏',
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

  hideAside: 'Hide sidebar',
  asideOn: 'Sidebar hidden',
  asideOff: 'Sidebar shown',
  asideUnavailable: 'No sidebar to hide on this page',

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
    aside: 'Hide the sidebar',
    danmaku: 'Toggle danmaku',
    fullscreen: 'Fullscreen',
    help: 'Toggle the panel',
    exitCinema: 'Exit cinema mode / close panel',
  },
}

/** 模块自建 i18n：只覆盖简中与英文，其余语言回退简中 */
export const MESSAGES: Record<string, LivePageMessages> = {
  'cmn-CN': CMN_CN,
  'en': EN,
}

const FALLBACK_LANGUAGE = 'cmn-CN'

export function normalizeLanguage(language?: string): string {
  return language === LanguageType.English
    ? 'en'
    : FALLBACK_LANGUAGE
}

export function getMessages(language?: string): LivePageMessages {
  const key = normalizeLanguage(language ?? settings.value.language)
  return MESSAGES[key] ?? CMN_CN
}

/** 响应 settings.language 的文案（切换语言后立即生效，不需要重建 UI） */
export function useMessages() {
  return computed(() => getMessages(settings.value.language))
}
