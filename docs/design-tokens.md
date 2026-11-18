# 全站设计令牌：动效 / 间距 / 圆角（第 9 轮）

第 9 轮 C 工作流，负责人 `native-style`。目标：把散落在各处的动效时长、缓动曲线、间距与圆角
收敛成**一套令牌**，并让 `prefers-reduced-motion` 的降级只在一处生效。

## 1. 改动文件

新增：

| 文件 | 内容 |
| --- | --- |
| `src/styles/tokens/_motion.scss` | 动效时长 / 缓动曲线（Sass 变量 + `tokens` / `reduced-tokens` / `reduced-motion` mixin） |
| `src/styles/tokens/_spacing.scss` | 6 档间距（4 / 8 / 12 / 16 / 24 / 32） |
| `src/styles/tokens/_radius.scss` | 4 档圆角（sm 8 / md 12 / lg 16 / pill 999） |
| `docs/design-tokens.md` | 本文件 |

修改（只追加 / 只动自己写过的区域）：

| 文件 | 改动 |
| --- | --- |
| `src/styles/main.scss` | 顶部 3 行 `@use`；末尾追加「设计令牌」区域（`:root`/`:host` 暴露变量 + reduced-motion 令牌降级）。**既有规则一行未动。** |
| `src/styles/adaptedStyles/pages/_native-shared.scss` | native 令牌改为指向全站令牌（不再写死数值）；`reduced-motion` mixin 转发到 tokens/motion |
| `searchPage.scss` / `notificationsPage.scss` / `userSpacePage.scss` | **只替换第 2 轮（我写的）区域**：微间距改令牌、reduced-motion 块收敛（只保留悬停位移重置） |
| `channelPage.scss` | 无规则可替（我第 5 / 7 轮写的页面规则在模块 `pageStyles.scss` 里，本轮写入范围不含模块），未改动 |

未改动：`App.vue`、`contentScripts/index.ts`、`storage.ts`、`nativeOverlay`、`variables.scss`、
其它轮次由别的子智能体写的区域（第 3 轮搜索 / 消息增强、第 4 轮空间增强、上游既有规则）。

## 2. 令牌表

### 动效（`tokens/_motion.scss`）

| CSS 变量 | 值 | 说明 |
| --- | --- | --- |
| `--bew-motion-fast` | `120ms` | 悬停、焦点、小图标反馈 |
| `--bew-motion-base` | `180ms` | 面板过场、卡片状态切换（默认档） |
| `--bew-motion-slow` | `240ms` | 展开/收起、需要被注意到的过渡 |
| `--bew-ease-out` | `cubic-bezier(0.22, 0.61, 0.36, 1)` | 第 1–8 轮统一使用的曲线（快进慢出） |
| `--bew-ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | 位移动画 |
| `--bew-ease-linear` | `linear` | 进度条等线性变化 |

### 间距（`tokens/_spacing.scss`）

| CSS 变量 | 值 |
| --- | --- |
| `--bew-space-4` | 4px |
| `--bew-space-8` | 8px |
| `--bew-space-12` | 12px |
| `--bew-space-16` | 16px |
| `--bew-space-24` | 24px |
| `--bew-space-32` | 32px |

命名后缀即像素值，便于换算；超出这 6 档的微值（2px 描边偏移、0.4px 字距等）不强行套令牌。

### 圆角（`tokens/_radius.scss`）

| CSS 变量 | 值 | 说明 |
| --- | --- | --- |
| `--bew-radius-sm` | 8px | 按钮、标签、角标 |
| `--bew-radius-md` | 12px | 卡片、封面（等价于既有的 `--bew-radius`） |
| `--bew-radius-lg` | 16px | 吸顶栏、数据卡、动态卡 |
| `--bew-radius-pill` | 999px | 胶囊按钮、徽标 |

> 既有的 `--bew-radius: 12px`（`variables.scss`）**保持不变**，本轮只补 `--bew-radius-md` 作为同义别名，
> 以及缺失的 sm / lg / pill。三个页面里统一通过 `--bew-native-radius*` 间接引用。

## 3. 暴露方式（main.scss）

```scss
@use "./tokens/motion" as motion;
@use "./tokens/radius" as radius;
@use "./tokens/spacing" as spacing;

