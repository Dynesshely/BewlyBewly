import type { ModuleLocale } from '~/utils/moduleI18n'

import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

/** 快捷键说明文案（与 shortcuts.ts 的 labelKey 一一对应） */
export interface ShortcutLabels {
  seekBack: string
  seekForward: string
  playPause: string
  back5: string
  forward5: string
  danmaku: string
  mute: string
  fullscreen: string
  cinema: string
  pip: string
  restore: string
  prevEpisode: string
  nextEpisode: string
  prevItem: string
  nextItem: string
  prevVideo: string
  nextVideo: string
  autoplay: string
  percent: string
  help: string
  escape: string
}

export type ShortcutLabelKey = keyof ShortcutLabels

export interface VideoPageMessages {
  controls: string
  cinema: string
  exitCinema: string
  cinemaOn: string
  cinemaOff: string
  restorePlayer: string
  restored: string
  compactBack: string
  miniPlayer: string
  danmaku: string
  danmakuOn: string
  danmakuOff: string
  mute: string
  muted: string
  unmuted: string
  fullscreen: string
  pip: string
  pipUnsupported: string
  pipFailed: string
  playerNotFound: string
  shortcuts: string
  shortcutsTitle: string
  shortcutsHint: string
  close: string
  /** 播放列表面板标题（/list/*） */
  playlistPanel: string
  /** 分P 选集的标题（普通多P 视频） */
  partsPanel: string
  /** 合集的标题（合集视频页） */
  collectionPanel: string
  /** 形如「3 / 12」，用 formatPlaylistPosition 替换占位符 */
  playlistPosition: string
  autoplay: string
  autoplayOn: string
  autoplayOff: string
  autoplayUnavailable: string
  playlistHint: string
  partsHint: string
  commentsToolbar: string
  commentsSortHot: string
  commentsSortLatest: string
  commentsSortUnavailable: string
  commentSortHotToast: string
  commentSortLatestToast: string
  commentsOnlyUp: string
  commentsUpUnavailable: string
  commentsOnlyUpOn: string
  commentsOnlyUpOff: string
  commentsExpand: string
  /** 推荐轨道标题（第 27 轮） */
  recommendRailTitle: string
  recommendRailHint: string
  recommendRailPrev: string
  recommendRailNext: string
  recommendRailClose: string
  collectionHint: string
  /** 形如「已跳到 {percent}%」，用 formatPercent 替换占位符 */
  percent: string
  shortcut: ShortcutLabels
}

