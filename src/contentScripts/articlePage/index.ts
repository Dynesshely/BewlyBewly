/**
 * 专栏 / 文章页阅读模式入口。
 *
 * 由 contentScripts/index.ts 调用 setupArticlePage() / teardownArticlePage()（Lead 接线）。
 * 文章页本身是 B 站原生页面（bilibili.com/read/*、bilibili.com/opus/*），我们只在它上面：
 *
 *   1. 叠加一个独立 shadow root 的浮层（原样复用 nativeOverlay 外壳）：
 *      顶部阅读进度条 + 右下角百分比 / 沉浸阅读开关 / 字号三档 / 目录 / 回到顶部；
 *   2. 注入一份页面级样式（<html class="bewly-article-reading"> 作用域），
 *      进入沉浸阅读时隐藏侧栏 / 推荐 / 评论锚点、正文 720px、降噪背景；
 *   3. 从正文 h1/h2/h3 生成目录并跟随滚动高亮当前章节；
 *   4. 注册快捷键 R / [ ] / T / Esc。
 *
 * 找不到正文容器时整块 UI 降级隐藏（ui.ready = false），不会在非文章页留下空浮层。
 * 非文章页是空操作；重复调用幂等（nativeOverlay 按 hostId 去重）。
 */
import { watch } from 'vue'

import { settings } from '~/logic'
import { injectCSS } from '~/utils/main'

import { hasNativeOverlay, mountNativeOverlay, unmountNativeOverlay } from '../nativeOverlay'

import {
  cleanupPageHooks,
  restorePreferences,
  setFontStep,
  setReading,
  setTocOpen,
  updateProgress,
} from './actions'
import pageCss from './articlePage.page.scss?inline'
import shadowCss from './articlePage.shadow.scss?inline'
import { cleanupCodeBlocks, setupCodeCopy, syncCodeBlocks } from './codeBlocks'
import ArticlePageOverlay from './components/ArticlePageOverlay.vue'
import { HOST_ID, PAGE_STYLE_ID } from './constants'
import { getArticlePageKind, getContentEl, isArticlePage, markContentEl } from './dom'
import { cleanupLightbox, setupImageLightbox } from './lightbox'
import { readStoredReading, readStoredTocOpen } from './preferences'
import { setupShortcuts } from './shortcuts'
import { resetUiState, ui } from './state'
import { clearToc, syncToc, updateActiveToc } from './toc'

/** DOM 变化合并窗口：文章页正文 / 图片懒加载会持续改 DOM，逐条同步太浪费 */
const SYNC_DEBOUNCE = 250
/** 兜底轮询：进度与目录高亮需要跟着滚动更新，但滚动事件已经覆盖大部分场景 */
const SYNC_INTERVAL = 1500

let pageStyleEl: HTMLStyleElement | null = null
let disposeShortcuts: (() => void) | null = null
let disposeImageLightbox: (() => void) | null = null
let disposeCodeCopy: (() => void) | null = null
let observer: MutationObserver | null = null
let intervalTimer: number | null = null
let debounceTimer: number | null = null
let scrollFrame = 0
let lastContentEl: HTMLElement | null = null
let tocRestored = false
let readingRestored = false
let stopSettingsWatch: (() => void) | null = null

export function setupArticlePage(): void {
  if (!isArticlePage())
    return
  if (hasNativeOverlay(HOST_ID))
    return
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => setupArticlePage(), { once: true })
    return
  }
  mount()
}

export function teardownArticlePage(): void {
  unmount()
}

function mount(): void {
  // 先恢复偏好（字号立即生效、阅读模式按 sessionStorage 复原），再挂 UI，避免样式闪一下
  restorePreferences()

  pageStyleEl = injectPageStyle()
  mountNativeOverlay({
    hostId: HOST_ID,
    component: ArticlePageOverlay,
    css: shadowCss,
    hostAttributes: { 'data-bewly-article-overlay': '' },
  })

  disposeShortcuts = setupShortcuts()
  // 正文交互：图片点击放大 / 代码块复制按钮（按钮在 sync 时注入）
  disposeImageLightbox = setupImageLightbox()
  disposeCodeCopy = setupCodeCopy()

  // 设置页改动实时生效：字号立即换算，阅读模式按需切换（正文没就绪时由 sync 补进）
  stopSettingsWatch = watch(
    () => [settings.value.articleFontSize, settings.value.articleReadingMode] as const,
    ([fontSize, readingMode]) => {
      setFontStep(fontSize, { silent: true })
      if (readingMode !== ui.reading)
        setReading(readingMode, { silent: true })
    },
  )

  sync()
  intervalTimer = window.setInterval(() => {
    if (document.hidden)
      return
    sync()
  }, SYNC_INTERVAL)

  observer = new MutationObserver(() => scheduleSync())
  observer.observe(document.body, { childList: true, subtree: true })

  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('resize', handleScroll, { passive: true })
}

