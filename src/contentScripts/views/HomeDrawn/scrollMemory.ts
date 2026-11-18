/**
 * 首页推荐流的滚动位置记忆（第 103 轮「减少心智负担」优化 3/3）。
 *
 * # 为什么不做成「刷新也恢复」
 *
 * 用户点开一个视频（新标签 / 抽屉）、再回到首页时希望接着看；而**刷新页面**时
 * 希望从顶部重新开始（否则容易以为页面卡住）。所以恢复源是**模块级内存**
 * 而不是 localStorage：`views/Home/scrollMemory.ts` 第 20 轮已经用同样的取舍
 * 解决过这个问题，这里保持一致。
 *
 * # 为什么用「锚点卡片」而不是绝对像素
 *
 * 回到首页时会**重新请求第 1 页**：推荐内容与上次不完全相同（接口每次返回随机批次），
 * 卡片高度也可能因标题行数不同而变。记绝对 `scrollTop` 会落到另一张卡上。
 * 所以记「第一张可见卡片的 key + 它相对滚动容器顶部的偏移」，恢复时反查这张卡。
 * 找不到这张卡（推荐变了 / 还没渲染）就退回记录时的绝对像素，再不行就留在顶部。
 *
 * # 与既有键盘卡片导航的关系
 *
 * 恢复过程只改 `scrollTop`、不触发任何请求；用户中途自己滚动（wheel / touchstart）
 * 立即放弃，不抢滚动条。
 */

export interface HomeScrollAnchor {
  /** 锚点卡片的 key（`data-bewly-home-card-key`，即 bvid / 直播房间号） */
  key: string
  /** 卡片顶部相对滚动容器顶部的偏移（px） */
  offset: number
  /** 记录时的绝对 scrollTop（锚点找不到时的兜底） */
  top: number
  /** 记录时间戳（仅用于排查） */
  ts: number
}

const STORAGE_KEY = 'bewly-home-drawn-scroll'
/** 卡片上沿至少露出的像素，避免记下一张刚好被遮住的卡 */
const VISIBLE_EDGE = 24
/** 等待目标卡片出现的重试次数与间隔（约 1.5s） */
const RETRY_TIMES = 15
const RETRY_DELAY = 100

/** 内存态才是恢复依据（刷新页面后清空 → 回顶部） */
let saved: HomeScrollAnchor | null = null

function writeDebugCopy(anchor: HomeScrollAnchor | null): void {
  try {
    if (anchor)
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(anchor))
    else
      sessionStorage.removeItem(STORAGE_KEY)
  }
  catch {
    // 隐私模式 / 配额满：只保留内存态
  }
}

/** 记录当前位置（离开首页 / 滚动节流时调用） */
export function saveHomeDrawnScroll(root: HTMLElement | null, cardsSelector = '[data-bewly-home-card]'): void {
  if (!root)
    return
  const cards = Array.from(root.querySelectorAll<HTMLElement>(cardsSelector))
  if (!cards.length) {
    saved = null
    writeDebugCopy(null)
    return
  }
  const rootTop = root.getBoundingClientRect().top
  const anchor = cards.find((card) => {
    const rect = card.getBoundingClientRect()
    return rect.height > 0 && rect.bottom > rootTop + VISIBLE_EDGE
  })
  if (!anchor)
    return
  const key = anchor.getAttribute('data-bewly-home-card') ?? ''
  if (!key)
    return
  saved = {
    key,
    offset: Math.round(anchor.getBoundingClientRect().top - rootTop),
    top: Math.round(root.scrollTop),
    ts: Date.now(),
  }
  writeDebugCopy(saved)
}

/** 取出并消费记录（同一次停留只恢复一次） */
export function takeHomeDrawnScroll(): HomeScrollAnchor | null {
  const anchor = saved
  saved = null
  writeDebugCopy(null)
  return anchor
}

/** 当前是否有待恢复的记录（mount 时判断是否要做「压掉浏览器 scroll restoration」） */
export function hasHomeDrawnScroll(): boolean {
  return saved !== null
}

