/**
 * 视频页广告区域移除（第 28 轮 B 工作流）。
 *
 * 用户需求：移除广告区域，保持播放器 / 评论 / 推荐轨道始终可见。
 *
 * 判定策略（**CSS 优先，JS 只做标记与动态兜底**）：
 * 1. 实测清单（Lead 真机 2026-11-11，BV1wvWM6RE3Z 命中数）：
 *    `.ad-report` ×3、`.strip-ad` ×1、`.left-banner` ×1、`[class*="ad-report"]` ×6、
 *    `#slide_ad` ×1、`.video-card-ad-small` ×1、`.activity-m-v1` ×1、
 *    `.video-page-special-card-small` ×1；
 * 2. 白名单（**绝不当广告**）：`.video-pod-above-modules`（选集 / 合集面板容器）、
 *    `.video-pod`、`.video-pod__list`、`.right-entry`（右栏入口）、
 *    `#reco_list` / `.rcmd-tab` / `.recommend-list-v1` / `.rec-list`（推荐列表，由轨道接管）、
 *    `.video-page-card-small`（推荐小卡）、`.up-panel-container`（UP 面板）、
 *    `#commentapp` / `bili-comments`（评论区）、`#playerWrap`（播放器）、
 *    `#arc_toolbar_report`（点赞/收藏/分享工具栏）、`#v_desc`（简介）;
 *    白名单命中的元素即使 class 里带 ad 字样也不隐藏，并跳过其后代；
 * 3. 隐藏：CSS（`src/styles/adaptedStyles/pages/videoPage.scss`）负责视觉，
 *    这里给命中的容器补 `data-bewly-ad-hidden`（便于排查 / e2e 断言）并加内联
 *    `display: none` 兜底（B 站有时用内联样式覆盖 display）；
 * 4. 动态插入：B 站切视频 / 翻页后会重新插广告，用 MutationObserver（500ms 节流）补处理；
 * 5. 卸载：移除观察器、清掉所有 `data-bewly-ad-hidden` 与内联样式。
 *
 * ⚠️ 本文件**不被 index.ts 直接引用**（第 28 轮约定：A 工作流正在改 index.ts）。
 * 接线点见文件末尾注释 / 汇报里的「Lead 接线项」。
 */

/** 广告容器选择器（实测清单 + 同类变体） */
const AD_SELECTORS = [
  '.ad-report',
  '.strip-ad',
  '.left-banner',
  '#slide_ad',
  '#slideAd',
  '.activity-m-v1',
  '.video-page-special-card-small',
  '.video-card-ad-small',
  '.video-page-game-card-small',
  '.brand-ad-list',
  '.adcard',
  '.slide-ad-exp',
  '.bili-dyn-ads',
  '[class*="ad-report"]',
] as const

/**
 * 白名单：这些元素（及其后代）永远不当广告。
 *
 * 选它们的原因：
 * - `.video-pod-above-modules` / `.video-pod`：选集、合集面板，用户明确要保留；
 * - `.rcmd-tab` / `.recommend-list-v1` / `.rec-list` / `.video-page-card-small`：推荐列表（轨道接管）；
 * - `.right-entry`：右栏入口（收藏 / 充电等），不是广告；
 * - 播放器 / 评论 / 工具栏 / 简介 / UP 面板：核心内容。
 */
const WHITELIST_SELECTORS = [
  '.video-pod-above-modules',
  '.video-pod',
  '.video-pod__list',
  '.right-entry',
  '.rcmd-tab',
  '.recommend-list-v1',
  '.rec-list',
  '.video-page-card-small',
  '.up-panel-container',
  '#commentapp',
  'bili-comments',
  '#playerWrap',
  '#arc_toolbar_report',
  '#v_desc',
] as const

/** 隐藏标记（CSS 与 e2e 共用） */
export const AD_HIDDEN_ATTR = 'data-bewly-ad-hidden'
/** 广告隐藏后广播的事件：固定布局（A 工作流）可监听它重算高度 */
export const ADS_HIDDEN_EVENT = 'bewly:video-ads-hidden'
/** 观察器节流（ms） */
const OBSERVE_THROTTLE = 500

let observer: MutationObserver | null = null
let throttleTimer: number | null = null
let bound = false

function isWhitelisted(el: Element): boolean {
  return WHITELIST_SELECTORS.some((selector) => {
    try {
      return el.matches(selector)
    }
    catch {
      return false
    }
  })
}

/** 元素或其任一祖先在白名单里 → 跳过（避免把选集面板里的某段误杀） */
function hasWhitelistedAncestor(el: Element): boolean {
  let node: Element | null = el
  while (node && node !== document.body) {
    if (isWhitelisted(node))
      return true
    node = node.parentElement
  }
  return false
}

