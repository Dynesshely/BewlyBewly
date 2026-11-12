/**
 * 隐藏视频页「充电」列表（第 40 轮，内化自油猴脚本）。
 *
 * 真机类名核对（Brief 数据 + B 站现状）：
 * - 充电主面板：`#elec-full-info`（视频页左栏下方的「为 TA 充电」整块）；
 * - 同类变体：`.elec-full-info` / `.elec-mould` / `.video-elec`；
 * - **不能误伤**：`.elec-btn`（工具栏里的充电小按钮，用户可能仍想用）、
 *   `.up-info--elec`（UP 卡上的粉丝牌/等级）、把 `[class*="elec"]` 当通配会更危险（`.electron` 之类）。
 *
 * 因此这里只隐藏**明确的面板容器**，不碰按钮与 UP 卡内的元素。
 */

import { injectCSS } from '~/utils/dom'

const CSS = `
#elec-full-info,
.elec-full-info,
.elec-mould,
.video-elec,
.report-wrap .elec-full-info {
  display: none !important;
}
`

let styleEl: HTMLStyleElement | null = null

/** 是否视频/番剧页（充电面板只在这些页面出现） */
function isVideoLikePage(): boolean {
  return /^https?:\/\/(?:www\.)?bilibili\.com\/(?:video|bangumi)\//i.test(location.href)
}

/** 开启：注入样式（幂等；非视频页也注入，成本极低且避免路由切换时漏掉） */
export function setupChargeList(): void {
  if (styleEl?.isConnected)
    return
  if (!isVideoLikePage())
    return
  styleEl = injectCSS(CSS)
}

/** 关闭：移除样式节点 */
export function teardownChargeList(): void {
  styleEl?.remove()
  styleEl = null
}
