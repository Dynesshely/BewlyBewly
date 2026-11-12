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
## 选集面板：分P / 播放列表 / 合集（第 13–15 轮）

同一个浮动入口 / 面板组件，按页面能力显示「播放列表 / 选集（分P）/ 合集」。四类页面**互斥**：

| 页面 | 选集来源 | 面板标题 | `[` / `]` | `A` 自动连播 |
|---|---|---|---|---|
| 番剧 / 电影 `/bangumi/play/*` | 集数列表（原有能力，不进面板） | — | 上一集 / 下一集 | 不可用（交给 B 站） |
| 播放列表 `/list/*` | `.video-pod` 播放列表条目 | 播放列表 | 上一个 / 下一个播放项 | 可用 |
| 普通多P 视频 `/video/*` | 现代 `.video-pod`（列表含 `multip`）或旧版 `#multi_page` | 选集 | 上一 P / 下一 P | 不可用（交给 B 站） |
| 合集视频页 `/video/*` | `.video-pod` + header 合集语义 | 合集 | 上一个 / 下一个视频 | 不可用（交给 B 站） |

### 真机 DOM 证据（2026-11 实测）

**分P**（`/video/BV1wvWM6RE3Z/`，8 个分P）：

- 容器：`.video-pod.video-pod`
- header：`视频选集 （1/8）`（`[class*="video-pod__header"]` 内）
- 列表：class 为 `video-pod__list multip list`（**`multip` 是分P 最强信号**）
- 条目：`simple-base-item video-pod__item active normal`，当前 P 带 `.active`
- **条目内部没有 `<a>`**：点击条目 DIV 本身即可切换（实测点第 3 项后 URL 变为 `?p=3`）

**合集**（`/video/BV14a411n7Rf/`，合集「钩织入门教程」10 集）：

- 同样只有一个 `.video-pod`
- header：`钩织入门教程 （1/10） 491万播放 暂无简介 简介 订阅合集`
- 列表：class 为 `video-pod__list section`（**没有 `multip`**）
- 条目：10 个，指向合集内**不同 bvid**
- ⚠️ header 里的 `（1/10）` 与分P 的 `（1/8）` 形态相同 —— **`（x/y）` 不能单独作为分P 依据**，
  否则合集会被误判成「选集」

**相关推荐 / 接下来播放**：同样是 `.video-pod`，列表 class **没有 `multip`**，
header 是推荐类文案，条目指向其它 bvid。

### 判定顺序（`src/contentScripts/videoPage/dom.ts` → `getSelectionContext()`）

1. `/list/*` → **playlist**（原有播放列表分支，不受下面规则影响）
2. 旧版显式分P 容器（`#multi_page` / `.multi-page-v1` / `[class*="multi-page"]`）→ **parts**
3. 现代 `.video-pod` 内按以下优先级判定（**合集优先**）：
   1. pod header 含 **`合集` / `订阅合集` / `共 N 集` / `collection`** → **collection**
      （即使 header 里同时有 `（x/y）` 也按合集处理）
   2. 列表 class 含 **`multip`** → **parts**（分P 最强信号）
   3. header 含 **`视频选集` / `选集` / `分P`** 且带 `（x/y）` 进度 → **parts**
   4. header 是推荐文案（`相关推荐` / `接下来播放` / `猜你喜欢`）→ **none**
   5. 都判定不了（例如只有 `（x/y）`、没有选集/合集字样、列表也没有 `multip`）→ **none，不渲染**
4. 容器 class / data-* 直接标了 `collection` 的旧结构 → **collection**（兜底）
5. 兜底：当前 bvid 下存在 2 个以上带 `p=` 的链接（旧版分P 链接特征）→ **parts**

补充规则：

- **条目数 < 2 一律不渲染入口**（单 P 视频不显示「选集」）
- 合集条目 bvid 各不相同是正常的；能解析出 bvid 时要求 ≥2 个不同 bvid（防止单视频面板误判）
- 当前项：先看原生高亮类（`active` / `on` / `current` / `selected` / `cursor` 或 `aria-current`，
  旧版分P 的高亮可能挂在父级 `li` 上）；再看条目链接的 `p=` / `bvid`；
  现代分P 条目没有链接时按 URL 的 `p=` 序号推导（`index = p - 1`）；判定失败时下标为 -1，面板仍可用
- **任何一类都探测不到时**，浮动入口、面板 host、快捷键、帮助项全部不渲染，不留空浮层
### 合集页的原生面板避让（第 15 轮补充）

真实合集页右侧本来就有 B 站自己的「合集 0/10」纵向面板。为了不重复、也不和右下角浮动条挤在一起：

- 我们的合集面板**默认收起**（只有点浮动按钮才出现，状态与其它选集类型一致）
- 合集页的面板定位改为**左侧中部**（`.bvp-playlist[data-kind="collection"]`：`left: 24px; top: 50%`），
  避开右侧原生合集面板与右下角浮动条；播放列表 / 分P 页仍保持原来的右上角定位
- 当前项：优先原生高亮类，其次用「条目链接里的 bvid === 当前页 bvid」匹配（合集条目常见结构是
  `<a href="/video/BV..."><div class="video-pod__item">…</div></a>`，`<a>` 是条目的**祖先**，
  所以链接查找同时支持条目自身 / 页面后代 / 祖先包裹三种形态）；两者都拿不到时退化为**第 1 项**（不再返回 -1）
- 面板里同时写 `aria-current="true"` 与 `.bvp-playlist__item.is-active` 高亮类，样式与无障碍语义一致
### 为什么不能只认 `.video-pod`（第 14 轮回归教训）

现代 B 站播放页把「分P 选集」「合集」「相关推荐 / 接下来播放」都渲染成 `.video-pod` 容器 +
`.video-pod__item` 条目，只按类名判断会让**所有普通单 P 视频**都出现「选集」入口（第 14 轮实测回归）。
因此分P / 合集必须靠**容器语义**判定：列表 `multip`、pod header 文案；
拿不到这些信号时宁可不渲染。播放列表页（`/list/*`）走独立分支，不受影响。

### 交互

- 点条目：有 `<a>` 就点 `<a>`；现代分P 条目没有 `<a>`，直接点条目 DIV（与 B 站原生点击等价），路由交给 B 站
- 当前项主题色高亮 + `aria-current="true"`；条目是原生 `<button>`（Tab 可达、Enter/Space 触发）
- 面板打开时把当前项滚到可视区中间；`Esc` 关闭面板（顺序：帮助 → 面板 → 影院）
- `A` 自动连播只在播放列表页提供；分P / 合集 / 番剧的连播由 B 站自己处理
- 帮助面板文案按 kind 切换：合集页显示「上一个 / 下一个视频」，分P / 播放列表显示「播放项」

