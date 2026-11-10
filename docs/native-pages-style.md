# 原生页面样式升级（搜索结果页 / 消息页 / 用户空间）

第 2 轮 B 工作流，负责人 `native-style`。这三个页面都是 **B 站原生页面**：
Bewly 只在按 URL 命中时注入页面级 CSS（`dist/styles/pages/<page>.css`，见
`src/utils/style.ts` 与 `scripts/build-pages-styles.mjs`），**不能改 DOM 结构**。
所以本轮只动 SCSS，不改 TS / Vue / `_locales` / `storage.ts`。

## 1. 改动文件

| 文件 | 改动 |
| --- | --- |
| `src/styles/adaptedStyles/pages/_native-shared.scss` | **新建**：三个页面共用的设计令牌与 mixin（不参与注入，单独编译输出为空） |
| `src/styles/adaptedStyles/pages/searchPage.scss` | 顶部加 `@use`，末尾追加「第 2 轮」区域（既有规则一行未删） |
| `src/styles/adaptedStyles/pages/notificationsPage.scss` | 同上 |
| `src/styles/adaptedStyles/pages/userSpacePage.scss` | 同上（30KB 的那个文件只追加，既有规则一行未删） |
| `docs/native-pages-style.md` | 本文件 |

## 2. 设计令牌（`_native-shared.scss`）

