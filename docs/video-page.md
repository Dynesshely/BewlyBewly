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

- 番剧 / 电影播放页（`/bangumi/play/*`）同样接入本模块，差异见下文「番剧 / 电影播放页」一节；
  其他播放页（课堂 `/cheese/*`、直播等）不在接管范围
- 播放器的内部布局仍由 B 站脚本计算，影院模式的 16:9 兜底样式依赖 `aspect-ratio`；
  极端窗口比例下以原生脚本的重算结果为准
- 全屏（浏览器全屏）时增强层不在全屏元素内，浮动控件不可见，这是预期行为
- 分 P / 换集由 B 站自己替换播放器元素，本模块靠 500ms 轮询重新绑定状态，切换瞬间进度可能有一拍延迟
## 番剧 / 电影播放页（第 4 轮扩展）

番剧 / 电影播放页（`www.bilibili.com/bangumi/play/*`，含电影、国创、纪录片）复用**同一套**
影院模式、迷你播放器、快捷键、紧凑信息栏与帮助面板，没有第二套 UI：

- 判定：`getNativePlaybackKind()` 返回 `'video'`（`/video/*`、`/list/*`）或
  `'bangumi'`（`/bangumi/play/*`），`isNativeVideoPage()` 对两者都为真
- 布局：番剧页的播放器外层没有 `#playerWrap`，改为由 JS 给「播放器外层」打
  `data-bewly-player-stage`、给祖先链打 `data-bewly-player-stage-ancestor`，
  `animePlayback&MoviePage.scss` 里的影院 / 迷你样式只认这两个属性，不依赖 CSS Modules 哈希类名
- 影院模式：播放器舞台 `position: fixed` 铺满视口宽度，其余内容用 `body::before` 遮罩压暗，
  同时尽力隐藏右侧信息列 / 剧集列表 / 推荐 / 榜单 / 赞助（命中不了的由遮罩压暗）
- 迷你播放器：同样把舞台 fixed 到右下角；番剧页没有 `.left-container` 可撑高，
  由 JS 在舞台父级写 `min-height` 占位，避免收起浮窗时页面内容上跳
- 标题 / UP 主：新增 `[class*="mediainfo_mediaTitle"]`、`.media-info .media-title`、
  `[class*="upinfo_upName"]`、`.up-info .up-name` 等选择器，读不到时回退 `document.title`
- 切集：`[` 上一集、`]` 下一集。实现是点击集数列表里相邻的一项
  （新版 `[class*="numberListItem_number_list_item"]`，旧版 `.ep-list-wrapper .ep-item`），
  与点原生「上一话 / 下一话」等价；**页面上没有集数列表时（电影单集、结构改版）
  这两项不会出现在帮助面板里，按键也交还给 B 站原生处理**
- 原生小窗优先：番剧页同样支持 B 站自己的小窗播放，检测到原生 `.bpx-player-container`
  已 `position: fixed` 时不再叠加本模块的迷你浮窗
- 设置开关（`videoPageCinemaMode` / `videoPageMiniPlayer` / `videoPageShortcuts`）对两类页面同时生效

已知限制：

- 番剧页的结构由 CSS Modules 生成，隐藏右栏/推荐用的是 `[class*="..."]` 近似选择器；
  页面改版后若某块内容没被隐藏，仍会被影院遮罩压暗，不影响观看
- 切集快捷键依赖集数列表的 DOM 顺序；若 B 站改成虚拟列表（只渲染可视项），相邻集判定可能失效，
  届时需要按真实结构补充选择器
## 播放列表页（/list/*，第 12 轮扩展）

`/list/watchlater?bvid=…`、`/list/ml…`、`/list/…` 这类**播放列表播放页**除了原有的影院 / 迷你 / 快捷键，
本轮补了「播放列表」本身的交互：浮动按钮在既有的 `bilibili-video-page` 浮层里，
**面板用 `src/contentScripts/nativeOverlay` 挂成独立的 `#bewly-video-playlist` host**
（与消息页 / 搜索页同一套挂载方式与 `--bew-*` 令牌），探测不到列表结构时整个 host 不渲染。

- 结构探测：容器 `#playlist-container` / `.video-pod` / `[class*="video-pod"]`，
  条目 `.video-pod__item` → `.video-pod__list .simple-base-item` → `.video-pod__list [class*="item"]`
  （类名证据来自 `src/styles/adaptedStyles/thirdParties/bilibiliEnhanceVideoList.scss`）；
  **探测不到播放列表时，浮动按钮、面板、快捷键、自动连播全部不渲染**，不留空浮层
- 右下角「播放列表」按钮 → 打开面板：条目按顺序列出，当前项高亮 + `aria-current="true"`，
  顶部显示「当前 / 总数」与自动连播开关；点条目**直接点原生条目链接**，路由由 B 站自己处理