### 降级与已知限制

- 分P / 合集的容器/条目选择器全部按优先级尝试，命中不了走「当前 bvid 下 2 个以上 `p=` 链接」兜底；
  都失败时入口不出现（不会出现「面板空着」的状态）
- 合集依赖 pod header 的「合集」文案或容器 class/data-* 的 collection 语义；
  若 B 站改版把合集标题移出 `.video-pod` 且没有 collection 类名，会退化为不显示（宁可不出入口，也不误判）
- 现代分P 条目没有链接，`[`/`]` 依赖 `.active` 类或 URL 的 `p=` 序号；若两者都拿不到，当前项下标为 -1，
  `[`/`]` 会从列表首/尾开始切换
- 面板标题跟随来源：播放列表 / 选集 / 合集；文案来自模块内 i18n（四种语言）
## 评论区增强（第 23 轮：按真实 Web Components 重写）

> 第 22 轮的实现基于 light DOM（`.reply-list` / `.reply-item` / `.up-mark`），**真机上完全不生效**，
> 已在第 23 轮按实测结构重写。评论区现在是 **Web Components + shadow DOM**，页面级 CSS 选不到任何目标节点，
> 所有隐藏 / 折叠样式必须**注入到对应 shadow root**。

### 真机 DOM 层级（2026-11 实测）

```
#commentapp
  └─ bili-comments (shadowRoot)
       ├─ bili-comments-header-renderer (shadowRoot)
       │    └─ #navbar
       │         ├─ #title (h2 评论 + #count)
       │         └─ #sort-actions.hot
       │              └─ bili-text-button（「最热」）/ bili-text-button（「最新」）
       └─ bili-comment-thread-renderer × N (shadowRoot)
            ├─ bili-comment-renderer (shadowRoot)
            │    ├─ #header → bili-comment-user-info (shadowRoot)
            │    │              ├─ #user-name
            │    │              └─ #user-up   ← 只有 UP 本人的评论才有
            │    ├─ #content            ← 正文
            │    └─ #footer
            └─ #replies > bili-comment-replies-renderer (shadowRoot)
```

### 实现要点

- **探测**：逐层 `#commentapp → bili-comments.shadowRoot → bili-comments-header-renderer.shadowRoot → #navbar / #sort-actions`，
  线程 `bili-comment-thread-renderer.shadowRoot → bili-comment-renderer.shadowRoot → #content`，
  UP 标识 `bili-comment-renderer → #header → bili-comment-user-info.shadowRoot → #user-up`；任何一层失败都不渲染对应 UI。
- **排序**：工具条固定在 `#navbar` 下方（`top = navbar.bottom + 6`），点「最热 / 最新」直接 `bili-text-button.click()`；
  当前态优先读 `#sort-actions` 的 class（`hot` / `latest`），其次读按钮 `active`；都推断不出时只提供点击、不显示按下态。
- **只看 UP**：遍历线程，读老三件（renderer → #header → user-info shadow → #user-up）给 UP 线程打 `data-bewly-comment-up="1"`；
  同时向 **bili-comments 的 shadowRoot** 注入一次 `<style id="bewly-comments-style">`：
  `:host([data-bewly-only-up]) bili-comment-thread-renderer:not([data-bewly-comment-up="1"]) { display: none }`，
  开关只切换宿主上的 `data-bewly-only-up` 属性；没有 UP 标识时开关禁用并说明。
- **长评论折叠**：读每个 `bili-comment-renderer` shadow 内 `#content` 的 `scrollHeight`（> 400px 折叠；
  用 `scrollHeight` 而不是 rect 高度，避免折叠后高度变化导致抖动），给 renderer 打 `data-bewly-comment-clamped`，
  并向**该 renderer 的 shadowRoot** 注入 `<style id="bewly-comment-fold-style">`：
  `:host([data-bewly-comment-clamped]) #content { max-height: 400px; overflow: hidden; mask-image: linear-gradient(...) }`。
  展开按钮仍在 videoPage 的 shadow 浮层里（fixed，跟随 thread 矩形），点击后打 `data-bewly-comment-expanded`、移除折叠标记。
- **动态性**：`MutationObserver` 观察 **bili-comments 的 shadowRoot**（childList/subtree，节流 300ms）补处理懒加载 / 分页新线程；
  评论区未挂载或被整段替换时会自动重新观察；每拍 500ms 的 `syncComments()` 兜底。
- **卸载**：移除所有注入的 `<style>`、清掉所有 `data-bewly-*` 属性、断开观察器，评论区恢复原样。
- **与影院模式共存**：影院模式压暗评论区时工具条 / 展开按钮隐藏（`v-if="!ui.cinema"`），退出后恢复。

### 用户可见行为

1. 评论区顶部（`#navbar` 下方）出现胶囊工具条：最热 / 最新 / 只看 UP 主。
2. 「只看 UP 主」只保留 UP 主本人的评论线程；页面上没有 `#user-up` 时开关禁用并说明。
3. 正文超过 400px 的评论默认折叠（底部渐隐），右下角出现「展开」按钮，点击后完整显示。
4. 所有控件是 shadow 浮层里的原生 `<button>`：Tab 可达、aria 状态、focus-visible 描边，不破坏原生评论交互。

### 已知限制

- 选择器全部依赖上述自定义元素名与 shadow 内部 id；B 站改组件名 / 结构后对应功能降级（不渲染或禁用），不会误改页面。
- 「只看 UP」只处理顶层 `bili-comment-thread-renderer`；楼中楼跟随其所属顶层线程显隐。
- 折叠判定只看 `#content` 的 `scrollHeight > 400px`，不含图片懒加载后的二次变化（ResizeObserver 会在尺寸变化时重算）。
- 展开按钮是 fixed 定位的浮层按钮，只对视口内的线程渲染；滚动时按 rAF 重算坐标。
- e2e 用 fixture 脚本 `attachShadow` 手工构造同样的层级；真实页面仍建议人工确认一次。

### 懒加载 / 翻页 / 重排后的状态保持（第 25 轮）

评论区有懒加载与分页（初始只渲染部分线程），用户还可能切换排序导致线程列表整体重建。本轮补齐了状态保持：

