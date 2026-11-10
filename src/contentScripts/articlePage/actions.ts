/**
 * 阅读模式的行为层：所有对页面 / 状态的写操作都收敛在这里。
 *
 * 只做三件事：改 <html> 上的类名与属性、滚动页面、显示提示；
 * 不直接碰 B 站 DOM 结构（只读取 + 加自己的 data 属性）。
 */
import {
  CONTENT_ATTR,
  FONT_STEP_ATTR,
  ROOT_CLASS_READING,
} from './constants'
import { getContentEl, markContentEl, prefersReducedMotion } from './dom'
import { fontStepLabel, formatTemplate, getMessages } from './i18n'
import {
  readStoredFontStep,
  storeFontStep,
  storeReading,
  storeTocOpen,
} from './preferences'
import { FONT_STEPS, ui } from './state'

let toastTimer: number | null = null

function messages() {
  return getMessages()
}

export function showToast(message: string): void {
  ui.toast = message
  if (toastTimer !== null)
    window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastTimer = null
    ui.toast = ''
  }, 1900)
}

export function clearToast(): void {
  if (toastTimer !== null) {
    window.clearTimeout(toastTimer)
    toastTimer = null
  }
  ui.toast = ''
}

/**
 * 从 sessionStorage 恢复字号。
 *
 * 阅读模式不在这里恢复：必须等正文容器确认存在后再进（见 index.ts 的 sync），
 * 否则正文没渲染出来就先隐藏侧栏 / 评论，会得到一个空白页面。
 */
export function restorePreferences(): void {
  ui.fontStep = readStoredFontStep()
  applyFontStep(ui.fontStep)
}

/** 正文字号三档：写到 <html data-bewly-font-step>，由页面样式换算 --bap-font-size */
export function applyFontStep(step: typeof FONT_STEPS[number]): void {
  document.documentElement.setAttribute(FONT_STEP_ATTR, step)
}

export function setFontStep(step: typeof FONT_STEPS[number], options: { silent?: boolean } = {}): void {
  if (!FONT_STEPS.includes(step))
    return
  if (ui.fontStep === step && options.silent) {
    applyFontStep(step)
    return
  }
  ui.fontStep = step
  storeFontStep(step)
  applyFontStep(step)
  if (!options.silent) {
    const t = messages()
    showToast(formatTemplate(t.fontChanged, {
      step: fontStepLabel(t, step),
    }))
  }
}

function stepFont(delta: number): void {
  const index = FONT_STEPS.indexOf(ui.fontStep)
  const next = FONT_STEPS[Math.min(FONT_STEPS.length - 1, Math.max(0, index + delta))]
  if (!next)
    return
  // 已经在边界时也给个提示，避免用户以为按键没生效
  if (next === ui.fontStep) {
    const t = messages()
    showToast(formatTemplate(t.fontChanged, {
      step: fontStepLabel(t, next),
    }))
    return
  }
  setFontStep(next)
}

export function increaseFont(): void {
  stepFont(1)
}

export function decreaseFont(): void {
  stepFont(-1)
}

/**
 * 沉浸阅读开关。
 *
 * 进入时给 <html> 加类名，页面级样式（模块内注入）据此隐藏侧栏 / 推荐 / 评论锚点，
 * 并把正文限制在 720px、换成降噪背景；退出时移除。
 */
export function setReading(on: boolean, options: { silent?: boolean } = {}): void {
  // 没找到正文容器时不允许进入（否则会先把侧栏 / 评论藏掉，得到一个空白页）
  if (on && !getContentEl()) {
    ui.ready = false
    if (!options.silent)
      showToast(messages().noContent)
    return
  }

  if (ui.reading === on) {
    document.documentElement.classList.toggle(ROOT_CLASS_READING, on)
    return
  }

  ui.reading = on
  document.documentElement.classList.toggle(ROOT_CLASS_READING, on)
  storeReading(on)

  if (on) {
    // 确保正文容器已打标记（进入阅读模式前页面可能刚完成渲染）
    const content = getContentEl()
    markContentEl(content)
    if (content)
      ui.ready = true
  }

  // 布局变了（侧栏消失 / 正文变窄），滚动进度要立刻重算
  updateProgress()

  if (!options.silent) {
    const t = messages()
    showToast(on ? t.readingOn : t.readingOff)
  }
}

export function toggleReading(): void {
  setReading(!ui.reading)
}

/** 目录浮层开关（sessionStorage 记住，刷新后保持展开状态） */
export function setTocOpen(on: boolean): void {
  if (ui.tocOpen === on)
    return
  ui.tocOpen = on
  storeTocOpen(on)
}

export function toggleToc(): void {
  setTocOpen(!ui.tocOpen)
}

export function scrollToTop(): void {
  window.scrollTo({
    top: 0,
    behavior: prefersReducedMotion()
      ? 'auto'
      : 'smooth',
  })
  showToast(messages().backToTopDone)
}

/**
 * 平滑滚动到第 index 个标题。
 *
 * 用 window.scrollTo 而不是 scrollIntoView：后者会连带横向滚动，且受滚动容器影响；
 * 这里只需要纵向定位，并给吸顶头留出 88px 空间（与页面样式里的 scroll-margin-top 一致）。
 */
export function jumpToHeading(index: number, headings: HTMLElement[]): void {
  const target = headings[index]
  if (!target)
    return
  const top = Math.max(0, window.scrollY + target.getBoundingClientRect().top - 88)
  window.scrollTo({
    top,
    behavior: prefersReducedMotion()
      ? 'auto'
      : 'smooth',
  })
  // 焦点交给标题：键盘 / 读屏用户跳转后位置明确，且不影响页面滚动
  if (!target.hasAttribute('tabindex'))
    target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
}

/** 阅读进度（0–100 整数）：以 documentElement 的可滚动高度为准 */
export function updateProgress(): void {
  const doc = document.documentElement
  const scrollable = doc.scrollHeight - window.innerHeight
  if (scrollable <= 40) {
    ui.progress = 0
    ui.showProgress = false
    return
  }
  ui.showProgress = true
  const ratio = window.scrollY / scrollable
  ui.progress = Math.min(100, Math.max(0, Math.round(ratio * 100)))
}

/** 退出时清理写到页面上的所有痕迹（卸载 / 离开文章页） */
export function cleanupPageHooks(): void {
  document.documentElement.classList.remove(ROOT_CLASS_READING)
  document.documentElement.removeAttribute(FONT_STEP_ATTR)
  document.querySelectorAll<HTMLElement>(`[${CONTENT_ATTR}]`).forEach((node) => {
    node.removeAttribute(CONTENT_ATTR)
  })
  clearToast()
}