- 面板条目是原生 `<button>`：Tab 可达、Enter/Space 触发、`:focus-visible` 主题色描边；
  打开面板时会把当前项滚动到面板可视区中间
- 自动连播：默认关，状态存 `sessionStorage`（key `bewly-playlist-autoplay`）；
  开启后视频触发 `ended` 时延时 400ms 再动作（让 B 站自己的 ended 处理先跑）：
  优先点播放器原生的「下一个」按钮，找不到就点列表里的下一项；
  两者都没有（最后一项 / 页面没有下一个入口）时自动关闭自动连播并提示
- 快捷键（沿用同一份数据源，帮助面板按页面能力过滤）：
  - `[` / `]` 上一个 / 下一个播放项（`<` `>` 亦可；番剧页这两个键走「上一集 / 下一集」，两者按页面能力互斥）
  - `A` 自动连播开关
  - `Esc` 依次关闭：快捷键帮助 → 播放列表面板 → 影院模式
- 进入影院模式会自动收起播放列表面板；离开播放页 / 列表结构消失时状态与监听一并清理

已知限制：

- 真实播放列表页 DOM 未实测：面板条目选择器按仓库内已有样式证据选择，命中不了就完全不渲染（可降级）；
  自动连播的原生「下一个」按钮选择器（`.bpx-player-ctrl-next` 等）同样带兜底，兜底到点列表下一项
- 点击条目是否成功切换取决于 B 站对该条目的原生点击处理；本模块只 `click()`，不模拟路由
## 选集面板：分P / 播放列表（第 13 轮扩展）

第 12 轮的「播放列表面板」在本轮升级为**通用选集面板**：同一个浮动入口 / 面板组件，按页面能力显示
「播放列表」或「选集（分P）」。三类页面的能力**互斥**：

| 页面 | 选集来源 | 面板标题 | `[` / `]` | `A` 自动连播 |
|---|---|---|---|---|
| 番剧 / 电影 `/bangumi/play/*` | 集数列表（原有能力，不进面板） | — | 上一集 / 下一集 | 不可用（交给 B 站） |
| 播放列表 `/list/*` | `.video-pod` 等播放列表条目 | 播放列表 | 上一个 / 下一个播放项 | 可用 |
| 普通多P 视频 `/video/*` | `#multi_page` / `.multi-page-v1` 分P 列表 | 选集 | 上一 P / 下一 P | 不可用（交给 B 站） |

**探测规则**（`src/contentScripts/videoPage/dom.ts` 的 `getSelectionContext()`）

- 播放列表：`#playlist-container` / `.video-pod` / `[class*="video-pod"]` 内的 `.video-pod__item`、
  `.video-pod__list .simple-base-item`
- 分P（按优先级）：`#multi_page .list-box li` → `.multi-page-v1 .cur-list .list-box li` →
  `.multi-page-v1 .list-box li` → `[class*="multi-page"] .list-box li` → `#multi_page li` →
  `.video-pod__list .simple-base-item` → `.video-pod__item`
- 兜底启发式：同一路径下存在 **2 个以上带 `p=` 的视频链接**（`a[href*="p="]`）时，直接把这些链接当分P 条目
- 当前项：先看原生高亮类（`on` / `active` / `current` / `selected` / `cursor` 或 `aria-current`，
  分P 支持高亮挂在父级 `li` 上），再看 URL 的 `p=` / `bvid` 与条目链接匹配；判定失败时下标为 -1，面板仍可用
- **任何一类都探测不到时，浮动入口、面板 host、快捷键、帮助项全部不渲染**，不留空浮层

**交互**

- 点条目：直接点原生条目里的 `<a>`（分P 链接 / 播放列表链接），路由交给 B 站，不模拟跳转
- 当前项主题色高亮 + `aria-current="true"`；条目是原生 `<button>`（Tab 可达、Enter/Space 触发）
- 面板打开时把当前项滚到可视区中间；`Esc` 关闭面板（顺序：帮助 → 面板 → 影院）
- 自动连播（`A`）只在播放列表页提供：分P / 番剧的连播由 B 站自己处理，避免两边同时跳

**降级与已知限制**

- 分P 的容器/条目选择器全部按优先级尝试，命中不了就走「2 个以上 `p=` 链接」兜底；
  两者都失败时入口不出现（不会出现「面板空着」的状态）
- 面板标题跟随来源：`/list/*` 为「播放列表」，普通多P 视频为「选集」；文案来自模块内 i18n（四种语言）
- 分P 页不提供自动连播，帮助面板也不会列出 `A`（避免与 B 站自己的分P 自动切换冲突）
