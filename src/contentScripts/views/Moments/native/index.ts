import type { DrawnActionType } from './types'

/**
 * 动态页自绘（原生 t.bilibili.com）入口。
 *
 * 由 contentScripts/index.ts 调用 setupMomentsDrawnPage() / teardownMomentsDrawnPage()。
 *
 * 设计要点：
 * - **只读解析**：只读取原生 DOM 的类名与文本，不写回原生节点、不发任何请求；
 * - **不破坏原生列表**：保留 `.bili-dyn-list__item` wrapper（原生无限滚动依赖 DOM 高度），
 *   只隐藏已成功自绘条目里的 `.bili-dyn-item`，再把自绘卡片插进 wrapper；
 * - **失败回退原生**：任何一条解析失败都只 release 那一条（原生卡片保持可见），
 *   一条都解析不出来时直接不挂 `bewly-moments-drawn` 类，页面与原生完全一致；
 * - **幂等 + 可卸载**：重复 setup 空操作；teardown 移除类 / 样式 / 自绘节点，零残留。
 */
import { injectCSS } from '~/utils/dom'
import {
  DRAWN_ITEM_ATTR,
  DRAWN_ROOT_CLASS,
  NATIVE_ACTION_SELECTOR,
  NATIVE_ITEM_SELECTOR,
  NATIVE_LIST_SELECTOR,
  SYNC_DEBOUNCE,
} from './constants'
import nativeCss from './nativeMoments.scss?inline'
import { getRenderedSignature, momentSignature, removeRenderedMoment, renderMoment } from './render'
import { scrapeMoment } from './scrape'

let styleEl: HTMLStyleElement | null = null
let observer: MutationObserver | null = null
let syncTimer: number | null = null
let started = false

/**
 * 已「固定为原生」的列表项。
 *
 * 评论面板是渲染在原生 `.bili-dyn-item` 内部的，卡片被隐藏时面板也会不可见，
 * 所以点「评论」时把这一条恢复成原生卡片再点原生评论按钮，并在本次会话内
 * 不再自绘它（否则下一次 sync 会重新隐藏原生卡片、把面板吞掉）。
 */
const nativePinned = new WeakSet<Element>()

/** 是否为动态页（排除投票 / 分享等 t.bilibili.com 下的独立子页） */
export function isNativeMomentsPage(url: string = location.href): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== 't.bilibili.com')
      return false
    return !/^\/(?:vote|share)(?:\/|$)/.test(parsed.pathname)
  }
  catch {
    return false
  }
}

/** 挂载自绘层；非动态页 / 重复调用都是空操作 */
export function setupMomentsDrawnPage(): void {
  if (!isNativeMomentsPage())
    return
  if (started)
    return
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => setupMomentsDrawnPage(), { once: true })
    return
  }

  started = true
  styleEl = injectCSS(nativeCss)

  observer = new MutationObserver(scheduleSync)
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  })
  window.addEventListener('popstate', scheduleSync)

  syncNow()
}

/** 卸载：移除样式、类与所有自绘节点（原生卡片立即恢复） */
export function teardownMomentsDrawnPage(): void {
  started = false

  observer?.disconnect()
  observer = null
  if (syncTimer !== null) {
    window.clearTimeout(syncTimer)
    syncTimer = null
  }
  window.removeEventListener('popstate', scheduleSync)

  for (const wrapper of Array.from(document.querySelectorAll<HTMLElement>(`[${DRAWN_ITEM_ATTR}]`)))
    releaseWrapper(wrapper)

  styleEl?.remove()
  styleEl = null
  document.documentElement.classList.remove(DRAWN_ROOT_CLASS)
}

function scheduleSync(): void {
  if (syncTimer !== null)
    return
  syncTimer = window.setTimeout(() => {
    syncTimer = null
    syncNow()
  }, SYNC_DEBOUNCE)
}

/** 撤销单条自绘（原生卡片重新可见） */
function releaseWrapper(wrapper: Element): void {
  removeRenderedMoment(wrapper)
  wrapper.removeAttribute(DRAWN_ITEM_ATTR)
}

/**
 * 操作栏代理：直接把点击转给同一条原生卡片里的原生按钮。
 *
 * 不自己发请求，因此点赞 / 评论 / 转发都保持 B 站原生行为（含登录校验、风控、弹层）。
 */
function proxyNativeAction(wrapper: HTMLElement, type: DrawnActionType): void {
  const button = wrapper.querySelector<HTMLElement>(`.bili-dyn-item ${NATIVE_ACTION_SELECTOR}[data-type="${type}"]`)
  if (!button)
    return

  // 评论面板在原生卡片内部：先把这一条恢复成原生（并固定为原生），再点原生评论
  if (type === 'comment') {
    nativePinned.add(wrapper)
    releaseWrapper(wrapper)
  }

  button.click()

  // 原生计数 / 已赞态是异步回写的：延后两拍再同步一次（也吞掉连点导致的重渲染竞争）
  window.setTimeout(scheduleSync, 350)
  window.setTimeout(scheduleSync, 1100)
}

function syncNow(): void {
  if (!started)
    return

  const list = document.querySelector(NATIVE_LIST_SELECTOR)
  if (!list) {
    // 列表还没渲染出来 / 已切到别的路由：先不接管，原生页面完全可见
    document.documentElement.classList.remove(DRAWN_ROOT_CLASS)
    return
  }

  const wrappers = Array.from(list.querySelectorAll<HTMLElement>(NATIVE_ITEM_SELECTOR))
  let drawnCount = 0

  for (const wrapper of wrappers) {
    try {
      // 用户主动恢复了原生卡片（如点了评论）：保持原生，避免反复抢回
      if (nativePinned.has(wrapper)) {
        releaseWrapper(wrapper)
        continue
      }

      const moment = scrapeMoment(wrapper)
      if (!moment) {
        releaseWrapper(wrapper)
        continue
      }

      const signature = momentSignature(moment)
      if (wrapper.getAttribute(DRAWN_ITEM_ATTR) === '1' && getRenderedSignature(wrapper) === signature) {
        drawnCount++
        continue
      }

      wrapper.setAttribute(DRAWN_ITEM_ATTR, '1')
      renderMoment(wrapper, moment, signature, type => proxyNativeAction(wrapper, type))
      drawnCount++
    }
    catch (error) {
      // 单条失败只回退这一条，绝不让整页失去原生外观
      console.warn('[BewlyBewly] 动态卡片自绘失败，已回退原生卡片', error)
      releaseWrapper(wrapper)
    }
  }

  document.documentElement.classList.toggle(DRAWN_ROOT_CLASS, drawnCount > 0)
}