:root,
:host {
  @include motion.tokens;
  @include spacing.tokens;
  @include radius.tokens;
}
```

- 只追加，不改既有规则；
- `:root` 覆盖页面，`:host` 覆盖 Bewly 自己的 shadow root，两处都能拿到令牌；
- Sass 侧变量（`$duration-base`、`$space-16` 等）留给需要编译期求值的地方（mixin 默认值、媒体查询）。

## 4. reduced-motion 收敛

**一处生效**：`main.scss` 末尾

```scss
@media (prefers-reduced-motion: reduce) {
  :root,
  :host {
    @include motion.reduced-tokens; // 三个时长令牌 → 0ms
  }
}
```

因为所有页面过渡都写成 `var(--bew-motion-*)`（或经 `--bew-native-dur` 间接引用），
reduced-motion 下过渡时长恒为 0ms，**不需要每个文件再写 `transition: none`**。
本轮据此删掉了三个页面里「只关过渡」的降级块，只保留真正需要额外处理的：

| 页面 | 保留的降级内容 |
| --- | --- |
| 搜索结果页 | 悬停升起 `transform: none` |
| 消息页 | 无（纯过渡，令牌已覆盖） |
| 用户空间 | 悬停升起 `transform: none` |

`_native-shared.scss` 的 `reduced-motion` mixin 现在只是转发到 `tokens/motion` 的同名 mixin，
语义（`@media (prefers-reduced-motion: reduce)`）全站只有一份定义。

## 5. native 页面替换范围

`_native-shared.scss` 的 `tokens` mixin 改为**纯引用**：

| native 令牌 | 指向 |
| --- | --- |
| `--bew-native-gap-xs / sm / md / gap / lg / xl` | `--bew-space-4 / 8 / 12 / 16 / 24 / 32`（新增 md=12） |
| `--bew-native-radius-sm / radius / lg / pill` | `--bew-radius-sm / md / lg / pill` |
| `--bew-native-dur-fast / dur / dur-slow` | `--bew-motion-fast / base / slow`（新增 fast） |
| `--bew-native-ease` | `--bew-ease-out` |

每个引用都带原值兜底（如 `var(--bew-space-8, 8px)`），页面 CSS 单独加载也不会失效。

替换明细（只在我写的第 2 轮区域）：

- 搜索页：分区计数胶囊 `padding: 0 5px` → `padding: 0 var(--bew-native-gap-xs)`；
  圆角 / 间距原本已走 native 令牌，本轮顺着令牌链自动指向全站值；
- 消息页：未读数字胶囊 `padding: 0 5px` → `padding: 0 var(--bew-native-gap-xs)`；
  删掉只关过渡的 reduced-motion 块；
- 用户空间：reduced-motion 块收敛到只保留 `transform: none`。

**视觉变化**：`--bew-native-radius-lg` 从旧的 `calc(--bew-radius * 1.5) ≈ 18px` 收敛为全站 `16px`，
影响第 2 轮里用到「大圆角」的元素（吸顶筛选栏、UP 数据卡、动态卡、玻璃卡），其余值不变。

## 6. 没有覆盖到的部分（已知限制）

- **第 3 轮起的区域**（搜索结果页交互增强 `searchPage.scss` 第 3 轮段、消息页第 3 轮段、
  空间页第 4 轮段）由其它子智能体编写，本轮按「不动他人区域」的约束**没有替换**；
  它们已经在用 `var(--bew-native-*, 兜底值)` 的写法，会随 native 令牌一起指向全站令牌，
  只是仍有少量内联兜底值；
- **channelPage 模块**（`src/contentScripts/channelPage/pageStyles.scss`、
  `channelPage.shadow.scss`）与 **livePage 模块**（第 6 轮）里还留着字面量时长 / 圆角，
  本轮写入范围不含模块目录，未替换；建议后续单独一轮用同样的令牌；
- suggested next step：把 `--bew-native-*` 这一层逐步替换成直接用 `--bew-space-* / --bew-radius-*`，
  native 令牌可作为过渡期的兼容层保留。

## 7. 自测记录

- 本地 `sass@1.108` 编译：`tokens/_*.scss`、`main.scss`、`_native-shared.scss`、
  三个页面 scss、`channelPage.scss` 全部通过；`main.scss` 产物里能看到完整的
  `--bew-motion-* / --bew-ease-* / --bew-space-* / --bew-radius-*` 与 reduced-motion 的 0ms 覆盖；
- `pnpm exec eslint`（含 CSS Prettier 格式化）：0 error 0 warning；
- `pnpm run typecheck`：0 error（本轮没有改 TS）；
- 未跑 build / playwright；未碰浏览器；未做 git 操作。

## 8. 模块 shadow 样式接入（第 11 轮）

第 9 轮把令牌定义在 `src/styles/tokens/` 并通过 `main.scss` 的 `:root / :host` 暴露。
本轮把六个原生页增强模块里**写死的动效 / 圆角 / 间距**换成这些令牌，并补高对比度支持。

### 涉及文件

| 模块 | 文件 |
| --- | --- |
| 搜索结果页 | `searchPage/searchEnhance.shadow.scss` |
| 消息页 | `notificationPage/notificationPage.shadow.scss` |
| 用户空间 | `spacePage/spacePage.shadow.scss` |
| 分区 / 排行页 | `channelPage/channelPage.shadow.scss`、`channelPage/pageStyles.scss` |
| 直播页 | `livePage/livePage.shadow.scss`、`livePage/livePage.page.scss` |
| 专栏阅读模式 | `articlePage/articlePage.shadow.scss`、`articlePage/articlePage.page.scss` |

只改了 SCSS 与样式文本，**没有改任何模块 TS 逻辑**。

### 模块自有变量 → 全站令牌（带兜底值）

每个 shadow 样式在 `:host` 里本来就有 `--bse-*` / `--bnp-*` / `--bsp-*` / `--bcp-*` /
`--blp-*` / `--bap-*` 这一层变量，本轮把它们的**值**指向全站令牌，保留兜底值以便
shadow root 单独加载（例如组件测试）时仍然可用：

| 模块变量 | 指向 |
| --- | --- |
| `--<p>-duration` | `var(--bew-motion-base, 180ms)` |
| `--<p>-duration-slow` | `var(--bew-motion-slow, 240ms)` |
| `--<p>-ease` | `var(--bew-ease-out, cubic-bezier(0.22, 0.61, 0.36, 1))` |
| `--<p>-edge` | `var(--bew-space-24, 24px)`（文章页窄屏变体指向 `--bew-space-12`） |
| `--bnp-gap-xs / sm / / lg` | `--bew-space-4 / 8 / 12 / 16` |
| `--bap-gap` | `--bew-space-8` |
| 各模块 `border-radius: 8 / 12 / 16 / 999px` | `--bew-radius-sm / md / lg / pill` |
| 各模块 padding / margin / gap / inset 里的 4 / 8 / 12 / 16 / 24 / 32px | `--bew-space-4…32` |
| 文章页进度条 `transition: width 140ms linear` | `--bew-motion-fast(,140ms) + --bew-ease-linear` |
| 频道页高亮描边过渡 `180ms cubic-bezier(...)` | `--bew-motion-base + --bew-ease-out` |

> 尺寸类字面量（浮层按钮高度 34/44px、面板 `min(340px, …)`、toast 距顶 96px 等）
> **不是**间距令牌的语义，保持原值；圆角里不在 8/12/16/999 标尺上的微值（4 / 5 / 6 / 10px）
> 也保持原值，避免为凑令牌改变视觉。

### prefers-reduced-motion

- 六个 shadow 样式现在都有统一的**兜底规则**：
  ```scss
  @media (prefers-reduced-motion: reduce) {
    :host,
    :host * {
      transition-duration: 0.01ms !important;
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
    }
    /* …各模块原有的面板过场 / Transition 规则 */
  }
  ```
  加上各模块原有的「面板过场 / 淡入淡出 / 滑块过渡关掉、位移与缩放复位」规则；
- 全站令牌本身也会在 reduced-motion 下被压成 0ms（第 9 轮，`main.scss`），
  shadow root 会继承 `:root` 上被覆盖后的令牌值，因此**双保险**；
- 六个模块内**没有任何 `@keyframes` / `animation`**（只有 transition 与 Vue 的
  Transition 过场），浮层按钮、面板、胶囊、徽标都没有额外动画需要单独关闭。

### prefers-contrast: more

给浮层按钮 / 面板 / 胶囊 / kbd / toast 补可见边界（只加深边框，不改配色）：

```scss
/* 以搜索结果页的 bse- 前缀为例，其余模块把前缀换掉即可 */
@media (prefers-contrast: more) {
  :host .bse-fab,
  :host .bse-panel,
  :host .bse-toast,
  :host .bse-kbd,
  :host .bse-seg,
  :host .bse-seg__btn,
  :host .bse-chip,
  :host .bse-jump,
  :host .bse-toggle,
  :host .bse-icon-btn,
  :host .bse-status {
    border-color: var(--bew-text-3);
  }

  :host [aria-pressed="true"],
  :host [aria-expanded="true"] {
    border-color: var(--bew-text-2);
  }
}
```

页面级样式同理：频道页命中卡描边加宽到 3px、排名徽标文字改用 `--bew-text-1`；
直播页影院遮罩加深到 70% 黑，保证高对比度下内容边界仍清楚。

### forced-colors: active（Windows 高对比度 / 强制颜色）

shadow root 里的自定义边框与背景不会被系统自动接管，因此用**系统颜色**重画：

| 模块 | 处理 |
| --- | --- |
| 六个 shadow 浮层 | 按钮 / 面板 / 胶囊 / kbd / toast 用 `Canvas` 底、`CanvasText` 文字与 1px 边框；`aria-pressed=true` / `aria-expanded=true` 用 `Highlight`；`:focus-visible` 用 `Highlight` 描边 |
| 频道页（页面级） | 排名徽标 `::before` 恢复 `Canvas` 底 + `CanvasText` 边框，前三名用 `Highlight` 边框 |
| 直播页（页面级） | 影院模式的 `body::before` 压暗遮罩在强制颜色下直接 `content: none`（否则会被系统色涂成实色块，盖住播放器） |
| 文章阅读模式（页面级） | 阅读模式本身就是「保留原生排版 + 收窄正文」，没有自绘边框，不需要额外处理 |

### 已知限制

- 强制颜色下会使用系统调色板，主题色（`--bew-theme-color`）被 `Highlight` 取代是预期行为；
- 浮层定位用的尺寸（fab 高度、toast 顶部偏移、面板宽度）仍是像素值，不属于间距令牌语义；
- 页面级 scss（`channelPage/pageStyles.scss` / `livePage.page.scss` / `articlePage.page.scss`）
  作用于 B 站原生 DOM，只在有意义的位置补了对比度规则，没有重写整页配色；
- 未做浏览器验证（高对比度模式建议由 Lead 在 Windows 高对比度主题下人工确认一次）。

## 9. 第 11 轮自测

- 六个模块全部样式的 `sass` 编译通过（9 个文件）；
- `pnpm exec eslint src/contentScripts/{livePage,channelPage,spacePage,notificationPage,searchPage,articlePage} --fix`
  后裸跑：**0 error 0 warning**；
- `pnpm run typecheck`：**0 error**（本轮无 TS 改动）；
- 未跑 build / playwright；未碰浏览器；未做 git 操作。

## 10. 全站 UI 统一打磨（8 个自绘页真机审计 → 收敛）

审计方式：CDP（127.0.0.1:9333）真机打开 8 个自绘页，用 `getComputedStyle` +
`getBoundingClientRect` 抓**实际生效值**，逐页对比容器宽度 / 卡片圆角与内边距 /
字号层级 / 间距 / 颜色 / 悬停反馈。审计与对比脚本在
`.meta/special/edge-bewly-preview/ui-audit/`（工作区，不入库）。

### 10.1 新增令牌文件

| 文件 | 内容 |
| --- | --- |
| `src/styles/tokens/_typography.scss` | 字号 7 档 + 行高 4 档 + 字重 3 档 |
| `src/styles/tokens/_layout.scss` | 页宽留白 / 上下留白 / 区块间距 / 卡片间距 / 网格行列间距 + `page-inner` mixin |
| `src/styles/tokens/_interaction.scss` | 悬停上浮量 / 封面缩放 / 控件高度三档 / 焦点描边 + `focus-ring` mixin |

三个文件都在 `main.scss` 的 `:root, :host` 里 include，与既有 motion / radius / spacing 并列。

### 10.2 令牌清单（新增部分）

**字号**（`--bew-fs-*`）——与 UnoCSS 的 rem→`calc(var(--bew-base-font-size) * n)`
换算同源，保证自绘页与共享组件（VideoCard）算出同一个像素值：

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--bew-fs-hero` | 22px | 页面主标题 |
| `--bew-fs-section` | 18px | 区块标题 |
| `--bew-fs-card-title` | `calc(base * 1.125)` = 16.65px | 卡片标题（= UnoCSS `text-lg`） |
| `--bew-fs-body` | 14.8px | 正文 |
| `--bew-fs-control` | 14px | tab / pill / chip / 按钮 |
| `--bew-fs-secondary` / `--bew-fs-caption` | `calc(base * 0.875)` = 12.95px | 次要信息（= UnoCSS `text-sm`） |
| `--bew-fs-micro` | `calc(base * 0.75)` = 11.1px | 角标 / 时长 / 微型标签（= UnoCSS `text-xs`） |
| `--bew-fs-badge` | 10.5px | 未读数字徽标 |

