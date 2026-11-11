# 直播页增强浮层（第 6 轮）

第 6 轮 A 工作流，负责人 `native-style`。直播页（`live.bilibili.com/*`）是 **B 站原生页面**，
Bewly 此前完全不支持它：manifest 与本轮由 Lead 加了内容脚本匹配，**Bewly 主 UI（`#bewly` 顶栏 / Dock）
并不在这个域名上挂载**（`isSupportedPages()` 不含 live），所以本模块是独立运行的增强层：
一个 shadow root 浮层 + 一份自行注入的页面级样式，不依赖 adaptedStyles。

零网络请求、零写操作。

## 1. 改动文件

新增 `src/contentScripts/livePage/`：

| 文件 | 说明 |
| --- | --- |
| `index.ts` | 入口：`setupLivePage()` / `teardownLivePage()`（Lead 已接线 `setupLivePage`） |
| `dom.ts` | DOM 适配层：播放器 / 侧栏 / 弹幕 / 全屏控件发现，舞台标记，键盘让行判定 |
| `actions.ts` | 动作层：影院、隐藏侧栏、弹幕、全屏、页面样式注入、同步与清理 |
| `keyboard.ts` | T / H / C / F / ? / Esc |
| `state.ts` | 面板 UI 状态（reactive） |
| `preferences.ts` | sessionStorage 读写（`bewly-live-*`） |
| `i18n.ts` | 模块内文案（简中 + 英文） |
| `constants.ts` | hostId / 属性名 / 状态类名 / sessionStorage 键 |
| `components/LivePageOverlay.vue` | 浮层 UI（浮动按钮 + 面板） |
| `livePage.page.scss` | 页面级样式（影院 / 隐藏侧栏 / 遮罩，模块注入） |
| `livePage.shadow.scss` | 浮层样式（shadow root 内） |

新增 `docs/live-page.md`（本文件）。

未改动：`App.vue`、`contentScripts/index.ts`、`manifest.ts`、`storage.ts`、`_locales/**`、
`nativeOverlay/**`（只 import 复用）、`styles/**`、`package.json`、`vite.config*`。

## 2. 用户可见行为

### 右下角浮动按钮 + 面板

- 浮动按钮常驻右下角（与其它原生页增强层同一位置与视觉）；进入影院模式后按钮上多一个主题色小点；
- 面板包含四个开关行（影院 / 隐藏侧栏 / 弹幕 / 全屏）、快捷键说明与底部提示；
- 所有控件都是原生 `<button type="button">`，带 `aria-pressed` / `aria-label` / `title`，
  Tab 可达，`:focus-visible` 有主题色描边；
- 页面上找不到对应能力的控件会 **禁用并说明原因**（不会出现点了没反应的按钮）。

### 影院模式（T）

- 播放器舞台 `position: fixed` 铺满视口宽度（16:9，最高 100vh），页面其余内容用
  `body::before` 遮罩压暗（`color-mix(--bew-bg, black 58%)`，`pointer-events: none`）；
- 右侧栏一并隐藏、布局容器撑满；
- **z-index 陷阱（第 4 轮番剧页踩过）**：祖先链上任何 `z-index` / `transform` / `filter` /
  `contain` / `perspective` 都会建立层叠上下文，把 `fixed` 舞台压到遮罩下面。
  本模块的做法与番剧页一致：
  1. JS 在播放器祖先链（直到 body）打上 `data-bewly-live-ancestor`，
     CSS 对这些节点清掉上述属性并 `z-index: auto`；
  2. 遮罩 `body::before` 的 `z-index` 是 **2147483099**，舞台是 **2147483100**，
     浮层 shadow host 是 **2147483200** —— 三层顺序固定。
- Esc 或再按 T 退出；状态存 sessionStorage（刷新保持，新标签页从关闭开始）；
- 舞台尺寸变化后主动派发 `resize`（120ms / 320ms 各一次），通知播放器重新计算布局。

### 隐藏右侧栏（H）

- 给右侧栏（礼物 / 榜单 / 推荐列）打 `data-bewly-live-aside` 后 `display: none`；
- 播放器与布局容器同时 `width: 100%`，把腾出来的宽度还给播放器；
- 与影院模式互不依赖：可以单独隐藏侧栏但保持正常滚动布局。

### 弹幕开关（C）

- 点击的是 **原生弹幕开关**（找到 button / checkbox 就 `click()`），不自己开关弹幕渲染层，
  保证播放器自己的状态机与 UI 同步；
- 乐观更新面板里的 ON/OFF，150ms 后从 DOM 读回真实状态；
- 找不到原生开关时禁用该行并提示。

