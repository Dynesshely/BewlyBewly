/**
 * 隐藏「检测到广告屏蔽」提示与空信息流卡（第 40 轮，内化自油猴脚本）。
 *
 * B 站检测到广告被拦截时会在页面顶部弹一条「检测到您的页面展示可能受到浏览器插件影响…」，
 * 并可能留下一张空的信息流卡片。我们注入一段 CSS 把它们隐藏：
 * - `.adblock-tips`：提示条；
 * - `.feed-card:has(.bili-video-card > div:empty)`：内部视频卡为空的占位卡（`:has` 精准限定，不影响正常卡）。
 *
 * 用注入 `<style>` 的方式（`injectCSS`），卸载时移除节点即可完全还原。
 */

import { injectCSS } from '~/utils/dom'

/** 与油猴脚本同款选择器；只用 `!important` 保证压过 B 站内联样式 */
const CSS = `
.adblock-tips {
  display: none !important;
}

.feed-card:has(> .bili-video-card > div:empty) {
  display: none !important;
}

.feed-card:has(.bili-video-card > div:empty) {
  display: none !important;
}
`

let styleEl: HTMLStyleElement | null = null

/** 开启：注入样式（幂等） */
export function setupAdblockTip(): void {
  if (styleEl?.isConnected)
    return
  styleEl = injectCSS(CSS)
}

/** 关闭：移除样式节点 */
export function teardownAdblockTip(): void {
  styleEl?.remove()
  styleEl = null
}
