# 列表页升级（历史 / 稍后再看 / 收藏）

本轮把 Bewly 自己的三个列表页从「左侧长列表 + 右侧粘性面板」改造成
「页头 + 吸顶工具条 + 时间分组/多视图」的信息布局，并补齐键盘可达性、空状态与骨架屏。

## 1. 用户可见行为

### 三种视图模式
- **舒适网格**：默认，卡片最小 280px，自动填充列数。
- **紧凑网格**：卡片最小 190px，同屏信息密度更高。
- **列表（时间轴）**：左侧一条虚线时间轴（点 + 时间），右侧是横向视频卡片（封面在左、元信息在右）；
  宽度小于 900px 时自动收起时间轴列，退化为单列。
- 切换入口是工具条右侧的分段控件，选择会记忆到 localStorage：
  `bewly-list-view-history` / `bewly-list-view-watch-later` / `bewly-list-view-favorites`。

### 统一工具条
- 吸顶在顶栏下方（`top: var(--bew-top-bar-height)`），滚动时自动加毛玻璃、边框与阴影。
- 内含：视图切换、排序（时间 / 时长 / 标题）、关键词过滤、页面级操作按钮、本页快捷键入口。
- 排序方式也会记忆：`bewly-list-sort-*`。
- 排序不是「时间」时不做时间分组，并在工具条下方给出「顺序只作用于已加载的 N 条」提示。
- 关键词过滤是**本地过滤**（标题 / UP 主 / 标签）。历史页与收藏页保留原有的服务端搜索：
  输入过滤词后按 <kbd>Enter</kbd> 触发接口搜索，清空过滤词会自动回到完整列表。
  
### 时间分组
- 历史（`view_at`）、稍后再看（`add_at`，缺失时回落 `pubdate`）、收藏（`fav_time`）按
  **今天 / 昨天 / 本周 / 更早** 分组；分组头吸顶在工具条下方并显示条数。
- 「本周」以周一为一周起点；时间戳缺失或为 0 的条目归入「更早」。

### 卡片快捷操作
- 悬停或在卡片内 Tab 聚焦时，卡片右上角出现快捷按钮（键盘可直接 `Enter`/`Space` 触发）：
  - 历史：稍后再看（仅普通投稿）、复制链接、移除；
  - 稍后再看：复制链接、移除；
  - 收藏：稍后再看（非音频）、复制链接、取消收藏。
- 历史与稍后再看卡片下方额外显示观看进度（细进度条 + `已看 12:30 / 20:00`），
  已看完的显示 `已看完 · 20:00`。
- 复制成功 / 失败、加入稍后再看结果都有 toast 反馈。

### 空状态与骨架
- 无数据：插画式空状态（双环 + 图标组合，缓慢旋转，`prefers-reduced-motion` 下静止），
  文案区分「真的没有内容」和「过滤词没有匹配项」。
- 首屏加载与切换分类：骨架屏（复用 `VideoCardSkeleton`，随视图模式切换横/竖版式）。

### 键盘快捷键（本页）
在工具条右端 <kbd>⌨</kbd> 按钮可打开「本页快捷键」面板：

| 快捷键 | 作用 |
| --- | --- |
| <kbd>V</kbd> | 循环切换视图模式（舒适 → 紧凑 → 列表） |
| <kbd>Shift</kbd> + <kbd>V</kbd> | 循环切换排序方式（时间 → 时长 → 标题） |
| <kbd>/</kbd> | 聚焦关键词过滤框 |
| <kbd>H</kbd> | 打开 / 关闭本页快捷键说明 |
| <kbd>?</kbd> | 全局快捷键帮助（由 App 提供） |

在输入框、下拉框、可编辑区域内不会触发；<kbd>Ctrl</kbd>/<kbd>Meta</kbd>/<kbd>Alt</kbd> 组合不接管。

## 2. 文件清单

新增：

- `src/contentScripts/views/listShared/`
  - `types.ts`：`ListViewMode` / `ListSortMode` / `ListCardItem` / `ListCategoryChip` 等共享类型
  - `i18n.ts`：模块内文案（简中 + 英文，其余语言回退简中）
  - `preferences.ts`：视图 / 排序的 localStorage 记忆与循环切换
  - `timeline.ts`：时间分组、时间轴文案、进度计算、排序
  - `utils.ts`：复制到剪贴板（含 execCommand 回退）、输入态判定
  - `useListShortcuts.ts`：本页快捷键
  - `styles/listPage.scss`：列表页共享样式（`.bewly-list-*` 前缀，全部用 CSS 变量）
  - `components/`：`ListPageHeader` / `ListToolbar` / `ListShortcutHelp` / `ListVideoCard` /
    `ListGroupSection` / `ListCategoryChips` / `ListEmptyState` / `ListSkeleton`