**行高**（`--bew-lh-*`）：tight 1.25 / snug 1.4 / body 1.5 / reading 1.7。

**布局**（`--bew-page-*` / `--bew-*-gap`）：

| 令牌 | 值 | 说明 |
| --- | --- | --- |
| `--bew-page-inset` | 75px | 页面左右单边留白（默认档） |
| `--bew-page-inset-wide` | 100px | ≥1024px |
| `--bew-page-inset-narrow` | 16px | ≤900px |
| `--bew-page-pad-top` / `--bew-page-pad-bottom` | 16px / 32px | 页面上下留白 |
| `--bew-section-gap` | 16px | 页头 / 吸顶 tab / 网格之间的间距 |
| `--bew-card-gap` | 12px | 卡片内部纵向间距 |
| `--bew-grid-gap-row` / `--bew-grid-gap-col` | 24px / 20px | 视频网格行列间距 |

**交互**（`--bew-hover-*` / `--bew-control-h-*` / `--bew-focus-ring-*`）：
上浮 -2px、封面缩放 1.03、控件高度 32/36/44px、焦点描边 2px + 偏移 2px。

**媒体前景 / 遮罩**（`variables.scss`）：`--bew-text-on-media`、`--bew-text-on-theme`、
`--bew-media-scrim`、`--bew-media-scrim-soft`、`--bew-media-shadow`。

