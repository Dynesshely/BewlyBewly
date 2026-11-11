/**
 * 专栏 / 文章页（`bilibili.com/read/*`、`bilibili.com/opus/*`）的 DOM 适配层。
 *
 * 这里集中所有「依赖 B 站页面结构」的查询，页面改版时只需要改这一处。
 * 选择器来源：仓库既有 `src/styles/adaptedStyles/pages/articlesPage.scss`（专栏页）
 * 与 `momentsPage.scss`（opus 详情）里本来就在使用的类名，没有凭空新造类名：
 *   - 专栏：.article-container / .article-container__content / .title-container
 *           .normal-article-holder / .read-article-holder / .right-side-bar /
 *           .side-toolbar / .fixed-top-header / .comment-wrapper / .reply-box
 *   - opus：.opus-detail / .opus-module-content / .side-toolbar / .fixed-author-header
 *
 * 每条查询都带候选列表并允许返回 null —— 文章页是异步渲染的，结构也可能随上游改版。
 * 找不到正文容器时整块 UI 降级隐藏（见 index.ts 的 sync）。
 */
import { CONTENT_ATTR } from './constants'

/** 专栏详情页：/read/cv123456 与 /read/123456 */
const READ_ARTICLE_URL_RE = /^https?:\/\/(?:www\.)?bilibili\.com\/read\/(?:cv)?\d+/i
/** 专栏移动版：/read/mobile?id=123456 */
const READ_MOBILE_URL_RE = /^https?:\/\/(?:www\.)?bilibili\.com\/read\/mobile/i
/** 图文详情页：/opus/123456789 */
const OPUS_URL_RE = /^https?:\/\/(?:www\.)?bilibili\.com\/opus\/\d+/i

export type ArticlePageKind = 'read' | 'opus'

/** 正文容器的候选选择器（从最具体的正文容器逐级退化到外层卡片） */
const CONTENT_SELECTORS = [
  // 专栏
  '.article-container .normal-article-holder',
  '.article-container .read-article-holder',
  '.normal-article-holder',
  '.read-article-holder',
  '.article-container__content .article-holder',
  '.article-container__content',
  // opus 图文详情
  '.opus-detail .opus-module-content',
  '.opus-module-content',
  '.opus-detail',
]

/** 正文标题的候选选择器（目前只用于 aria-label，读不到就用 document.title） */
const TITLE_SELECTORS = [
  '.article-container .title-container .title',
  '.normal-article-holder .article-title',
  '.opus-detail .opus-module-title',
  '.opus-module-title',
  '.article-title',
]

const EDITABLE_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
].join(', ')

export function getArticlePageKind(url: string = location.href): ArticlePageKind | null {
  if (OPUS_URL_RE.test(url))
    return 'opus'
  if (READ_ARTICLE_URL_RE.test(url) || READ_MOBILE_URL_RE.test(url))
    return 'read'
  return null
}

export function isArticlePage(url: string = location.href): boolean {
  return getArticlePageKind(url) !== null
}

/**
 * 正文容器。
 *
 * 返回第一个「有实际文字」的候选，避免把占位骨架当成正文；
 * 全都命中不了时返回 null，调用方据此隐藏阅读增强。
 */
export function getContentEl(): HTMLElement | null {
  for (const selector of CONTENT_SELECTORS) {
    const el = document.querySelector<HTMLElement>(selector)
    if (!el)
      continue
    const text = (el.textContent ?? '').trim()
    if (text.length >= 80)
      return el
  }
  return null
}

/** 给正文容器打上模块自己的标记，页面级样式靠这个属性定位（不改 B 站类名） */
export function markContentEl(el: HTMLElement | null): void {
  document.querySelectorAll<HTMLElement>(`[${CONTENT_ATTR}]`).forEach((node) => {
    if (node !== el)
      node.removeAttribute(CONTENT_ATTR)
  })
  if (el && !el.hasAttribute(CONTENT_ATTR))
    el.setAttribute(CONTENT_ATTR, '')
}

export function getArticleTitle(): string {
  for (const selector of TITLE_SELECTORS) {
    const text = document.querySelector<HTMLElement>(selector)?.textContent?.trim()
    if (text)
      return text
  }
  return document.title.replace(/[_|-]?哔哩哔哩.*$/, '').trim()
}

/**
 * 正文里的标题元素。
 *
 * 专栏正文里标题通常是 h2 / h3（少数老文章用 h1），opus 用 h2 / h3，
 * 因此按 h1–h3 收集后把 h1 也当作一级标题处理。隐藏元素（offsetParent 为 null）跳过。
 */
export function getHeadingEls(content: HTMLElement | null): HTMLElement[] {
  if (!content)
    return []
  const nodes = Array.from(content.querySelectorAll<HTMLElement>('h1, h2, h3'))
  const seen = new Set<string>()
  return nodes.filter((node) => {
    if (node.offsetParent === null && node.getClientRects().length === 0)
      return false
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (!text || text.length > 120)
      return false
    // 嵌套标题（h2 里套 h3 之类）只保留最外层
    if (node.parentElement?.closest('h1, h2, h3'))
      return false
    if (seen.has(text))
      return false
    seen.add(text)
    return true
  })
}

/** 正文里可放大的图片（跳过没有地址 / 过小的表情与占位图） */
export function getContentImages(content: HTMLElement | null): HTMLImageElement[] {
  if (!content)
    return []
  return Array.from(content.querySelectorAll<HTMLImageElement>('img'))
    .filter((img) => {
      const src = img.currentSrc || img.src
      if (!src)
        return false
      // 懒加载还没真正加载完的图没有 naturalWidth，点击前一般已经加载，这里再兜一层
      return img.naturalWidth === 0 || img.naturalWidth >= 200
    })
}

/** 图片地址（优先 currentSrc，兼容 srcset） */
export function getImageSrc(img: HTMLImageElement): string {
  return img.currentSrc || img.src
}

/** 正文里的代码块 */
export function getPreBlocks(content: HTMLElement | null): HTMLElement[] {
  if (!content)
    return []
  return Array.from(content.querySelectorAll<HTMLElement>('pre'))
}

/** 事件是否发生在输入框 / 可编辑区域里 */
export function isEditableEvent(event: KeyboardEvent): boolean {
  for (const node of event.composedPath()) {
    if (!(node instanceof HTMLElement))
      continue
    if (node.isContentEditable || node.matches?.(EDITABLE_SELECTOR))
      return true
  }
  return false
}

/** 事件是否来自 Bewly 自己的 UI（本模块浮层或 #bewly 主应用） */
export function isFromBewlyUi(event: Event, hostId: string): boolean {
  for (const node of event.composedPath()) {
    if (!(node instanceof HTMLElement))
      continue
    if (node.id === hostId || node.id === 'bewly')
      return true
  }
  return false
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