const CMN_CN: VideoPageMessages = {
  controls: '播放器增强',
  cinema: '影院模式',
  exitCinema: '退出影院',
  cinemaOn: '已进入影院模式，按 Esc 退出',
  cinemaOff: '已退出影院模式',
  restorePlayer: '还原播放器',
  restored: '已还原播放器',
  compactBack: '回到播放',
  miniPlayer: '迷你播放器',
  danmaku: '弹幕',
  danmakuOn: '弹幕已开启',
  danmakuOff: '弹幕已关闭',
  mute: '静音',
  muted: '已静音',
  unmuted: '已取消静音',
  fullscreen: '全屏',
  pip: '画中画',
  pipUnsupported: '当前浏览器不支持画中画',
  pipFailed: '画中画启动失败',
  playerNotFound: '未找到播放器',
  shortcuts: '快捷键',
  shortcutsTitle: '播放页快捷键',
  shortcutsHint: '按 ? 打开或关闭帮助，Esc 关闭',
  close: '关闭',
  playlistPanel: '播放列表',
  partsPanel: '选集',
  collectionPanel: '合集',
  playlistPosition: '{current} / {total}',
  autoplay: '自动连播',
  autoplayOn: '已开启自动连播：播完自动切下一个',
  autoplayOff: '已关闭自动连播',
  autoplayUnavailable: '当前页面没有可用的「下一个」，无法自动连播',
  playlistHint: '点条目切换视频；A 切自动连播；Esc 关闭面板',
  partsHint: '点条目切换分P；Esc 关闭面板',
  collectionHint: '点条目切换合集视频；Esc 关闭面板',
  commentsToolbar: '评论增强',
  commentsSortHot: '最热',
  commentsSortLatest: '最新',
  commentsSortUnavailable: '没有找到原生评论排序',
  commentSortHotToast: '已按最热排序',
  commentSortLatestToast: '已按最新排序',
  commentsOnlyUp: '只看 UP 主',
  commentsUpUnavailable: '没有找到 UP 主标识，暂不能只看 UP',
  commentsOnlyUpOn: '只看 UP 主评论',
  commentsOnlyUpOff: '显示全部评论',
  commentsExpand: '展开',
  recommendRailTitle: '推荐视频',
  recommendRailHint: '推荐视频轨道：← → 切换，Enter 当前页预览，Ctrl/⌘+点击 或 中键新标签页',
  recommendRailPrev: '上一张',
  recommendRailNext: '下一张',
  recommendRailClose: '收起推荐轨道',
  percent: '已跳到 {percent}%',
  shortcut: {
    seekBack: '后退 10 秒',
    seekForward: '前进 10 秒',
    playPause: '播放 / 暂停',
    back5: '后退 5 秒',
    forward5: '前进 5 秒',
    danmaku: '开关弹幕',
    mute: '静音切换',
    fullscreen: '全屏',
    cinema: '影院模式',
    pip: '画中画',
    restore: '还原迷你播放器',
    prevEpisode: '上一集',
    nextEpisode: '下一集',
    prevItem: '上一个播放项',
    nextItem: '下一个播放项',
    prevVideo: '上一个视频',
    nextVideo: '下一个视频',
    autoplay: '自动连播开关',
    percent: '跳到 0%–90%',
    help: '打开 / 关闭快捷键帮助',
    escape: '退出影院 / 关闭帮助',
  },
}

const EN: VideoPageMessages = {
  controls: 'Player enhancements',
  cinema: 'Cinema mode',
  exitCinema: 'Exit cinema',
  cinemaOn: 'Cinema mode on — press Esc to exit',
  cinemaOff: 'Cinema mode off',
  restorePlayer: 'Restore player',
  restored: 'Player restored',
  compactBack: 'Back to video',
  miniPlayer: 'Mini player',
  danmaku: 'Danmaku',
  danmakuOn: 'Danmaku on',
  danmakuOff: 'Danmaku off',
  mute: 'Mute',
  muted: 'Muted',
  unmuted: 'Unmuted',
  fullscreen: 'Fullscreen',
  pip: 'Picture-in-picture',
  pipUnsupported: 'Picture-in-picture is not supported in this browser',
  pipFailed: 'Failed to start picture-in-picture',
  playerNotFound: 'Player not found',
  shortcuts: 'Shortcuts',
  shortcutsTitle: 'Video page shortcuts',
  shortcutsHint: 'Press ? to toggle this help, Esc to close',
  close: 'Close',
  playlistPanel: 'Playlist',
  partsPanel: 'Parts',
  collectionPanel: 'Collection',
  playlistPosition: '{current} / {total}',
  autoplay: 'Autoplay',
  autoplayOn: 'Autoplay on — play the next item automatically',
  autoplayOff: 'Autoplay off',
  autoplayUnavailable: 'No next item is available on this page, so autoplay cannot be enabled',
  playlistHint: 'Click an item to switch, A toggles autoplay, Esc closes',
  partsHint: 'Click an item to switch part, Esc closes',
  collectionHint: 'Click an item to switch video in this collection, Esc closes',
  commentsToolbar: 'Comment tools',
  commentsSortHot: 'Top',
  commentsSortLatest: 'Newest',
  commentsSortUnavailable: 'Native comment sorting not found',
  commentSortHotToast: 'Sorted by top comments',
  commentSortLatestToast: 'Sorted by newest comments',
  commentsOnlyUp: 'Uploader only',
  commentsUpUnavailable: 'Uploader badge not found, cannot filter',
  commentsOnlyUpOn: 'Showing uploader comments only',
  commentsOnlyUpOff: 'Showing all comments',
  commentsExpand: 'Expand',
  recommendRailTitle: 'Recommended videos',
  recommendRailHint: 'Recommendation rail: ← → to switch, Enter previews here, Ctrl/⌘+click or middle click opens a new tab',
  recommendRailPrev: 'Previous',
  recommendRailNext: 'Next',
  recommendRailClose: 'Hide the recommendation rail',
  percent: 'Jumped to {percent}%',
  shortcut: {
    seekBack: 'Back 10 seconds',
    seekForward: 'Forward 10 seconds',
    playPause: 'Play / pause',
    back5: 'Back 5 seconds',
    forward5: 'Forward 5 seconds',
    danmaku: 'Toggle danmaku',
    mute: 'Toggle mute',
    fullscreen: 'Fullscreen',
    cinema: 'Cinema mode',
    pip: 'Picture-in-picture',
    restore: 'Restore the mini player',
    prevEpisode: 'Previous episode',
    nextEpisode: 'Next episode',
    prevItem: 'Previous playlist item',
    nextItem: 'Next playlist item',
    prevVideo: 'Previous video',
    nextVideo: 'Next video',
    autoplay: 'Toggle autoplay',
    percent: 'Jump to 0%–90%',
    help: 'Toggle this shortcut help',
    escape: 'Exit cinema / close this help',
  },
}