### 全屏（F）

- 优先点原生全屏按钮（保留 B 站自己的网页全屏逻辑）；
- 找不到原生按钮时对播放器舞台调 `requestFullscreen()`；
- 已经在全屏则退出；被浏览器拒绝时 toast 提示，不影响其它快捷键。

### 快捷键

| 键 | 行为 |
| --- | --- |
| `T` | 影院模式开 / 关 |
| `H` | 隐藏 / 显示右侧栏 |
| `C` | 弹幕开关 |
| `F` | 全屏 |
| `?` | 打开 / 关闭面板 |
| `Esc` | 先关面板，否则退出影院模式 |

让行：`event.defaultPrevented`、`isComposing`（输入法）、输入框 / 弹幕输入框 / `contenteditable`、
Ctrl / Cmd / Alt 组合、Shift + 字母；焦点在 Bewly 或本模块浮层里时也不接管（浮层内按钮自己处理）。

## 3. 选择器来源与降级（重要）

**Bewly 此前的代码里没有任何直播页选择器**（仓库 scss / fixtures 里都没有 `live` 页面结构），
所以本轮的选择器是「按结构推断 + 多候选 + 允许失败」，集中写在 `dom.ts`：

| 目标 | 候选（按优先级） |
| --- | --- |
| 播放器舞台 | 真机 `.live-non-revenue-player`（主路径，已命中）→ 旧版 `#live-player` / `.live-player` / `#live-player-ctnr` → `[class*="live-player"]` |
| 右侧栏 | 旧选择器 `.aside-area` → `#aside-area` → `.player-and-aside-area > aside` → `[class*="aside-area"]` → `[class*="right-aside"]`；**真机都没有**，再退化为结构化启发式（见第 8 节） |
| 弹幕开关 | `#live-player .web-player-icon-danmaku` → `#live-player [class*="danmaku-switch"]` → `#live-player [class*="dm-switch"]` → `#live-player [class*="danmaku"] button` → `#live-player button[aria-label*="弹幕"]` → 页面级同名候选 |
| 全屏按钮 | `#live-player .web-player-icon-fullscreen` → `#live-player [class*="fullscreen"]` → `#live-player button[aria-label*="全屏"]` → 页面级同名候选 |

**不依赖 B 站类名做样式**：命中后 JS 只给节点打属性标记
（`data-bewly-live-player` / `-layout` / `-aside` / `-ancestor`），页面级 CSS 只认这些属性，
B 站改类名不会让样式错位，只可能让某个功能「找不到 → 隐藏/禁用」。

## 4. 注入点与状态

- **页面级样式注入点**：直播页不在 `adaptedStyles/index.ts` 的注入清单里，也没有对应的
  `xxx.scss` 可追加（本轮写入范围仅限模块 + 文档），因此由模块在入口处把
  `livePage.page.scss?inline` 注入成 `<style id="bewly-live-page-style">`（`injectCSS` 到
  `document.documentElement`），卸载时移除。样式作用域是 `html.bewly-live-page`
  （模块自己加的标记类）。
- **CSS 变量**：`--bew-*` 来自内容脚本全局样式（`:root` 定义），即使 Bewly 主 UI 未挂载也可用，
  暗色模式跟随 `html.dark` 自动生效。

| sessionStorage 键 | 取值 | 说明 |
| --- | --- | --- |
| `bewly-live-cinema` | `1 \| 0` | 影院模式 |
| `bewly-live-hide-aside` | `1 \| 0` | 隐藏侧栏 |
| `bewly-live-panel` | `1 \| 0` | 面板展开状态 |

## 5. Lead 需要接线

- `setupLivePage()`：**已接线**（`src/contentScripts/index.ts` 已 import 并调用），本轮不再需要改动；
- `teardownLivePage()`：已导出但入口里暂未调用。直播页是 SPA（切房间走前端路由、不刷新页面），
  当前实现靠 `MutationObserver` + 每 300ms 去抖的 `syncPage()` 自动重挂标记，**不调 teardown 也不会残留**；
  如后续需要在离开直播域名 / 禁用扩展时清理，可在入口调用它（会卸载浮层、解绑键盘与观察器、
  清掉全部属性标记 / 状态类 / 注入的 `<style>`）。

## 6. 已知限制

- **选择器是推断的**：直播页结构若与推断不符，对应功能会降级（影院 / 全屏需要播放器；
  隐藏侧栏 / 弹幕需要命中节点），面板会禁用并说明原因；改选择器只需动 `dom.ts`。
- 直播页是 SPA：切房间时播放器整段替换，影院模式会自动退出（避免残留半透明遮罩），
  需要重新按 T 进入。
