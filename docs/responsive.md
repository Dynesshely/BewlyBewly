# 窄屏适配（≤900px / ≤640px）

第 17 轮 A 节交付（负责人：`anime-search` 子智能体）。

第 1–16 轮新增 UI 以 1600×1000 桌面宽度为基准，本轮逐个审计窄屏表现并**只加媒体查询样式**修复，
不改任何 TS 逻辑与 DOM 结构。所有修复块统一写成 `@media (max-width: 900px)` / `(max-width: 640px)`，
放在各自组件 `scss` 的**末尾**（不重排既有规则）。

## 1. 审计范围与方法

| 域 | 文件 |
| --- | --- |
| 视频卡悬停操作条 | `src/components/VideoCard/VideoCard.vue`（`:deep()` 定位子组件按钮） |
| 反馈态组件 | `src/components/Feedback/{EmptyState,ErrorState,SkeletonBlock}.vue` |
| 列表页工具条 | `src/contentScripts/views/listShared/styles/listPage.scss`（工具条样式都在这里） |
| 动态卡 / 工具条 | `views/Moments/{Moments.vue,components/MomentCard.vue,components/MomentLightbox.vue}` |
| 首页密度胶囊 + 回到顶部 | `views/Home/Home.vue` |
| 原生页增强浮层 | `notificationPage` / `searchPage` / `spacePage` / `channelPage` / `articlePage` 的 `*.shadow.scss` |

检查项：固定宽度 / `min-width` / `white-space: nowrap` / 不换行的 flex 行 / 绝对定位浮层 / 横向溢出风险。
方法：逐文件审计 + 加块后用 `sass` 编译校验，并用 `grep` 确认选择器在对应文件中真实存在，避免写死规则。

## 2. 发现的问题与修复

### 2.1 视频卡悬停操作条

- **问题**：`.bewly-card-actions` 在封面右下角绝对定位、三个按钮各 28px；窄卡片上会压到时长徽标区域，
  并且按钮组宽度接近卡片宽度，左右贴边显得拥挤。
- **修复**：`VideoCard.vue` 末尾加媒体块，通过 `:deep()` 把操作条右/下内移 2px、限制最大宽度
  （`max-width: calc(100% - 4px)`），按钮 28 → 26px（≤900）/ 24px（≤640），间隙同步缩小；
  时长徽标本身在悬停时淡出，两个状态互不叠加。

### 2.2 动态页卡片与工具条

- **问题**：头部 hero（标题 + 计数 + 刷新按钮）在窄屏挤成一行；工具条（密度分段 + 只看视频 + 离屏优化）
  不换行；卡片互动条 / 统计行（转发 / 评论 / 点赞 / 播放 / 弹幕）在窄卡片上溢出；
  键盘提示条占一整行宽度；大图浮层下载按钮 / 说明在极窄屏可能超宽。
- **修复**：
  - `Moments.vue`：≤900 让 hero 与工具条 `flex-wrap`，hero 操作区独占一行右对齐；≤640 隐藏工具条文字标签
    （图标仍可点，`aria-label`/`title` 保留）、隐藏键盘提示条（触屏窄屏用不上）、缩小标题字号；
  - `MomentCard.vue`：≤900 统计行与互动条 `flex-wrap`；≤640 meta 行换行、按钮内边距收窄；
  - `MomentLightbox.vue`：≤640 收窄浮层内边距、说明文字 `overflow-wrap: anywhere`、下载按钮限宽。

### 2.3 列表页工具条（视图 / 排序 / 过滤 / 页面操作）

- **问题**：`.bewly-list-toolbar` 是单行 flex（标题 + 计数 + 分段视图 + 排序下拉 + 过滤框 + 右侧操作按钮），
  900px 以下开始挤压，640px 以下过滤框被压到几乎不可用，且可能出现横向溢出。