1. **「只看 UP」自动套用到新线程**：
   - UP 标记逻辑抽成 `processThread(thread)`，全量扫描与增量路径都走同一份实现；
   - 只要开关是开的，新线程一旦被打上 `data-bewly-comment-up="1"` 就会自动被注入到
     `bili-comments` shadow 的样式隐藏（非 UP 线程 `display:none`），不需要用户再点一次；
   - 新线程里没有 UP 时不会误关用户选择：可用性由「当前 DOM 里仍有 UP 线程」决定（`upThreads`），
     线程被移除后 `pruneDisconnected()` 会清理引用。
2. **长评论折叠自动套用**：新线程同样走 `evaluateFold`，`#content.scrollHeight > 400px` 即打折叠标记并注入样式。
3. **容器被重建（切排序 / 整段替换）**：MutationObserver 检测到 header / `bili-comments` 增删或节点删除时
   标记 `pendingFullScan`，300ms 后做一次**全量重扫**；用户选择（只看 UP / 折叠）会重新应用，
   不依赖任何临时 DOM 引用。
4. **分页性能**：MutationObserver 回调不再统一做全量扫描，而是先把新增的 `bili-comment-thread-renderer`
   收集进 `pendingThreads`，300ms 节流后**只处理新线程**（增量），并只做轻量的排序状态 / 工具条位置刷新；
   只有结构性变更（header 替换、线程被删除、shadow 换新）才升级为全量重扫。

已知限制：

- 增量判定依赖 MutationObserver 的 `addedNodes`；若 B 站把新线程挂在观察范围之外（例如换了一个新的子 shadow），
  目前靠 500ms 的 `syncComments()` 兜底会补上，但首帧可能延迟到下一拍；
- 「只看 UP」只保留顶层 `bili-comment-thread-renderer`；楼中楼跟随所属线程显示 / 隐藏；
- 折叠状态不持久化（重新进入页面会重新判一次），用户点开过的评论在重排后会重新折叠 —— 与 B 站自身行为一致。
## 评论区右列布局（第 27 轮：评论移到播放器右侧、与播放器同高）

> 用户点名需求：评论区不再堆在左栏底部，而是移到右侧栏、与播放器同高，内部自己滚动。
> 由设置项 `videoPageCommentColumn`（默认开）控制，关闭后保持 B 站原生布局。

### 真机结构（2026-11，1600×1000，BV1wvWM6RE3Z）

```
#mirror-vdcon
  ├─ .left-container（sticky）
  │    ├─ #playerWrap（播放器，实测高 683）
  │    ├─ 视频标题 / 工具条 / 简介 …
  │    └─ #commentapp（评论区 Web Components，原本在左栏底部 y≈1274）
  └─ .right-container（350 宽）
       └─ .right-container-inner.scroll-sticky
            ├─ .up-panel-container
            ├─ .video-pod-above-modules
            └─ .rcmd-tab（推荐列表，由「下部横向聚焦轨道」工作流接管，本模块不碰）
```

### 实现

- **DOM 搬运**：由 `src/contentScripts/videoPage/commentColumn.ts` 创建一个
  `#bewly-comment-column.bewly-comment-column` 容器，插到 `.right-container-inner` 最前面，
  再把 `#commentapp` 追加进去；同时记录它原来的 `parent` 与 `nextSibling`。
- **同高与对齐**：容器高度取 `#playerWrap` 的 `getBoundingClientRect().height`，顶部 `margin-top` 取
  「播放器顶边 − 右栏顶边」，以 CSS 变量 `--bewly-comment-column-height` / `--bewly-comment-column-offset`
  写在 `<html>` 上（窗口 resize、每 500ms 同步拍都会重算）；容器 `overflow-y: auto; overscroll-behavior: contain`，
  内部滚动，**不改动评论 Web Components 自身的内部行为**。
- **降级（宁缺勿滥）**：找不到 `#mirror-vdcon` / `.right-container-inner`（或 `.right-container`）/ `#playerWrap` /
  `#commentapp` 任一 → 完全不生效；`<1280px`、影院模式（`html.bewly-video-cinema`）、设置关闭 → 自动还原原生布局。
- **卸载还原**：把 `#commentapp` 插回原 `parent` 的原 `nextSibling` 位置（原位置失效时兜底 `appendChild`），
  移除容器与 `html.bewly-comment-column` 类、清掉两个 CSS 变量。
- **响应 B 站重渲染**：每拍同步时校验 `#commentapp` / 容器是否还连着 DOM；被替换则先还原旧状态再重新接管。
- `.rcmd-tab`：**本模块不隐藏、不移动**。与「推荐下部轨道」工作流约定：A 只负责评论列；
  B 在轨道渲染成功后自己给 `.rcmd-tab` 打 `data-bewly-rail-taken` 并隐藏，避免两处互相覆盖。

### 用户可见行为

1. 宽屏（≥1280px）下，评论区从视频下方移到右侧栏、与播放器顶边对齐、高度与播放器一致，评论在右列内部滚动。
2. 关闭设置项 / 窗口窄于 1280px / 进入影院模式 → 评论区自动回到左栏底部原生位置。
3. 结构不匹配（B 站改版、评论区未加载完）→ 完全保持原生布局，不出现半吊子重排。

### 已知限制

- 高度跟随 `#playerWrap` 的实测高度；播放器尺寸变化（全屏 / 迷你播放器）会触发一次同步拍重算，
  极端情况下有一拍延迟；
- 右栏自身是 `scroll-sticky`：评论列固定高度 + 内部滚动，页面滚动时右栏可整体吸附，行为与 B 站右栏一致；
- B 站评论区内部若有自己的懒加载 / 分页（`bili-comments`），移动宿主不会影响其加载逻辑（第 23 轮已验证）；
- 评论区被移动后，原有的评论增强浮层（工具条 / 展开按钮）位置随 `#navbar` / thread 的 rect 重算，
  因此会自动跟着右列布局；
- 与「推荐下部轨道」工作流的边界：本模块不碰 `.rcmd-tab`；若 B 工作流未接管，推荐列表会留在右栏（原样）。
## 第 28 轮：广告区域移除

用户需求：移除视频播放页的广告区域，让播放器 / 评论区 / 推荐轨道始终可见。

### 判定依据（Lead 真机实测 2026-11-11，BV1wvWM6RE3Z）

| 选择器 | 命中数 | 说明 |
| --- | --- | --- |
| `.ad-report` | 3 | 左栏底部广告位（`.ad-report.strip-ad.left-banner`，128px 高） |
| `.strip-ad` / `.left-banner` | 1 / 1 | 上面那个广告位的组合类 |
| `[class*="ad-report"]` | 6 | 含外层包装 |
| `#slide_ad` | 1 | 右栏侧边广告 |
| `.video-card-ad-small` | 1 | 右栏推荐里的广告卡 |
| `.activity-m-v1` | 1 | 活动位 |
| `.video-page-special-card-small` | 1 | 「特别推荐」广告卡 |

