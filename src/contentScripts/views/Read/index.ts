/**
 * 专栏页自绘层入口（列表页自绘 + 文章页默认排版）。
 *
 * 由 contentScripts/index.ts 调用 setupReadDrawnPage() / teardownReadDrawnPage()（Lead 接线）。
 * 本模块自己判断当前是不是专栏页，不是就完全空操作。
 *
 * 两类页面，两种做法：
 *
 *   1. 列表页 `https://www.bilibili.com/read/home`
 *      整体自绘：读数据源（`__INITIAL_STATE__.home.list` → 原生 DOM 兜底），
 *      拿到卡片后挂一个独立 shadow root 的 Vue 卡片网格，再给 <html> 加
 *      `bewly-read-drawn` 隐藏原生列表；**拿不到任何卡片就什么都不做**，原生页面照旧。
 *
 *   2. 文章页 `/read/cv<id>`（现在会被 B 站重定向到 `/opus/<id>`）
 *      只注入一份页面级排版样式（720px 正文列、1.8 行高、图片圆角与放大指针、
 *      底部互动栏），**不改 DOM 结构**；正文容器一直不出现就不注入。
 *
 * 真机 dump 到的真实类名（2026-11，CDP 只读）：
 *   列表：.page-home > .main > .content > .feed > .feed-item > a.article-item
 *         └ .article-item__left > .article-item__details > .article-item__title / __desc
 *         └ .article-item__meta > .article-item__author(.article-item__avatar/.article-item__uname)
 *                                .article-item__label .article-item__stats > .article-item__stat.view/.like/.comment
 *         └ .article-item__right > .article-item__cover
 *   文章：.opus-detail > .bili-opus-view-wrap > .bili-opus-view
 *         └ .opus-module-title / .opus-module-author / .opus-module-content / .opus-module-bottom
 *         └ .right-sidebar-wrap > .side-toolbar > .side-toolbar__box > .side-toolbar__action
 *   旧版读者页类名（兜底）：.article-container / .read-article-holder / .normal-article-holder
 */
import type { App } from 'vue'
import { createApp } from 'vue'

import { injectCSS } from '~/utils/dom'

import { getInitialCards } from './fetcher'
import articleCss from './readArticle.scss?inline'
import listCss from './readList.shadow.scss?inline'
import ReadList from './ReadList.vue'
import pageCss from './readPage.scss?inline'

/** 列表页自绘生效时挂在 <html> 上的类（页面级样式与 e2e 都靠它） */
export const READ_LIST_DRAWN_CLASS = 'bewly-read-drawn'
/** 文章页默认排版生效时挂在 <html> 上的类 */
export const READ_ARTICLE_CLASS = 'bewly-read-article'
/** 自绘列表容器的 id（shadow host，页面级样式按它留顶栏高度） */
export const READ_LIST_HOST_ID = 'bewly-read-page'

const LIST_PAGE_STYLE_ID = 'bewly-read-page-style'
const ARTICLE_PAGE_STYLE_ID = 'bewly-read-article-style'

/** 文章页正文容器的候选（opus 优先，其次旧版专栏） */
const ARTICLE_BODY_SELECTOR = [
  '.opus-module-content',
  '.article-container .normal-article-holder',
  '.article-container .read-article-holder',
  '.normal-article-holder',
  '.read-article-holder',
  '.article-container',
].join(', ')

/** 正文异步渲染时的等待参数：400ms 一次，最多 8 秒 */
const ARTICLE_WAIT_INTERVAL = 400
const ARTICLE_WAIT_TRIES = 20

let listHost: HTMLElement | null = null
let listApp: App | null = null
let listStyleEl: HTMLStyleElement | null = null
let articleStyleEl: HTMLStyleElement | null = null
let articleTimer: number | null = null

/** 是否专栏列表页（`/read/home`） */
export function isReadListPage(url: string = location.href): boolean {
  try {
    const parsed = new URL(url)
    return /(?:^|\.)bilibili\.com$/i.test(parsed.hostname) && /^\/read\/home\/?$/.test(parsed.pathname)
  }
  catch {
    return false
  }
}

/** 是否专栏文章页（`/read/cv<id>`、`/read/<id>`、`/read/mobile`、重定向后的 `/opus/<id>`） */
export function isReadArticlePage(url: string = location.href): boolean {
  try {
    const parsed = new URL(url)
    if (!/(?:^|\.)bilibili\.com$/i.test(parsed.hostname))
      return false
    return /^\/read\/(?:cv)?\d+/i.test(parsed.pathname)
      || /^\/read\/mobile/i.test(parsed.pathname)
      || /^\/opus\/\d+/i.test(parsed.pathname)
  }
  catch {
    return false
  }
}