- **修复**（`listPage.scss` 末尾）：
  - ≤900：工具条 `flex-wrap`、`row-gap: 8px`；隐藏 spacer；meta 允许收缩；过滤框 `flex: 1 1 200px` + `min-width: 0`；
  - ≤640：分段视图按钮隐藏文字只留图标（宽度 30px）、过滤框独占一行、右侧操作按钮整行右对齐、
    标题单行省略；hero 与 chips 同步换行、字号与内边距收窄。

### 2.4 首页密度胶囊 + 回到顶部与 Dock 避让

- **问题**：首页标签栏 + 右侧密度胶囊 / 布局切换胶囊在 900px 以下不换行，容易与 Dock / 右侧栏挤压；
  回到顶部按钮 40px 在 640px 以下偏大，可能贴近 Dock 或边缘。
- **修复**：≤900 标签栏容器 `flex-wrap: wrap`，回到顶部缩到 36px；≤640 标签栏靠左、间距收窄，
  回到顶部 34px 并限制 `max-width: calc(100vw - 24px)`。
  回到顶部的 `right/bottom` 仍由第 10 轮的 `settings.dockPosition` 内联计算负责（右侧 Dock 让 72px、
  底部 Dock 上移 72px），本轮不改逻辑，只缩小按钮尺寸，因此不会与 Dock 重叠。

### 2.5 原生页增强浮层（消息 / 搜索 / 空间 / 分区 / 文章）

- **问题**：五个浮层面板都用 `width: min(320~340px, calc(100vw - edge*2))`，**总宽度本身安全**；
  但面板内部分行（状态行 / chips / 跳转行 / 快捷键行）不换行，640px 下会顶出面板出现横向滚动；
  浮动按钮带文字标签在窄屏占宽；文章页右下角 Dock 有 5–6 个按钮 + 文字标签，320px 宽度下会超宽。
- **修复**：
  - 消息 `bnp-*`：≤640 隐藏 FAB 文字标签、面板左右贴 12px、`max-height` 收敛、头部与分类 chips 换行；
  - 搜索 `bse-*`：≤640 隐藏 FAB 标签、面板左右 12px 自适应宽、row / status 换行；
  - 空间 `bsp-*`：≤640 隐藏 FAB 标签、面板贴边、跳转行与 chips 换行；
  - 分区 `bcp-*`：≤640 隐藏 FAB 标签、面板贴边、chips 换行；
  - 文章 `bap-*`：≤900 Dock 内移 12px；≤640 按钮只留图标（约 32px）、按钮组允许换行并限制
    `max-width: calc(100vw - 24px)`、目录面板左右贴边自适应宽、大图提示单行省略。

### 2.6 反馈态组件（空态 / 错误态 / 骨架）

- **问题**：空态插画 96px + 48px 上下内边距，在 640px 以下偏高；错误态消息长文本可能撑宽。
- **修复**：≤640 空态/错误态内边距 32px 12px、插画 76px、标题 15px、操作区居中换行；
  错误信息 `word-break: break-word`；骨架行圆角收小。

## 3. 校验

- 14 个改动样式（8 个 Vue scoped style 抽取 + 6 个 scss）用 `pnpm exec sass` 单文件编译：**14/14 通过**；
- 所有媒体查询块均位于对应文件末尾（Vue 在 `</style>` 前），未重排既有规则；
- 未新增任何 `overflow-x: scroll`；换行/省略优先，只有面板内部 chips 允许换行（不产生页面横向滚动条）；
- `grep` 校验了引用的类名（`bewly-list-toolbar__*` / `moments-*` / `bnp-*` / `bse-*` / `bsp-*` / `bcp-*` / `bap-*`）
  均在对应文件中存在，避免死规则；
- 未改 TS 逻辑、未改 DOM 结构、未跑 build/playwright、未碰浏览器、未做 git 操作。

## 4. 已知残留 / 后续