### 白名单（**不是广告，绝不隐藏**）

`.video-pod-above-modules` / `.video-pod` / `.video-pod__list`（选集 / 合集面板）、
`.right-entry`（右栏入口）、`.rcmd-tab` / `.recommend-list-v1` / `.rec-list` /
`.video-page-card-small`（推荐列表，由轨道接管）、`.up-panel-container`（UP 卡）、
`#commentapp` / `bili-comments`（评论区）、`#playerWrap`（播放器）、
`#arc_toolbar_report`（点赞/收藏/分享）、`#v_desc`（简介）。

JS 侧 `adGuard.ts` 对「元素本身白名单」与「祖先在白名单」都跳过，所以选集面板里即便有
class 带 `ad` 字样的节点也不会被误标。

### 实现

| 文件 | 内容 |
| --- | --- |
| `src/styles/adaptedStyles/pages/videoPage.scss`（只追加） | 页面级 CSS：上面清单全部 `display: none !important`，并对 `[data-bewly-ad-hidden]` 兜一层（即使 JS 只打了标记没跑样式也会隐藏） |
| `src/contentScripts/videoPage/adGuard.ts`（新建） | `setupAdGuard()` 立即扫描 + `MutationObserver`（500ms 节流）补处理动态插入；命中容器补 `data-bewly-ad-hidden`（记下原 `display`）并加内联 `display:none` 兜底；`teardownAdGuard()` 全部还原；`countHiddenAds()` 供诊断；`notifyAdsHidden()` 广播 `bewly:video-ads-hidden` + `resize` |
| `src/contentScripts/videoPage/videoPage.shadow.scss`（只追加） | 轨道 / 评论工具条的 `isolation: isolate`，保证动态广告即便插到同一坐标也不会抢我们浮层的交互 |

判定细节：
- 广告选择器命中后还要过两道闸：**不在白名单（含祖先）** 且 **元素尺寸 ≥ 24px**（宽或高为 0 或小于 24px 的不动，避免误标广告内的角标 / 关闭按钮）；
- 隐藏用「标记 + 内联 none」双保险，B 站常用内联样式覆盖 `display`，纯 CSS 会被压过；
- MutationObserver 观察 `document.body` 的 `childList + subtree`，500ms 节流（切视频后 B 站会成批插广告）。

### 与固定布局（A 工作流）的协作

- 广告被隐藏会改变左栏高度，固定布局需要重算播放器高度；
- `notifyAdsHidden(count)` 会派发 `window` 上的 `bewly:video-ads-hidden`（`detail.count`）**和** 一次 `resize`：
  - A 的固定布局监听前者可以立刻重排；
  - 没监听也能靠现有的 `ResizeObserver` / `resize` 逻辑收敛；
- 推荐轨道本身就是 500ms 同步一次，广告消失后轨道位置会自动上移，不需要额外通知。

### Lead 接线项（index.ts 由 A 工作流持有，本轮未改）

```ts
// src/contentScripts/videoPage/index.ts
import { setupAdGuard, teardownAdGuard } from './adGuard'

// mount() 里（setupComments() 之后即可）
setupAdGuard()

// unmount() 里（disposeComments 之后）
teardownAdGuard()
```

### 已知限制

- 判定基于**实测选择器清单 + 结构白名单**，B 站改版新增的广告容器类名（例如新的哈希类）不会被立刻识别；
  这时靠 `[class*="ad-report"]` 兜一部分，仍漏的话需要补清单；
- 广告被 `display:none` 后仍留在 DOM 里（不删除节点），因为 B 站会在切视频时复用这些容器；
- 未在真机验证（本轮不 build / 不 playwright / 不碰浏览器）：e2e 片段已交 Lead 合并，真机需确认左栏高度变化后播放器与轨道位置正常；
- 广告容器若被 B 站改成 `position: fixed` 全屏浮层，`display:none` 依然有效，但它的关闭按钮等交互也会一起消失（预期）。
## 第 29 轮：推荐轨道滚轮接管 + 点击不改 URL

### 1. 普通垂直滚轮也横向切换

用户反馈：之前只有 `Shift+滚轮` / 横向滚轮能切卡，普通滚轮没反应。

现在的 `handleWheel`（`recommendRail/RecommendRail.vue`）：

| 输入 | 行为 |
| --- | --- |
| 普通垂直滚轮（deltaY） | 累计到 **40** 才切一张（触控板一次滑动会连发多个小 delta，逐帧切会「刷屏」） |
| Shift + 滚轮 / 横向滚轮（deltaX） | 累计到 **12** 就切（意图更明确，响应更快） |
| 两次滚动间隔 > 200ms | 视为新手势，累计值清零 |
| 已经到首张 / 末张 | 不 `preventDefault`，滚轮交还页面（不在轨道边缘「吃掉」滚动） |
| 鼠标不在轨道内 | 完全不干预（页面/评论区滚动正常） |

CSS 保险（`videoPage.shadow.scss`，只追加）：`.bvp-rail` / `.bvp-rail__viewport` 加
`overscroll-behavior: contain`（到边缘不把滚动传给页面）与 `touch-action: pan-x`（触屏横向手势归轨道）。

### 2. 点击绝不改 URL（第 27 轮遗留的三步递进）

真机现象：点卡片后 iframe 抽屉打开，但 `location.href` 变成推荐视频地址。已排除「卡片在 `<a>` 内 /
`elementFromPoint` 命中错误 / click 冒泡未拦」，剩下唯一没试的方向是 **B 站的路由跳转来自
`pointerdown`/`mousedown` 阶段的委托，或它注册在先的 capture 监听**。

实现按顺序叠加三层（**都保留**，后一层是前一层失效时的保险）：

| 步骤 | 做法 | 说明 |
| --- | --- | --- |
| **a** | 卡片 `@pointerdown` / `@mousedown` → `preventDefault + stopPropagation + stopImmediatePropagation` | 阻止按下阶段的 B 站委托与后续 click 合成 |
| **b** | `window` 上注册 **capture** 的 `pointerdown` / `mousedown` / `click`（`window` 捕获早于 `document`），命中轨道矩形就 `preventDefault` | 关键：**不能 stopPropagation** —— 否则轨道自己的 section 捕获（激活逻辑）也收不到，会退化成「既不跳转也不开预览」（第 27 轮踩过） |
| **c** | **兜底自愈**：`openPreview()` 先记录 `location.href`，`emit('preview')` 后在 `0 / 50 / 200ms` 用 `history.replaceState` 把 URL 改回 | 抽屉已打开，URL 变化对用户不可见；只要 B 站改了 URL 就一定会被拉回 |

