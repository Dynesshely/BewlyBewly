# 专栏 / 文章页阅读模式

第 4 轮 C 节交付（负责人：`anime-search` 子智能体）。

文章页是 **B 站原生页面**（`bilibili.com/read/*` 专栏、`bilibili.com/opus/*` 图文详情），
本模块只在它上面叠加阅读辅助，不替换 B 站 DOM：浮层放在独立 shadow root 里（复用
`src/contentScripts/nativeOverlay/index.ts` 外壳），页面级排版改动全部挂在
`html.bewly-article-reading` 这一个类名作用域下，退出即完全恢复。

## 文件

| 文件 | 作用 |
| --- | --- |
| `index.ts` | 入口 `setupArticlePage()` / `teardownArticlePage()`；挂载浮层、注入页面样式、观察 DOM、同步进度与目录 |
| `dom.ts` | 页面判定（`/read/` 与 `/opus/`）与真实选择器；正文容器、标题、可编辑区判断 |
| `actions.ts` | 沉浸阅读开关、字号三档、目录开关、顶部、进度计算、退出清理 |
| `toc.ts` | 从正文 `h1/h2/h3` 生成目录并维护当前章节高亮 |
| `shortcuts.ts` | `R` / `[` / `]` / `T` / `Esc` |
| `state.ts` / `preferences.ts` / `i18n.ts` / `constants.ts` | UI 状态、sessionStorage 偏好、模块内中英文案、常量 |
| `articlePage.page.scss` | 注入到 `document.documentElement` 的页面级样式（沉浸阅读） |
| `articlePage.shadow.scss` | shadow root 内的浮层样式 |
| `components/` | `ArticlePageOverlay` / `ReadingProgress` / `ReadingDock` / `ArticleTocPanel` |

> `src/styles/adaptedStyles/pages/articlesPage.scss` / `notePage.scss` **本轮没有改动**。
> 原因：阅读模式要同时覆盖 `/read/`（本来归 `articlesPage.scss`）与 `/opus/`
> （归 `momentsPage.scss`，不在本轮写入范围）。把同一套规则放进模块里注入，
> 两处页面行为一致、卸载时可整块移除，也不会在别人拥有的 scss 里留半套规则。

## 功能

### 1. 沉浸阅读（R / 浮动按钮）

- 给 `<html>` 加 `bewly-article-reading`，页面级样式据此：
  - 隐藏侧栏 / 推荐位 / 评论锚点 / 吸顶头 / 面包屑：
    `.right-side-bar`、`.page-content .right-side`、`.side-toolbar`、
    `.fixed-top-header`、`.fixed-author-header`、`.nav-tab-bar`、
    `.comment-wrapper`、`.bili-comment.browser-pc`、`.reply-box.fixed-box`、`.article-breadcrumb`；
  - 正文容器（运行时打上 `data-bewly-article-content`）限宽 **720px** 并居中；
  - 背景降噪：`html/body` 与文章卡片换成纯色 `--bew-bg`，去掉背景图。
- 状态存 `sessionStorage`（`bewly-article-reading`）：同一标签页刷新后保持。
- **安全降级**：只有确认找到正文容器才允许进入；正文没渲染出来时按 `R` 只提示
  「暂时没有找到正文容器」，不会先把侧栏藏掉变成空白页。

### 2. 阅读进度

- 顶部 2px 主题色进度条（`role="progressbar"`，带 `aria-valuenow`）；
- 右下角浮动区顶部显示百分比；
- 页面可滚动高度 ≤ 40px 时进度条与百分比一起隐藏（短文章不显示恒为 100% 的假进度）。
- 滚动用 `requestAnimationFrame` 合并，进度按 `documentElement.scrollHeight - innerHeight` 计算。

### 3. 目录

- 从正文里的 `h1/h2/h3` 自动生成（跳过空标题、重复标题、嵌套标题、隐藏标题），
  `h3` 缩进一级；
- 右下角「目录」按钮开关浮层，点击标题平滑滚动到对应位置（顶部留 88px，避开吸顶元素），
  并把焦点交给标题；
