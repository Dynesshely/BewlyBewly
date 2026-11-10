/**
 * 从正文标题生成目录，并维护「当前章节」高亮。
 *
 * 只读取正文里的 h1/h2/h3，给它们打上模块自己的 data 属性；不改写 B 站 DOM 结构与类名。
 * 目录为空时（老文章不用语义化标题）整块目录 UI 隐藏（见 ui.tocItems.length）。
 */
import { TOC_INDEX_ATTR, TOC_TARGET_ATTR } from './constants'
import { getHeadingEls } from './dom'
import { ui } from './state'

/** 判定「已进入某章节」的视口阈值：标题顶边滚到这条线以上即算当前章节 */
const ACTIVE_THRESHOLD = 96

let headings: HTMLElement[] = []
let lastSignature = ''

function normalizeText(el: HTMLElement): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function clearMarks(): void {
  document.querySelectorAll<HTMLElement>(`[${TOC_TARGET_ATTR}]`).forEach((node) => {
    node.removeAttribute(TOC_TARGET_ATTR)
    node.removeAttribute(TOC_INDEX_ATTR)
  })
}

/**
 * 重新收集标题。
 *
 * 内容异步渲染 / 懒加载图片撑高页面时会被反复调用，因此用「标题文本签名」判定是否需要重建，
 * 避免每拍都写一遍 data 属性导致浏览器反复重排。
 */
export function syncToc(content: HTMLElement | null): void {
  const next = getHeadingEls(content)
  const signature = next.map(el => `${el.tagName}:${normalizeText(el)}`).join('|')

  if (signature === lastSignature && next.length === headings.length) {
    headings = next
    return
  }

  lastSignature = signature
  clearMarks()
  headings = next

  ui.tocItems = next.map((el, index) => {
    el.setAttribute(TOC_TARGET_ATTR, '')
    el.setAttribute(TOC_INDEX_ATTR, String(index))
    return {
      index,
      level: el.tagName.toLowerCase() === 'h3'
        ? 3
        : 2,
      text: normalizeText(el),
    }
  })

  if (!ui.tocItems.length)
    ui.tocOpen = false

  updateActiveToc()
}

/** 当前章节：最后一个「顶边已越过阈值」的标题 */
export function updateActiveToc(): void {
  if (!headings.length) {
    if (ui.activeTocIndex !== -1)
      ui.activeTocIndex = -1
    return
  }

  let active = -1
  for (let index = 0; index < headings.length; index++) {
    const top = headings[index].getBoundingClientRect().top
    if (top - ACTIVE_THRESHOLD <= 0)
      active = index
    else
      break
  }

  if (active !== ui.activeTocIndex)
    ui.activeTocIndex = active
}

/** 给跳转用的标题元素列表（与 ui.tocItems 的下标一一对应） */
export function getTocHeadings(): HTMLElement[] {
  return headings
}

export function clearToc(): void {
  clearMarks()
  headings = []
  lastSignature = ''
  ui.tocItems = []
  ui.activeTocIndex = -1
  ui.tocOpen = false
}