另外：第 27 轮的「宿主 `pointer-events` 空间受限开关」（`setHostHitOpen`）仍然生效，
指针在轨道内时宿主才 `pointer-events: auto`，离开即恢复 `none`。

### 3. 生效顺序（真机结论，Lead 复测后回填）

- 代码里三层同时生效，无法静态判断「哪一层真正阻止了 B 站跳转」；
- 复测方法：在 `onWindowCapturePointer`（b）与 `restoreUrlAfterPreview`（c）里各加一句
  `console.count`，点击一次后看哪个计数增加：
  - b 计数增加且 URL 未变 → **b 生效**（B 站的委托在 document 捕获阶段）；
  - b 计数不增加但 URL 未变 → **a 生效**（按下阶段就拦住了跳转）；
  - a/b 都没拦住、只有 c 的 `replaceState` 把 URL 拉回 → **c 兜底生效**；
- 当前实现已按「三层都留」交付，真机只要看到 **URL 不变 + 抽屉打开** 即符合需求。

### 4. 已知限制

- `history.replaceState` 改回的是**同一页面内**的 URL：如果 B 站用 `location.assign` 真的发起了导航，
  替换时代码可能已经卸载，兜底来不及生效（这种情况下靠 a/b 提前拦）；
- `window` 捕获只对「鼠标指针在轨道矩形内」的事件生效：键盘 Enter 路径走的是组件自己的 `handleKeydown`，不经过指针链；
- 滚轮阈值（40 / 12）与重置窗口（200ms）是经验值，触控板手感若偏钝/偏灵可直接调这两个常量；
- 未在真机验证（本轮不 build / 不 playwright / 不碰浏览器）：请构建后确认
  「普通滚轮能横向切卡」「点击后 URL 不变 + 抽屉打开」「轨道外滚轮仍能滚动页面」。
## 删除影院模式（第 28 轮）

用户点名要求去掉影院模式。已删除的内容：

- `T` 快捷键、`Esc` 退出影院分支、`FloatingControls` / `CompactBar` 里的影院按钮；
- `ui.cinema` 状态、`html.bewly-video-cinema` 类、`sessionStorage` 里的 `bewly-video-cinema`；
- `actions.ts` 的 `setCinema` / `toggleCinema` / `readStoredCinema`，`i18n.ts` 的四语言影院文案，
- `videoPage.scss` 与 `animePlayback&MoviePage.scss` 里影院模式的布局 / 压暗规则。

`settings.videoPageCinemaMode` 字段**保留但不再被读取**（避免导入旧配置时报字段缺失），
也不再出现在设置页与快捷键注册表里 —— 注册表与设置页由 list-pages 工作流负责移除。

## 固定单页布局（第 28 轮引入，第 29 轮重写为「单次布局事务」）

### 目标

页面不滚动，视频区 / 评论区 / 推荐轨道三块**始终可见且互不重叠**，以 dock 形式分隔整个视口。

### 第 29 轮修掉的真实缺陷

第 28 轮有两个模块同时改布局：`fixedLayout.ts` 改播放器高度，`commentColumn.ts` 每 500ms 读
「播放器顶边 − 右栏顶边」反算 `margin-top`。两者互相读对方的 rect 再写样式，形成**震荡环**：
真机采样到评论列 `y` 在 120 ↔ 64 之间来回跳（差 56px），评论工具条 `top` 跟着 98 ↔ 154 跳，
用户看到的就是「评论区的 UI 有规律鬼畜」，连「只看 UP 主」按钮一起抖。

### 现在的约定：布局只有一个所有者

`src/contentScripts/videoPage/fixedLayout.ts` 一次算出全部尺寸，**只写 CSS 变量**（写在 `<html>` 行内样式）：

| 变量 | 含义 |
| --- | --- |
| `--bvp-fixed-top` | `#mirror-vdcon` 距视口顶部 |
| `--bvp-fixed-info` | 信息栏 dock 高度（≤56） |
| `--bvp-fixed-gap` | dock 之间的 gutter（8） |
| `--bvp-fixed-details` | 详情 dock 高度（104） |
| `--bvp-fixed-player-height` | 播放器 / 评论列高度 |
| `--bvp-fixed-rail-space` | 轨道预留高度（未渲染为 0） |

`commentColumn.ts` 在固定布局下**不再读任何 rect、不再写 `margin-top`**，高度直接用
`height: var(--bvp-fixed-player-height)`；它也不再对 `#playerWrap` 挂 `ResizeObserver`（避免回环）。
非固定布局（原生可滚动页面）才回落实测高度，且写入前做值比较。

### 16:9 约束

```
可用高 = 视口高 − 顶部偏移 − 信息栏 − 详情 dock − 3 × gutter − 轨道预留
播放器高 = clamp(320, min(可用高, 播放器宽 × 9 / 16), 1200)
```

即**先按宽度定高**，再按可用高度上限回落，最后做一次自检：
`player.bottom + gutter + 详情 dock <= rail.top - gutter`，保证播放器不会侵入推荐区。

### 三区 dock 布局（页面级 CSS）

`#mirror-vdcon` 变成「两列 × 纵向三段」的 dock 容器（`grid-template-columns: minmax(0,1fr) min(350px,26vw)`）：

| 区域 | 高度来源 |
| --- | --- |
| 信息栏 `#viewbox_report` | `--bvp-fixed-info`，标题单行 `-webkit-line-clamp: 1` |
| 播放器 `#playerWrap` + 评论列 | `--bvp-fixed-player-height`（严格等高） |
| 详情 dock（工具栏 / 简介 / 标签） | `--bvp-fixed-details`，逐项压缩、`overflow: hidden`，资源列表隐藏 |
| 推荐轨道 | `fixed` 贴视口底部（`rail.ts` 在固定布局下按 `innerHeight` 定位） |

`html` / `body` 在 `html.bewly-video-fixed` 下都是 `overflow: hidden`；
评论区与轨道各自是独立滚动容器，互不影响。

### 评论工具条定位（第 29 轮修正）

工具条从「跟随视口内 `#navbar`」改为**锚定评论列容器** `[data-bewly-comment-column]`：
评论区搬到右列后是独立滚动容器，内部 `#navbar` 会随评论列表滚动而移动，按它算 `top` 会让工具条
（连带「只看 UP 主」按钮）跟着滑动。锚定容器后工具条固定在评论列顶部，
并对 `top` / `left` 做 0.5px 内的抖动抑制。

