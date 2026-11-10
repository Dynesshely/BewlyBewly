# 用户空间交互增强（第 4 轮）

第 4 轮 B 工作流，负责人 `native-style`。用户空间（`space.bilibili.com/*`）是 **B 站原生页面**：
Bewly 不能替换它的 DOM，只能在上面叠加一个独立 shadow root 的浮层，并通过给原生内容卡
打标记 + 页面级 CSS 实现内容筛选、密度切换与 j/k 浏览。

## 1. 改动文件

新增：

| 文件 | 说明 |
| --- | --- |
| `src/contentScripts/spacePage/index.ts` | 入口：`setupSpacePage()` / `teardownSpacePage()` |
| `src/contentScripts/spacePage/dom.ts` | DOM 适配层（内容卡识别、快速跳转 tab 发现、键盘让行判定） |
| `src/contentScripts/spacePage/actions.ts` | 动作层（偏好、打标、筛选 / 密度、j/k、快速跳转、清理） |
| `src/contentScripts/spacePage/keyboard.ts` | j / k / Enter / Esc |
| `src/contentScripts/spacePage/state.ts` | 面板 UI 状态（reactive） |
| `src/contentScripts/spacePage/preferences.ts` | sessionStorage 读写 |
| `src/contentScripts/spacePage/i18n.ts` | 模块内文案（简中 + 英文） |
| `src/contentScripts/spacePage/constants.ts` | hostId / 属性名 / 状态类名 / sessionStorage 键 |
| `src/contentScripts/spacePage/components/SpaceEnhanceOverlay.vue` | 浮层 UI（浮动按钮 + 面板） |
| `src/contentScripts/spacePage/spacePage.shadow.scss` | 浮层样式（shadow root 内） |
| `docs/space-page.md` | 本文件 |

修改（只追加）：

- `src/styles/adaptedStyles/pages/userSpacePage.scss` 末尾新增「第 4 轮」区域：
  键盘高亮、内容筛选、紧凑密度、动效降级。**上方既有规则（含第 2 轮区域）一行未动。**

未改动：`App.vue`、`contentScripts/index.ts`、`logic/storage.ts`、`_locales/**`、
`nativeOverlay/**`（只 import 复用，不改）、`main.scss`、`package.json`、`vite.config*`。

## 2. 用户可见行为

### 右下角浮动按钮 + 面板

- 浮动按钮常驻右下角（与搜索页 / 消息页增强层同一位置与视觉），带「当前可见条数」角标；
- 面板包含四组内容：**内容筛选**、**密度**、**快速跳转**、**浏览状态 + 快捷键说明**；
- 面板与快捷键只作用于本页；状态存 sessionStorage，刷新保留、关标签页消失；
- 面板展开 / 收起、按钮状态都走 `aria-expanded` / `aria-pressed`，全部是原生
  `<button type="button">`，Tab 可达，`:focus-visible` 有主题色描边。

### 内容筛选（全部 / 视频 / 专栏 / 动态 / 合集）

- 模块扫描原生内容卡并打标记，筛选时**只隐藏不匹配的卡片**（`display: none`），
  切回「全部」立即恢复，**不删除任何 B 站节点**；
- 卡片类型与来源选择器（全部来自 `userSpacePage.scss` 里已确认的原生 DOM）：

  | 类型 | 选择器 |
  | --- | --- |
  | 视频 | `.large-item` / `.video-container` / `.small-item` |
  | 专栏 | `.opus-list .opus-item` / `.article-container` |
  | 动态 | `.bili-dyn-item` |
  | 合集 | `.series-item` / `#page-index .channel .channel-item` / `#page-series-index .channel-item` |

- 同一张卡命中多组选择器时按「外层优先 + 互相包含即跳过」去重（例如动态卡里转发的视频 /
  专栏不会再被算成独立一条）；
- 当前页没有的类型，面板里对应按钮 **禁用** 并在下方提示；如果记忆里的筛选在当前页
  没有对应内容，自动回到「全部」并 toast 提示；
- 若某个 `.section` 区块里的卡片被全部筛掉，模块会给该区块打
  `data-bewly-space-section-empty`，由 CSS 整块收起（原生页没有 `:has`，只能 JS 算）。

### 密度（舒适 / 紧凑）

紧凑档（`.bewly-space-compact`）在原生页面上：

- 区块标题 16px → 14px；
- 卡片标题强制单行截断、字号 13px；
- 卡片正文 / 元信息（`.text-area .content`、`.opus-item-content`、`.opus-item-time`、
  `.small-item .meta`）降到 11px；
- 标题与封面之间留白收紧（`.video-container .text-area` 上内边距 6px）；
- 动态卡圆角收到 12px。

### j / k 浏览