- **眼睛没在真机上看过**：本轮按分工只做静态审计 + 编译校验，最终窄屏观感需 Lead 统一构建后在 640/900 宽度下走查；
- **触屏无 hover**：视频卡悬停操作条在触屏上依赖 `focus-within`（既有行为），本轮只缩小尺寸，未改触发方式；
- **首页 Dock 避让依赖内联计算**：极窄屏（<360px）若 Dock 在底部且用户把字号调大，回到顶部按钮可能与 Dock 间距变小
  （仍是 24px 边距 + 72px 让位），后续如需可把让位值改成 CSS 变量；
- **动态页键盘提示条在 ≤640 被隐藏**：触屏设备用不到，但外接键盘用户可依赖帮助面板（`?`）；
- **原生页面板内滚动**：面板 `max-height` 收敛后内容在面板内滚动（不是页面滚动），属于预期行为；
- 列表页吸顶工具条高度由 JS 写入 `--bew-list-toolbar-height`，换行后会自动重新测量（ResizeObserver），无需改逻辑。
## 5. 第 25 轮：窄屏（≤1024px / ≤768px）全站回归

本轮把断点从「≤900 / ≤640」扩到「≤1024 / ≤768」，逐项检查 5 处窄屏可用性问题。
所有修复都只用 `flex-wrap` / `min-width: 0` / `clamp()` / `max-width: calc()` 与媒体查询，
**没有 `!important` 堆叠，不改桌面端（≥1280px）视觉，也不改任何业务逻辑**。

### 5.1 设置页（`components/Settings/Pages/Pages.vue`）

| 问题（窄屏表现） | 修复 | 断点 |
| --- | --- | --- |
| 分组胶囊行 `.pages-nav__track` 是 `overflow-x:auto` 的 flex 容器，父级 `.pages-nav` 未设 `min-width:0`，长标题会把内容栏挤窄 | `.pages-nav { min-width: 0 }` + 轨道 `scroll-padding-inline`（键盘聚焦时自动滚入视野） | ≤1024px |
| 吸顶工具栏 `.pages-toolbar` 左右负边距只有 640px 档，1024/768 下与内容对齐错位 | 补 1024px（-1.75rem）与 768px（-1rem）两档边距；768px 下工具栏改纵向排列 | ≤1024 / ≤768px |
| 胶囊文字在 768px 下过大、占满一行 | `.pages-nav__pill { padding-inline: 0.625rem; font-size: 0.6875rem }` | ≤768px |
| 数据导入 / 导出按钮与确认框按钮在窄屏被裁切 | `.pages-data__actions{flex-wrap:wrap}`、`.pages-data__button{max-width:100%}`、确认框按钮左对齐 | ≤768px |

### 5.2 诊断面板（`contentScripts/diagnostics/DiagnosticsPanel.vue`，只加 CSS）

| 问题 | 修复 | 断点 |
| --- | --- | --- |
| 环境信息是 `grid-template-columns: max-content minmax(0,1fr)`，长 UserAgent 会把面板撑出横向滚动 | 1024px 起把标签列钳到 `minmax(0, 8.5rem)`；768px 起整表改为单列（标签在上、值在下）+ `overflow-wrap: anywhere` | ≤1024 / ≤768px |
| 结果条目 `.diagnostics__item` 一行排开（名称 / 原因 / 元信息），窄屏下挤成细长条 | 768px 起 `flex-direction: column`，名称、原因、元信息各占一行 | ≤768px |

> 与 C 工作流并行：本轮**只新增媒体查询**，没有改诊断面板的结构、文案与逻辑。

### 5.3 评论区工具条（`contentScripts/videoPage/components/CommentToolbar.vue`）

| 问题 | 修复 | 断点 |
| --- | --- | --- |
| 工具条是 `fixed` + 内联 left/top（由 comments.ts clamp 到视口内），窄屏下三个按钮挤成一行会被裁切 | `flex-wrap: wrap` + `row-gap`，`max-width: min(320px, calc(100vw - 24px))`，圆角从 999px 改为 14px（换行后胶囊形会露馅） | ≤1024px |
| 768px 下按钮仍偏大，紧贴 / 盖住视频信息栏 | `max-width: calc(100vw - 16px)`、按钮高 24px / 字号 11px | ≤768px |

