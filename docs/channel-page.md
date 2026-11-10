# 分区 / 频道页 / 热门 / 排行榜增强浮层（第 5、7 轮）

第 5 轮 C 工作流，负责人 `native-style`。分区 / 频道页（`bilibili.com/v/*`、`bilibili.com/channel/*`）
是 **B 站原生页面**：Bewly 不能替换它的 DOM，只能在上面叠加一个独立 shadow root 的浮层，
并通过给原生视频卡打标记 + 页面级 CSS 实现密度切换、排序快捷与 j/k 浏览。

本轮**零网络请求**，全部是本地 DOM 查询与样式状态。

## 1. 改动文件

新增 `src/contentScripts/channelPage/`：

| 文件 | 说明 |
| --- | --- |
| `index.ts` | 入口：`setupChannelPage()` / `teardownChannelPage()` |
| `dom.ts` | DOM 适配层（视频卡识别、排序 tab 文本发现、键盘让行判定） |
| `actions.ts` | 动作层（偏好、打标、密度、排序、j/k、页面样式注入、清理） |
| `keyboard.ts` | j / k / Enter / Esc |
| `state.ts` | 面板 UI 状态（reactive） |
| `preferences.ts` | sessionStorage 读写（`bewly-channel-*`） |
| `i18n.ts` | 模块内文案（简中 + 英文） |
| `constants.ts` | hostId / 属性名 / 状态类名 / sessionStorage 键 / style id |
| `components/ChannelEnhanceOverlay.vue` | 浮层 UI（浮动按钮 + 面板） |
| `pageStyles.scss` | **页面级**样式（作用在原生 DOM，两个注入点共用这一份） |
| `channelPage.shadow.scss` | 浮层样式（shadow root 内） |

修改：

- `src/styles/adaptedStyles/pages/channelPage.scss`：顶部加一行
  `@use "../../../contentScripts/channelPage/pageStyles" as *;`，末尾追加说明块。
  **既有规则一行未改。**

新增：`docs/channel-page.md`（本文件）。

未改动：`App.vue`、`contentScripts/index.ts`、`logic/storage.ts`、`_locales/**`、
`nativeOverlay/**`（只 import 复用）、`main.scss`、`package.json`、`vite.config*`。

## 2. 注入点归属（重要）

页面级样式的注入有两个入口，**共用 `pageStyles.scss` 同一份规则**，不会出现两套：

| 路径 | 谁注入 | 说明 |
| --- | --- | --- |
| `/tv/*`、`/movie/*`、`/variety/*`、`/mooc/*`、`/documentary/*` | `adaptedStyles/index.ts` 注入 `channelPage.css` | 该文件顶部 `@use` 了 `pageStyles.scss` |
| `/v/*`、`/channel/*` | 本模块 | 这几条路径**不在** `adaptedStyles` 的注入清单里，模块在入口处把 `pageStyles.scss?inline` 注入成 `<style id="bewly-channel-page-style">` |

模块注入的是 `<style id="bewly-channel-page-style">`（`injectCSS` 到 `document.documentElement`）。
每轮扫描都会对齐一次状态：`<html>` 上出现 `channelPage` 类（即 adaptedStyles 已接管）时，
本模块注入的 `<style>` 会被撤掉，保证同一份规则只加载一份。

页面级规则的作用域是 `html.bewly-channel-page`（模块自己在 `<html>` 上加的标记类，
teardown 时移除），与 B 站原有的类名不冲突。

> 如果后续把 `/v/*`、`/channel/*` 加进 `adaptedStyles/index.ts` 的频道页分支（并添加
> `channelPage` 类），模块的注入会自动跳过，无需改本模块代码。

## 3. 用户可见行为

### 右下角浮动按钮 + 面板

- 浮动按钮常驻右下角（与消息页 / 搜索页 / 空间页增强层同一位置与视觉），带视频卡数量角标；
- 面板包含：**密度**、**排序快捷**、**浏览状态 + 快捷键说明**、底部提示；
- 面板展开 / 收起走 `aria-expanded`，密度与排序按钮是原生 `<button type="button">`，
  带 `aria-pressed` / `aria-label`，Tab 可达，`:focus-visible` 有主题色描边。

### 密度（舒适 / 紧凑）

紧凑档（`.bewly-channel-compact`，存 sessionStorage `bewly-channel-density`）：

- 卡片标题强制单行截断、字号 13px；
- 作者 / 元信息字号 12px；
- 标题与封面之间留白收到 6px；
- 封面圆角收小一档（`--bew-radius-half`）。

### 排序快捷（综合 / 播放多 / 最新）

- 点击的是**原生排序 tab**（`element.click()`），交给 B 站自己的逻辑，不自己排序、不发请求；
- 页面上找不到的排序项 **直接不渲染**（不会出现点不动的按钮）；一项都找不到时整组隐藏；
- 点击后面板自动收起，避免挡住刚切换出来的列表。