- 当前章节高亮：标题顶边越过视口 96px 线即认为进入该章节，随滚动实时更新
  （目录条目标 `data-active` + `aria-current`）；
- 目录为空（老文章不用语义化标题）时：目录按钮禁用、面板不打开，不会出现空壳面板。

### 4. 快捷键

| 键 | 行为 |
| --- | --- |
| `R` | 切换沉浸阅读 |
| `[` | 字号减小（档位 小 → 标准 → 大 左移） |
| `]` | 字号增大 |
| `T` | 回到顶部 |
| `Esc` | 目录展开时先收起目录；再按退出沉浸阅读；否则完全让行给 B 站 |

- 字号三档：小 16px / 1.8、标准 18px / 1.9、大 20px / 2（只在阅读模式下生效），
  存 `sessionStorage`（`bewly-article-font`）；正文标题与代码块按档位等比换算；
- 捕获阶段注册，处理完 `preventDefault + stopPropagation`；输入框 / 可编辑区、带 Ctrl/Cmd/Alt、
  Shift 组合、已有人处理过的按键（`event.defaultPrevented`）、来自本模块浮层或 `#bewly` 的按键一律让行。

## 选择器依据（先确认再写）

全部来自仓库既有样式里已经在用的真实类名，没有凭空新造：

- `src/styles/adaptedStyles/pages/articlesPage.scss`：
  `.article-container`、`.article-container__content`、`.title-container .title`、
  `.normal-article-holder`、`.read-article-holder`、`.right-side-bar`、`.side-toolbar`、
  `.fixed-top-header`、`.article-breadcrumb`、`.comment-wrapper`、`.bili-comment.browser-pc`、`.reply-box.fixed-box`
- `src/styles/adaptedStyles/pages/momentsPage.scss`（opus 详情）：
  `.opus-detail`、`.opus-module-content`、`.opus-module-title`、`.side-toolbar`、`.fixed-author-header`

正文容器按候选列表逐级退化（`.normal-article-holder` → `.read-article-holder` →
`.article-container__content` → `.opus-module-content` → `.opus-detail`），并额外要求
「元素里至少有 80 个字符」才算命中，避免把占位骨架当正文。

**降级策略**：候选全不命中 → `ui.ready = false`，右下角 Dock 整体不渲染、进度条隐藏；
快捷键 `R` 只给提示不生效；其余快捷键（`T`、`[`、`]`）仍然可用。

## 无接口、无全局存储

- 零网络请求，全部本地 DOM 操作；
- 不新增 `storage.ts` 字段，偏好一律 `sessionStorage` + `bewly-` 前缀；
- 不改 `src/_locales`，文案走模块内 `i18n.ts`（cmn-CN + en，非 en 回退简中）。

## Lead 需要接线

在 `src/contentScripts/index.ts` 的 `onDOMLoaded()` 里，与其它原生页增强并列：

```ts
import { setupArticlePage } from './articlePage'

// 专栏 / 文章页阅读模式（沉浸阅读 / 进度 / 目录 / 字号）
// 内部会自行判断是否 /read/* 或 /opus/*，非文章页是空操作
setupArticlePage()
```

其余无需改动：`App.vue`、`storage.ts`、`_locales`、`nativeOverlay` 均未触碰。

## 已知限制

- `/read/mobile`（移动版专栏）只做了页面判定与正文容器兜底，没有实测其排版容器类名；
- 目录只认 `h1/h2/h3`，纯 `<div>` 排版的标题不会被收进目录（此时目录按钮禁用）；
- 沉浸阅读不处理正文内的推广 / 相关阅读卡片（没有在 scss 里确认到稳定类名，避免误伤正文）；
- 不隐藏站点全局顶栏（`.bili-header`），只隐藏文章页自己的吸顶头与导航条；
- 目录与进度的同步依赖滚动事件 + 1.5s 兜底轮询，页面用自定义滚动容器时进度会以窗口滚动为准；
- 阅读模式与字号不跨标签页共享（`sessionStorage` 语义）。
