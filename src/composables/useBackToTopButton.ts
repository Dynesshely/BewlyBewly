/**
 * 自绘页面的「回到顶部 / 底部」按钮状态。
 *
 * # 现状与问题
 *
 * 首页（`views/Home/Home.vue`）与首页自绘版各写了一份「滚过两屏才出现」的回到顶部按钮，
 * 而第 93~103 轮改成的自绘页（空间 / 搜索 / 热门 / 分区 / 动态 / 消息）**一个都没有**：
 * 长列表滚到第 5 屏以后想回顶，只能一路把滚轮拖回去或去按 Home（而 Home 又被键盘卡片
 * 导航占用）。首页与自绘页的滚动容器还不一样（OverlayScrollbars 实例 vs 覆盖层自己的
 * `.bewly-*-shell`），复制粘贴一份必然出现两套阈值 / 两套样式。
 *
 * # 做法
 *
 * 只测「滚动容器自身的 scrollTop / clientHeight」，与容器是谁无关：
 *   - 滚过两屏 → 显示「回到顶部」；
 *   - 从底部往回滚过两屏 → 显示「回到底部」（只在列表还有更多 / 很长时才有意义，
 *     由页面通过 `showBottom` 选择是否启用）。
 *
 * 滚动监听用 passive + rAF 合并，不会与页面自身的滚动逻辑打架；卸载时解绑。
 */
import { useBewlyApp } from './useAppProvider'

export interface BackToTopOptions {
  /** 超过多少屏才出现，默认 2（与首页一致） */
  screens?: number
  /** 是否同时提供「回到底部」，默认 false */
  withBottom?: boolean
}

export interface BackToTopHandle {
  /** 是否需要显示「回到顶部」 */
  showTop: Ref<boolean>
  /** 是否需要显示「回到底部」（withBottom 为 false 时恒为 false） */
  showBottom: Ref<boolean>
  /** 平滑回到顶部（reduced-motion 下直接跳） */
  scrollToTop: () => void
  /** 平滑回到底部（reduced-motion 下直接跳） */
  scrollToBottom: () => void
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useBackToTopButton(options: BackToTopOptions = {}): BackToTopHandle {
  const screens = options.screens ?? 2
  const withBottom = options.withBottom ?? false

  const { scrollbarRef, handleBackToTop } = useBewlyApp()

  const showTop = ref<boolean>(false)
  const showBottom = ref<boolean>(false)
  const scrollTop = ref<number>(0)
  const viewportHeight = ref<number>(0)
  const scrollHeight = ref<number>(0)

  let boundEl: HTMLElement | null = null
  let frame = 0

  function readMetrics(): void {
    const el = boundEl
    if (!el)
      return
    scrollTop.value = el.scrollTop
    viewportHeight.value = el.clientHeight || window.innerHeight || 0
    scrollHeight.value = el.scrollHeight
  }

  function recompute(): void {
    readMetrics()
    const maxScroll = Math.max(0, scrollHeight.value - viewportHeight.value)
    /**
     * 出现阈值（真机踩到的坑）：只按「两屏」算时，自绘页列表往往**滚不到两屏**——
     * 热门页实测 maxScroll = 1350px、视口 1153px，两屏要 2306px，按钮永远不出现。
     * 所以取「两屏」与「半程」的较小值，并以 240px 兜底，保证任何可滚动的列表都能出现。
     */
    const twoScreens = viewportHeight.value * screens
    const threshold = Math.max(240, Math.min(twoScreens, maxScroll * 0.5))

    showTop.value = scrollTop.value > threshold
    /**
     * 「回到底部」只在**已经滚下来**且下方还有大半程时才出现。
     *
     * 真机踩到的坑：条件写成「剩余 > 阈值」时，页面刚打开（scrollTop 0）就会挂一个
     * 「回到底部」按钮 —— 用户还没滚动就先看到一个次要动作，纯属噪声。
     * 所以要求 showTop 同时成立，两个按钮永远成对出现。
     */
    showBottom.value = withBottom
      && showTop.value
      && maxScroll - scrollTop.value > threshold
  }

  function onScroll(): void {
    if (frame)
      return
    frame = window.requestAnimationFrame(() => {
      frame = 0
      recompute()
    })
  }

  function bind(): void {
    const next = (scrollbarRef.value as HTMLElement | null) ?? null
    if (next && next !== boundEl)
      boundEl = next
    recompute()
  }

  /**
   * 滚动监听挂在 `document` 的 **capture** 阶段，而不是绑到某个具体元素。
   *
   * 真机踩到的坑：自绘页的滚动容器由 mount.ts 注入 `scrollbarRef`，注入时机与
   * 本 composable 的 `onMounted` 不一定谁先谁后 —— 直接绑元素会漏掉「注入前就滚动」
   * 的那一段（实测搜索结果页首次进页面后滚到 1500px，按钮仍不出现）。
   * capture 不冒泡也没关系：`scroll` 事件在 document 上可以捕获到任意元素，
   * 命中时再判断 `event.target === boundEl`，时机问题自然消失。
   */
  function onDocumentScroll(event: Event): void {
    if (!boundEl || event.target !== boundEl)
      return
    onScroll()
  }

  function unbind(): void {
    boundEl = null
    if (frame) {
      window.cancelAnimationFrame(frame)
      frame = 0
    }
  }

  function scrollToTop(): void {
    const el = boundEl
    if (el) {
      if (prefersReducedMotion()) {
        el.scrollTop = 0
        // `handleBackToTop` 会顺带同步顶栏等页面级状态
        handleBackToTop()
      }
      else {
        el.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
    else {
      handleBackToTop()
    }
    // 平滑滚动期间按钮先收起，避免「点完还在，以为没生效」
    showTop.value = false
  }

  function scrollToBottom(): void {
    const el = boundEl
    if (!el)
      return
    const target = Math.max(0, el.scrollHeight - el.clientHeight)
    if (prefersReducedMotion())
      el.scrollTop = target
    else
      el.scrollTo({ top: target, behavior: 'smooth' })
    showBottom.value = false
  }

  onMounted(() => {
    bind()
    document.addEventListener('scroll', onDocumentScroll, { capture: true, passive: true })
    window.addEventListener('resize', recompute, { passive: true })
    // 容器注入 / 首屏数据到达后再补算几次（自绘页的列表高度是异步长出来的）
    window.setTimeout(recompute, 200)
    window.setTimeout(recompute, 800)
  })

  // 自绘页的滚动容器由 mount.ts 注入，可能晚一拍才有值
  watch(scrollbarRef, () => bind())

  onBeforeUnmount(() => {
    document.removeEventListener('scroll', onDocumentScroll, { capture: true })
    window.removeEventListener('resize', recompute)
    unbind()
  })

  return {
    showTop,
    showBottom,
    scrollToTop,
    scrollToBottom,
  }
}
