/**
 * 直播页原生 DOM 适配层。
 *
 * 职责只有三件：找到要覆盖 / 要隐藏的原生节点、隐藏与还原、以及在自绘失败时把控制权还回去。
 * 所有选择器集中在 `constants.ts`，这里只做「多候选 + 允许失败」的查询，任何一步查不到
 * 都返回 null，由调用方决定不接管（保留原生页面）。
 */
import {
  HOME_AREA_NAV_SELECTORS,
  HOME_CONTENT_SELECTORS,
  NATIVE_HIDDEN_ATTR,
  NATIVE_MUTED_ATTR,
  NAVBAR_SELECTORS,
  PAGE_STYLE_ID,
  ROOM_FOLLOW_SELECTORS,
  ROOM_HEAD_INFO_SELECTORS,
  ROOM_PLAYER_SELECTORS,
  ROOM_RIGHT_COLUMN_SELECTORS,
  ROOM_SECTION_SELECTORS,
} from './constants'

/** 按顺序试选择器，返回第一个命中的元素 */
function firstMatch<T extends Element>(selectors: string[], root: ParentNode = document): T | null {
  for (const selector of selectors) {
    const el = root.querySelector<T>(selector)
    if (el)
      return el
  }
  return null
}

/** 站点头栏高度（自绘首页从它下面开始；测不到时按 64px） */
export function measureNavbarHeight(): number {
  const navbar = firstMatch<HTMLElement>(NAVBAR_SELECTORS)
  if (!navbar)
    return 64
  const rect = navbar.getBoundingClientRect()
  const bottom = Math.round(rect.bottom)
  return bottom > 0
    ? bottom
    : 64
}

/**
 * 首页需要隐藏的原生内容。
 *
 * 真机（新版 v2 布局）：`.v2-main-scroll > main.mx-20px` 是全部内容
 * （banner / 小播放器 / 我的关注 / 推荐直播），分区行 `nav[aria-label="直播分区"]`
 * 是滚动容器外的另一行，两处都要隐藏，否则会出现「原生分区 pill + 自绘分区 pill」两套。
 */
export function findHomeNativeContent(): { content: HTMLElement[], areaNav: HTMLElement | null } {
  const content = new Set<HTMLElement>()
  for (const selector of HOME_CONTENT_SELECTORS) {
    document.querySelectorAll<HTMLElement>(selector).forEach(el => content.add(el))
  }
  const areaNav = firstMatch<HTMLElement>(HOME_AREA_NAV_SELECTORS)
  // 分区行的包装层只包着分区行时一起隐藏，避免留下一条 60px 的空白条
  if (areaNav?.parentElement && areaNav.parentElement.children.length <= 2)
    content.add(areaNav.parentElement as HTMLElement)
  else if (areaNav)
    content.add(areaNav)
  return {
    content: [...content],
    areaNav,
  }
}

/** 隐藏节点（inline !important + 标记，卸载时只还原自己标记过的） */
export function hideNativeElements(elements: HTMLElement[]): void {
  for (const el of elements) {
    if (!el.isConnected)
      continue
    el.setAttribute(NATIVE_HIDDEN_ATTR, '')
    el.style.setProperty('display', 'none', 'important')
  }
}

/** 还原所有被隐藏的原生节点 */
export function restoreNativeElements(): void {
  document.querySelectorAll<HTMLElement>(`[${NATIVE_HIDDEN_ATTR}]`).forEach((el) => {
    el.removeAttribute(NATIVE_HIDDEN_ATTR)
    el.style.removeProperty('display')
  })
  restoreNativeMutedNodes()
}

/**
 * 首页隐藏原生内容时，原生小播放器可能还在出声，统一静音并暂停。
 * 返回被暂停的 video 元素，卸载时逐个恢复（只在原本就在播放时才恢复）。
 */
const pausedVideos = new Set<HTMLVideoElement>()

export function pauseNativeVideos(root: ParentNode = document): void {
  root.querySelectorAll<HTMLVideoElement>('video').forEach((video) => {
    if (video.paused)
      return
    try {
      video.pause()
      pausedVideos.add(video)
    }
    catch {
      // 播放器内部抛错时忽略：静音失败不影响自绘
    }
  })
}

export function resumeNativeVideos(): void {
  for (const video of pausedVideos) {
    if (!video.isConnected) {
      pausedVideos.delete(video)
      continue
    }
    video.play().catch(() => {
      // 浏览器可能拒绝自动播放，忽略即可
    })
    pausedVideos.delete(video)
  }
}

