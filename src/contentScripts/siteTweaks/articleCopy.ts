/**
 * 允许复制专栏正文（第 40 轮，内化自油猴脚本 «Make BiliBili Great Again»）。
 *
 * 专栏页（`/read/cv*`）的正文容器 `.article-holder` 上挂了捕获阶段的 `copy` 监听，
 * 会把复制的文本换成一串「作者/来源」版权尾巴。这里在同一阶段先 `stopImmediatePropagation()`，
 * 让 B 站的处理函数拿不到这次复制事件，浏览器默认的「复制选中文本」行为不受影响。
 *
 * 只在专栏页生效；其它页面不注册任何监听。
 */

const ARTICLE_SELECTOR = '.article-holder'
const COPY_EVENT = 'copy'

let boundTarget: HTMLElement | null = null

function isArticlePage(): boolean {
  return /^https?:\/\/(?:www\.)?bilibili\.com\/read\/cv/i.test(location.href)
}

/**
 * 捕获阶段的 copy 拦截。
 *
 * 用 `stopImmediatePropagation` 而不是 `stopPropagation`：
 * B 站与我们的监听挂在同一元素、同一阶段，只有前者才能阻止同元素的其它监听。
 */
function onCopyCapture(event: Event): void {
  event.stopImmediatePropagation()
  // 不调用 preventDefault：浏览器默认的「复制选中内容」应当继续执行
}

/** 找到正文容器（可能懒加载，最多等 10 秒） */
function bindToArticle(timeoutMs = 10_000): void {
  const existing = document.querySelector<HTMLElement>(ARTICLE_SELECTOR)
  if (existing) {
    existing.addEventListener(COPY_EVENT, onCopyCapture, true)
    boundTarget = existing
    return
  }

  const observer = new MutationObserver(() => {
    const target = document.querySelector<HTMLElement>(ARTICLE_SELECTOR)
    if (!target)
      return
    observer.disconnect()
    target.addEventListener(COPY_EVENT, onCopyCapture, true)
    boundTarget = target
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.setTimeout(() => observer.disconnect(), timeoutMs)
}

/** 开启（非专栏页直接返回，不做任何事） */
export function setupArticleCopy(): void {
  if (!isArticlePage() || boundTarget)
    return
  bindToArticle()
}

/** 关闭：解绑 */
export function teardownArticleCopy(): void {
  boundTarget?.removeEventListener(COPY_EVENT, onCopyCapture, true)
  boundTarget = null
}
