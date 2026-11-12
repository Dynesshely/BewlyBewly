/**
 * 站点增强（第 40 轮）：内化油猴脚本 «Make BiliBili Great Again» 的 6 项功能。
 *
 * 用户点名的 6 件事与设置字段（`src/logic/storage.ts`，默认值已存在）：
 *
 * | 功能 | 设置字段 | 本目录文件 | 执行世界 |
 * | --- | --- | --- | --- |
 * | 清理 URL 追踪参数 | `siteTweaksCleanUrlParams` | `urlCleaner.ts` | 页面世界 + 内容脚本兜底 |
 * | 绕过 P2P CDN | `siteTweaksDisableP2P` | `p2pBypass.ts` | 页面世界 |
 * | 允许复制专栏正文 | `siteTweaksAllowArticleCopy` | `articleCopy.ts` | 内容脚本 |
 * | 隐藏广告屏蔽提示 | `siteTweaksHideAdblockTip` | `adblockTip.ts` | 内容脚本（CSS） |
 * | 隐藏视频页充电列表 | `siteTweaksHideChargeList` | `chargeList.ts` | 内容脚本（CSS） |
 * | 播放器视频裁切 | `siteTweaksVideoFit` | `videoFit.ts` | 内容脚本（CSS + 菜单项） |
 *
 * 页面世界部分复用仓库既有注入通道 `src/inject/index.js`（manifest `world: 'MAIN'`，
 * document_start 加载），本模块通过 `pageBridge.ts` 派发开关事件，不使用 unsafeWindow。
 *
 * 接线由 Lead 负责（`src/contentScripts/index.ts` 是 Lead 独占）：
 * ```ts
 * import { setupSiteTweaks, syncSiteTweaks, teardownSiteTweaks } from './siteTweaks'
 * // 顶层（settings 就绪后）：setupSiteTweaks()
 * // 已有的 watch(settings, ...) 每拍：syncSiteTweaks()
 * // 卸载：teardownSiteTweaks()
 * ```
 */

import { watch } from 'vue'

import { settings } from '~/logic'

import { setupAdblockTip, teardownAdblockTip } from './adblockTip'
import { setupArticleCopy, teardownArticleCopy } from './articleCopy'
import { setupChargeList, teardownChargeList } from './chargeList'
import { syncP2PBypass } from './p2pBypass'
import { setupUrlCleaner, teardownUrlCleaner } from './urlCleaner'
import { setupVideoFit, syncVideoFit, teardownVideoFit } from './videoFit'

let started = false
let stopWatch: (() => void) | null = null

/** 读开关：`settings` 还没就绪时按 storage 的默认值兜底 */
function readFlags() {
  const value = settings.value
  return {
    cleanUrlParams: value.siteTweaksCleanUrlParams ?? true,
    disableP2P: value.siteTweaksDisableP2P ?? false,
    allowArticleCopy: value.siteTweaksAllowArticleCopy ?? true,
    hideAdblockTip: value.siteTweaksHideAdblockTip ?? true,
    hideChargeList: value.siteTweaksHideChargeList ?? true,
    videoFit: value.siteTweaksVideoFit ?? false,
  }
}

/** 按当前开关应用全部功能（幂等，可重复调用） */
function apply(): void {
  const flags = readFlags()

  // 页面世界：URL 清理 + P2P 绕过 由注入脚本执行，这里只下发开关
  syncP2PBypass(flags.disableP2P, flags.cleanUrlParams)
  if (flags.cleanUrlParams)
    setupUrlCleaner()
  else
    teardownUrlCleaner()

  if (flags.allowArticleCopy)
    setupArticleCopy()
  else
    teardownArticleCopy()

  if (flags.hideAdblockTip)
    setupAdblockTip()
  else
    teardownAdblockTip()

  if (flags.hideChargeList)
    setupChargeList()
  else
    teardownChargeList()

  if (flags.videoFit) {
    setupVideoFit()
    syncVideoFit()
  }
  else {
    teardownVideoFit()
  }
}

/**
 * 启动站点增强。
 *
 * 幂等：重复调用不会重复绑定（内部各模块都自己判重）。
 */
export function setupSiteTweaks(): void {
  if (started)
    return
  started = true
  apply()

  // 设置页改动后立即生效（无需等下一拍）
  stopWatch = watch(() => ({ ...settings.value }), () => apply(), { deep: false })
}

/**
 * 每拍同步（由外部 500ms 心跳调用）。
 *
 * 处理两类时序问题：
 * - 页面世界脚本可能比内容脚本晚就绪（document_start 竞态）→ 重发一次配置；
 * - 播放器菜单 / 专栏正文是动态渲染的 → 由各模块内部补注入。
 */
export function syncSiteTweaks(): void {
  if (!started) {
    setupSiteTweaks()
    return
  }
  const flags = readFlags()
  syncP2PBypass(flags.disableP2P, flags.cleanUrlParams)
  if (flags.cleanUrlParams)
    setupUrlCleaner()
  if (flags.videoFit)
    syncVideoFit()
}

/** 卸载：还原所有注入（CSS / 属性 / 监听 / 菜单项） */
export function teardownSiteTweaks(): void {
  stopWatch?.()
  stopWatch = null
  teardownUrlCleaner()
  teardownArticleCopy()
  teardownAdblockTip()
  teardownChargeList()
  teardownVideoFit()
  started = false
}