- `docs/list-pages.md`（本文件）

重写：

- `src/contentScripts/views/History/History.vue`
- `src/contentScripts/views/WatchLater/WatchLater.vue`
- `src/contentScripts/views/Favorites/Favorites.vue`

未改动（保持原样）：`App.vue`、`contentScripts/index.ts`、`logic/storage.ts`、`_locales/**`、
`styles/main.scss`、`components/VideoCard/**`、`package.json`、`styles/adaptedStyles/pages/*.scss`。

## 3. 技术要点

- 卡片复用 `~/components/VideoCard.vue`（`data-video-*` 属性保持可用，全局键盘卡片导航与 `data-video-*`
  系列快捷键无需改动即可工作）；列表模式使用它的 `horizontal` 变体，快捷操作放在卡片外的绝对定位层，
  因此不需要改 `VideoCard` 内部结构。
- 颜色只用 `--bew-*` 变量，暗色模式与自定义主题色自动生效；圆角最大 12px（胶囊按钮也用 10px）。
- 动效 160–200ms `cubic-bezier(.22,.61,.36,1)`；`.bewly-list-page` 子树在
  `prefers-reduced-motion: reduce` 下统一关闭过渡与动画。
- 吸顶判定：工具条读取自身 `getComputedStyle().top`（即 sticky 偏移）与滚动容器顶部比较，
  进入吸顶状态时加毛玻璃/阴影；同时用 `ResizeObserver` 把工具条实际高度写入
  `--bew-list-toolbar-height`，供吸顶分组头计算偏移，窗口变窄换行时也不会重叠。
- 不使用额外依赖；所有新文案走模块内 `i18n.ts`。

## 4. 给 Lead 的接线清单

1. **全局快捷键帮助**：本页自带的 <kbd>?</kbd> 入口只覆盖列表页模块。若希望
   `? 快捷键帮助` 面板也列出 <kbd>V</kbd> / <kbd>Shift</kbd>+<kbd>V</kbd> / <kbd>/</kbd> / <kbd>H</kbd>，
   需要在 `components/KeyboardShortcutHelp.vue` 与 `src/_locales/**` 增加条目（当前受写入范围限制未改）。
2. **设置项（可选）**：目前视图/排序记忆使用 `localStorage`（`bewly-list-view-*`、`bewly-list-sort-*`）。
   如需并入 `settings`（例如「列表页默认视图」），建议字段：
   `historyViewMode`、`watchLaterViewMode`、`favoritesViewMode`（`comfortable | compact | list`）与
   `listDefaultSort`（`time | duration | title`）。接入后我这边可再切换数据源。
3. **无其他接线**：页面组件已在 `App.vue` 注册，无需新增入口。

## 5. 已知限制

1. 排序与本地过滤只作用于**已加载**的条目（接口分页，不支持服务端排序）。
2. 历史 / 收藏的搜索与关键词过滤共用一个输入框：输入即本地过滤，回车才请求服务端搜索；
   清空输入框会自动回到完整列表。
3. 收藏页分类切换沿用原有「加载中忽略点击」的保护，切换瞬间点击会被忽略。
4. 稍后再看删除单条后不会同步 `allWatchLaterList`，继续翻页时理论上可能再次出现该条（原实现同样存在）。
5. 收藏页页面标题复用 `dock.favorites`（收藏），因为 `favorites.*` 命名空间下没有 title 键，且本轮不改 `_locales`。
6. 原收藏页与 `TOP_BAR_VISIBILITY_CHANGE` 联动的浮动控件避让逻辑已随浮动控件一并移除：
   新工具条是吸顶元素，不再与 Bilibili Evolved 顶栏发生重叠。
7. 卡片关闭了 `VideoCard` 自带的 hover 稍后再看按钮与「更多」菜单按钮（`:show-watcher-later="false"`、
   `:more-btn="false"`），相关能力改由统一的卡片右上角快捷操作承载；因此收藏页原卡片「更多」菜单入口不再出现。
8. 时间分组严格按「今天 / 昨天 / 本周（周一为起点）/ 更早」四档划分，上周日的内容即使只隔一天也会落到「更早」。