### 降级与还原

- 视口 `<1280px` 宽或 `<700px` 高、番剧页、迷你播放器态、开关关闭 → 不启用固定布局，回到原生可滚动布局；
- 卸载：移除 `html.bewly-video-fixed`、清掉全部 `--bvp-fixed-*` 变量、恢复 `#playerWrap` 原来的行内高度，
  评论列由 `commentColumn.ts` 放回原位；
- 评论区自身的降级不变：缺失锚点 / 窄屏 / 开关关闭时原样还原。

### 已知限制

- 左栏「详情 dock」是把工具栏 / 简介 / 标签压缩成固定高度后**裁切**，不是可折叠抽屉：
  超高内容会被裁掉（用户要求「不产生内部滚动」）；
- 播放器高度上限 1200px、下限 320px；极端窗口下按 320 计算可能略溢出，此时以自检结果为准；
- 广告位由 native-style 工作流负责隐藏，隐藏后左栏高度变化不需要再通知本模块
  （尺寸只依赖视口 / 信息栏 / 轨道，不依赖左栏实际内容高度）。

## 播放器严格 16:9 + 空出宽度补给评论区（第 30 轮）

### 修复的问题

真机 1600×1000 下播放器是 `1222 × 518`（h/w = 0.424，应 0.5625 = 9/16）：
`height = min(可用高, 宽 × 9/16)` 被「可用高」限制后**宽度没有跟着回收**，左列仍占满宽度，
于是播放器变成宽扁形，右列还被固定成 350px。

### 现在的算法

```
容器宽     = #mirror-vdcon.clientWidth − 左右 padding
左列可用宽 = 容器宽 − 评论区最小宽(280) − gutter(8)
可用高     = 视口高 − 顶部偏移 − 信息栏(56) − 详情(104) − 3×gutter(8) − 轨道预留
播放器宽   = min(左列可用宽, round(可用高 × 16 / 9))     ← 可用高不足时宽度回收，而不是拉扁
播放器高   = round(播放器宽 × 9 / 16)                    ← 严格 16:9
右列宽     = 容器宽 − 播放器宽 − gutter                  ← 空出来的宽度全给评论区
```

新增 CSS 变量 `--bvp-fixed-player-width`，`#mirror-vdcon` 的网格列改成：

```scss
grid-template-columns: var(--bvp-fixed-player-width, 1fr) minmax(280px, 1fr);
```

即**左列宽度 = 播放器宽度**，右列吃掉剩余宽度；评论区仍然 `height: var(--bvp-fixed-player-height)`，
等高关系不变。信息栏 / 详情 dock 都在左列内 `width: 100%`，因此自动与播放器同宽对齐。

### 轨道高度与宽度的耦合（不动点迭代）

轨道宽 = 左列宽 = 播放器宽，而轨道高度又由宽度算出（可见卡片数 4~7 决定封面高度），
于是形成 `宽 → 轨道高 → 可用高 → 宽` 的小回路。处理方式：在同一次 `applyLayout()` 里**从 0 起迭代**
到不动点（最多 10 次，差值 <1px 即收敛）。固定起点保证「同样输入 → 同样输出」，否则每拍会停在
振荡区间的不同相位，看起来就是轻微跳动。

### 自检（保留并强化）

- `player.bottom + gutter + 详情 dock <= rail.top − gutter`（三区互不重叠）；
- 评论区高度 == 播放器高度（同一个变量）；
- `playerWidth / playerHeight === 16 / 9`（由构造保证，模拟验证 1600×1000 → 948×533，比值 1.7786）；
- 评论区右边缘 == 容器右边缘（右列 `1fr` 吃满）。

### 评论区变宽后的适配

- 页面级 CSS 放开 `#commentapp` 及其直接子节点的 `width / max-width`（B 站评论 Web Components 自带
  定宽容器的话会被撑开），不再有任何 350px 类定宽残留；
- 评论工具条锚定评论列容器，左对齐取容器 `rect.left`，因此自动跟着右列左边缘移动；
- 左列与右列都加了 `min-width: 0`，避免 B 站原生 flex 规则把网格轨道撑回去。

### 连续性

窗口从 1600 缩到 1280（仍 ≥ 阈值）时，播放器宽随「左列可用宽 / 可用高」平滑收敛，
比例始终 16:9；模拟 1600→1280 每 40px 采样，宽度从 948 单调降到 948（受可用高限制）后随容器宽下降，
无跳变。降级阈值（<1280 宽 / <700 高）不变。

### 第 30 轮补充：评论区右侧溢出 20px（已修）

真机复测：播放器比例已正确（948×533），但评论列 `right = 1620 > 容器右边缘 1600`，溢出 20px。

**根因**：网格列本身是对的（`948 + 8 + 1fr`），但列的**子元素**带了 B 站原生的
横向 `margin` / `padding`，而这两列又被写成 `width: 100%`（内容盒算宽），
于是 `100% + padding` 把右列顶出了容器右边缘；同时左列的额外横向间距把右列整体右移。

**修法**（只动 CSS，不改 API）：

1. 两列宽度改为 `width: auto`（交给 grid 轨道拉伸）+ `justify-self: stretch`，不再用 `100%`；
2. 两列统一 `box-sizing: border-box`、`margin: 0`、`padding-inline: 0`，清掉 B 站原生横向间距；
3. 网格列改成 `minmax(0, var(--bvp-fixed-player-width)) minmax(0, 1fr)`，用 `minmax(0, …)`
   夹住子元素 `min-content`，防止内容把轨道撑宽；容器加 `box-sizing: border-box`、`width: 100%`；
4. 评论列 `max-width: 100%`（原来是 `none`），双保险不超过右列。

修复后：`col.right = 容器内容右边缘 = mirror.right − paddingRight`，
`col.width = 容器内容宽 − 播放器宽 − gutter`，不会再越过视口/容器右边界。

## 结构修复：封面 / 作者卡位置 / 三区不重叠（第 31 轮）

### 1. 轨道封面看不见（`img = null`）

真机现象：轨道卡片里根本没有 `<img>`，因为 `card.cover` 是空串，模板 `v-if="card.cover"` 不渲染。
根因是**采集发生在隐藏原生 `.rcmd-tab` 之前但图片尚未加载**：B 站封面是懒加载，
而我们把列表 `display: none` 之后，懒加载再也不会触发，`src` 永远是空串。

修法（`recommendRail/rail.ts`）：

1. **隐藏前预热**：`warmUpNativeCovers()` 在 `markNativeTaken()` 之前执行 —— 把卡片里的 `img`
   改为 `loading="eager"`，有 `data-src` / `data-original` / `data-lazy-src` 就补到 `src` 触发请求；