| 键 | 行为 |
| --- | --- |
| `J` | 下一个内容卡（高亮 + 滚动到视口中央） |
| `K` | 上一个内容卡 |
| `Enter` | 在新标签页打开当前高亮卡 |
| `Esc` | 有面板时先关面板，否则取消高亮 |

- 高亮 = 卡片根节点上 `data-bewly-space-active` + `aria-current="true"`，
  页面级 CSS 给主题色 2px 描边 + 20% 主题色外发光；
- 到头循环；当前筛选下没有可见卡片时 toast 提示；
- 被筛选隐藏 / 被站点隐藏（矩形为 0）的卡片不会被 j/k 选中；
- 让行规则：`event.defaultPrevented`、`isComposing`、输入框 / 下拉框 / `contenteditable`、
  带 Ctrl / Cmd / Alt 的组合键、Shift + 字母全部让行；焦点在原生链接 / 按钮上时
  `Enter` 交给原生行为，不会同时打开高亮卡。

### 快速跳转（主页 / 投稿 / 合集 / 收藏夹）

- 只在顶部导航区（`.nav-bar` / `#navigator` / `#navigator-fixed` / `.be-tab`）里找原生 tab：
  先按 tab 文本精确匹配，再按 href 路径（`/video`、`/channel`、`/favlist`、`/<uid>`）匹配，
  最后按文本包含兜底；
- 点击的是**原生 tab 的 `<a>`**（`anchor.click()`），交给 B 站自己的路由，不重新请求接口；
- 页面上找不到对应 tab 时 **该项直接不显示**（面板里不会出现点不动的按钮）；
- 跳转后面板会自动收起，避免挡住刚切换出来的内容。

## 3. 状态与存储

| 键 | 类型 | 说明 |
| --- | --- | --- |
| `bewly-space-filter` | `all \| video \| article \| dynamic \| collection` | 内容筛选 |
| `bewly-space-density` | `comfortable \| compact` | 密度 |
| `bewly-space-panel` | `1 \| 0` | 面板展开状态 |

全部写在 `sessionStorage`（只影响当前标签页，不改 `storage.ts`、不加全局设置项）。
存储不可用（隐私模式）时静默降级为「不记忆」。

模块**零网络请求**：不调用任何 background API，全部是本地 DOM 查询与样式状态。

## 4. Lead 需要接线

在 `src/contentScripts/index.ts` 里 import 并调用（与 `setupSearchEnhance()` 同一位置）：

```ts
import { setupSpacePage } from './spacePage'

// setupSpacePage() 内部自行判断是否空间页，非空间页是空操作
setupSpacePage()
```

需要卸载时调用 `teardownSpacePage()`（会卸载浮层、解绑键盘与观察器、移除所有 DOM 标记）。
**这两个函数本轮没有自己接到 `index.ts`**（按分工由 Lead 接线）。

## 5. 已知限制

- **内容卡选择器是「已确认类名」的覆盖，不是全站兜底**：只识别上表里的类名。
  B 站若改版换掉 `.video-container` / `.bili-dyn-item` 等类名，对应类型会识别不到
  （表现是筛选按钮禁用、j/k 跳不到这类内容），面板不会报错。
- **快速跳转依赖导航文本 / href 启发式**：多语言或改版的 tab 文本可能匹配不到，
  此时该项直接隐藏（按设计降级），不影响其它功能。
- **区块收起只处理 `.section`**：卡片不在 `.section` 里的布局（例如整页只有一张网格）不会
  收区块，只收卡片本身，可能出现「区块标题还在、内容空了」的情况。
- 空间页是 SPA：切 tab 由 `MutationObserver` + `popstate` / `hashchange` 触发重扫（300ms 去抖），
  首屏另加一次 900ms 的补扫；极端情况下（站点用 canvas 渲染内容）识别不到卡片。
- 浮动按钮在右下角，可能与 B 站自己的浮层（如「返回顶部」）位置接近；搜索页 / 消息页增强层
  采用同一位置，保持一致。
- 本轮**没有跑浏览器验证**（按分工由 Lead 统一构建回归），也没有跑 build / playwright。

## 6. 自测记录

- `pnpm exec eslint src/contentScripts/spacePage src/styles/adaptedStyles/pages/userSpacePage.scss --fix`，
  再裸跑一次：**0 error 0 warning**；
- `pnpm run typecheck`：**0 error**；
- 本地 `sass@1.108` 编译 `spacePage.shadow.scss` 与 `userSpacePage.scss`：均通过
  （后者约 52KB）；
- 未修改 `App.vue` / `contentScripts/index.ts` / `storage.ts` / `_locales` / `nativeOverlay`；
  未跑 build / playwright；未碰浏览器；未做 git 操作。