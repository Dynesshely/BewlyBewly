# 性能优化记录

## 首屏基线

`tests/e2e/perf.spec.ts` 会记录：

- `#bewly` Shadow DOM 挂载耗时（从导航开始到宿主节点出现）；
- 首屏视频卡片出现耗时。

运行：`pnpm exec playwright test tests/e2e/perf.spec.ts`（报告里查看 `perf` annotation）。
当前实测（fixture 页面，本机）：挂载约 1.5–2s，首屏卡片约 2–3s。

## 已完成的优化

- 页面级样式按页注入：主 `style.css` 约 583 KB → 394 KB，页面样式按 URL 动态加载。
- 内置字体子集化：`ShangguSansSC-VF` 9.79 MB → 1.86 MB，扩展总包约 4.2 MB。
- 封面 `loading="lazy"` + `aspect-video` 固定比例，减少 CLS。
- 卡片使用 `content-visibility: auto` + `intrinsic-size` 跳过屏外渲染。
- 触底加载改为 `IntersectionObserver` 哨兵（移除滚动阈值计算）。
- 修复 `queryDomUntilFound` 的 `setInterval` 泄漏（改 MutationObserver）。
- TopBar / OldTopBar 的未读轮询定时器在卸载时清理；App 的 window scroll 监听改为命名函数并在卸载时移除。

## 列表渲染窗口化（评估，暂缓）

当前每页 30 张卡片、DOM 节点约 30–90 个，虚拟化的收益有限；但实现风险较高：

- 窗口化会破坏滚动锚定与"键盘导航滚动跟随"的位置计算；
- 卡片懒加载/悬停预览依赖元素存在；
- `content-visibility: auto` 已承担大部分屏外渲染成本。

结论：暂不做虚拟化；若未来单页卡片数显著增加（如 >200），再引入
`@tanstack/vue-virtual` 之类的窗口化方案，并同步改造滚动跟随逻辑。

## content-visibility 与滚动锚定（评估）

- 卡片已在根节点声明 `content-visibility: auto` 与 `intrinsic-size`，屏外跳过渲染。
- 本轮实测：给滚动容器或卡片加 `overflow-anchor: none` **不能**阻止"滚动位置被重置"
  的抽搐（该问题的真实根因是 ForYou 无限重请求导致持续重渲染，已修复）。
- 主滚动容器已加 `overscroll-behavior: contain`，避免滚动链传导到页面。

建议：保持卡片固定比例与 `intrinsic-size`；新增列表页时沿用同一套卡片骨架结构。

## 图片与 CLS

- 封面：`loading="lazy"`、`aspect-video object-cover`（已具备）。
- 骨架卡片与真实卡片共用卡片容器尺寸，避免数据到达后的布局跳动。
