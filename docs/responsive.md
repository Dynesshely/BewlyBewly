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