在三个页面的根选择器（`html.bewly-design.<page>`）上 `@include native.tokens`，
作用域只覆盖该页面，不会泄漏到 Bewly 自己的视图：

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--bew-native-gap-xs/sm/\*lg/xl` | 4 / 8 / 16 / 24 / 32px | 间距基准 4px |
| `--bew-native-radius-sm` | `calc(var(--bew-radius) / 1.5)` ≈ 8px | 按钮、标签、时长角标 |
| `--bew-native-radius` | `var(--bew-radius)` = 12px | 卡片、封面 |
| `--bew-native-radius-lg` | `calc(var(--bew-radius) * 1.5)` ≈ 18px | 吸顶栏、UP 数据卡、动态卡 |
| `--bew-native-radius-pill` | 999px | 筛选按钮、分区计数、未读徽标 |
| `--bew-native-dur` / `--bew-native-dur-slow` | 180ms / 240ms | 与第 1 轮列表页、视频页同一档动效 |
| `--bew-native-ease` | `cubic-bezier(.22,.61,.36,1)` | 同上 |
| `--bew-native-lift` | -2px | 悬停升起位移 |
| `--bew-native-sticky-top` | `calc(var(--bew-top-bar-height) + 8px)` | 吸顶元素相对 Bewly 顶栏的偏移 |

mixin：`surface` / `interactive` / `lift` / `clamp` / `focus-ring` / `glass` / `reduced-motion`。
所有颜色都走 `--bew-*`（`--bew-content`、`--bew-elevated`、`--bew-fill-1..4`、
`--bew-text-1..4`、`--bew-border-color`、`--bew-shadow-1/2`、`--bew-theme-color-*`），
暗色模式随变量自动适配，没有硬编码十六进制颜色。

## 3. 搜索结果页（`search.bilibili.com`）

选择器来源：仓库既有 `searchPage.scss` + `src/utils/nativeFilter.ts` 里的搜索页规则 +
B 站搜索页真实快照（`.search-layout` / `.search-header` / `.search-conditions` /
`.vui_tabs--nav-*` / `.b-user-video-card` / `.search-user-avatar` 等），没有凭空造类名。

### 顶部搜索区

- 搜索框容器 `.search-input-wrap`：胶囊圆角、`--bew-fill-1` 底、悬停加深到 `--bew-fill-2`，
  聚焦时换 `--bew-content-solid` 底 + 主题色 40% 描边（`:focus-within`，用原生焦点而不是 JS）；
- 输入框文字/占位符用 `--bew-text-1` / `--bew-text-3`，搜索按钮圆角化并补 `:focus-visible` 描边；
- 分区导航 `.search-tabs .vui_tabs--nav-item`：hover 出现软背景，选中项文字转主题色 + 600 字重，
  下划线滑块（`.vui_tabs--nav-slider`）改主题色胶囊；
- 分区计数 `.vui_tabs--nav-num` 从裸数字改成小胶囊（`--bew-fill-1` 底 / 选中时 `--bew-theme-color-20`）；
- `.search-line` 分隔线统一成 `--bew-border-color` 的 1px 线。

### 筛选 / 排序栏：吸顶 + 毛玻璃

- `.search-conditions` 改成 `position: sticky`，`top: var(--bew-native-sticky-top)`（顶栏 64px + 8px），
  `--bew-elevated` 底 + `--bew-filter-glass-1` 毛玻璃 + `--bew-shadow-1`，滚动时整条浮在结果上方；
- 排序按钮 `.vui_button--tab`：胶囊化，hover 软背景，选中（`.vui_button--active`）用
  `--bew-theme-color-10` 底 + 主题色文字 + 600 字重；「更多筛选」`.i_button_more` 同样胶囊化；
- 展开的 `.more-conditions` 与主行之间补 8px 间距。

### 结果卡片

- 结果区原灰底 `.search-content--gray` 改透明，让卡片自己承担层表面；
- `.bili-video-card__wrap` 圆角统一 `--bew-native-radius`（覆盖既有的 `--bew-radius-half`），
  悬停时在既有「高亮环」之外**补一个 -2px 升起**（不覆盖既有阴影，避免两套 hover 打架）；
- 封面 `.bili-video-card__image / __image--wrap / __cover / __mask` 统一圆角，
  `__image--wrap` 加 `overflow: hidden` 兜住圆角；
- 标题 `__info--tit`：15px / 500 字重 / 紧凑行高 + **两行截断**（`-webkit-line-clamp: 2`）；
- 元信息分层：作者 `__info--author` = `--bew-text-2` 13px，日期 `__info--date` = `--bew-text-3` 12px（等宽数字）；
- 时长角标 `__stats__duration` 圆角化；
- 「用户」分类的 UP 主卡 `.b-user-video-card`：大圆角软表面，hover 用 `--bew-fill-1`；
  头像加 1px 描边环，昵称 hover 转主题色，简介降级为 `--bew-text-3` 12px；
- 结果网格 `.video-list.row` 补 `row-gap: var(--bew-native-gap-lg)`：列宽与断点仍交给 B 站原有的
  `col_*` 栅格，只统一行距（首屏结果区与 UP 主卡内的视频小网格都会受益）；
- 视频 / 用户 / 专栏等结果块之间用 `.search-all-list + .search-all-list` 统一 32px 留白。

### 暗色与降级

- 暗色下吸顶筛选栏加实到 `color-mix(--bew-content-solid, transparent 25%)` 并把阴影提到 `--bew-shadow-2`，
  滚动时边界更清楚；
- `prefers-reduced-motion: reduce`：去掉所有过渡与悬停升起（颜色变化保留）。

## 4. 消息页（`message.bilibili.com`）

选择器来源：仓库既有 `notificationsPage.scss`（`.space-left` / `.side-bar` / `.notify-dot` /
`.notify-number` / `.msg-time` / `.reply-card` / `.at-card` / `.love-card` / `.msg-notify` 等），
它们本来就在这个文件里被使用，属于确认存在的选择器。

- **左栏分类胶囊**：`.space-left .side-bar .item` 由通栏文字改成左右各内缩 8px 的胶囊
  （`border-radius: var(--bew-native-radius)`），hover 用 `--bew-fill-1`，选中（`.active`）用
  `--bew-theme-color-10`；分类标题 `.title` 降级为 12px 的 `--bew-text-3` 小标题；
- **未读标记**：`.notify-dot` 收敛成 6px 主题色圆点并带 3px 的 20% 主题色光晕；
  `.notify-number` 统一成 18px 高的主题色胶囊（11px / 600 字重 / 等宽数字，
  文字用 `--bew-text-auto` 保证明暗模式都可读）；
- **右栏层级**：`.space-right-top .title` 16px / 600 字重 / `--bew-text-1`；
- **条目悬停**：回复 / @ / 点赞 / 系统四类条目（`.reply-card` / `.at-card` / `.love-card` / `.msg-notify`）
  统一 12px 圆角 + `--bew-fill-1` 悬停高亮；
- **时间右对齐**：`.msg-time` 用 `margin-left: auto` 推到行尾，时间文字 12px / `--bew-text-3` /
  `white-space: nowrap` / 等宽数字（父级不是 flex 时 `margin-left: auto` 无效，不会破坏原布局）；
- 左栏与右栏之间补 1px `--bew-border-color` 分隔；`.message-list` 滚动条用 `scrollbar-width: thin`；
- 暗色：选中胶囊加深到 `--bew-theme-color-20`，未读光晕加深到 `--bew-theme-color-30`；
- `prefers-reduced-motion` 下条目与胶囊过渡全部关闭；
- 抽屉模式（`.notificationsPage.drawer`）沿用既有规则，本轮新增样式在抽屉里同样成立
  （抽屉里 `.space-left .title` 原本就被隐藏）。

## 5. 用户空间（`space.bilibili.com`）

`userSpacePage.scss` 有 30KB，本轮**只在文件末尾追加**一个 `第 2 轮` 区域，一条既有规则都没删，
也刻意不动它已有的主题色 / 暗色块。

- **头图与 UP 信息层级**：
  - `.header .header-toutu` 用 `inset` 阴影在头图底部压一层 `--bew-bg` 渐变
    （对背景图容器生效，对 `<img>` 无副作用，两种情况都不会画错）；
  - `.header .header-upinfo-bg-shadow`（原生压在头图上的深色遮罩）换成
    `--bew-filter-glass-2` 毛玻璃 + 到底部 `--bew-bg` 的渐变，让 UP 信息浮在图上；
  - `.nav-bar`（顶部分区导航，原有毛玻璃）补 1px 底边线与 `--bew-shadow-1`。
- **UP 数据卡统一**：`.n .n-inner` 从纯色块改成 `--bew-content` + `--bew-filter-glass-1` 的
  18px 圆角玻璃卡；`.n-data`（关注 / 粉丝 / 播放）做成可悬停的小数据块；
  `.n-data-k` 降级 12px `--bew-text-3`，`.n-data-v` 16px / 600 字重 / 等宽数字；`.n-btn` 胶囊化。
  旧版空间页的 `.user-info` 同步：数值层级 + 标签圆角。
- **视频网格与首页同一视觉节奏**：
  - `.large-item .cover / .cover img` 从写死的 4px 收敛到 `--bew-native-radius`（12px），
    `.large-item .title` 两行截断；
  - `.video-container` 悬停升起 -2px，`.text-area .title` 两行截断、`.text-area .content` 降为 12px 次要色；
  - `.small-item`（收藏 / 历史的横向小卡）12px 圆角 + 悬停软背景，`.meta` 降为 `--bew-text-3`；
  - 空间页动态流 `.feed-card` / `.bili-dyn-item` 与首页动态卡统一 18px 圆角，悬停加 `--bew-shadow-1`；
  - 区块标题 `.section-title` 16px / 600 字重，`.section .count` 12px 次要色 + 等宽数字。
- **暗色微调**：`.nav-bar` 阴影提级到 `--bew-shadow-2`；动态卡悬停改用 1px 描边（暗色下阴影不可见）。
- **reduced-motion**：关闭 `.n-data` / `.video-container` / `.small-item` / 动态卡的过渡与悬停位移。

## 6. 约束遵守情况

| 约定 | 状态 |
| --- | --- |
| 只用 `--bew-*` 变量、无硬编码颜色 | ✅（唯一非变量颜色是 `transparent` 与 mask 用的渐变透明端） |
| 不用 `:has()` | ✅ 新增规则里没有 `:has()`（`userSpacePage.scss` 里原有的两处是第 1 轮之前的代码，未改动） |
| 不长段 `!important` | ✅ 新增规则里 `!important` 数量为 0 |
| 只改样式、不动 DOM | ✅ |
| 改文件范围 | ✅ 仅 4 个 SCSS + 本文档 |

## 7. Lead 需要接线

**无。** 三个页面的样式注入由 `src/styles/adaptedStyles/index.ts` 已有的 URL 分支完成
（`searchPage` / `notificationsPage` / `userSpacePage`），`@use "native-shared"` 由 sass 在编译期内联，
不需要改注入清单，也不需要改 `App.vue` / `index.ts`。

可选项（不做也完全可用）：

1. `scripts/build-pages-styles.mjs` 会把 `pages/` 下所有 `.scss` 都编译一遍（不区分 `_` 前缀），
   因此 `_native-shared.scss` 会在 `extension/dist/styles/pages/` 里多出一个 **0 字节**的
   `_native-shared.css`。若希望构建产物干净，可在该脚本的 `readdirSync(...).filter` 里
   排除以 `_` 开头的文件（一行改动，本轮未越界修改 `scripts/`）。
2. 第 3 轮「设计令牌收敛」时，可把 `_native-shared.scss` 提升为全局令牌文件，
   让列表页 / 视频页的写死值一并收敛过去。

## 8. 已知限制

- **搜索页右侧「UP 主 / 相关搜索」栏未覆盖**：采样的线上搜索页快照（2026-01）中，
  结果区只有 `.search-content` 单列 + 「用户」分类的 UP 主卡，没有稳定的右侧栏类名可供验证。
  按"不猜类名"的原则，本轮不写这批规则；如果用户的版本仍有右侧栏，需要先在浏览器里取到类名再补。
- **筛选栏吸顶的偏移是固定值**：`top` 取「Bewly 顶栏高度 + 8px」。若 B 站自己把头部做成
  `position: sticky; top: 0`（会被 Bewly 固定顶栏盖住），视觉上等价；若上游哪天改成别的固定高度，
  需要调整 `--bew-native-sticky-top`。另外祖先元素如果有 `overflow: hidden`，`sticky` 会静默失效
  （只是不吸顶，不会错位）。
- **现有 `.search-input-container .search-fixed-header` 规则可能已随上游改版失效**：
  新快照里搜索框容器是 `.search-header > .search-input > .search-input-container > .search-input-wrap`，
  没有 `.search-fixed-header`。本轮没有删除它（可能是别的布局分支在用），新增规则改用确认存在的
  `.search-header` 前缀。若确认它已死，可以后续清理。
- **消息页左栏条目的内缩**：给 `.side-bar .item` 加了左右 8px 外边距并置 `width: auto`，
  目的是做胶囊内缩；如果上游把该列表换成非块级布局，胶囊会退化成普通整行，不会错位。
- 本轮**没有跑浏览器验证**（按分工由 Lead 统一构建与回归），也没有跑 `pnpm build` / playwright；
  只做了 sass 编译校验与 `pnpm run typecheck`。

## 9. 自测记录

- `node` + 本地 `sass@1.108` 逐个编译四个文件：全部成功；
  `_native-shared.scss` 单独编译输出 0 字节（确认它只含 mixin，不会污染注入产物）；
  三个页面编译后的 CSS 分别约 9.5KB / 40.6KB / 50.0KB（原文件 + 新增区域）。
- 新增区域内的选择器与既有规则做了一次人工优先级核对：需要覆盖既有值的规则
  （卡片圆角、悬停高亮、既有暗色块）都放在同层或更高层，并靠"后定义"取胜，
  没有使用 `!important`。
- `pnpm exec eslint <四个 SCSS + 本文件>`：0 error 0 warning（仓库的 eslint 配置带 CSS Prettier 格式化规则，SCSS 与 Markdown 都会被检查）。
- `pnpm run typecheck`：当前**不是** 0 error，但报错全部落在 `src/contentScripts/views/Moments/Moments.vue`
  （`badge` / `title` / `skeleton_*` 等 i18n key 不在类型联合里），属于同轮 moments 子智能体**正在改的文件**，
  与本轮（纯 SCSS + 文档，没有改任何 TS/Vue）无关；等该工作流收尾后由 Lead 复跑即可。
- 未修改 `App.vue`、`contentScripts/index.ts`、`_locales/**`、`composables/**`、
  `logic/storage.ts`、`styles/main.scss`、`package.json`、`vite.config*`；未跑 build / playwright；
  未做 git 操作；未启动或关闭浏览器。