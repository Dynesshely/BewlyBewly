# 与上游（BewlyBewly 归档版）的差异

上游最后版本：`v0.41.1`（2025-02-26 归档）。本 fork 在归档版本上继续维护。

## 依赖与工具链

- 依赖升级到 latest（TS 5.9.3、vue-tsc 2.2.12、pinia 4、Vite 8 等），
  兼容性原因见 `docs/dependency-policy.md`。
- 移除 wxt / release-it-pnpm / submit 相关脚本。
- 新增 Playwright e2e 与每日在线 DOM 探针。

## 样式

- 页面级样式改为按页注入（主 style.css 体积下降约 33%）。
- 内置字体子集化（ShangguSansSC-VF 9.79 MB → 1.86 MB），扩展总包约 4.2 MB。

## 稳定性修复（相对上游）

- 后台消息监听注册时机：`onMessage` 改为启动时直接注册（上游只在 `onConnect`
  中注册，导致 content script 的 `sendMessage` 全部返回 `undefined`）。
- ForYou 无限重载：接口数据不足一页时不再无限递归（会持续重渲染并重置滚动），
  无数据时保留骨架卡片并停止请求，新增 `loadStatus` 状态机。
- 推荐接口在后台消息不可用时回退为 content script 同源 fetch。
- `queryDomUntilFound` 的 `setInterval` 泄漏改为 MutationObserver。

## 主滚动容器

- 由 OverlayScrollbars 改为原生滚动容器（`div.bewly-scroll-container`），
  解决滚动位置被内部逻辑重置的问题；OverlayScrollbars 仍用于 tabs 横滚等局部场景
  （版本锁定见依赖策略）。

## 键盘卡片导航（新增）

见 `docs/keyboard-navigation.md`。

## 维护约定

- 上游已归档，B 站改版后需自行适配；`tests/e2e/dom-probe.spec.ts` 与每日探针
  用于尽早发现 DOM 变更。
