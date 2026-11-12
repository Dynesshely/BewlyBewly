/**
 * 站点增强的「页面世界」桥（第 40 轮）。
 *
 * 有两类事情必须放在页面世界（MAIN world）做，ISOLATED world 的内容脚本做不了：
 * - 改 `history.pushState / replaceState` 的入参（URL 追踪参数清理）；
 * - 改 `HTMLMediaElement.prototype.src` 的 setter 与 `XMLHttpRequest.prototype.open`
 *   （P2P CDN 地址绕过）。
 *
 * 仓库既有的注入通道是 `src/inject/index.js`（manifest `world: 'MAIN'`，document_start 加载），
 * 本模块只负责把 `settings` 里的开关通过 window 事件下发给它：
 *
 * ```ts
 * window.dispatchEvent(new CustomEvent('bewly-site-tweaks', { detail }))
 * ```
 *
 * 不新增依赖、不改 manifest、不用 unsafeWindow。
 */

/** 下发给页面世界的配置事件名（与 src/inject/index.js 里的监听保持一致） */
export const SITE_TWEAKS_EVENT = 'bewly-site-tweaks'

export interface SiteTweaksConfig {
  /** 清理 URL 追踪参数 */
  cleanUrlParams: boolean
  /** 绕过 P2P CDN（默认关） */
  disableP2P: boolean
}

/**
 * 把开关下发给页面世界。
 *
 * 页面世界脚本在 document_start 就装好钩子（默认值与 storage 默认值一致），
 * 因此这里可以随时重复调用；页面世界只改自己的配置对象，不会重复包装函数。
 */
export function pushSiteTweaksConfig(config: SiteTweaksConfig): void {
  try {
    window.dispatchEvent(new CustomEvent(SITE_TWEAKS_EVENT, { detail: config }))
  }
  catch {
    // 事件派发失败不影响内容脚本侧的功能
  }
}
