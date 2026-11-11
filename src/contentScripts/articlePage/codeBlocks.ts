/**
 * 正文代码块「复制」按钮。
 *
 * 纯 JS 注入原生 <button>（不包 wrapper、不改 B 站 DOM 结构），按钮本身由
 * 页面级样式（articlePage.page.scss）定位到代码块右上角：
 *   - 默认透明 + pointer-events: none，hover / focus / Tab 聚焦时才出现，不挡文字选择；
 *   - 复制成功按钮变「已复制」，1.5 秒后恢复；失败静默（不弹 toast、不报错）；
 *   - 没有 <pre> 的页面不会插入任何节点。
 *
 * 语言：按钮文案在注入 / 复制成功时按当前模块语言取，切换语言后的旧按钮文案
 * 在下一次 sync 注入新按钮前保持原样（见 docs/article-page.md 已知限制）。
 */
import { CODE_BLOCK_ATTR, CODE_COPY_ATTR } from './constants'
import { getPreBlocks } from './dom'
import { getMessages } from './i18n'

/** 每个按钮的「已复制」回退计时器，避免多次点击叠计时 */
const resetTimers = new WeakMap<HTMLButtonElement, number>()
/** 复制成功标记保持时长 */
const COPIED_DURATION = 1500

let clickHandler: ((event: MouseEvent) => void) | null = null

/** 给正文里所有 <pre> 补复制按钮（幂等：已有按钮的代码块直接跳过） */
export function syncCodeBlocks(content: HTMLElement | null): void {
  const preBlocks = getPreBlocks(content)
  if (!preBlocks.length)
    return

  const messages = getMessages()
  for (const pre of preBlocks) {
    pre.setAttribute(CODE_BLOCK_ATTR, '')
    if (pre.querySelector(`[${CODE_COPY_ATTR}]`))
      continue

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'bap-code-copy'
    button.setAttribute(CODE_COPY_ATTR, '')
    button.textContent = messages.codeCopy
    button.setAttribute('aria-label', messages.codeCopy)
    pre.appendChild(button)
  }
}

function handleClick(event: MouseEvent): void {
  const target = event.target
  if (!(target instanceof Element))
    return

  const button = target.closest(`[${CODE_COPY_ATTR}]`)
  if (!(button instanceof HTMLButtonElement))
    return

  event.preventDefault()
  event.stopPropagation()
  void copyCodeBlock(button)
}

/** 绑定按钮点击（捕获阶段；按钮在 B 站原生 DOM 里，避免被页面自己的点击处理吞掉） */
export function setupCodeCopy(): () => void {
  clickHandler = handleClick
  document.addEventListener('click', clickHandler, true)
  return () => {
    if (clickHandler)
      document.removeEventListener('click', clickHandler, true)
    clickHandler = null
  }
}

async function copyCodeBlock(button: HTMLButtonElement): Promise<void> {
  const pre = button.closest('pre')
  if (!pre)
    return

  // 优先取 <code> 的文本；没有 <code> 时用克隆节点，避免把注入的按钮文案也复制进去
  const code = pre.querySelector('code')
  let text = (code?.textContent ?? '').replace(/\n$/, '')
  if (!text) {
    const clone = pre.cloneNode(true) as HTMLElement
    clone.querySelectorAll(`[${CODE_COPY_ATTR}]`).forEach(button => button.remove())
    text = (clone.textContent ?? '').replace(/\n$/, '')
  }
  if (!text)
    return

  const ok = await copyText(text)
  // 失败静默：按钮保持原样，不打扰阅读
  if (!ok)
    return

  const messages = getMessages()
  button.textContent = messages.codeCopied
  button.setAttribute('aria-label', messages.codeCopied)
  button.dataset.copied = 'true'

  const existing = resetTimers.get(button)
  if (existing !== undefined)
    window.clearTimeout(existing)
  const timer = window.setTimeout(() => {
    resetTimers.delete(button)
    button.textContent = getMessages().codeCopy
    button.setAttribute('aria-label', getMessages().codeCopy)
    delete button.dataset.copied
  }, COPIED_DURATION)
  resetTimers.set(button, timer)
}

/** Clipboard API 优先，失败回退到隐藏 textarea（与 list 页的复制工具思路一致） */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  }
  catch {
    // 继续走回退方案
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '0'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const succeeded = document.execCommand('copy')
    textarea.remove()
    return succeeded
  }
  catch {
    return false
  }
}

/** 卸载时移除所有注入的按钮与标记 */
export function cleanupCodeBlocks(): void {
  document.querySelectorAll<HTMLButtonElement>(`[${CODE_COPY_ATTR}]`).forEach((button) => {
    const timer = resetTimers.get(button)
    if (timer !== undefined)
      window.clearTimeout(timer)
    resetTimers.delete(button)
    button.remove()
  })
  document.querySelectorAll<HTMLElement>(`[${CODE_BLOCK_ATTR}]`).forEach((pre) => {
    pre.removeAttribute(CODE_BLOCK_ATTR)
  })
}