2. **取值兜底顺序**：`currentSrc → src → data-src → data-original → data-lazy-src → srcset 首项 →
   <picture><source srcset> → 背景图 → 任意元素的 data-src/data-background → 外层 a 的背景图`；
3. **封面缓存**：`coverCache`（bvid → URL）跨拍保留，切视频后同一 bvid 仍可直接复用；
4. **每拍刷新**：`refreshRailCovers()` 在隐藏之后继续尝试，有变化就更新 `railState.cards`，
   模板随即渲染 `<img>`；
5. **占位兜底**：仍然拿不到封面、或图片 `@error`（地址过期/403）时，渲染
   `.bvp-rail__cover-fallback` 占位块，而不是留白。

### 2. 作者卡移到评论区上方

用户要求作者区在评论区**上方**，且不能压到推荐轨道（真机 UP 卡 `bottom=765 > railTop=762`，压进 3px）。

`commentColumn.ts` 现在会：

- 把 `.up-panel-container` 一并搬进评论列容器，作为**第一块**（顺序：作者卡 → 评论列表）；
- 记录作者卡原来的 `parent` / `nextSibling`，关闭开关 / 窄屏 / 卸载时原样放回；
- 作者卡被 B 站整块替换（切视频）时，把新节点重新搬进来并保持「评论列表之前」的位置；
- 评论列内部改为 flex 纵排：作者卡固定 72px（超出裁切），`#commentapp` 吃剩余高度并
  `overflow-y: auto` 内部滚动；
- 评论列整体高度仍是 `--bvp-fixed-player-height`，所以「作者卡 + 评论」总高 === 播放器高，
  不会再溢出到轨道区域。

### 3. 三区不重叠（结论）

作者卡进入评论列之后，右列在固定布局下只剩评论列本身（其余 `.video-pod-above-modules`、
`.rcmd-tab` 被右列 `overflow: hidden` 裁掉，不参与视觉），于是：

```
commentColumn.top    = 播放器 top
commentColumn.height = 播放器 height
commentColumn.bottom = 播放器 bottom < rail.top - 8
作者卡 top = commentColumn.top，bottom = top + 72 <= commentColumn.bottom
```

### 与 native-style 的分工

- A（本文件）：封面采集 / 占位**结构**、作者卡搬运、评论列 flex 结构、右列裁剪；
- B：轨道卡片与评论列的外观（圆角 / 间距 / 字号 / hover / 暗色等），本轮不在 `docs` 里替它定义。
## 第 31 轮：视觉与间距细化

用户要求：详细优化美观程度、排版与间距（本轮只改**视觉属性**，不动 A 工作流的尺寸计算与卡片 DOM 结构）。

### 1. 推荐轨道（`videoPage.shadow.scss`，只追加）

| 元素 | 规格 |
| --- | --- |
| 卡片 | 圆角 12px、内边距 8px、间距 12px、`--bew-elevated` 底 + 1px 边框 |
| 卡片 hover / active | **抬升 2px**（`translateY(-2px)`）+ `--bew-shadow-2` + 主题色 40% 边框 + `--bew-elevated-hover` 底 |
| 卡片 `:focus-visible` | 2px 主题色描边、offset 2px |
| 封面 | 固定 `aspect-ratio: 16/9` + `object-fit: cover` + 圆角 8px + `--bew-fill-1` 占位底 |
| 封面占位（A 新增 `bvp-rail__cover-fallback`） | 135° 渐变底 + 居中图标；暗色提一档文字色；高对比度加虚线框；forced-colors 用 Canvas/CanvasText |
| 标题 | **12.5px / 行高 1.35 / 两行截断**（`-webkit-line-clamp: 2`）+ `word-break: break-word` |
| UP + 播放量 | 同一行、**11px**、`--bew-text-3`；UP 最多 62% 宽省略、播放量右对齐等宽数字 |
| 外壳 | 左右 16px、底边 12px、12px 间距；顶部 1px 分隔线 + `--bew-fill-1` 35% 半透明底 + 顶部圆角 14px + 毛玻璃 → **dock 停靠区观感** |
| 标题行 | 左「推荐视频」13px 600；右侧 ← / → / 收起三个 26px 圆钮（hover 抬 1px） |
| 窄屏 ≤1024 | 左右 12px、底 10px、标题 12px、间距 10px、卡片内边距 7px |

### 2. 评论区（`src/styles/adaptedStyles/pages/videoPage.scss`，只追加）

| 元素 | 规格 |
| --- | --- |
| 作者卡 `.up-panel-container` | 圆角 12px、内边距 8px、`--bew-fill-1` 底 + 1px 边框；hover 提亮到 `--bew-fill-2` |
| 头像 | 圆形裁切、不可收缩（不同 UP 头像不会把行高撑变） |
| UP 名 / 粉丝数 | 13px/600 单行省略；副信息 11px 次要色 |
| 评论列 `.bewly-comment-column` | 左右 **12px** 内边距、`--bew-content` 底 + 1px 边框 + 圆角 12px |
| 作者卡与评论列表之间 | **12px 间距**（`.bewly-comment-column > .up-panel-container { margin-bottom: 12px }`，A 把作者卡搬进评论列后自动生效） |

### 3. 信息栏与详情 dock（同文件，只追加）

| 元素 | 规格 |
| --- | --- |
| 标题 | 固定布局下 **15px / 行高 1.4**（满足可读下限 ≥15px / 1.4），letter-spacing 0.01em |
| 元信息（UP / 播放量） | 12px / 1.4、次要色 |
| 工具栏 `#arc_toolbar_report` | `--bew-fill-1` 底 + 10px 圆角、左右 4px 内边距；按钮 hover 提亮 |
| 简介 / 标签 | 左右 4px、8px 圆角（只做视觉分层，不改 A 的高度） |

### 4. 主题与无障碍覆盖

- **暗色**：hover 边框改用 `color-mix(theme-color, white 12%)` 提对比；评论列底改为 `--bew-elevated`；
- **prefers-contrast: more**：卡片 / 箭头 / 轨道 / 作者卡 / 评论列 / 工具栏边框统一提到 `--bew-text-3`，次要文字提一档；
- **forced-colors: active**：轨道、卡片、封面、箭头、作者卡、评论列全部改用 `Canvas` / `CanvasText`，选中态用 `Highlight`；
- **prefers-reduced-motion: reduce**：轨道平移、卡片抬升、箭头 hover 位移全部关闭（只保留颜色变化）。