const CMN_TW: VideoPageMessages = {
  controls: '播放器增強',
  cinema: '影院模式',
  exitCinema: '退出影院',
  cinemaOn: '已進入影院模式，按 Esc 退出',
  cinemaOff: '已退出影院模式',
  restorePlayer: '還原播放器',
  restored: '已還原播放器',
  compactBack: '回到播放',
  miniPlayer: '迷你播放器',
  danmaku: '彈幕',
  danmakuOn: '彈幕已開啟',
  danmakuOff: '彈幕已關閉',
  mute: '靜音',
  muted: '已靜音',
  unmuted: '已取消靜音',
  fullscreen: '全螢幕',
  pip: '子母畫面',
  pipUnsupported: '目前瀏覽器不支援子母畫面',
  pipFailed: '子母畫面啟動失敗',
  playerNotFound: '找不到播放器',
  shortcuts: '快速鍵',
  shortcutsTitle: '播放頁快速鍵',
  shortcutsHint: '按 ? 開啟或關閉說明，Esc 關閉',
  close: '關閉',
  playlistPanel: '播放清單',
  partsPanel: '選集',
  collectionPanel: '合集',
  playlistPosition: '{current} / {total}',
  playlistHint: '點項目切換影片；A 切換自動連播；Esc 關閉面板',
  partsHint: '點項目切換分P；Esc 關閉面板',
  collectionHint: '點項目切換合集影片；Esc 關閉面板',
  commentsToolbar: '評論增強',
  commentsSortHot: '最熱',
  commentsSortLatest: '最新',
  commentsSortUnavailable: '找不到原生評論排序',
  commentSortHotToast: '已按最熱排序',
  commentSortLatestToast: '已按最新排序',
  commentsOnlyUp: '只看 UP 主',
  commentsUpUnavailable: '找不到 UP 主標識，暫不能只看 UP',
  commentsOnlyUpOn: '只看 UP 主評論',
  commentsOnlyUpOff: '顯示全部評論',
  commentsExpand: '展開',
  recommendRailTitle: '推薦影片',
  recommendRailHint: '推薦影片軌道：← → 切換，Enter 在當前頁預覽，Ctrl/⌘+點擊 或 中鍵開新分頁',
  recommendRailPrev: '上一張',
  recommendRailNext: '下一張',
  recommendRailClose: '收起推薦軌道',
  autoplay: '自動連播',
  autoplayOn: '已開啟自動連播：播完自動切下一個',
  autoplayOff: '已關閉自動連播',
  autoplayUnavailable: '目前頁面沒有可用的「下一個」，無法自動連播',
  percent: '已跳到 {percent}%',
  shortcut: {
    seekBack: '後退 10 秒',
    seekForward: '前進 10 秒',
    playPause: '播放 / 暫停',
    back5: '後退 5 秒',
    forward5: '前進 5 秒',
    danmaku: '開關彈幕',
    mute: '靜音切換',
    fullscreen: '全螢幕',
    cinema: '影院模式',
    pip: '子母畫面',
    restore: '還原迷你播放器',
    prevEpisode: '上一集',
    nextEpisode: '下一集',
    prevItem: '上一個播放項目',
    nextItem: '下一個播放項目',
    prevVideo: '上一個影片',
    nextVideo: '下一個影片',
    autoplay: '自動連播開關',
    percent: '跳到 0%–90%',
    help: '開啟 / 關閉快速鍵說明',
    escape: '退出影院 / 關閉說明',
  },
}

