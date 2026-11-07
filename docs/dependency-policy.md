# 依赖治理

## 已锁定版本与原因

| 包 | 版本 | 原因 |
| --- | --- | --- |
| `typescript` | 5.9.3 | TS 7 与 `@typescript-eslint` / `vue-tsc` 不兼容 |
| `vue-tsc` | 2.2.12 | 3.x 对 Vue 3.5 模板有大量误报 |
| `overlayscrollbars` | 2.7.3 | 2.17 在部分场景下滚动位置被重置（回归点） |
| `overlayscrollbars-vue` | 0.5.9 | 与 2.7.3 配套；0.5.10 需重新回归 |
| `node` | ^22.12 或 >=24 | vitest 5 要求 |

## 升级流程

1. 单独分支升级一个主依赖（或一组强关联依赖）；
2. `pnpm lint` + `pnpm run typecheck` + `pnpm exec vitest run` + `pnpm build`；
3. `pnpm exec playwright test`（离线 e2e）；
4. 手动回归清单：
   - 首页滚动位置是否稳定（OverlayScrollbars 相关升级必查）；
   - tabs 横向滚动、设置面板滚动；
   - 键盘导航切换与焦点跟随；
   - 从播放页返回首页的状态恢复；
5. 更新本文件与 `package.json` 注释（必要时）。

## overlayscrollbars 专项

历史问题：升级到 2.17 后，主滚动容器直接设置 `viewport.scrollTop` 会被内部
`update()` 重置为 0。当前方案是主容器改用原生滚动；局部 OverlayScrollbars
仍锁定 2.7.3。升级前必须验证：

- 原生容器方案不依赖 OverlayScrollbars（主容器）；
- tabs、设置页等局部的滚动/横滚行为正常。
