/**
 * 评论输入框（第 83 轮）。
 *
 * 已登录：textarea + 字数计数（0/1000）+ 表情按钮 + 图片按钮 + 发布（Ctrl/Cmd+Enter 快捷发布）。
 * 未登录：由调用方渲染「登录后可以发评论 + 去登录」。
 * 表情：点按钮弹 `emotePanel`，选中后把 `[表情]` 文本插入光标处。
 */
import { showToast } from './actions'
import { insertAtCursor, openEmotePanel } from './emotePanel'

export const MAX_MESSAGE_LENGTH = 1000

export interface ComposerOptions {
  placeholder: string
  /** 内联回复样式（更紧凑） */
  compact?: boolean
  /** 额外 data 属性（内联回复用来带 rpid） */
  rpid?: string
  /** 内联回复需要「取消」按钮 */
  withCancel?: boolean
}

export function composerHtml(options: ComposerOptions): string {
  const { placeholder, compact = false, rpid = '', withCancel = false } = options
  const rpidAttr = rpid
    ? ` data-rpid="${rpid}"`
    : ''
  return `<form class="bvp-cmt__compose${compact ? ' bvp-cmt__compose--inline' : ' bvp-cmt__compose--main'}" data-action="compose"${rpidAttr} data-composer="1">
    <textarea class="bvp-cmt__input" maxlength="${MAX_MESSAGE_LENGTH}" rows="2" placeholder="${placeholder}"></textarea>
    <div class="bvp-cmt__compose-actions">
      <span class="bvp-cmt__count">0/${MAX_MESSAGE_LENGTH}</span>
      <button type="button" class="bvp-cmt__icon-btn" data-action="open-emote" title="表情">😊</button>
      <button type="button" class="bvp-cmt__icon-btn" data-action="attach-image" title="图片">🖼️</button>
      ${withCancel ? '<button type="button" class="bvp-cmt__cancel" data-action="cancel-reply">取消</button>' : ''}
      <button type="submit" class="bvp-cmt__submit" data-action="submit-compose">发布</button>
    </div>
  </form>`
}

/** 表情按钮：打开面板并插入到表单 textarea */
export async function openEmoteForForm(form: HTMLElement): Promise<void> {
  const textarea = form.querySelector<HTMLTextAreaElement>('.bvp-cmt__input')
  if (!textarea)
    return
  await openEmotePanel(form, text => insertAtCursor(textarea, text))
}

/** 图片按钮：本轮未接上传，给出明确提示而不是静默失败 */
export function handleAttachImage(): void {
  showToast('图片评论暂未支持，可先用 B 站原生评论区上传')
}

/** 字数计数同步（input 事件里调用） */
export function syncCount(textarea: HTMLTextAreaElement): void {
  const counter = textarea.parentElement?.querySelector('.bvp-cmt__count')
  if (counter)
    counter.textContent = `${textarea.value.length}/${MAX_MESSAGE_LENGTH}`
}

/** 提交后重置表单（清空输入与计数） */
export function resetComposer(form: HTMLElement): void {
  const textarea = form.querySelector<HTMLTextAreaElement>('.bvp-cmt__input')
  if (textarea) {
    textarea.value = ''
    syncCount(textarea)
  }
}
