# 反馈态组件（空态 / 错误态 / 骨架）

> 第 16 轮 C 工作流。背景：首页 / 列表页 / 动态页 / 搜索页各自实现了空态、错误态、骨架，
> 样式与文案风格不统一。本轮在 `src/components/Feedback/` 下建三个统一组件，并接入
> 列表页、动态页、搜索起始页；不引入任何插画 / 图片资源（圆环、图标、灰块全部是既有 CSS 变量 + Iconify 图标）。

## 一、组件 API

### `Feedback/EmptyState.vue`

| prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| `title` | `string` | `''` | 主标题（可省略） |
| `description` | `string` | `''` | 说明文案（可省略） |
| `icon` | `string` | `i-mingcute:inbox-line` | Iconify / UnoCSS 图标类名 |
| `compact` | `boolean` | `false` | 面板内联小空态：无圆环、横向排布、文本靠左 |
| `live` | `boolean` | `true` | 是否挂 `role="status"` + `aria-live="polite"` |

- 默认插槽放操作（按钮 / 链接），组件给插槽内按钮补 `focus-visible` 描边；
- 视觉：96px 双圆环（虚线外环缓慢旋转、实线内环反向）+ 主题色图标 + 标题 + 说明（最多 46ch）；
- `prefers-reduced-motion: reduce` 时圆环旋转停止；
- 颜色只用 `--bew-*` 变量，暗色 / 自定义主题色自动跟随。

### `Feedback/ErrorState.vue`

| prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| `title` | `string` | `''` | 错误标题 |
| `message` | `string` | `''` | 接口返回的错误信息（可省略，长文本自动换行） |
| `icon` | `string` | `i-tabler:cloud-off` | 错误图标类名 |
| `retryable` | `boolean` | `true` | 是否显示重试按钮 |
| `retryLabel` | `string` | `Retry` | 重试按钮文案（调用方传 i18n 文案） |
| `live` | `boolean` | `true` | 是否挂 `role="alert"` + `aria-live="assertive"` |

- 事件：`retry`（点击重试按钮时触发）；
- 默认插槽可追加其它操作（与重试按钮并排）；
- 视觉：88px 圆形图标底 + 错误色图标 + 标题 + message + 胶囊重试按钮；
- 重试按钮是原生 `button type="button"`，带 `aria-label` 与 `focus-visible` 描边；reduced-motion 下取消过渡。

### `Feedback/SkeletonBlock.vue`

| prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| `rows` | `number` | `1` | 行数（每行一个等高灰块） |
| `height` | `number / string` | `12` | 单行高度：数字按 px |
| `width` | `number / string` | `'100%'` | 宽度：数字按 px |
| `radius` | `number / string` | `8` | 圆角：数字按 px |
| `gap` | `number / string` | `8` | 多行间距：数字按 px |
| `circle` | `boolean` | `false` | 圆形占位（头像 / 圆点），圆角固定 50% |
| `animated` | `boolean` | `true` | 是否播放 1.6s 透明度脉冲 |

- 根节点固定 `aria-hidden="true"`，不进入读屏树；
- 占位色用 `--bew-skeleton`；reduced-motion 下关闭动画、保留静态占位（0.7 不透明度）；
- 只负责「灰块」，不承担布局：网格 / 卡片外壳由使用方负责。

## 二、接入点

### 列表页（`src/contentScripts/views/listShared/**`）

- `components/ListEmptyState.vue`：改为 `EmptyState` 的薄封装，**props（`title` / `description` / `icon`）与默认插槽保持不变**，
  History / WatchLater / Favorites 三页无需改动；
- `components/ListSkeleton.vue`：改用 `SkeletonBlock` 拼装三种视图（舒适 / 紧凑网格、时间轴列表）的占位卡；
  列表视图为「左封面 + 右文字行」横向骨架，≤640px 自动改为纵向；
- 删除 `styles/listPage.scss` 里旧的 `.bewly-list-empty*` 空态样式与 keyframes、`.bewly-list-skeleton` 旧样式（已无引用）。

### 动态页（`src/contentScripts/views/Moments/**`）