const JYUT: VideoPageMessages = {
  ...CMN_TW,
  playlistHint: '撳項目切換影片；A 切換自動連播；Esc 關閉面板',
  partsHint: '撳項目切換分P；Esc 關閉面板',
  collectionHint: '撳項目切換合集影片；Esc 關閉面板',
  commentsToolbar: '評論增強',
  commentsSortHot: '最熱',
  commentsSortLatest: '最新',
  commentsSortUnavailable: '搵唔到原生評論排序',
  commentSortHotToast: '已按最熱排序',
  commentSortLatestToast: '已按最新排序',
  commentsOnlyUp: '淨係睇 UP 主',
  commentsUpUnavailable: '搵唔到 UP 主標記，暫時淨係睇唔到',
  commentsOnlyUpOn: '淨係顯示 UP 主評論',
  commentsOnlyUpOff: '顯示晒所有評論',
  commentsExpand: '打開',
  recommendRailHint: '推薦影片軌道：← → 切換，Enter 喺呢頁預覽，Ctrl/⌘+撳 或 中鍵開新分頁',
  recommendRailClose: '收埋推薦軌道',
  cinemaOn: '入咗影院模式，撳 Esc 退出',
  cinemaOff: '已經退出影院模式',
  restored: '還原咗播放器',
  danmakuOn: '彈幕開咗',
  danmakuOff: '彈幕熄咗',
  muted: '靜咗音',
  unmuted: '取消靜音喇',
  playerNotFound: '搵唔到播放器',
  shortcutsHint: '撳 ? 開或者關閉說明，Esc 關閉',
  autoplayOn: '開咗自動連播：播完自動切下一個',
  autoplayOff: '熄咗自動連播',
  autoplayUnavailable: '呢頁冇「下一個」可以用，連播唔到',
  percent: '跳咗去 {percent}%',
  shortcut: {
    seekBack: '後退 10 秒',
    seekForward: '前進 10 秒',
    playPause: '播放 / 暫停',
    back5: '後退 5 秒',
    forward5: '前進 5 秒',
    danmaku: '開關彈幕',
    mute: '靜音切換',
    fullscreen: '全螢幕',
    cinema: '影院模式',
    pip: '子母畫面',
    restore: '還原迷你播放器',
    prevEpisode: '上一集',
    nextEpisode: '下一集',
    prevItem: '上一個播放項目',
    nextItem: '下一個播放項目',
    prevVideo: '上一個影片',
    nextVideo: '下一個影片',
    autoplay: '自動連播開關',
    percent: '跳去 0%–90%',
    help: '開 / 關閉快速鍵說明',
    escape: '退出影院 / 關閉說明',
  },
}

/** 模块自建 i18n：四种语言键集合完全一致（缺键回退简中 / 英文，不会出现空串） */
export const MESSAGES: Record<ModuleLocale, VideoPageMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  jyut: JYUT,
  en: EN,
}

export function normalizeLanguage(language?: string): ModuleLocale {
  return resolveModuleLocale(language)
}

export function getMessages(language?: string): VideoPageMessages {
  return getModuleMessages<VideoPageMessages>(MESSAGES, resolveModuleLocale(language ?? settings.value.language), CMN_CN)
}

/** 响应 settings.language 的文案（切换语言后立即生效，不需要重建 UI） */
export function useMessages() {
  return computed(() => getMessages(settings.value.language))
}

export function formatPercent(template: string, percent: number): string {
  return template.replace('{percent}', String(percent))
}

export function formatPlaylistPosition(template: string, current: number, total: number): string {
  return template
    .replace('{current}', String(current))
    .replace('{total}', String(total))
}