/** 直播间：播放器列容器（`position: relative`，自绘顶部栏绝对定位在它里面） */
export function findRoomPlayerColumn(): HTMLElement | null {
  return firstMatch<HTMLElement>(ROOM_PLAYER_SELECTORS)
}

/** 直播间：原生顶部信息栏（`#head-info-vm`，52px） */
export function findRoomHeadInfo(): HTMLElement | null {
  return firstMatch<HTMLElement>(ROOM_HEAD_INFO_SELECTORS)
}

/**
 * 掩盖原生顶部信息栏的内容。
 *
 * 用 `visibility: hidden` 而不是 `display: none`：
 *   1. 保留 52px 高度，播放器位置不变（自绘栏正好盖住这块）；
 *   2. 原生关注控件仍在 DOM 里可点，自绘的关注按钮转发点击给它（真机关注逻辑是 @click）。
 */
export function muteRoomHeadInfo(headInfo: HTMLElement): void {
  for (const child of Array.from(headInfo.children)) {
    if (!(child instanceof HTMLElement))
      continue
    child.setAttribute(NATIVE_MUTED_ATTR, '')
    child.style.setProperty('visibility', 'hidden', 'important')
  }
}

function restoreNativeMutedNodes(): void {
  document.querySelectorAll<HTMLElement>(`[${NATIVE_MUTED_ATTR}]`).forEach((el) => {
    el.removeAttribute(NATIVE_MUTED_ATTR)
    el.style.removeProperty('visibility')
  })
}

/** 还原原生顶部信息栏 */
export function restoreRoomHeadInfo(): void {
  restoreNativeMutedNodes()
}

/** 直播间：舞台下方的右侧列（原生只放主播公告，推荐列表挂在它下面） */
export function findRoomRightColumn(): HTMLElement | null {
  const column = firstMatch<HTMLElement>(ROOM_RIGHT_COLUMN_SELECTORS)
  if (column)
    return column
  const section = firstMatch<HTMLElement>(ROOM_SECTION_SELECTORS)
  return section?.querySelector<HTMLElement>('.right-container') ?? null
}

/** 原生关注控件（自绘按钮点它） */
export function findNativeFollowControl(): HTMLElement | null {
  return firstMatch<HTMLElement>(ROOM_FOLLOW_SELECTORS)
}

/**
 * 转发关注点击给原生控件。
 *
 * 真机关注按钮是 `.follow-ctnr`（带 `data-curbutton` / `data-curbuttonstrategy`）里的 div，
 * B 站用 @click 处理；自绘栏只是把这次点击转发过去，不自己发关注请求（避免 csrf / 风控问题）。
 */
export function triggerNativeFollow(): boolean {
  const control = findNativeFollowControl()
  if (!control)
    return false
  control.click()
  return true
}

/**
 * 从原生关注控件读关注状态（接口读不到时的兜底）。
 *
 * 真机 `.follow-ctnr` 上带 `data-curbutton="unFollow"`（未关注）/ 其它值（已关注）。
 */
export function readNativeFollowState(): boolean | null {
  const control = document.querySelector<HTMLElement>('.follow-ctnr')
  if (!control)
    return null
  const marker = control.getAttribute('data-curbutton')
  if (marker)
    return marker !== 'unFollow'
  if (control.querySelector('.not-yet-follow'))
    return false
  return null
}

/** 轮询等待元素出现（直播间 DOM 异步渲染，首屏可能还没有播放器列） */
export function waitForElement<T extends Element>(
  getter: () => T | null,
  timeout = 6_000,
  interval = 200,
): Promise<T | null> {
  return new Promise((resolve) => {
    const started = Date.now()
    const tick = () => {
      const found = getter()
      if (found) {
        resolve(found)
        return
      }
      if (Date.now() - started >= timeout) {
        resolve(null)
        return
      }
      window.setTimeout(tick, interval)
    }
    tick()
  })
}

/** 注入页面级 <style>（幂等；直播站没有对应的 adaptedStyles 分支） */
export function injectPageCss(css: string): void {
  if (document.getElementById(PAGE_STYLE_ID))
    return
  const style = document.createElement('style')
  style.id = PAGE_STYLE_ID
  style.textContent = css
  document.head?.appendChild(style)
}

/** 移除页面级 <style> */
export function removePageCss(): void {
  document.getElementById(PAGE_STYLE_ID)?.remove()
}