### j / k 浏览

| 键 | 行为 |
| --- | --- |
| `J` | 下一个视频卡（高亮 + 滚动到视口中央） |
| `K` | 上一个视频卡 |
| `Enter` | 在新标签页打开当前高亮卡 |
| `Esc` | 有面板时先关面板，否则取消高亮 |

- 高亮 = 卡片根节点上 `data-bewly-channel-active` + `aria-current="true"`，
  页面级 CSS 给主题色 2px 描边 + 20% 主题色外发光；
- 到头循环；页面上没有卡片时 toast 提示；
- 让行规则：`event.defaultPrevented`、`isComposing`、输入框 / 下拉框 / `contenteditable`、
  Ctrl / Cmd / Alt、Shift + 字母全部让行；焦点在原生链接 / 按钮上时 `Enter` 交给原生行为。

## 4. 选择器来源（全部已在仓库中确认）

| 用途 | 选择器 | 仓库出处 |
| --- | --- | --- |
| 视频卡 | `.bili-video-card` | `src/composables/useKeyboardCardNavigation.ts`（`NATIVE_CARD_SELECTOR`）、`src/utils/nativeFilter.ts`（分区页规则）、`searchPage.scss` |
| 历史兜底卡 | `.video-card` / `.video-list-item` / `.rank-item` | `src/utils/nativeFilter.ts` 的 `page` 规则 |
| 页面容器 | `.channel-container` | `src/styles/adaptedStyles/pages/channelPage.scss` |
| 卡片标题 | `.bili-video-card__info--tit` / `.video-name` / `.title` / `h3` | 同上（nativeFilter 的 title 列表） |
| 作者 | `.bili-video-card__info--author` / `.up-name` / `.upname` | 同上 |

**排序 tab 没有仓库级确认的类名**，因此不做类名假设：只按「`.channel-container` 内 + 文本
（综合 / 播放多 / 最新，另含英文兜底）」查找可点击元素（`a` / `button` / `[role=button]` / `li`），
并排除视频卡内部的同名文本；找不到就不显示——符合简报「找不到则隐藏」的要求。

## 5. 状态与存储

| 键 | 取值 | 说明 |
| --- | --- | --- |
| `bewly-channel-density` | `comfortable \| compact` | 密度 |
| `bewly-channel-panel` | `1 \| 0` | 面板展开状态 |

全部写在 `sessionStorage`（只影响当前标签页）。本轮不新增 settings 字段。
存储不可用（隐私模式）时静默降级为「不记忆」。

## 6. Lead 需要接线

在 `src/contentScripts/index.ts` 里 import 并调用（与其它增强层同一位置）：

```ts
import { setupChannelPage } from './channelPage'

// setupChannelPage() 内部自行判断是否分区页、是否在 iframe 里，非目标页是空操作
setupChannelPage()
```

卸载时调用 `teardownChannelPage()`（卸载浮层、解绑键盘与观察器、移除 DOM 标记 / 状态类 /
注入的 `<style>`）。

## 7. 已知限制

- **排序 tab 是文本启发式**：B 站若改排序文案（例如「最新发布」→其它词）或把排序控件放进
  非 `.channel-container` 的区域，对应项会消失（按设计降级，不影响密度与 j/k）。
- **与 Bewly 全局键盘导航共存**：`useKeyboardCardNavigation` 在原生页上接管的是方向键 /
  Home / End / Enter（并会 `preventDefault`），本模块只接管 `j` / `k` / `Enter` / `Esc`；
  按方向键时是全局导航的高亮（`data-keyboard-active`），按 j/k 时是本模块的高亮
  （`data-bewly-channel-active`），两套高亮互不干扰、可能同时出现。
- **`/v/*` 全量包含**：包括 `/v/popular/all`（热门）这类同样带 `.bili-video-card` 的页面，
  这些页面上浮层同样可用；如只想在频道列表页出现，可在 `isChannelPage()` 里再加白名单。
- **iframe 内不叠加**：`window.self !== window.top` 时直接空操作（顶栏抽屉等场景）。
- 页面级样式依赖 `adaptedStyles/pages/channelPage.scss` 顶部的 `@use` 与模块的
  `?inline` 注入；两者任一被删都会让 `/tv`、`/v` 其中一类页面的密度 / 高亮失效。
- 本轮**没有跑浏览器验证**（按分工由 Lead 统一构建回归），也没有跑 build / playwright。

## 8. 自测记录

- `pnpm exec eslint src/contentScripts/channelPage src/styles/adaptedStyles/pages/channelPage.scss --fix`，
  再裸跑一次：**0 error 0 warning**；
- `pnpm run typecheck`：**0 error**（全量检查通过；过程中曾看到 2 条报错落在
  `src/contentScripts/spacePage/actions.ts`，是同轮 A 工作流正在改的他人文件，该工作流修好后复跑已干净）；