- 弹幕开启状态是「乐观更新 + 150ms 后从 DOM 读回」，读回失败时会保持乐观值。
- 影院模式是网页内沉浸（页面压暗 + 播放器铺满），不隐藏浏览器/系统 UI；全屏请用 F。
- 未在真实直播页上跑浏览器验证（按分工由 Lead 统一构建回归），也没有跑 build / playwright。

## 7. 自测记录

- `pnpm exec eslint src/contentScripts/livePage --fix`，再裸跑一次：**0 error 0 warning**；
- `pnpm run typecheck`：**0 error**；
- 本地 `sass@1.108` 编译 `livePage.page.scss`（1.7KB）与 `livePage.shadow.scss`（5.4KB）：通过；
- 未修改 `App.vue` / `contentScripts/index.ts` / `manifest.ts` / `storage.ts` / `_locales` /
  `nativeOverlay`；未跑 build / playwright；未碰浏览器；未做 git 操作。
## 8. 第 17 轮：真机适配加固（live.bilibili.com/6，2026-11-11 实测）

### 真机 DOM 证据

- 播放器舞台：`.live-non-revenue-player`（已由 `[data-bewly-live-player]` 正常命中）；
- 舞台**子节点**：`.live-player-handle-bar.expandable`（顶部操作条，实测约 183px 高）
  与 `.live-player-bg`（画面容器，实测 1320×734）；
- 页面上**不存在** `.aside-area` / `#aside-area` / `.player-and-aside-area`；
  也不存在 `#live-player` / `#live-player-ctnr`（旧版选择器不再作为主路径）。

### 影院模式（修正）

- 舞台改为 `position: fixed; inset: 0; width: 100vw; height: 100vh; max-height: 100vh`，
  **不再套 16:9**（直播是任意比例，16:9 撑不满或裁切）；
- 画面用 `object-fit: contain`，高度按 `100vh`，保证完整可见、不裁切；
- 舞台内顶部操作条 `.live-player-handle-bar` 由 JS 打上 `data-bewly-live-handle-bar` 后
  `display: none`；画面容器 `.live-player-bg` 打上 `data-bewly-live-video-bg` 后铺满舞台；
- 舞台铺满视口后，页面其余区块被舞台与遮罩完全覆盖/压暗，不再需要逐个隐藏。

### 隐藏侧栏（降级策略）

- 先按旧选择器找（`.aside-area` / `#aside-area` / `.player-and-aside-area > aside` / …）；
- 找不到时用结构化启发式：在播放器祖先（最多 3 层）的同级节点里，找「宽度 160–420px、
  高度 ≥ 220px、class 或文案命中聊天/礼物/榜单特征」的容器（真机聊天/礼物列约 320–420px）；
- **仍然找不到 → 面板里的「隐藏侧栏」开关保持禁用**（`disabled` + `aria-disabled` 语义来自原生
  `button:disabled`），并在面板底部显示「当前页没有可隐藏的侧栏」说明 ——
  不给假开关，不会出现「点了没反应」。

### 窄屏（≤900px）不挡控件

- 直播播放器控件在画面底部；≤900px 时浮动按钮从右下角移到**右上角**，面板改为向下展开；
- ≤640px 进一步收窄面板宽度（`100vw - 24px`）、限制标签宽度、允许吐司换行；
- 遮罩 / 播放器舞台不变，缩进都在 shadow root 内，不影响 B 站原生 DOM。

### 本轮改动文件

- `src/contentScripts/livePage/dom.ts`：新增 `HANDLE_BAR_ATTR` / `VIDEO_BG_ATTR`；
  `markLiveStage()` 标记操作条与画面容器；`findAside()` 增加结构化启发式；
- `src/contentScripts/livePage/livePage.page.scss`：影院模式改 100vh / contain / 隐藏操作条；
- `src/contentScripts/livePage/livePage.shadow.scss`：`@media (max-width: 900px/640px)` 窄屏定位；
- `src/contentScripts/livePage/components/LivePageOverlay.vue`：侧栏不可用时的可见说明；
- 本文件。

### 已知限制（第 17 轮）

- 侧栏启发式依赖真实的「聊天/礼物列」宽度与文案；若 B 站改成更宽的双栏或纯图标布局，
  会退化为「找不到 → 开关禁用」，不会误隐藏内容；
- 影院模式下顶部操作条被隐藏；若某些直播间把必要按钮也放在该条里，退出影院后即恢复；
- 窄屏定位用 viewport 媒体查询，直播页若被嵌在 iframe 里不会启用模块（入口已排除 iframe）。
