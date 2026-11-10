/**
 * 动态页模块内 i18n。
 *
 * 只服务 `views/Moments/**`，不触碰全局 `src/_locales`。
 * 四种模块语言：cmn-CN 简中 / cmn-TW 繁体 / jyut 繁体（粤语词）/ en 英文，
 * 语言解析统一走 `~/utils/moduleI18n`（见 docs/i18n-modules.md）。
 */
import type { MomentCardType } from './types'
import type { ModuleLocale } from '~/utils/moduleI18n'
import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

import { formatCount, formatRelativeTime, typeMessageKey } from './utils/format'

export type MomentsLocale = ModuleLocale

const CMN_CN = {
  page_title: '动态',
  page_subtitle: '关注时间线 · 视频 / 图文 / 转发 / 专栏 / 直播',
  page_badge: '全部动态',
  refresh: '刷新',
  refresh_hint: '重新拉取最新动态',
  open_native: '原生动态页',
  count_loaded: '已加载 {n} 条',
  keyboard_title: '键盘操作',
  keyboard_hint_bar: 'j / k 或 ↑ / ↓ 切换卡片 · o 打开原动态 · Esc 取消高亮',
  density_title: '卡片密度',
  density_comfortable: '舒适',
  density_compact: '紧凑',
  filter_video_only: '只看视频',
  filter_video_hint: '仅显示视频 / 番剧卡片，j / k 仍可切换',
  filter_empty_title: '当前筛选下还没有视频动态',
  filter_empty_desc: '这一屏还没有视频或番剧卡片，关闭筛选可以看全部动态',
  filter_clear: '关闭「只看视频」',
  optimize: '离屏优化',
  optimize_on: '已开启：只渲染视口附近的卡片，滚动到附近时其余卡片才渲染（可在本按钮关闭）',
  optimize_off: '已关闭：所有卡片全部渲染（长列表更吃性能）',
  loading_more: '正在加载更多…',
  load_failed: '动态加载失败',
  load_more_failed: '加载更多失败',
  retry: '重试',
  load_more: '加载更多',
  no_more: '没有更多动态了',
  empty_title: '还没有动态',
  empty_desc: '关注的 UP 主最近没有更新，或者你还没有登录 B 站',
  login_required: '动态流需要登录 B 站后才能加载',
  type_video: '视频',
  type_images: '图文',
  type_text: '动态',
  type_forward: '转发',
  type_article: '专栏',
  type_live: '直播',
  type_pgc: '番剧',
  type_unknown: '动态',
  open_original: '打开原动态',
  expand: '展开',
  collapse: '收起',
  origin_deleted: '原动态已删除',
  stat_forward: '转发',
  stat_comment: '评论',
  like: '点赞',
  like_cancel: '取消点赞',
  liked: '已点赞',
  like_cancelled: '已取消点赞',
  like_failed: '点赞失败，请稍后重试',
  like_login_required: '需要先登录 B 站才能点赞',
  play_count: '{n} 播放',
  danmaku_count: '{n} 弹幕',
  live_badge: '直播中',
  live_offline: '未开播',
  live_online: '{n} 人在看',
  article_badge: '专栏',
  image_alt: '第 {n} 张图片',
  avatar_alt: '{name} 的头像',
  media_open_hint: '打开视频',
  copy_text: '复制正文',
  copied: '已复制',
  copy_failed: '复制失败',
  lightbox_close: '关闭',
  lightbox_prev: '上一张',
  lightbox_next: '下一张',
  lightbox_counter: '{current} / {total}',
  lightbox_hint: 'Esc 关闭 · ← / → 切换',
  lightbox_download: '下载图片',
  lightbox_downloading: '下载中…',
  lightbox_download_failed: '下载失败，已在新标签页打开原图',
  just_now: '刚刚',
  minutes_ago: '{n} 分钟前',
  hours_ago: '{n} 小时前',
  days_ago: '{n} 天前',
  date_at: '{date}',
} as const

export type MomentsMessageKey = keyof typeof CMN_CN
type MomentsDict = Record<MomentsMessageKey, string>