### 5. 分工与未做项

## 第 32 轮：简介收拢到工具栏 + 自绘 tooltip
### 第 34 轮真机复测：字号被既有规则覆盖（特异性修正）

**现象**（真机 1600×1000）：视频标题仍是 `15px / 600 / line-height 21px / clamp 1`，元信息 12px，
工具栏按钮 12px —— 与 5 档字阶期望（20 / 27 / clamp 2、12.5、12.5）不符。

**根因**：本轮的 typography 段写在 `.bewly-design.videoPage ...`（0,2,0 级），而第 28–31 轮有几条
**更早、特异性更高**的既有规则：

| 既有规则 | 位置 | 特异性 | 被覆盖的值 |
| --- | --- | --- | --- |
| `.bewly-design.videoPage.bewly-video-fixed #viewbox_report .video-title` | L624–632 | ~(1,4,0) | 17px / lh 22px / clamp 1 |
| `&.bewly-video-fixed #viewbox_report .video-title` | L861–866 | ~(1,4,0) | 15px / lh 1.4 |
| `&.bewly-video-fixed #viewbox_report .video-info-meta` | L869–871 | ~(1,4,0) | 12px |
| `&.bewly-video-fixed .bewly-desc-trigger` | L1007 | ~(0,4,0) | 12px |
| `&.bewly-video-fixed .bewly-toolbar-action` | L1194 | ~(0,4,0) | 12px |
| `.up-panel-container .up-name` / `.fan` | L818–831 | ~(0,3,0) | 13px / 11px |

**修法**：在 typography 段末尾追加「特异性修正」子段，用 **`html` + 双类 + ID** 抬高特异性：

| 目标 | 新选择器 | 特异性 |
| --- | --- | --- |
| 视频标题 | `html.bewly-design.videoPage.bewly-video-fixed #viewbox_report .video-title`（+ 非固定布局一条） | (1,4,1) |
| 元信息 | 同上模式（`--bvp-fs-meta` 12.5px + tabular-nums） | (1,4,1) |
| UP 名 / 粉丝数 | `html.bewly-design.videoPage .up-panel-container .up-name` 等 | (0,3,1) |
| 工具栏按钮 | `html.bewly-design.videoPage.bewly-video-fixed .bewly-desc-trigger` / `.bewly-toolbar-action` + 原生 `#arc_toolbar_report` 项 | (0,4,1) / (1,2,1) |
| 标签 | `html.bewly-design.videoPage .video-tag-container .tag / a / .tag-link` | (0,3,1) |
| 窄屏（≤1280）标题 18px | 同高特异性 + media | — |

轨道标题（shadow 内）已核查：`.bvp-rail__title` 在编译后共 4 条规则，最后一条是本轮的
`font-size: var(--bvp-fs-section)`（16px），后写覆盖前值，无需额外提权。

**遗留（属 A 的 layout 段）**：信息栏 `#viewbox_report { max-height: var(--bvp-fixed-info, 56px); overflow: hidden }`。
标题 20px × 1.35 × 2 行 = 54px，加 padding 12px = **66px** > 56px，第二行会被裁。
建议 A 把 `--bvp-fixed-info` 提到 **68~70px**（与简报 A3 的「标题组 70px」一致）。

## 第 35 轮：恢复全宽 + dock 与轨道之间 24px 分区间距

### 1. 去掉容器 max-width，恢复全宽

- `#mirror-vdcon` / `.video-container-v1`：删掉 `max-width: var(--bvp-content-max)`（1720）与 `margin-inline: auto`，
  改为 `width: 100%` + `max-width: none` + `margin-inline: 0`；
- 左右 `--bvp-page-pad`（24px）的 padding **保留** —— 全宽不等于贴边；
- `>2200px` 不再有额外加宽限制；`--bvp-content-max` 令牌保留但标注「不再用于布局」，
  避免其它段落引用时报变量缺失；
- `fixedLayout.ts` 的宽度预算基于 `#mirror-vdcon.clientWidth − padding`，全宽后自动变大，
  播放器宽度仍由「16:9 反算 + 左列可用宽上限」共同决定，比例不受影响。

### 2. dock 底边与轨道顶边 24px（原来只有 8px）

真机复测：`col.bottom = 737`、`rail.top = 745` —— 只差 8px，视觉上几乎贴住。
用户要求「明显的分区间距」，按 Kimi 规范面板 gutter = 24。

```
railTop  = 视口高 − railSpace − 12           // 轨道底部保留 12
dockTop  = topOffset
dockH    = railTop − 24 − dockTop            // 分区间距 24
         = 视口高 − topOffset − railSpace − 36
```

- `fixedLayout.ts` 新增常量 `DOCK_RAIL_GAP = 24`、`DOCK_BOTTOM_MARGIN = RAIL_BOTTOM_GAP + DOCK_RAIL_GAP = 36`；
- 自检从 `dock.bottom <= rail.top − 8` 收紧为 `<= rail.top − 24`（`allowedDock = railTop − DOCK_RAIL_GAP − topOffset`）；
- 左列 dock 底边（标签行）与右列评论列底边都遵循同一组变量，因此同时与轨道保持 24；
- dockH 从 678 → 662，播放器相应变矮（16:9 自适应，属预期）。

### 3. 预期数值（1600×1000，rail 实测/估算较大者 238）

| 项目 | 计算 | 结果 |
| --- | --- | --- |
| dockH | 1000 − 64 − 238 − 36 | **662** |
| 播放器高 | floor(662 − (70+52+30) − 8×3) | **486** |
| 播放器宽 | round(486 × 16/9) | **864** |
| 16:9 | 864 / 486 | **1.7778** |
| 评论列高 | `--bvp-fixed-dock-height` | **662 = dock 高** |
| rail.top − dock.bottom | 24（构造保证） | **24** |
| 全宽 | `#mirror-vdcon` width | **1600**（含 24 padding 在内） |

2200 宽时：内容宽 2152，播放器仍由高度反算（约 807×454），右列变宽，无横向滚动。

### 4. 评论面板拉满右列（第 35 轮补充）

全宽后右列会变宽（2200 时约 1300px）。第 34 轮的 clamp(400~640) 会导致右侧留白 ~680px，
与「页面恢复全宽」的诉求冲突，因此：
- `--bvp-col-comment-max` 改为 **100%**（面板拉满右列）；
- 下限保留 `min-width: min(100%, 400px)`，窄屏不会溢出；
- **行长仍由正文 `max-width: 420px` 控制**（注入在 `bili-comment-renderer` 的 shadow 里），
  面板变宽只影响容器背景，不会让正文行变长。
