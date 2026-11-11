import { nextTick, onBeforeUnmount, watch } from 'vue'

/**
 * 列表页（历史 / 稍后再看 / 收藏）的滚动位置记忆（第 20 轮）。
 *
 * 问题：从列表卡片点进视频（当前标签打开）后，浏览器「返回」会让列表页重新 mount，
 * 数据从第一页重新请求，直接恢复绝对像素会错位（列表高度变了）。
 *
 * 做法：**记住「最近一张可见卡片 + 它相对滚动容器顶部的偏移」**，恢复时按卡片反查位置：
 *   1. 滚动时（节流 200ms）找第一张 `bottom > 容器顶 + 24px` 的卡片，
 *      记下它的 `data-bewly-list-card` key 与 `rect.top - 容器顶`；
 *   2. 页面重新挂载、卡片数量 > 0 后读回记录，按 key 找元素并反算 `scrollTop`，
 *      因此卡片高度 / 分组数量变化也能对齐到「同一张卡片同一相对位置」；
 *   3. 找不到这张卡片（列表变了 / 第一页还没加载）→ 短暂重试约 1.5s，
 *      仍找不到就回退到顶部（scrollTop = 0），并清掉记录；
 *   4. 恢复过程只改 `scrollTop`，不调用任何接口 / 不触发无限滚动加载；
 *      用户中途主动滚动（滚轮 / 触摸）就放弃恢复，避免和用户抢；
 *   5. 直接赋值（无 smooth），reduced-motion 下天然是跳转。
 *
 * 所有查询都走 `#bewly` 的 shadow root：列表页渲染在 shadow root 内，
 * `document.querySelector` 看不到 `.bewly-scroll-container` / `[data-bewly-list-card]`。
 */

const STORAGE_PREFIX = 'bewly-list-scroll-'

/** 与 useListVirtual 同一个卡片标记（由 ListGroupSection 写在 ListVideoCard 根节点） */
const LIST_CARD_ATTR = 'data-bewly-list-card'

interface SavedAnchor {
  /** 卡片 key */
  key: string
  /** 卡片顶部相对滚动容器顶部的偏移（px，通常为 0~卡片高度） */
  offset: number
  /** 记录时的卡片数量（仅用于排查） */
  count: number
  /** 记录时间戳，便于排查过期数据 */
  ts: number
}

function getBewlyShadowRoot(): ShadowRoot | null {
  try {
    return document.querySelector<HTMLElement>('#bewly')?.shadowRoot ?? null
  }
  catch {
    return null
  }
}

function findScrollRoot(): HTMLElement | null {
  const shadowRoot = getBewlyShadowRoot()
  if (shadowRoot)
    return shadowRoot.querySelector<HTMLElement>('.bewly-scroll-container') ?? null
  return document.querySelector<HTMLElement>('.bewly-scroll-container')
}

function findListRoot(): ParentNode | null {
  const shadowRoot = getBewlyShadowRoot()
  if (shadowRoot)
    return shadowRoot.querySelector<HTMLElement>('.bewly-list-page') ?? null
  return document.querySelector<HTMLElement>('.bewly-list-page')
}

export interface UseListScrollMemoryOptions {
  /** 存储作用域：history / watch-later / favorites（拼进 sessionStorage key） */
  scope: string
  /** 当前列表卡片数量（卡片渲染出来才能恢复） */
  count: () => number
  /** 卡片查询根节点，默认 `.bewly-list-page` */
  getListRoot?: () => ParentNode | null
  /** 滚动容器，默认 App 的 `.bewly-scroll-container` */
  getScrollRoot?: () => HTMLElement | null
}

/** 卡片上沿至少露出的像素，避免记下一张刚好被遮住的卡 */
const VISIBLE_EDGE = 24
/** 等待目标卡片出现的重试次数与间隔（约 1.5s） */
const RETRY_TIMES = 15
const RETRY_DELAY = 100

