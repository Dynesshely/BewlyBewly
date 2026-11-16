import type { ModuleLocale } from '~/utils/moduleI18n'
import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

/** 动态页自绘层自己产出的文案（原生已带文案的部分保持原样，不重复翻译） */
export interface DrawnMomentsMessages {
  expand: string
  collapse: string
  forward: string
  comment: string
  like: string
  liked: string
  video: string
  reserve: string
  viewImage: string
  openVideo: string
}

const CMN_CN: DrawnMomentsMessages = {
  expand: '展开',
  collapse: '收起',
  forward: '转发',
  comment: '评论',
  like: '点赞',
  liked: '取消点赞',
  video: '视频',
  reserve: '直播预约',
  viewImage: '查看原图',
  openVideo: '打开视频',
}

const CMN_TW: DrawnMomentsMessages = {
  expand: '展開',
  collapse: '收合',
  forward: '轉發',
  comment: '留言',
  like: '按讚',
  liked: '取消按讚',
  video: '影片',
  reserve: '直播預約',
  viewImage: '查看原圖',
  openVideo: '打開影片',
}

const JYUT: DrawnMomentsMessages = {
  ...CMN_TW,
  expand: '展開',
  collapse: '收埋',
  like: '讚好',
  liked: '取消讚好',
}

const EN: DrawnMomentsMessages = {
  expand: 'Expand',
  collapse: 'Collapse',
  forward: 'Repost',
  comment: 'Comment',
  like: 'Like',
  liked: 'Unlike',
  video: 'Video',
  reserve: 'Live reservation',
  viewImage: 'View original image',
  openVideo: 'Open video',
}

const MESSAGES: Record<ModuleLocale, DrawnMomentsMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  'jyut': JYUT,
  'en': EN,
}

export function useDrawnMomentsI18n() {
  const locale = computed<ModuleLocale>(() => resolveModuleLocale(settings.value.language))
  const t = computed<DrawnMomentsMessages>(() => getModuleMessages(MESSAGES, locale.value, CMN_CN))
  return { t }
}