### 10.3 收敛前后对比（形态值，同一套统计口径）

统计范围：8 个自绘页的样式文件（不含 Home/HomeDrawn/ListsDrawn 与原生页 adaptedStyles）。

| 维度 | 改前 | 改后 |
| --- | --- | --- |
| 字号字面量种类 | 18 种（10 … 36px） | 7 种（14/15/16/17/18/24/36px，均为图标或展示级微调） |
| 圆角字面量种类 | 5 种（4/6/8/10/999） | 3 种（4/8/999） |
| `gap` 字面量种类 | 16 种（含 10/14/20/14px 行距） | 8 种（2/4/8/12/16/24 的 4 倍数 + 两个组合简写） |
| 行高字面量种类 | 12 种（1.25…1.72 混用） | 2 种（`0`、`1`，均为图标类特殊值） |
| 页面容器留白 | 150 / 200 / 96 / 160 / 40 / 80 / 32 / 24px 八套 | 统一 75 / 100 / 16px 三档（读屏宽度 760px 的动态页除外） |
| 页面上下留白 | 上 16/10/24px、下 32/40/48/20/24px | 上 16px、下 32px |
| 视频网格行距（真机测量） | 39px（网格 24 + VideoCard 自带 `mb-4` 14.8） | 24px |
| 卡片悬停反馈 | 4 套（只换背景 / 只升阴影 / 上浮 / 上浮+缩放） | 1 套：上浮 2px + shadow-1→shadow-2；封面统一 `scale(1.03)` |
| 控件高度 | 28/30/32/34/36/38/40px 混用 | 32px（sm）/ 36px（md）/ 44px（lg） |
| 硬编码颜色（`#fff`） | 8 处 | 0 处（改用 `--bew-text-on-* / --bew-media-*`） |

