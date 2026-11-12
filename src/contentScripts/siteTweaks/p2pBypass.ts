/**
 * 绕过 P2P CDN（第 40 轮，内化自油猴脚本 «Make BiliBili Great Again»）。
 *
 * 背景：B 站对部分视频会下发 `mcdn.bilivideo.cn` / `*.szbdyd.com` 的 P2P 加速地址，
 * 这些域名在部分网络（校园网 / 部分 ISP）会 403 / 404，表现为「视频加载失败」。
 *
 * 真正的改写发生在**页面世界**（`src/inject/index.js`）：
 * - 劫持 `HTMLMediaElement.prototype.src` 的 setter（播放器主要走这里）；
 * - 劫持 `XMLHttpRequest.prototype.open`（部分清晰度走 XHR 拉分片）；
 * - 把 mcdn / szbdyd 域名回落到 `upos-sz-mirrorali.bilivideo.com`；
 * - 出错（media error / XHR 4xx）时把这个域名记入 10 分钟黑名单，期间自动回退原始地址
 *   （对应脚本里的 recentErrors 机制）。
 *
 * 本文件是内容脚本侧的**状态与开关**：
 * - 默认关闭（`siteTweaksDisableP2P: false`）；
 * - 开启后通知页面世界启用钩子；关闭后通知它停用（钩子本身保留包装，但直接放行原 URL）。
 */

import { pushSiteTweaksConfig } from './pageBridge'

/** 当前是否启用（内容脚本侧的镜像状态，用于诊断 / 汇报） */
let enabled = false

export function isP2PBypassEnabled(): boolean {
  return enabled
}

/**
 * 同步 P2P 开关到页面世界。
 *
 * @param next 是否启用绕过
 * @param cleanUrlParams 同一次下发里带上 URL 清理开关，减少事件次数
 */
export function syncP2PBypass(next: boolean, cleanUrlParams: boolean): void {
  enabled = next
  pushSiteTweaksConfig({ cleanUrlParams, disableP2P: next })
}