- `Moments.vue`：
  - 错误态 → `ErrorState`（图标 `i-tabler:cloud-off`、标题沿用 `errorTitle`、message 沿用接口 `errorMessage`、重试仍调用 `loadFirst`）；
  - 首次空态 → `EmptyState`（标题 `empty_title`、说明 `empty_desc`、重试按钮仍在插槽里调用 `loadFirst`）；
  - 「只看视频」筛选空态 → `EmptyState`（图标 `i-tabler:movie`、清空筛选按钮仍在插槽里把 `videoOnly` 置 false）；
  - 删除 `Empty.vue` 依赖与 `.moments-state*` / `.moments-filter-empty*` 旧样式。
- `components/MomentSkeleton.vue`：卡片外壳（边框 / 圆角 / 背景 / 密度间距）保留，内部灰块全部换成 `SkeletonBlock`
  （头像圆形块、昵称 / 时间行、三行正文、媒体块、三个互动 pill），密度与 compact 的尺寸逻辑不变。

### 搜索结果页 / 搜索起始页（`src/contentScripts/views/Search/**`）

- `components/SearchQuickPanel.vue`：「最近搜索」为空时由一行纯文本改为 `EmptyState compact`
  （图标 `i-mingcute:history-line` + `recent_empty` 文案），面板内保持小尺寸横向排布；
  删除旧的 `.quick-empty` 样式。

## 三、统一后的行为

| 要求 | 实现 |
|---|---|
| 暗色 | 所有颜色只用 `--bew-*` 变量（`--bew-text-1/3`、`--bew-fill-*`、`--bew-skeleton`、`--bew-theme-color`、`--bew-error-color`） |
| reduced-motion | EmptyState 圆环旋转停止；SkeletonBlock 脉冲关闭并保留静态度；ErrorState 取消按钮过渡；列表页既有全局降级规则继续覆盖 |
| role / aria-live | EmptyState：`role="status"` + `aria-live="polite"`；ErrorState：`role="alert"` + `aria-live="assertive"`；SkeletonBlock：`aria-hidden="true"` |
| 键盘可达 | 操作 / 重试按钮均为原生 `button type="button"`；插槽按钮补 `focus-visible` 描边；重试按钮带 `aria-label` |
| 行为一致 | 列表页 props / 插槽不变；动态页重试仍是 `loadFirst`、筛选空态仍是清空 `videoOnly`；搜索空态仅替换视觉，无行为变化 |

## 四、与旧实现的差异

| 位置 | 旧实现 | 新实现 |
|---|---|---|
| 列表页空态 | 组件内自带圆环 + 标题 + 说明（样式在 `listPage.scss`） | 统一 `EmptyState`，样式收进组件；props 不变 |
| 列表页骨架 | 复用首页 `VideoCardSkeleton`（视觉偏首页卡片） | `SkeletonBlock` 拼装列表专属骨架，与三种视图一一对应 |
| 动态页错误态 | 手写图标 + 标题 + message + 按钮（`.moments-state*`） | `ErrorState`（`role=alert`，错误色图标，统一点击区） |
| 动态页空态 | `Empty.vue`（内嵌 `empty.png` 插画） | `EmptyState`（纯 CSS 圆环 + 图标，不再依赖图片资源） |
| 动态页筛选空态 | 手写 `.moments-filter-empty*` | `EmptyState` + 插槽里的「清空筛选」按钮（行为不变） |
| 动态页骨架 | 手写灰块 + 自己的 pulse 动画 | `SkeletonBlock`（统一颜色 / 圆角 / 动画 / reduced-motion） |
| 搜索起始页空态 | 一行 `.quick-empty` 文本 | `EmptyState compact`（图标 + 文案） |

## 五、已知限制

- `EmptyState` 仍保留旧列表页的「双圆环绕图标」画法，没有使用 `Empty.vue` 的 `empty.png` 插画；动态页空态因此从插画变为图标，视觉上有变化；
- `SkeletonBlock` 的宽度 / 高度支持数字（px）与字符串（如 `72%`）；在 flex 行容器里请依赖内容宽度或外层包裹，避免百分比宽度在外层尺寸未定时出现歧义；
- 列表页骨架不再复用 `VideoCardSkeleton`，与首页骨架在细节比例上略有差异（内容区仍是同一套网格与间距）；
- 本轮只接入简报指定的列表页 / 动态页 / 搜索起始页；首页、消息页、用户空间等仍使用各自原有反馈态，后续可逐个替换；
- 自测仅 eslint + typecheck（按分工未跑 build / playwright、未碰浏览器）。