### 5.4 收藏夹胶囊「⋯」菜单与删除确认框（`contentScripts/views/listShared/styles/listPage.scss`）

| 问题 | 修复 | 断点 |
| --- | --- | --- |
| 900px 档会把胶囊行 `flex-wrap: wrap`，收藏夹多时行高失控、把工具条顶下去 | 1024px 起改回单行横向滚动（`flex-wrap: nowrap` + `max-width: 100%`） | ≤1024px |
| 「⋯」菜单与删除确认框是 `absolute` 相对胶囊定位，窄屏会顶出视口右侧被裁掉 | `max-width: calc(100vw - 32px)` + `max-height: min(60vh, 320px)` + 内部 `overflow-y: auto`；确认框宽度 `min(236px, calc(100vw - 32px))`；新建输入框 `min(140px, calc(100vw - 140px))` | ≤768px |

### 5.5 长评论展开按钮（`contentScripts/videoPage/components/CommentFoldButtons.vue`）

| 问题 | 修复 | 断点 |
| --- | --- | --- |
| 按钮 `left` 由 thread 右边缘算（`rect.right - 88`），窄屏正文几乎占满整行，按钮压在文字上 | 新增 `matchMedia('(max-width: 768px)')`：窄屏时按钮样式改为 `right: 8px`（不再用传入的 left），按钮缩到 76×30 / 字号 11px | ≤768px |

> 展开按钮的位置是在模板里按媒体查询切换的（`matchMedia` + `onMounted` 监听），
> 因为定位值是 JS 算出来的内联样式，纯 CSS 无法覆盖 `left`。点击逻辑与 `comments.ts` 完全没动。

### 5.6 自测

- 改动文件的 scoped `<style>` 与 `listPage.scss` 全部通过 `sass` 编译；
- `pnpm exec eslint <改动文件> --fix` 后裸跑：0 error 0 warning；
- `pnpm run typecheck`：0 error；
- 未跑 build / playwright、未碰浏览器、未 git —— 窄屏观感需要 Lead 构建后在 1024 / 768 / 640 三档走查一次。

### 5.7 已知限制（第 25 轮）

- 断点只覆盖「本轮点名的 5 处界面」，其它页面（动态 / 列表 / 首页）沿用第 17 轮的 ≤900/≤640 规则；
- 评论区工具条的定位仍由 JS 计算，CSS 只能改换行与尺寸；若 B 站评论容器宽度突变，工具条可能仍偏向一侧；
- 诊断面板在 ≤768 改为单列后更长，面板本身依赖父级滚动，长报告需要滚动查看（预期行为）；
- 设置页 768px 档把工具栏改成纵向排列，吸收了「胶囊行 + 搜索框」两行高度，未做折叠；
- 展开按钮在窄屏贴右内侧，若 B 站评论区本身有右侧留白，按钮会比正文右边缘再靠里 8px（可接受）。
## 6. 第 26 轮：窄屏横向滚动条专项（原生头部 1100px 溢出）

### 6.1 真机证据（Lead 实测，ungoogled-chromium 156，2026-11-11）

| 视口 | 现象 |
| --- | --- |
| 768×900 | `.bili-header` 宽 **1100px**（视口 768），`.right-entry` / `.v-popover` 被推到 `right=1076`；`document.scrollingElement.scrollWidth = 1100 > innerWidth = 768`，`canScrollX: true`（整页可横向滚动）；`#bewly` 自身宽 762px（正常） |
| 390×844 | `docScrollW = 1100`，同样可横向滚动 |

结论：横向滚动来自 **B 站原生头部**，不是 Bewly 的 UI（第 25 轮只修了 `#bewly` 内部）。

### 6.2 修复策略（最小侵入）

只改 `src/styles/adaptedStyles/common/common.scss` 与 `pages/homePage.scss`，全部包在 `@media (max-width: 1024px)` / `(max-width: 768px)` 里：

