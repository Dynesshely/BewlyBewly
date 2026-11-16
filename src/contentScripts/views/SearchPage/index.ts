/**
 * 搜索结果页视觉改造入口（第 92 轮 A）。
 *
 * 依据 Lead 真机 dump：搜索页结果卡就是 `.bili-video-card`（与首页同一套组件），
 * 所以不重写卡片组件，改为「注入页面级 CSS + 网格布局 + 筛选栏/分页 pill 化」，
 * 风险远低于整体重绘，也符合「全站视觉统一」的方向。
 *
 * 开关方式：只给 <html> 加 `bewly-search-drawn` 类 + 注入一段样式；
 * teardown 时移除类与样式节点，原生页面立即恢复，零残留。
 */
import { injectCSS } from '../../../utils/dom'

import searchPageCss from './searchPage.scss?inline'

/** 改造生效时挂在 <html> 上的类（页面级 CSS 与 e2e 都靠它） */
export const SEARCH_DRAWN_CLASS = 'bewly-search-drawn'

let styleEl: HTMLStyleElement | null = null
let gridObserver: MutationObserver | null = null

/** 是否为 B 站站内搜索页（`search.bilibili.com`） */
export function isSearchResultPage(url: string = location.href): boolean {
  try {
    return /(?:^|\.)search\.bilibili\.com$/i.test(new URL(url).hostname)
  }
  catch {
    return false
  }
}

/** 应用 / 更新样式改造；非搜索页或重复调用都是空操作 */
export function setupSearchDrawnPage(): void {
  if (!isSearchResultPage())
    return
  if (styleEl || !document.body)
    return

  document.documentElement.classList.add(SEARCH_DRAWN_CLASS)
  styleEl = injectCSS(searchPageCss)

  // 第 93 轮回退：grid 改造会让搜索结果卡片高度塌成 0（真机 42 张全 0 高），
  // 因此不再改布局，只保留视觉层样式。applyGridInline 保留以便将来 B 站 DOM 稳定后重启。
}

/**
 * 给搜索结果列表直接写 inline 网格布局（内联 !important 优先级最高）。
 *
 * 第 93 轮回退：B 站当前搜索页卡片用 __wrap 绝对定位，grid 会让卡片高度塌成 0，
 * 因此**暂不调用**；保留实现以便 B 站 DOM 稳定后重启（届时删掉这行 void 即可）。
 */
// eslint-disable-next-line unused-imports/no-unused-vars
function applyGridInline(): void {
  const lists = document.querySelectorAll<HTMLElement>('.video-list.row')
  for (const list of Array.from(lists)) {
    // UP 主卡内部的小视频网格保持 flex，不改成 grid
    if (list.closest('.b-user-video-card'))
      continue
    if (list.dataset.bewlyGridApplied === '1')
      continue
    list.style.setProperty('display', 'grid', 'important')
    list.style.setProperty('grid-template-columns', 'repeat(auto-fill, minmax(220px, 1fr))', 'important')
    list.style.setProperty('gap', '20px 16px', 'important')
    list.style.setProperty('margin', '0', 'important')
    list.style.setProperty('padding', '0', 'important')
    list.dataset.bewlyGridApplied = '1'
  }
}

/** 卸载：移除类与样式节点（原生页面恢复原样） */
export function teardownSearchDrawnPage(): void {
  gridObserver?.disconnect()
  gridObserver = null
  for (const list of Array.from(document.querySelectorAll<HTMLElement>('.video-list.row[data-bewly-grid-applied]'))) {
    list.style.removeProperty('display')
    list.style.removeProperty('grid-template-columns')
    list.style.removeProperty('gap')
    list.style.removeProperty('margin')
    list.style.removeProperty('padding')
    delete list.dataset.bewlyGridApplied
  }
  styleEl?.remove()
  styleEl = null
  document.documentElement.classList.remove(SEARCH_DRAWN_CLASS)
}