### 10.4 关键修法

1. **字号**：把 8 个页面的 `font-size` 全部映射到 7 档令牌；行高映射到 4 档令牌。
   `--bew-fs-card-title` / `--bew-fs-secondary` / `--bew-fs-micro` 用
   `calc(var(--bew-base-font-size) * n)` 表达，读屏时与 VideoCard 内联的 Uno 字号
   完全一致（16.65 / 12.95 / 11.1px），不再出现「同一行里 16.65 与 15px 打架」。
2. **页面骨架**：8 个页面的 `__inner` 统一改成
   `calc(100% - var(--bew-page-inset) * 2)` + 三档断点，收掉 96/40/160/80px 等私有值。
3. **网格行距**：VideoCard 根节点带 Uno `mb-4`（= `calc(base * 1)` ≈ 14.8px），
   放进 CSS Grid 后把行距从 24px 撑到 39px。各页网格加
   `.xx-grid > [data-video-card] { margin-bottom: 0 }` 清掉，行距完全由 `--bew-grid-gap-row` 决定。
4. **悬停统一**：所有视频卡 / 动态卡 / 直播卡 / 专栏卡统一
   `transform: translateY(var(--bew-hover-lift)) + box-shadow: var(--bew-shadow-2)`，
   时长统一 `var(--bew-motion-base) var(--bew-ease-out)`；封面统一 `scale(var(--bew-hover-cover-scale))`。
