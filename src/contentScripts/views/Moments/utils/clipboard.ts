/**
 * 复制文本到剪贴板（纯只读操作，不调用任何写接口）。
 *
 * 优先 `navigator.clipboard`（需要安全上下文 + 用户手势），
 * 失败时回退到隐藏 textarea + `document.execCommand('copy')`，
 * 两者都失败返回 false，由调用方给「复制失败」反馈。
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text)
    return false

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  }
  catch {
    // 权限被拒绝 / 非安全上下文：继续走回退方案
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '-1000px'
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