const CMN_TW: MomentsDict = {
  page_title: '動態',
  page_subtitle: '關注時間軸 · 影片 / 圖文 / 轉發 / 專欄 / 直播',
  page_badge: '全部動態',
  refresh: '重新整理',
  refresh_hint: '重新拉取最新動態',
  open_native: '原生動態頁',
  count_loaded: '已載入 {n} 條',
  keyboard_title: '鍵盤操作',
  keyboard_hint_bar: 'j / k 或 ↑ / ↓ 切換卡片 · o 打開原動態 · Esc 取消高亮',
  density_title: '卡片密度',
  density_comfortable: '舒適',
  density_compact: '緊湊',
  filter_video_only: '只看影片',
  filter_video_hint: '僅顯示影片 / 番劇卡片，j / k 仍可切換',
  filter_empty_title: '目前篩選下還沒有影片動態',
  filter_empty_desc: '這一屏還沒有影片或番劇卡片，關閉篩選可以看全部動態',
  filter_clear: '關閉「只看影片」',
  optimize: '離屏最佳化',
  optimize_on: '已開啟：只渲染視口附近的卡片，捲動到附近時其餘卡片才渲染（可在本按鈕關閉）',
  optimize_off: '已關閉：所有卡片全部渲染（長清單更吃效能）',
  loading_more: '正在載入更多…',
  load_failed: '動態載入失敗',
  load_more_failed: '載入更多失敗',
  retry: '重試',
  load_more: '載入更多',
  no_more: '沒有更多動態了',
  empty_title: '還沒有動態',
  empty_desc: '關注的 UP 主最近沒有更新，或者你還沒有登入 B 站',
  login_required: '動態流需要登入 B 站後才能載入',
  type_video: '影片',
  type_images: '圖文',
  type_text: '動態',
  type_forward: '轉發',
  type_article: '專欄',
  type_live: '直播',
  type_pgc: '番劇',
  type_unknown: '動態',
  open_original: '打開原動態',
  expand: '展開',
  collapse: '收合',
  origin_deleted: '原動態已刪除',
  stat_forward: '轉發',
  stat_comment: '留言',
  like: '按讚',
  like_cancel: '取消按讚',
  liked: '已按讚',
  like_cancelled: '已取消按讚',
  like_failed: '按讚失敗，請稍後重試',
  like_login_required: '需要先登入 B 站才能按讚',
  play_count: '{n} 播放',
  danmaku_count: '{n} 彈幕',
  live_badge: '直播中',
  live_offline: '未開播',
  live_online: '{n} 人正在看',
  article_badge: '專欄',
  image_alt: '第 {n} 張圖片',
  avatar_alt: '{name} 的頭像',
  media_open_hint: '打開影片',
  copy_text: '複製正文',
  copied: '已複製',
  copy_failed: '複製失敗',
  lightbox_close: '關閉',
  lightbox_prev: '上一張',
  lightbox_next: '下一張',
  lightbox_counter: '{current} / {total}',
  lightbox_hint: 'Esc 關閉 · ← / → 切換',
  lightbox_download: '下載圖片',
  lightbox_downloading: '下載中…',
  lightbox_download_failed: '下載失敗，已在新分頁打開原圖',
  just_now: '剛剛',
  minutes_ago: '{n} 分鐘前',
  hours_ago: '{n} 小時前',
  days_ago: '{n} 天前',
  date_at: '{date}',
}

const JYUT: MomentsDict = {
  ...CMN_TW,
  refresh: '重新整理',
  refresh_hint: '再拉最新動態',
  count_loaded: '載入咗 {n} 條',
  keyboard_hint_bar: 'j / k 或者 ↑ / ↓ 切換卡片 · o 打開原動態 · Esc 取消高亮',
  filter_video_only: '淨係睇影片',
  filter_video_hint: '淨係顯示影片 / 番劇卡片，j / k 一樣用得',
  filter_empty_title: '呢個篩選下仲未有影片動態',
  filter_empty_desc: '呢一屏仲未有影片或者番劇卡片，收埋篩選就睇到全部動態',
  filter_clear: '收埋「淨係睇影片」',
  optimize: '離屏最佳化',
  optimize_on: '開咗：淨係渲染視口附近嘅卡片，捲到附近先渲染其餘卡片（可以喺呢個掣閂返）',
  optimize_off: '閂咗：所有卡片全部渲染（長清單食效能啲）',
  loading_more: '載入緊更多…',
  load_failed: '動態載入失敗',
  load_more_failed: '載入更多失敗',
  retry: '再試',
  load_more: '載入更多',
  no_more: '冇更多動態喇',
  empty_title: '仲未有動態',
  empty_desc: '你關注嘅 UP 主最近冇更新，或者你仲未登入 B 站',
  login_required: '要登入 B 站先載入到動態流',
  origin_deleted: '原動態刪咗',
  like: '讚好',
  like_cancel: '取消讚好',
  liked: '讚好咗',
  like_cancelled: '取消讚好咗',
  like_failed: '讚好失敗，轉頭再試',
  like_login_required: '要登入 B 站先讚到好',
  copy_text: '複製正文',
  copied: '複製咗',
  copy_failed: '複製唔到',
  lightbox_download_failed: '下載唔到，喺新分頁開咗原圖',
  just_now: '啱啱',
  minutes_ago: '{n} 分鐘前',
  hours_ago: '{n} 個鐘前',
  days_ago: '{n} 日前',
  media_open_hint: '開影片',
  expand: '展開',
  collapse: '收埋',
}