/** 调试 / 测试用：清空记录 */
export function resetHomeDrawnScroll(): void {
  saved = null
  writeDebugCopy(null)
}

export interface RestoreOptions {
  /** 卡片查询根节点（默认用滚动容器自身） */
  getCardsRoot?: () => ParentNode | null
  /** 卡片选择器 */
  cardsSelector?: string
}

/**
 * 把滚动容器恢复到记录位置。
 *
 * @returns 清理函数（组件卸载 / 用户接管滚动时调用）
 */
export function restoreHomeDrawnScroll(
  anchor: HomeScrollAnchor,
  getRoot: () => HTMLElement | null,
  options: RestoreOptions = {},
): () => void {
  const cardsSelector = options.cardsSelector ?? '[data-bewly-home-card]'
  const getCardsRoot = options.getCardsRoot ?? getRoot

  let stopped = false
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  const correctionTimers: Array<ReturnType<typeof setTimeout>> = []

  const onUserInput = () => stop()
  for (const eventName of ['wheel', 'touchstart'] as const)
    window.addEventListener(eventName, onUserInput, { passive: true })

  function cleanupListeners(): void {
    for (const eventName of ['wheel', 'touchstart'] as const)
      window.removeEventListener(eventName, onUserInput)
  }

  function stop(): void {
    stopped = true
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    for (const timer of correctionTimers)
      clearTimeout(timer)
    correctionTimers.length = 0
    cleanupListeners()
  }

  /** 落位后按同一锚点再校正一两次（封面 / 卡片高度异步变化会把位置挪走） */
  function scheduleCorrections(): void {
    let expectedTop: number | null = null
    const correct = () => {
      if (stopped)
        return
      const root = getRoot()
      const cardsRoot = getCardsRoot()
      if (!root || !cardsRoot)
        return
      if (expectedTop !== null && Math.abs(root.scrollTop - expectedTop) > 4)
        return
      const card = cardsRoot.querySelector<HTMLElement>(
        `${cardsSelector}[data-bewly-home-card="${CSS.escape(anchor.key)}"]`,
      )
      if (!card)
        return
      const delta = card.getBoundingClientRect().top - root.getBoundingClientRect().top - anchor.offset
      if (Math.abs(delta) > 1)
        root.scrollTop = Math.max(0, root.scrollTop + delta)
      expectedTop = root.scrollTop
    }
    requestAnimationFrame(() => requestAnimationFrame(correct))
    for (const delay of [300, 800]) {
      correctionTimers.push(setTimeout(() => {
        correct()
        if (delay === 800)
          stop()
      }, delay))
    }
  }

  function attempt(tries: number): void {
    if (stopped)
      return
    const root = getRoot()
    if (!root) {
      if (tries < RETRY_TIMES)
        retryTimer = setTimeout(attempt, RETRY_DELAY, tries + 1)
      else
        stop()
      return
    }
    const cardsRoot = getCardsRoot()
    const card = cardsRoot
      ? cardsRoot.querySelector<HTMLElement>(`${cardsSelector}[data-bewly-home-card="${CSS.escape(anchor.key)}"]`)
      : null

    if (card) {
      const delta = card.getBoundingClientRect().top - root.getBoundingClientRect().top - anchor.offset
      if (Math.abs(delta) > 1)
        root.scrollTop = Math.max(0, root.scrollTop + delta)
      scheduleCorrections()
      return
    }

    // 锚点卡片还没渲染出来：等内容更多再试；始终不出现就退回绝对像素
    const canFallBackToPixels = root.scrollHeight > anchor.top + root.clientHeight * 0.5
    if (tries < RETRY_TIMES) {
      retryTimer = setTimeout(attempt, RETRY_DELAY, tries + 1)
      return
    }
    if (canFallBackToPixels)
      root.scrollTop = anchor.top
    stop()
  }

  void attempt(0)
  return stop
}
