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
| `lightbox.ts` | 正文图片点击放大：命中判定、打开/关闭、←/→ 切换、锁滚动与恢复位置 |
| `codeBlocks.ts` | 给正文 `pre` 注入「复制」按钮、复制成功 1.5s 反馈、卸载清理 |
| `shortcuts.ts` | `R` / `[` / `]` / `T` / `Esc`（大图打开时 `Esc` / `←` / `→`） |
| `state.ts` / `preferences.ts` / `i18n.ts` / `constants.ts` | UI 状态、sessionStorage 偏好、模块内文案（四种语言）、常量 |
| `articlePage.page.scss` | 注入到 `document.documentElement` 的页面级样式（沉浸阅读 / 复制按钮 / 大图锁滚动） |
| `articlePage.shadow.scss` | shadow root 内的浮层样式（含大图浮层、目录圆点） |
| `components/` | `ArticlePageOverlay` / `ReadingProgress` / `ReadingDock` / `ArticleTocPanel` / `ArticleImageLightbox` |

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
  （目录条目标 `data-active` + `aria-current`）；每个条目左侧有一个**进度圆点**：
  默认空心（`--bew-text-4` 细描边），当前章节实心主题色 + 一圈淡主题色光晕（第 15 轮）；
- 目录为空（老文章不用语义化标题）时：目录按钮禁用、面板不打开，不会出现空壳面板。

### 4. 快捷键

| 键 | 行为 |
| --- | --- |
| `R` | 切换沉浸阅读 |
| `[` | 字号减小（档位 小 → 标准 → 大 左移） |
| `]` | 字号增大 |
| `T` | 回到顶部 |
| `Esc` | 大图打开时先关大图 → 目录展开时收起目录 → 再按退出沉浸阅读；否则完全让行给 B 站 |
| `←` / `→` | 仅在大图打开时：切换同文上一张 / 下一张（到两端停住，不循环） |

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
- 不改 `src/_locales`，文案走模块内 `i18n.ts`（第 12 轮起已是 cmn-CN / cmn-TW / jyut / en 四种语言，
  缺键回退简中 / 英文，键集合四语言一致）。

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

---

## 第 15 轮补完：图片放大 / 代码块复制 / 目录进度圆点

### 1. 正文图片点击放大（lightbox）

- **命中范围**：只处理正文容器（`[data-bewly-article-content]`）里的 `<img>`；
  图片没有地址 / 仍在懒加载（`naturalWidth === 0`）时跳过，点击行为保持 B 站原样；
- **交互**：
  - 点击图片：`preventDefault + stopPropagation`（图片常被 `<a>` 包住，避免误跳转），打开浮层；
  - 同文图片按文档顺序组成序列，`←` / `→` 切换（两端停住不循环），两侧按钮同样可点；
  - `Esc` 关闭、点击遮罩空白处关闭、右上角关闭按钮关闭；
  - 打开时给 `<html>` 加 `bewly-article-lightbox-open`（`overflow: hidden`）锁定滚动，
    并把焦点送到关闭按钮；关闭时移除类名并**恢复到打开前的 `scrollY`**；
- **样式**：遮罩用半透明黑色（`color-mix`），图片 `object-fit: contain`、不裁切，
  暗色模式与 reduced-motion 自动降级；`prefers-contrast: more` / `forced-colors: active` 下按钮保留可见边界；
- **不遮挡正文**：浮层只在点击后渲染（`ui.lightbox.open`），关闭后 DOM 上不留节点；
  阅读模式下正文图片加 `cursor: zoom-in` 提示，不改变布局。

### 2. 代码块复制按钮

- **注入**：`codeBlocks.ts` 在每次同步时扫描正文 `pre`，给每个块补一个原生 `<button type="button">`
  （类名 `bap-code-copy`，打上 `data-bewly-code-copy`），不包 wrapper、不改 B 站结构；
  已有按钮的块直接跳过，DOM 变化 / 懒加载新代码块会自动补上；
- **样式与显隐**（页面级 scss）：按钮绝对定位在代码块右上角，默认 `opacity: 0` +
  `pointer-events: none`，只在 `pre:hover` / `pre:focus-within` / 按钮自身 `focus-visible` 时出现；
  代码块右侧预留 64px 内边距，按钮不会压住代码文字，**不影响正文选择与复制**；
- **复制**：优先 `navigator.clipboard.writeText`，失败回退隐藏 textarea + `execCommand('copy')`；
  文本优先取 `pre > code` 的 `textContent`（没有 `code` 时克隆节点并摘掉按钮，避免把按钮文案复制进去）；
- **反馈**：成功后按钮文案变「已复制 / 已複製 / 複製咗 / Copied」并标 `data-copied="true"`（主题成功色），
  1.5 秒后恢复；失败**静默**（不弹 toast、不改按钮）；
- **无代码块不渲染**：没有 `pre` 的页面不会插入任何节点；卸载时移除全部按钮与标记。

### 3. 目录进度圆点

- `ArticleTocPanel` 的每个目录条目左侧增加 `6px` 圆点（`aria-hidden`，纯装饰）：
  默认空心细描边；当前章节（`data-active="true"`）变为实心主题色 + 淡主题色光晕；
- 圆点不占文本可点击区域之外的空间，长标题仍按原逻辑省略号截断（新增 `.bap-toc__text` 负责截断）。

### 4. 本轮自测

- `pnpm exec eslint`（articlePage 13 个改动文件）：0 error 0 warning；
- `pnpm run typecheck`：0 error；
- 未跑 build / playwright；未碰浏览器；未做 git 操作。

### 5. 已知限制

- 大图**不做缩放 / 拖拽**（需求只要求 Esc / ←→ / 点遮罩 / 恢复滚动位置），也不做 pinch 手势；
- 大图打开时未做完整焦点陷阱：Tab 仍可能离开浮层（Esc 与方向键始终可用）；
- 同文图片序列在**点击瞬间**采集：之后懒加载进来的图片要到下一次点击才会进入序列；
- 代码块复制按钮文案在注入 / 复制成功时按当前模块语言取；切换语言后已存在的按钮要到下一次注入
  （下一次同步或页面重载）才更新，按钮上的「复制」二字不会即时切换；
- 按钮注入不区分阅读模式：普通文章页 hover 代码块也会出现复制按钮（同一套页面样式）；
- 复制失败静默是刻意的：文章页不引入 toast 噪声，用户可重试或手动选择。