export function useListScrollMemory(options: UseListScrollMemoryOptions) {
  const storageKey = `${STORAGE_PREFIX}${options.scope}`
  const getListRoot = options.getListRoot ?? (() => findListRoot())
  const getScrollRoot = options.getScrollRoot ?? (() => findScrollRoot())

  let restored = false
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let boundScrollRoot: HTMLElement | null = null
  let cancelOnUserInput: (() => void) | null = null

  function readSaved(): SavedAnchor | null {
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (!raw)
        return null
      const parsed = JSON.parse(raw) as Partial<SavedAnchor>
      if (!parsed || typeof parsed.key !== 'string' || !parsed.key)
        return null
      return {
        key: parsed.key,
        offset: Number(parsed.offset) || 0,
        count: Number(parsed.count) || 0,
        ts: Number(parsed.ts) || 0,
      }
    }
    catch {
      return null
    }
  }

  function clearSaved(): void {
    try {
      sessionStorage.removeItem(storageKey)
    }
    catch {
      // 隐私模式下忽略
    }
  }

  /** 找第一张「可见」的卡片并记录它相对容器顶部的偏移 */
  function saveAnchor(): void {
    const root = getScrollRoot()
    const listRoot = getListRoot()
    if (!root || !listRoot)
      return
    const cards = Array.from(listRoot.querySelectorAll<HTMLElement>(`[${LIST_CARD_ATTR}]`))
    if (!cards.length)
      return
    const rootTop = root.getBoundingClientRect().top
    const anchor = cards.find((card) => {
      const rect = card.getBoundingClientRect()
      return rect.height > 0 && rect.bottom > rootTop + VISIBLE_EDGE
    })
    if (!anchor)
      return
    const key = anchor.getAttribute(LIST_CARD_ATTR) ?? ''
    if (!key)
      return
    const saved: SavedAnchor = {
      key,
      offset: Math.round(anchor.getBoundingClientRect().top - rootTop),
      count: cards.length,
      ts: Date.now(),
    }
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(saved))
    }
    catch {
      // 配额满 / 隐私模式：本次记忆失效即可，不影响滚动
    }
  }

  function scheduleSave(): void {
    if (saveTimer)
      return
    saveTimer = setTimeout(() => {
      saveTimer = null
      saveAnchor()
    }, 200)
  }

  function unbindScroll(): void {
    if (boundScrollRoot)
      boundScrollRoot.removeEventListener('scroll', scheduleSave)
    boundScrollRoot = null
  }

  /** 监听真正的滚动容器（可能随页面挂载顺序出现 / 被替换） */
  function bindScroll(): void {
    const root = getScrollRoot()
    if (!root || root === boundScrollRoot)
      return
    unbindScroll()
    boundScrollRoot = root
    boundScrollRoot.addEventListener('scroll', scheduleSave, { passive: true })
  }

  function stopRestore(): void {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    if (cancelOnUserInput) {
      for (const eventName of ['wheel', 'touchstart'] as const)
        window.removeEventListener(eventName, cancelOnUserInput)
      cancelOnUserInput = null
    }
  }

  /** 把 scrollTop 调整到「钥匙卡片位于记录偏移」的位置 */
  function restoreFromAnchor(anchor: SavedAnchor, attempt = 0): void {
    if (restored)
      return
    const root = getScrollRoot()
    if (!root) {
      if (attempt < RETRY_TIMES) {
        retryTimer = setTimeout(restoreFromAnchor, RETRY_DELAY, anchor, attempt + 1)
        return
      }
      finishRestore(null)
      return
    }
    const listRoot = getListRoot()
    const card = listRoot?.querySelector<HTMLElement>(`[${LIST_CARD_ATTR}="${CSS.escape(anchor.key)}"]`) ?? null
    if (!card) {
      if (attempt < RETRY_TIMES) {
        retryTimer = setTimeout(restoreFromAnchor, RETRY_DELAY, anchor, attempt + 1)
        return
      }
      // 目标卡片始终没出现（列表内容变化 / 第一页都没加载出来）→ 回退到顶部
      finishRestore(root)
      return
    }
    const delta = card.getBoundingClientRect().top - root.getBoundingClientRect().top - anchor.offset
    if (Math.abs(delta) > 1)
      root.scrollTop = Math.max(0, root.scrollTop + delta)
    finishRestore(null)
  }

  function finishRestore(rootToReset: HTMLElement | null): void {
    restored = true
    stopRestore()
    if (rootToReset)
      rootToReset.scrollTop = 0
    clearSaved()
  }

  /** 卡片数量变化后尝试恢复；卸载 / 用户接管时取消 */
  function maybeRestore(): void {
    if (restored || options.count() <= 0)
      return
    const anchor = readSaved()
    if (!anchor) {
      restored = true
      return
    }
    const cancel = () => {
      restored = true
      stopRestore()
      // 用户已经自己滚了：保留当前记录，下次再恢复
    }
    cancelOnUserInput = cancel
    for (const eventName of ['wheel', 'touchstart'] as const)
      window.addEventListener(eventName, cancel, { passive: true })
    void nextTick(() => restoreFromAnchor(anchor))
  }

  watch(() => options.count(), () => maybeRestore(), { immediate: true })
  watch(getScrollRoot, () => {
    bindScroll()
  }, { immediate: true })
  // 卡片异步渲染 / 切页后再确认一次滚动容器
  const bindTimer = setInterval(bindScroll, 500)

  onBeforeUnmount(() => {
    clearInterval(bindTimer)
    stopRestore()
    if (saveTimer)
      clearTimeout(saveTimer)
    unbindScroll()
  })

  return { saveAnchor, clearSaved }
}
