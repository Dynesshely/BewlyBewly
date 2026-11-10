# 全站清屏模式（Shift + Z）

第 6 轮 B 节交付。任意页面（Bewly 内嵌页与 B 站原生页）都可以按 `Shift + Z` 进入「只看内容」
的清屏状态：隐藏 Dock / 侧栏 / 顶栏 / 浮动增强层入口，内容区收窄到近满宽；再按一次或 `Esc` 退出。

## 改动文件

| 文件 | 改动 |
| --- | --- |
| `src/contentScripts/views/App.vue` | 清屏状态、根节点 class、document 级 class 同步、`Shift+Z` / `Esc` 键盘入口、浮层 poke 检测 |
| `src/styles/main.scss` | **只追加**清屏规则（`html.bewly-zen` 与 `.bewly-wrapper.bewly-zen` 两个作用域） |
| `src/constants/shortcuts.ts` | 新增可自定义动作 `toggleZenMode`（默认 `Shift+z`） |
| `src/constants/shortcutRegistry.ts` | 登记 `global-zen-mode`（帮助面板 + 命令面板数据源） |
| `src/components/KeyboardShortcutHelp.vue` | 无代码改动：帮助面板由注册表驱动，自动出现「清屏模式（只留内容）」 |
| `src/_locales/{cmn-CN,cmn-TW,jyut,en}.yml` | `settings.keyboard_action_zen_mode`、`keyboard_registry.actions.toggle_zen_mode`；`keyboard_help.focus_browse_exit` 文案补上「清屏」 |

**没有改** `storage.ts` / `nativeOverlay` / 各模块内部按键逻辑 / `contentScripts/index.ts`。
状态只存 `sessionStorage`，不新增设置项（设置页「键盘与快捷键」会自动多出这一行的**改键**入口，
因为它在 `SHORTCUT_ACTIONS` 里）。

## 交互

| 输入 | 行为 |
| --- | --- |
| `Shift + Z` | 切换清屏（打开 → 关闭，关闭 → 打开） |
| `Esc` | 清屏中退出清屏 |

让行规则（避免与原生 / 其它模块抢按键）：

- 输入框 / `textarea` / `select` / `contenteditable` 内不触发（`Shift+Z` 正常打出大写 Z，
  只 `stopPropagation` 阻止全局快捷键层再处理一次）；
- 带 `Ctrl` / `Cmd` / `Alt` 的组合不接管；`event.isComposing`（输入法组词）让行；
- `Esc` 在以下情况不接管：有浮层打开（先关浮层）、原生 / 播放器**全屏**中（`document.fullscreenElement`）、
  聚焦浏览模式中（`html.bewly-focus-browse`，它有自己的 Esc 语义）。

优先级链（一个按键只做一件事）：输入框 → 全屏 → 聚焦浏览 → 浮层 → 清屏。

## 隐藏了什么

清屏分两个作用域，因为这套样式同时存在两份（`manifest.css` 注入页面文档 + `#bewly` shadow root 内）：

### 1. `#bewly` shadow root 内（`.bewly-wrapper.bewly-zen`）

- Dock：`.dock-wrap` / `.dock-edge` / `.dock-content`；
- 侧栏：`.sidebar-content` / `.sidebar-edge`；
- 顶栏：`> div:has(> header)`（TopBar 与 OldTopBar 都渲染 `<header>`，外层 div 只包着它和切换按钮）；
- 卡片信息条：`.bewly-active-info`；AI 状态条：`.bewly-ai-status`；
- `--bew-top-bar-height: 0px`：顶栏隐藏后不再为它留高度；
- 内容区：`.bewly-scroll-container main > div` 宽度改成 `calc(100% - 48px)`、上内边距 24px，
  不再为 Dock 预留的 150/200px 与顶栏留白。

### 2. 页面文档（`html.bewly-zen`）

- 原生页增强层浮层入口：`body > [data-bewly-native-overlay]`（视频页 / 列表页 / 搜索页 / 消息页 /
  空间页 / 文章页 / 直播页的右下角按钮组）；
- B 站原生顶栏：`.bili-header` / `#biliMainHeader` 用 `visibility: hidden`（**不是** `display: none`），
  避免原生页面重新布局导致内容跳动。

## 浮层「暂时恢复 UI」

清屏时打开下列任一浮层，会临时恢复全部 UI（`bewly-zen--peek`），关闭后自动回到清屏，
**清屏状态本身不变**：