| 步骤 | 规则 | 目的 |
| --- | --- | --- |
| 1 | `.bili-header` / `.international-header` / `#biliMainHeader` / `#bili-header-container`：`box-sizing: border-box; max-width: 100vw; min-width: 0` | 头部容器不再按内容宽度撑到 1100px |
| 2 | 头部内的 `.bili-header__bar` / `.left-entry` / `.right-entry` / `.center-search-container` / `.search-panel` / `.nav-link-item`：`min-width: 0; max-width: 100%; flex-shrink: 1` | 子项可以收缩（默认 `min-width: auto` 会拒绝收缩，正是 1100px 的来源之一） |
| 3 | 频道条 `.bili-header__channel` / `.header-channel`：`max-width: 100vw; min-width: 0; overflow-x: auto; overflow-y: visible`，条目 `flex: none` | 条目太多时在频道条**内部**横向滚动，页面级不产生横向滚动条 |
| 4 | 768 档：搜索容器 `flex: 1 1 auto; min-width: 0`，左右入口的 `li` 允许 `min-width: 0` | 768 下搜索框与入口不再溢出 |
| 5 | 首页（`homePage.scss`）：`#biliMainHeader` / `.header-channel` 同上收缩；`.recommended-container .container` / `.bili-grid` `max-width: 100%` | 首页大头部与内容栅格一并收敛 |

**没有用** `body { overflow-x: hidden }`：它会让 `position: sticky` 失效，并且只是把真实溢出藏起来。
**没有** 对 `.bili-header` 用 `overflow: hidden`：头部内的下拉菜单（`.v-popover`、频道「更多」）会被一起裁掉。

### 6.3 复测方法（可直接复制进 DevTools Console / Playwright）

```js
// 1) 页面级横向滚动：核心判据
const doc = document.scrollingElement
const canScrollX = doc.scrollWidth > window.innerWidth + 1
console.log({ viewport: innerWidth, docScrollW: doc.scrollWidth, canScrollX })

// 2) 找真正的溢出元素（穿透 shadow root，递归遍历）
const offenders = []
function walk(root) {
  for (const el of root.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.right > innerWidth + 1) {
      offenders.push({
        tag: el.tagName,
        cls: String(el.className).slice(0, 90),
        right: Math.round(r.right),
        width: Math.round(r.width)
      })
    }
    if (el.shadowRoot)
      walk(el.shadowRoot)
  }
}
walk(document)
console.table(offenders.slice(0, 20))
```

判定：`canScrollX === false` 即通过；`offenders` 里应只剩少量 B 站自身 fixed 浮层（它们不影响文档滚动宽度）。

### 6.4 残余问题与保留原因

- **下拉菜单 / 频道「更多」浮层**：如果它们在 DOM 里是 `position: absolute` 且挂在头部内，收缩后可能被自身容器裁切。
  本轮**没有**给头部加 `overflow: hidden` 就是为了不裁它们；若真机复测发现头部仍有溢出，
  可在 `@media (max-width: 1024px)` 里追加下面这段「只裁剪、不隐藏页面滚动」的可选兜底：

  ```scss
  .bewly-design .bili-header {
    overflow-x: clip; // 比 hidden 温和：不创建滚动容器，也不影响 sticky
  }
  ```

  注意：`overflow-x: clip` 仍可能裁掉头部内的绝对定位浮层，所以只在「不收就溢出」时启用，并在真机上确认下拉菜单仍可见。
- **B 站自身的固定宽度元素**（例如某些页面的 `min-width: 1100px` 内容容器）：如果不在上面覆盖的类名范围内，
  需要按页追加规则（`products/*.scss`），本轮只处理了通用头部与首页，避免误伤其它页面。
- **未在真机验证**：本轮不允许 build/playwright/碰浏览器，改动是纯 CSS 收缩；结论需要在 Lead 构建后于 1024/768/390 三档各跑一次上面的探针确认 `canScrollX === false`。