const EN: MomentsDict = {
  page_title: 'Moments',
  page_subtitle: 'Following feed · videos, photos, reposts, articles and live',
  page_badge: 'All moments',
  refresh: 'Refresh',
  refresh_hint: 'Fetch the latest moments',
  open_native: 'Native moments',
  count_loaded: '{n} loaded',
  keyboard_title: 'Keyboard',
  keyboard_hint_bar: 'j / k or ↑ / ↓ to move · o to open the original post · Esc to clear',
  density_title: 'Card density',
  density_comfortable: 'Comfortable',
  density_compact: 'Compact',
  filter_video_only: 'Videos only',
  filter_video_hint: 'Only video / bangumi cards; j / k still works',
  filter_empty_title: 'No videos under this filter',
  filter_empty_desc: 'This batch has no video or bangumi cards yet. Turn the filter off to see every moment.',
  filter_clear: 'Turn off "Videos only"',
  optimize: 'Off-screen',
  optimize_on: 'On: only cards near the viewport are rendered; others render when you scroll close',
  optimize_off: 'Off: every card is rendered — heavier on long feeds',
  loading_more: 'Loading more…',
  load_failed: 'Failed to load moments',
  load_more_failed: 'Failed to load more moments',
  retry: 'Retry',
  load_more: 'Load more',
  no_more: 'No more moments',
  empty_title: 'Nothing here yet',
  empty_desc: 'The creators you follow have not posted recently, or you are not signed in',
  login_required: 'Sign in to Bilibili to load your moments feed',
  type_video: 'Video',
  type_images: 'Photos',
  type_text: 'Post',
  type_forward: 'Repost',
  type_article: 'Article',
  type_live: 'Live',
  type_pgc: 'Bangumi',
  type_unknown: 'Post',
  open_original: 'Open original',
  expand: 'Expand',
  collapse: 'Collapse',
  origin_deleted: 'The original post was deleted',
  stat_forward: 'Reposts',
  stat_comment: 'Comments',
  like: 'Like',
  like_cancel: 'Unlike',
  liked: 'Liked',
  like_cancelled: 'Like removed',
  like_failed: 'Failed to like, please retry later',
  like_login_required: 'Sign in to Bilibili to like',
  play_count: '{n} views',
  danmaku_count: '{n} danmaku',
  live_badge: 'LIVE',
  live_offline: 'Offline',
  live_online: '{n} watching',
  article_badge: 'Article',
  image_alt: 'Image {n}',
  avatar_alt: 'Avatar of {name}',
  media_open_hint: 'Open video',
  copy_text: 'Copy text',
  copied: 'Copied',
  copy_failed: 'Copy failed',
  lightbox_close: 'Close',
  lightbox_prev: 'Previous',
  lightbox_next: 'Next',
  lightbox_counter: '{current} / {total}',
  lightbox_hint: 'Esc to close · ← / → to switch',
  lightbox_download: 'Download image',
  lightbox_downloading: 'Downloading…',
  lightbox_download_failed: 'Download failed, opened the original image instead',
  just_now: 'just now',
  minutes_ago: '{n} min ago',
  hours_ago: '{n} h ago',
  days_ago: '{n} d ago',
  date_at: '{date}',
}

/** 四种语言键集合完全一致（缺键回退简中 / 英文，不会出现空串） */
export const MESSAGES: Record<ModuleLocale, MomentsDict> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  jyut: JYUT,
  en: EN,
}

export const NATIVE_MOMENTS_URL = 'https://t.bilibili.com'

export function resolveMomentsLocale(language?: string): MomentsLocale {
  return resolveModuleLocale(language)
}

export function useMomentsI18n() {
  const locale = computed<MomentsLocale>(() => resolveMomentsLocale(settings.value.language))

  function t(key: MomentsMessageKey, params?: Record<string, string | number>): string {
    const dict = getModuleMessages<MomentsDict>(MESSAGES, locale.value, CMN_CN)
    let text: string = dict[key] ?? CMN_CN[key] ?? key
    if (params) {
      for (const [name, value] of Object.entries(params))
        text = text.replaceAll(`{${name}}`, String(value))
    }
    return text
  }

  /** 卡片类型文案 */
  function typeLabel(type: MomentCardType): string {
    return t(typeMessageKey(type))
  }

  /** 紧凑数字：12345 → 1.2万 / 12.3K */
  function count(value: number | string | undefined): string {
    return formatCount(value, locale.value)
  }

  /** 相对时间：3 小时前 / 3 h ago */
  function time(timestamp: number): string {
    return formatRelativeTime(timestamp, t)
  }

  return { t, locale, typeLabel, count, time }
}