- 设置面板（`showSettings`）、命令面板（`showCommandPalette`）、快捷键帮助（`showKeyboardHelp`）、
  视频预览抽屉（`showIframeDrawer`）；
- shadow root 内渲染的 `.dialog`（通用确认框）、`.command-palette-mask`、`.keyboard-help-mask`、
  `.bewly-iframe-drawer`。

实现方式：四个 App 级状态用 `watch` 即时同步；Dialog 等由页面内组件自行渲染、拿不到 ref，
因此在**清屏期间**开一个 400ms 的轻量轮询（`document.hidden` 时跳过），退出清屏即停止轮询。

## 持久化

- key：`sessionStorage['bewly-zen'] = '1' | '0'`；
- 刷新保持（同一标签页），新标签页从关闭开始；
- 状态的初始值在 `setup` 期间**同步读取**，避免刷新后先闪一下顶栏 / Dock；
- `document` 级 class（`html.bewly-zen` / `html.bewly-zen--peek`）在 `onMounted` 与每次切换时同步；
  组件卸载时移除。

## 快捷键系统接入

- `SHORTCUT_ACTIONS` 新增 `{ id: 'toggleZenMode', defaultKey: 'Shift+z', labelKey: 'settings.keyboard_action_zen_mode' }`，
  因此「设置 → 键盘与快捷键」可以改键，键位与其它可自定义动作一致；
- 注册表新增 `global-zen-mode`（`scope: 'global'`、`shortcutActionId: 'toggleZenMode'`、
  `emitEvent: 'toggle-zen-mode'`），`? 帮助面板` 的「全局」组会自动列出，改键后同步显示；
- 键盘处理放在 `App.vue` 的**捕获阶段**监听里（原因见下），Launcher 通过 `emitter.emit('toggle-zen-mode')`
  也可以触发同一入口。

> 与设计简报的差异：简报写的是「`constants/shortcuts.ts` 加动作 + `useKeyboardCardNavigation` 处理」。
> 实际实现把按键处理放在 `App.vue`：`useKeyboardCardNavigation.handleKeydown` 在
> `getVisibleCards()` 为空时**直接 return**（文章页、消息页等无卡片页面），清屏就失效了；
> 而清屏要求「任意页面可用」。放在 App.vue 的捕获阶段既覆盖所有页面，也不会与卡片导航双触发
> （处理完就 `stopPropagation`，冒泡层的动作解析看不到这个键）。

## 与其它全屏形态的关系

| 场景 | 结果 |
| --- | --- |
| 清屏 + 聚焦浏览 | 可以叠加：聚焦浏览只接管方向键 / Enter / Space / Esc，清屏保持；聚焦浏览里的 `Esc` 仍先退出聚焦浏览 |
| 清屏 + 影院模式（播放页） | 互不影响：影院模式是播放器布局，清屏管 Bewly 外壳 |
| 清屏 + 打开设置 / 命令面板 / 帮助 / 抽屉 | 临时恢复 UI（`--peek`），关闭后回到清屏 |
| 清屏 + 原生全屏（播放器 / 浏览器全屏） | `Esc` 交给全屏退出，清屏保持 |

## Lead 需要接线

**无**。改动全部落在既有文件里（App.vue 的模板 class 与生命周期、main.scss 的追加规则、
常量/注册表/locale），没有新增模块入口、没有新增事件订阅点需要接线。

## 已知限制

- 清屏只隐藏 Bewly 自己的外壳与原生页增强层入口；**不隐藏 B 站页面内部的侧栏 / 推荐位**
  （那属于各页面适配样式的职责，统一隐藏容易误伤正文）；
- B 站原生顶栏用 `visibility: hidden` 隐藏，因此原生页顶部仍保留那一段高度（换来的是不会重排跳动）；
- 「暂时恢复 UI」的 Dialog 检测靠 400ms 轮询 + 类名（`.dialog` 等），清屏期间有极轻的开销；
- 聚焦浏览里按 `Shift+Z` 目前不会切换清屏（焦点浏览的 Esc 与按键语义优先，避免双重全屏状态打架）；
- `Shift+Z` 在 `contenteditable` 聊天气泡里不会触发清屏（按普通输入处理）；
- 命令面板里不提供「切换清屏」命令（本轮未改 CommandPalette.vue），要执行请用快捷键或设置页改键入口；
- 清屏与播放页「影院模式」同时开启时，`Esc` 先退出清屏（清屏在捕获阶段先注册），再按一次才退出影院。