5. **表单控件字号**：原生 `<button>` / `<input>` 在 Chromium 里不继承字号，默认 13.3333px，
   导致消息页会话列表、直播页部分文字比同层级小 1.5px。每个自绘页追加一条
   `:where(<root> button, input, select, textarea) { font-size: inherit }`
   （特异性 0，类规则仍然优先）。
6. **硬编码颜色**：`#fff` 与 `rgb(0 0 0 / 0.72)` 等媒体前景改为
   `--bew-text-on-media / --bew-text-on-theme / --bew-media-scrim`，深浅主题同一套值。

### 10.5 真机复核

- 8 页 × 深浅两套主题截图：`.meta/dynesshely/bewlybewly/ui-polish/screenshots/{before,after}/`；
- 响应式：1440 / 1024 / 900 / 640 四档宽度下 8 页均无横向溢出
  （直播页在 ≤1024 的 166/290px 溢出为**原生直播页**自身的 `.min-w-1190px` 容器，
  与自绘层无关，改前同样存在）；
- `pnpm run build` 通过，扩展重载后令牌在 `:root` 与 `#bewly` shadow 内均生效；
- `npx eslint`（styles 范围）0 error；`pnpm run typecheck` 0 error；
- e2e 抽查 `extension / visibility / native-guard / moments-offscreen / live-page / article-page`
  全部通过（article-page 首次与其它用例并发时出现过一次 flaky，单独重跑通过）。