function unmount(): void {
  if (observer) {
    observer.disconnect()
    observer = null
  }
  if (intervalTimer !== null) {
    window.clearInterval(intervalTimer)
    intervalTimer = null
  }
  if (debounceTimer !== null) {
    window.clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (scrollFrame) {
    window.cancelAnimationFrame(scrollFrame)
    scrollFrame = 0
  }
  if (stopSettingsWatch) {
    stopSettingsWatch()
    stopSettingsWatch = null
  }
  if (disposeShortcuts) {
    disposeShortcuts()
    disposeShortcuts = null
  }
  if (disposeImageLightbox) {
    disposeImageLightbox()
    disposeImageLightbox = null
  }
  if (disposeCodeCopy) {
    disposeCodeCopy()
    disposeCodeCopy = null
  }

  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('resize', handleScroll)

  unmountNativeOverlay(HOST_ID)
  removePageStyle()
  cleanupCodeBlocks()
  cleanupLightbox()
  cleanupPageHooks()
  clearToc()
  resetUiState()

  lastContentEl = null
  tocRestored = false
  readingRestored = false
}

/** 页面级样式：幂等注入（同一页面重复 setup 时不会叠两份） */
function injectPageStyle(): HTMLStyleElement {
  const existing = document.getElementById(PAGE_STYLE_ID)
  if (existing)
    return existing as HTMLStyleElement
  const el = injectCSS(pageCss)
  el.id = PAGE_STYLE_ID
  return el
}

function removePageStyle(): void {
  pageStyleEl?.remove()
  pageStyleEl = null
  document.getElementById(PAGE_STYLE_ID)?.remove()
}

function handleScroll(): void {
  if (scrollFrame)
    return
  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = 0
    updateProgress()
    updateActiveToc()
  })
}

function scheduleSync(): void {
  if (debounceTimer !== null)
    return
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null
    if (!document.hidden)
      sync()
  }, SYNC_DEBOUNCE)
}

/** 同步页面状态：正文容器 / 目录 / 进度 / 降级判定 */
function sync(): void {
  const kind = getArticlePageKind()
  if (!kind) {
    // 站内跳转到别处：直接卸载，避免在非文章页留浮层
    teardownArticlePage()
    return
  }

  // 已经确认过的正文容器只要还在文档里就直接复用：
  // getContentEl() 要读 textContent 判空，正文很长时不该每拍都跑一遍
  const content = lastContentEl && lastContentEl.isConnected && lastContentEl.hasAttribute('data-bewly-article-content')
    ? lastContentEl
    : getContentEl()
  if (content !== lastContentEl) {
    lastContentEl = content
    markContentEl(content)
  }

  // 功能降级：找不到正文容器时整块 UI 隐藏（浮层仍在但 ready=false，Dock 不渲染）
  ui.ready = content !== null

  if (!content) {
    ui.showProgress = false
    return
  }

  syncToc(content)
  // 代码块复制按钮：正文异步渲染 / 懒加载后可能持续出现新的 <pre>，这里补注入
  syncCodeBlocks(content)

  // 正文确认存在后才恢复沉浸阅读（只恢复一次；避免先把页面藏空）
  if (!readingRestored) {
    readingRestored = true
    if (readStoredReading())
      setReading(true, { silent: true })
  }
  // 设置页里打开「默认阅读模式」时，等正文就绪再进入（首次同步之外也覆盖）
  else if (!ui.reading && settings.value.articleReadingMode) {
    setReading(true, { silent: true })
  }

  // 目录刷新后，恢复上一次会话里展开的目录（只恢复一次）
  if (!tocRestored) {
    tocRestored = true
    if (readStoredTocOpen() && ui.tocItems.length > 0)
      setTocOpen(true)
  }

  // 目录为空时收起面板，避免留下一个空壳
  if (ui.tocOpen && ui.tocItems.length === 0)
    setTocOpen(false)

  updateProgress()
  updateActiveToc()
}

/** 供 Lead 接线 / 调试使用：程序化进入或退出阅读模式 */
export function setArticleReading(on: boolean): void {
  if (!isArticlePage())
    return
  setReading(on)
}
