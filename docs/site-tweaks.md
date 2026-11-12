# 站点增强（site tweaks）

第 40 轮：内化油猴脚本 **«Make BiliBili Great Again»** 的 6 项功能。
全部通过设置页开关控制；设置字段在 `src/logic/storage.ts`（本模块只读，不改）。

| 功能 | 设置字段 | 默认 | 执行世界 | 实现文件 |
| --- | --- | --- | --- | --- |
| 清理 URL 追踪参数 | `siteTweaksCleanUrlParams` | **开** | 页面世界 + 内容脚本兜底 | `src/inject/index.js` / `siteTweaks/urlCleaner.ts` |
| 绕过 P2P CDN | `siteTweaksDisableP2P` | **关** | 页面世界 | `src/inject/index.js` / `siteTweaks/p2pBypass.ts` |
| 允许复制专栏正文 | `siteTweaksAllowArticleCopy` | **开** | 内容脚本 | `siteTweaks/articleCopy.ts` |
| 隐藏广告屏蔽提示 | `siteTweaksHideAdblockTip` | **开** | 内容脚本（CSS） | `siteTweaks/adblockTip.ts` |
| 隐藏视频页充电列表 | `siteTweaksHideChargeList` | **开** | 内容脚本（CSS） | `siteTweaks/chargeList.ts` |
| 播放器视频裁切 | `siteTweaksVideoFit` | **关** | 内容脚本（CSS + 菜单项） | `siteTweaks/videoFit.ts` |

## 页面世界部分

URL 清理与 P2P 绕过必须改**页面对象**（`history.pushState`、`HTMLMediaElement.prototype.src` setter、
`XMLHttpRequest.prototype.open`），因此写在仓库既有的 MAIN world 注入脚本 `src/inject/index.js` 里
（manifest `world: 'MAIN'`、`document_start` 加载，已有 `historyChange` 事件通道）。

开关通过 window 事件下发，不使用 `unsafeWindow`：

```js
window.dispatchEvent(new CustomEvent('bewly-site-tweaks', {
  detail: { cleanUrlParams: true, disableP2P: false },
}))
```

### URL 清理清单

`buvid`、`is_story_h5`、`launch_id`、`live_from`、`mid`、`session_id`、`timestamp`、
`up_id`、`vd_source`，以及前缀 `share*`、`spm*`。只清理 `*.bilibili.com` 的链接，站外 URL 原样返回。

### P2P 绕过与自动回退

- 命中 `mcdn.bilivideo.cn` / `*.szbdyd.com` 时把 host 换成 `upos-sz-mirrorali.bilivideo.com`；
- 媒体 `error` 事件触发时，把该目标域名记入 10 分钟黑名单，期间的 URL 自动回退到原始地址
  （对应脚本原作者的 recentErrors 思路）；
- 默认关闭；关闭时钩子仍保留包装，但直接放行原 URL（零副作用）。

## 内容脚本部分

`src/contentScripts/siteTweaks/index.ts` 导出：

```ts
export function setupSiteTweaks(): void // 按当前 settings 应用全部功能（幂等）
export function syncSiteTweaks(): void // 每拍同步（页面世界配置重发 + videoFit 菜单项补注入）
export function teardownSiteTweaks(): void // 全部还原（CSS / body 属性 / 监听 / 菜单项）
```

接线（`src/contentScripts/index.ts` 由 Lead 独占，本模块未改）：

```ts
import { setupSiteTweaks, syncSiteTweaks, teardownSiteTweaks } from './siteTweaks'

setupSiteTweaks() // settings 就绪后调用一次
syncSiteTweaks() // 放进已有的 500ms 心跳（watch settings 的拍子里）
teardownSiteTweaks() // 页面卸载 / 扩展停用时
```

## 注意事项

- 充电列表只隐藏**面板容器**（`#elec-full-info` / `.elec-full-info` / `.elec-mould` / `.video-elec`），
  不碰工具栏的充电按钮、也不使用 `[class*="elec"]` 这种宽匹配（会误伤 `.electron` 之类）；
- 广告提示隐藏用 `:has()`（Chromium 105+），只匹配「内部视频卡为空的 feed-card」；
- 视频裁切用 `body[data-video-fit]` 属性 + 一条 CSS 控制，播放器设置菜单里的开关项与设置页开关写的是同一个值；
- 专栏复制放行用**捕获阶段**的 `stopImmediatePropagation()`（B 站与我们在同一元素同一阶段，只有它能拦住同元素监听），
  不调用 `preventDefault()`，浏览器默认复制行为照常。
