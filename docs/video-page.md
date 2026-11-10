# 视频播放页增强

B 站原生播放页（`www.bilibili.com/video/*`、`/list/*`）不是 Bewly 接管页：页面仍由 B 站渲染，
本模块只在其上叠加一层**独立 shadow root** 的增强层，提供影院模式、滚动迷你播放器、快捷键与紧凑信息栏。

- 入口：`src/contentScripts/videoPage/index.ts`（`setupVideoPage()` / `teardownVideoPage()`）
- 容器：`#bewly-video-page`（与 `#bewly` 互不嵌套，避免两套 shadow root 的样式互相影响）
- 宿主页面布局改动：`src/styles/adaptedStyles/pages/videoPage.scss` 末尾的
  `.bewly-video-cinema` / `.bewly-video-mini` 两段
- 增强层自身样式：`src/contentScripts/videoPage/videoPage.shadow.scss`（`?inline` 注入 shadow root）

## 影院模式

- 触发：右下角浮动按钮，或快捷键 `T`
- 行为：播放器扩展到视口宽度（16:9）、隐藏右栏与推荐列表、页面其余内容压暗到 38%、
  页面背景加深，并自动滚回页面顶部
- 退出：再按 `T` 或 `Esc`
- 状态存 `sessionStorage`（key：`bewly-video-cinema`），同一标签页刷新后保持，新标签页从关闭开始
- 进入影院模式会自动复位迷你播放器，两个状态不会叠加

## 滚动迷你播放器

- 播放器整体滚出视口上方时，`#playerWrap` 收成右下角浮窗（`position: fixed`，16:9，宽 `min(420px, 34vw)`），
  **保留原生播放器控件**，仍然可以在浮窗里暂停 / 拖动进度 / 调音量
- 左栏用收缩前测得的播放器高度做占位（`--bvp-mini-placeholder`），页面内容不会因此上跳
- 还原：浮动按钮「还原播放器」、紧凑信息栏「回到播放」、快捷键 `P`，或向上滚回原位（带 160px 滞回，避免边界抖动）
- 进入影院模式 / 离开页面时自动复位
- 播放器尺寸变化后会派发 `resize` 事件，让 B 站原生播放器重新计算布局

## 快捷键

在捕获阶段接管下表中的按键，处理完 `stopPropagation`，避免与 B 站原生快捷键重复触发；
不认识的按键（空格、`↑`/`↓` 音量、`D` 弹幕输入等）完全交给原生处理。
若事件已被 `preventDefault()`（原生或其它扩展先处理过），本模块让行。

| 按键 | 行为 |
|---|---|
| `J` / `L` | 后退 / 前进 10 秒 |
| `K` | 播放 / 暂停 |
| `←` / `→` | 后退 / 前进 5 秒 |
| `C` | 开关弹幕（委托原生控件，状态与播放器同步） |
| `M` | 静音切换 |
| `F` | 全屏（优先点原生全屏按钮，保留网页全屏逻辑） |
| `T` | 影院模式 |
| `Shift + P` | 画中画 |
| `P` | 还原迷你播放器 |
| `0` – `9` | 跳到 0% – 90% 进度 |
| `?` | 打开 / 关闭快捷键帮助 |
| `Esc` | 退出影院模式 / 关闭快捷键帮助 |

以下场景不劫持按键：焦点在输入框 / 评论框 / `contenteditable` 里；事件来自 Bewly 自己的 UI（`#bewly`）；
带 `Ctrl` / `Cmd` / `Alt` 的组合键（除 `Shift + P`）。

## 紧凑信息栏

页面滚动超过 160px 后，顶部滑出 48px 高的紧凑信息栏：标题、UP 主名、操作按钮
（回到播放 / 弹幕 / 影院 / 快捷键帮助），底部有一条 2px 的播放进度细线。
标题与 UP 主名来自原生 DOM（`.video-title` / `.up-name` 等），每 500ms 同步一次。

## 暗色与动效

- 颜色、圆角、阴影全部使用 `--bew-*` 变量，跟随主题色与 `.dark`
- 过渡 150–240ms，`cubic-bezier(.22,.61,.36,1)`
- `prefers-reduced-motion: reduce` 时禁用位移 / 透明度过渡，紧凑栏改为 `display` 切换

## DOM 适配点

所有依赖 B 站页面结构的查询集中在 `src/contentScripts/videoPage/dom.ts`：

- 播放器外层：`#playerWrap`，播放器：`#bilibili-player` / `.bpx-player-container`
- 视频元素：`#bilibili-player video` 等
- 标题：`h1.video-title` / `.video-title` / `.video-info-title-inner h1`
- UP 主：`.up-detail .up-name` / `.up-name`
- 弹幕开关：`.bpx-player-dm-switch` 内的 checkbox / `.bui-danmaku-switch-input`

页面改版时只需要改这一个文件；所有查询都允许返回 `null`，播放器未就绪时 UI 不会报错，只是暂不可用。

## 已知限制

- 只接管普通视频页与播放列表页；番剧 / 电影播放页（`/bangumi/play/*`）有自己的适配样式，本模块不介入
- 播放器的内部布局仍由 B 站脚本计算，影院模式的 16:9 兜底样式依赖 `aspect-ratio`；
  极端窗口比例下以原生脚本的重算结果为准
- 全屏（浏览器全屏）时增强层不在全屏元素内，浮动控件不可见，这是预期行为
- 分 P / 换集由 B 站自己替换播放器元素，本模块靠 500ms 轮询重新绑定状态，切换瞬间进度可能有一拍延迟