/** 挂载自绘层；非专栏页、重复调用都是空操作 */
export function setupReadDrawnPage(): void {
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => setupReadDrawnPage(), { once: true })
    return
  }

  if (isReadListPage())
    setupListPage()
  else if (isReadArticlePage())
    setupArticlePage()
}

/**
 * 列表页：挂自绘卡片网格。
 *
 * 数据源都拿不到卡片时直接返回 —— 不加类、不注入样式、不动原生 DOM，
 * 用户看到的就是原来的 B 站专栏首页（即「失败回退原生」）。
 */
function setupListPage(): void {
  if (listHost && listHost.isConnected)
    return

  const data = getInitialCards()
  if (!data)
    return

  const host = document.createElement('div')
  host.id = READ_LIST_HOST_ID
  host.setAttribute('data-bewly-read-source', data.source)
  const shadow = host.attachShadow({ mode: 'open' })
  const shadowStyle = document.createElement('style')
  shadowStyle.textContent = listCss
  shadow.appendChild(shadowStyle)
  const mountPoint = document.createElement('div')
  shadow.appendChild(mountPoint)

  try {
    const app = createApp(ReadList, { initialCards: data.cards })
    app.mount(mountPoint)
    document.body.appendChild(host)

    // 自绘层就位之后再隐藏原生页面，避免中间出现白屏
    listStyleEl = injectCSS(pageCss)
    listStyleEl.id = LIST_PAGE_STYLE_ID
    document.documentElement.classList.add(READ_LIST_DRAWN_CLASS)

    listHost = host
    listApp = app
  }
  catch (error) {
    // 挂载失败：回滚到原生页面（此时原生还没被隐藏）
    try {
      listApp?.unmount()
    }
    catch {
      // 组件没挂上时 unmount 会抛错，忽略
    }
    host.remove()
    listStyleEl?.remove()
    listStyleEl = null
    listApp = null
    listHost = null
    document.documentElement.classList.remove(READ_LIST_DRAWN_CLASS)
    console.error('[bewly] 专栏列表页自绘失败，已回退原生页面', error)
  }
}

/**
 * 文章页：只注入排版样式，不改 DOM 结构。
 *
 * 正文是异步渲染的，这里短暂等待（最多 8 秒）；等到之后再注入样式，
 * 一直等不到就保持 B 站原样。样式本身不依赖任何运行时数据。
 */
function setupArticlePage(): void {
  if (articleStyleEl)
    return
  if (hasArticleBody()) {
    applyArticleStyles()
    return
  }
  if (articleTimer !== null)
    return

  let tries = 0
  articleTimer = window.setInterval(() => {
    tries += 1
    if (hasArticleBody()) {
      stopArticleWait()
      applyArticleStyles()
      return
    }
    if (tries >= ARTICLE_WAIT_TRIES)
      stopArticleWait()
  }, ARTICLE_WAIT_INTERVAL)
}

function hasArticleBody(): boolean {
  const el = document.querySelector<HTMLElement>(ARTICLE_BODY_SELECTOR)
  if (!el)
    return false
  return (el.textContent ?? '').trim().length >= 80
}

function applyArticleStyles(): void {
  if (articleStyleEl)
    return
  articleStyleEl = injectCSS(articleCss)
  articleStyleEl.id = ARTICLE_PAGE_STYLE_ID
  document.documentElement.classList.add(READ_ARTICLE_CLASS)
}

function stopArticleWait(): void {
  if (articleTimer !== null) {
    window.clearInterval(articleTimer)
    articleTimer = null
  }
}

/** 卸载：移除自绘层、样式与类名，原生页面立即恢复 */
export function teardownReadDrawnPage(): void {
  stopArticleWait()

  try {
    listApp?.unmount()
  }
  catch {
    // 组件已卸载时忽略
  }
  listApp = null

  listHost?.remove()
  listHost = null

  listStyleEl?.remove()
  listStyleEl = null
  articleStyleEl?.remove()
  articleStyleEl = null

  document.documentElement.classList.remove(READ_LIST_DRAWN_CLASS)
  document.documentElement.classList.remove(READ_ARTICLE_CLASS)
}