/** 已标记的广告元素（卸载时逐个还原） */
const hidden = new Set<HTMLElement>()

function hideElement(el: HTMLElement): void {
  if (el.hasAttribute(AD_HIDDEN_ATTR))
    return
  el.setAttribute(AD_HIDDEN_ATTR, el.style.display || '')
  el.style.display = 'none'
  hidden.add(el)
}

/**
 * 扫描并隐藏广告容器。
 *
 * @returns 本次新隐藏的数量（0 表示没有变化，固定布局不需要重算）
 */
export function applyAdGuard(): number {
  let changed = 0
  for (const selector of AD_SELECTORS) {
    let nodes: Element[]
    try {
      nodes = Array.from(document.querySelectorAll(selector))
    }
    catch {
      continue
    }
    for (const node of nodes) {
      if (!(node instanceof HTMLElement))
        continue
      // 白名单内的元素（或其祖先在白名单）一律不动
      if (isWhitelisted(node) || hasWhitelistedAncestor(node))
        continue
      // 尺寸兜底：隐藏后宽度/高度为 0 的元素、以及 24px 以下的装饰性小节点不动，
      // 避免把广告容器内部的角标 / 关闭按钮之类误标（它们会随父容器一起消失）
      const rect = node.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0 && (rect.width < 24 || rect.height < 24))
        continue
      // 已经隐藏过的不重复标记
      if (node.hasAttribute(AD_HIDDEN_ATTR))
        continue
      hideElement(node)
      changed++
    }
  }

  if (changed > 0)
    notifyAdsHidden(changed)
  return changed
}

/**
 * 通知固定布局重算。
 *
 * 广播一个 CustomEvent（window 上），A 工作流的固定布局监听后重算播放器高度；
 * 同时补一发 `resize`，保证没有监听事件的实现也能靠现有 ResizeObserver / resize 逻辑收敛。
 */
export function notifyAdsHidden(count = 0): void {
  try {
    window.dispatchEvent(new CustomEvent(ADS_HIDDEN_EVENT, {
      detail: { count },
    }))
    window.dispatchEvent(new Event('resize'))
  }
  catch {
    // 事件派发失败不影响隐藏结果
  }
}

function scheduleScan(): void {
  if (throttleTimer !== null)
    return
  throttleTimer = window.setTimeout(() => {
    throttleTimer = null
    applyAdGuard()
  }, OBSERVE_THROTTLE)
}

/**
 * 启动广告移除：立即扫一遍 + 观察后续动态插入。
 *
 * 幂等：重复调用不会叠加观察器。
 */
export function setupAdGuard(): void {
  if (bound)
    return
  bound = true
  applyAdGuard()

  observer = new MutationObserver(scheduleScan)
  observer.observe(document.body, { childList: true, subtree: true })
}

/** 卸载：断开观察器、清标记与内联样式、广播一次重算 */
export function teardownAdGuard(): void {
  bound = false
  observer?.disconnect()
  observer = null
  if (throttleTimer !== null) {
    window.clearTimeout(throttleTimer)
    throttleTimer = null
  }
  for (const el of hidden) {
    el.style.display = el.getAttribute(AD_HIDDEN_ATTR) || ''
    el.removeAttribute(AD_HIDDEN_ATTR)
  }
  const remaining = document.querySelectorAll<HTMLElement>(`[${AD_HIDDEN_ATTR}]`)
  remaining.forEach((el) => {
    el.style.display = el.getAttribute(AD_HIDDEN_ATTR) || ''
    el.removeAttribute(AD_HIDDEN_ATTR)
  })
  hidden.clear()
  notifyAdsHidden(0)
}

/** 已隐藏的广告数量（诊断 / 排查用） */
export function countHiddenAds(): number {
  return document.querySelectorAll(`[${AD_HIDDEN_ATTR}]`).length
}

// #region 接线说明（第 28 轮：index.ts 由 A 工作流持有，本文件暂不自行接线）
//
// 在 `src/contentScripts/videoPage/index.ts` 里：
//   import { setupAdGuard, teardownAdGuard } from './adGuard'
//   mount():   setupAdGuard()          // 放在 setupComments() 之后、sync() 之前都行
//   unmount(): teardownAdGuard()       // 放在 disposeComments 之后
//
// 固定布局（A 工作流）若要感知广告隐藏导致的高度变化：
//   window.addEventListener(ADS_HIDDEN_EVENT, () => relayout())
// 或直接依赖现有的 ResizeObserver / resize 监听（notifyAdsHidden 也派发了 resize）。
// #endregion
