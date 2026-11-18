import type { ModuleLocale } from '~/utils/moduleI18n'
import { computed } from 'vue'
import { settings } from '~/logic'
import { getModuleMessages, resolveModuleLocale } from '~/utils/moduleI18n'

/**
 * 「回到顶部 / 回到底部」浮动按钮的模块内文案。
 *
 * 按项目约定不写进 `src/_locales`（那是 Lead 的写入范围），四种模块语言：
 * cmn-CN / cmn-TW / jyut / en，语言解析统一走 `~/utils/moduleI18n`。
 */
export interface BackToTopMessages {
  /** 回到顶部（按钮 aria-label / title 主体） */
  backToTop: string
  /** 回到顶部的补充说明（title 第二段，教用户这个按钮什么时候出现） */
  backToTopHint: string
  /** 回到底部 */
  backToBottom: string
  backToBottomHint: string
}

const CMN_CN: BackToTopMessages = {
  backToTop: '回到顶部',
  backToTopHint: '滚过两屏后出现，点击平滑回到顶部',
  backToBottom: '回到底部',
  backToBottomHint: '滚回两屏以上时出现',
}

const CMN_TW: BackToTopMessages = {
  backToTop: '回到頂部',
  backToTopHint: '滾過兩屏後出現，點擊平滑回到頂部',
  backToBottom: '回到最底',
  backToBottomHint: '滾返兩屏以上先會出現',
}

const JYUT: BackToTopMessages = {
  ...CMN_TW,
  backToTopHint: '滾過兩屏先會出現，撳一下平滑返到頂部',
  backToBottom: '去到最底',
  backToBottomHint: '滾返兩屏以上先會出現',
}

const EN: BackToTopMessages = {
  backToTop: 'Back to top',
  backToTopHint: 'Appears after scrolling two screens; click to glide back to the top',
  backToBottom: 'Back to bottom',
  backToBottomHint: 'Appears after scrolling up two screens',
}

const MESSAGES: Record<ModuleLocale, BackToTopMessages> = {
  'cmn-CN': CMN_CN,
  'cmn-TW': CMN_TW,
  jyut: JYUT,
  en: EN,
}

/** 响应 settings.language 的文案（切语言后立即生效） */
export function useBackToTopMessages() {
  const t = computed(() =>
    getModuleMessages<BackToTopMessages>(MESSAGES, resolveModuleLocale(settings.value.language), CMN_CN),
  )
  return { t }
}