- 本地 `sass@1.108` 编译校验：`pageStyles.scss`（1.6KB）、`channelPage.shadow.scss`（5.8KB）、
  `adaptedStyles/pages/channelPage.scss`（3.9KB，含 `@use` 引入的页面级规则）均通过；
- 未修改 `App.vue` / `contentScripts/index.ts` / `storage.ts` / `_locales` / `nativeOverlay`；
  未跑 build / playwright；未碰浏览器；未做 git 操作。

## 8. 第 7 轮追加：热门页 / 排行榜页

同一个 `channelPage` 模块继续覆盖两个 URL（它们本来就被 `isChannelPage()` 的 `/v/*` 分支接住）：

| URL | 页面种类 | 面板标题 | 可用功能 |
| --- | --- | --- | --- |
| `/v/*`、`/channel/*`、`/c/*`（其他） | `channel`（分区页） | 分区页增强 | 密度、排序快捷、j/k |
| `/v/popular*`（含 `/v/popular/all`） | `popular`（热门页） | 热门页增强 | 密度、j/k |
| `/v/popular/rank/*` | `rank`（排行榜） | 排行榜增强 | 密度、榜单快捷（1/2/3）、排名徽标、j/k |

页面种类由 `dom.ts` 的 `getChannelPageKind()` 判断（`rank` 优先于 `popular`），
同时写到 `<html data-bewly-channel-kind="channel|popular|rank">`，页面级样式与面板标题都按它区分。

### 榜单切换（1 / 2 / 3）

- 排行榜页的日榜 / 周榜 / 月榜没有仓库确认的类名，按「标签文本」发现：
  `日榜|每日|day|daily`、`周榜|每周|week|weekly`、`月榜|每月|month|monthly`；
  排除内容卡、头部导航与弹层，只接受短文本 + 子元素不超过 2 个的节点；
- 快捷键 `1` / `2` / `3` 分别点对应原生 tab（面板里也有「榜单切换」按钮，按钮上标了序号）；
- 页面上找不到某个 tab 时：面板里不渲染该项、对应快捷键静默忽略（不抢按键、不弹错）。

### 排名徽标

- 名次优先读卡片里已有的原生名次元素（`.num` / `.rank` / `[class*="rank-num"]` 等，
  只认 1–4 位纯数字，避免把播放量 / 日期当名次）；
- 读不到时退回卡片在列表里的 **DOM 顺序**（排行榜的排列顺序本身就是名次）；
- 名次写到 `[data-bewly-channel-rank]`，徽标用 CSS `content: attr(data-bewly-channel-rank)`
  渲染在卡片左上角：前三名主题色实心，4–10 名主题色淡底，其余中性底；
- 原生名次元素在徽标接管后隐藏（`[data-bewly-channel-rank-native]`），避免同一个名次显示两次；
- **非排行榜页不写任何名次标记**，样式也就不会渲染徽标；名次读不到（既无原生元素、
  列表为空）时同样不显示。

### 卡片选择器（排行榜页）

排行榜页的卡片根优先用 `.rank-item`（nativeFilter 的排行 / 分区页规则里已确认），
因为名次徽标要挂在整条目上；其余页面仍用 `.bili-video-card` 优先的既有顺序。
热门页的卡 `.bili-video-card` / `.video-card` 同样来自 nativeFilter 的
`.popular-video-container` 规则，无需新选择器。

### 样式落在哪

页面级样式（名次徽标、密度、高亮）唯一来源仍是模块内的 `pageStyles.scss`，
而 `src/styles/adaptedStyles/pages/channelPage.scss` 顶部 `@use` 了它 —— 所以
`/tv|movie|...` 子频道与模块自行注入的 `/v/*` 页面共用同一份规则。
本轮新增的徽标规则追加在 `pageStyles.scss`（在 `channelPage.scss` 的生效链路内），
`channelPage.scss` 本身不需要再加规则，避免两处漂移。

### 本轮自测

- `pnpm exec eslint src/contentScripts/channelPage --fix`，再裸跑：**0 error 0 warning**；
- `pnpm run typecheck`：**0 error**；
- sass 编译 `pageStyles.scss`（2.9KB）、`channelPage.shadow.scss`（6.0KB）、
  `adaptedStyles/pages/channelPage.scss`（5.2KB，含 `@use` 的页面级规则）均通过。

### 本轮已知限制

- 榜单 tab 与上一轮的排序 tab 一样是**文本启发式**：B 站改文案或换容器后对应项会消失
  （面板隐藏、快捷键静默），不影响密度与 j/k；
- 名次退回 DOM 顺序时，若列表混入了非视频条目（广告 / 推荐块），名次可能整体偏移一格；
  能读到原生名次元素时不会出现这个问题；
- 热门页（`/v/popular/all`）上的 `useKeyboardCardNavigation` 也接管方向键 / Enter，
  与本模块的 j/k 高亮各自独立（同一轮第 5 节已有说明）；
- 未做浏览器验证（按分工由 Lead 统一构建回归）。
