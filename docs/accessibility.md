# 可访问性与对比度（第 17 轮）

本轮负责**暗色模式与高对比度下的可读性审计**：不改整体配色，只把对比度不足的次要文字 /
图标 / 描边提到满足门槛的令牌档位，并补 `prefers-contrast: more` 的遗漏。

## 1. 判断标准

| 类型 | 门槛 | 依据 |
| --- | --- | --- |
| 正文 / 小字号文本（< 18px 常规、< 14px 粗体） | **≥ 4.5:1** | WCAG 2.1 AA 1.4.3 |
| 大字号文本（≥ 18px / 14px 粗体） | ≥ 3:1 | 同上 |
| 非文本（图标、边框、控件边界、图形） | ≥ 3:1 | WCAG 2.1 AA 1.4.11 |
| 装饰性元素（骨架占位、分隔线） | 不强制，但需能辨认 | 1.4.11 例外 |
| 禁用态文字 | 不强制 | 1.4.3 例外 |

数值口径：按 `src/styles/variables.scss` 里的令牌公式计算（HSL → sRGB → 相对亮度 → 对比度），
半透明令牌先按底色做 alpha 合成。**这是公式计算值，不是取色器实测**（见「局限」）。

## 2. 暗色令牌的实测对比度

暗色底色：`--bew-content-solid` = hsl(230 12% 10%) = `#16171d`；`--bew-elevated-solid` = hsl(230 12% 15%) = `#22232b`。

| 令牌 | 合成后颜色 | 对 content-solid | 对 elevated-solid | 结论 |
| --- | --- | --- | --- | --- |
| `--bew-text-1`（98% 不透明） | `#f9fafb` | 17.0:1 | 14.9:1 | ✅ 标题 / 正文 |
| `--bew-text-2`（90% / 80% alpha） | `#b8bcc1` | 9.3:1 | 8.4:1 | ✅ 次要文字标准档 |
| `--bew-text-3`（82% / 60% alpha） | `#81868e` | 4.87:1 | **4.54:1** | ⚠️ 刚好压线；叠 hover/fill 层降到 4.40:1 |
| `--bew-text-4`（74% / 40% alpha） | `#545962` | 2.52:1 | 2.47:1 | ❌ 只可用于禁用态 / 装饰 |

由此确定本轮策略：**暗色下凡是「承载信息」的文字，从 text-3 提到 text-2；
text-4 从可读文字中移除**；边框 / 图标在 `prefers-contrast: more` 下提到 text-3。

## 3. 问题 → 修复 对照表

### 3.1 原生页增强面板（shadow root，6 个模块）

暗色写法：`:host(.dark)`（shadow host = `#bewly.dark`，见 `useDark()` 与 `variables.scss:199`）。

| 文件 | 受影响元素（改前 `--bew-text-3`） | 修复 |
| --- | --- | --- |
| `searchPage/searchEnhance.shadow.scss` | `.bse-fab__count` / `.bse-icon-btn` / `.bse-row__label` / `.bse-hint` / `.bse-foot` / `.bse-kbd` / `.bse-shortcuts__label` / `.bse-toast` | 暗色 → `--bew-text-2`；`prefers-contrast: more` 两模式都提级，fab/panel/kbd/seg 边框 → `--bew-text-3` |
| `notificationPage/notificationPage.shadow.scss` | `.bnp-panel__summary` / `-icon-btn` / `-group__hint` / `-note` / `-kbd` / `-segmented__item` / `-shortcuts__label` / `-toast` | 同上 |
| `spacePage/spacePage.shadow.scss` | `.bsp-fab__count` / `-icon-btn` / `-group__label` / `-hint` / `-status__meta` / `-foot` / `-kbd` / `-shortcuts__label` / `-toast` | 同上 |
| `channelPage/channelPage.shadow.scss` | `.bcp-fab__count` / `-icon-btn` / `-group__label` / `-status__meta` / `-foot` / `-kbd` / `-shortcuts__label` / `-toast` | 同上 |
| `livePage/livePage.shadow.scss` | `.blp-icon-btn` / `-group__label` / `-toggle__state` / `-hint` / `-foot` / `-kbd` / `-shortcuts__label` / `-toast` | 同上 |
| `articlePage/articlePage.shadow.scss` | `.bap-percent` / `-font-step` / `-toc__meta` / `-toc__item[data-level="3"]` / `-toc__empty` / `-kbd` / `-toast`；另 `.bap-toc__foot` 原来是 `--bew-text-4` | 暗色 → text-2；`.bap-toc__foot` **基样式**从 text-4（2.5:1）直接提到 text-2 |

### 3.2 列表页（工具栏 / 时间轴 / 进度）

`views/listShared/styles/listPage.scss`（样式在 `#bewly` shadow 内，暗色祖先类为 app wrapper 的 `.dark`）：

| 元素 | 问题 | 修复 |
| --- | --- | --- |
| `.bewly-list-hero__subtitle`、`.bewly-list-chip__count`、`.bewly-list-toolbar__count` | 暗色 4.5–4.9:1 临界 | 暗色 → text-2 |
| `.bewly-list-filter__icon` / placeholder / `.bewly-list-filter__clear` | 图标与占位文字，低于 3:1 / 4.5:1 | 暗色 → text-2 |
| `.bewly-list-sort-note`、`.bewly-list-help__note` / `-close`、`.bewly-list-group__count` | 说明文字 | 暗色 → text-2 |
| `.bewly-list-card__rail-time`、`.bewly-list-card__progress-text` | 时间轴时间 / 观看进度（关键信息） | 暗色 → text-2 |
| 工具栏 / 筛选框 / 胶囊 / 帮助面板边框 | 高对比度模式下边界弱 | `prefers-contrast: more` → 边框 text-3，文字 text-2 |

### 3.3 动态页（互动条 / 页头 / 工具条）

| 文件 | 元素 | 修复 |
| --- | --- | --- |
| `views/Moments/components/MomentCard.vue` | `.moment-card__action` / `-action-btn` / `-stat` / `-type` / `-time` / `-deleted`（互动数、时间） | 暗色与 contrast-more → text-2；contrast-more 下互动按钮补边框 |
| `views/Moments/Moments.vue` | `.moments-hero__subtitle` / `-hero__count` / `-toolbar__label` / `-keys` / `-more__hint` | 暗色与 contrast-more → text-2 |

### 3.4 卡片操作条与收藏夹浮层

| 文件 | 元素 | 修复 |
| --- | --- | --- |
| `VideoCardQuickActions/VideoCardQuickActions.vue` | `.bewly-card-actions__btn:disabled` 透明度 0.55（暗色下图标约 2:1） | 暗色禁用态透明度 → 0.72；contrast-more 下按钮 `opacity:1` + 边框 text-3 |
| `VideoCardQuickActions/FavoriteFolderPanel.vue` | `.bewly-fav-panel__close` / `-hint` / `-state` / `-tag.is-private` / `-count` / `-selected` / `-action` | 暗色 → text-2；contrast-more 下浮层 / 复选框 / 按钮边框 → text-3 |

### 3.5 骨架屏 / 空态 / 错误态

| 文件 | 元素 | 问题（暗色实测） | 修复 |
| --- | --- | --- | --- |
| `components/Feedback/SkeletonBlock.vue` | `.feedback-skeleton__row` | fill-2 30% 对底色仅 **1.52:1**，看不出加载态 | 暗色混入 text-3 22% → **1.87:1**；contrast-more 混入 text-2 35% → **2.63:1**（装饰元素不要求 3:1） |
| `components/VideoCard/VideoCardSkeleton.vue` | 全部骨架块（新增 `.video-card-skeleton__block` 类） | 同上 1.52:1 | 同上 |
| `VideoCard/VideoCardAuthor/.../VideoCardAuthorAvatar.vue` | 头像占位底色 / `+N` 占位 | 约 1.5:1 | 暗色混入 text-3 20%；contrast-more 下加 1px text-3 outline |
| `components/Feedback/EmptyState.vue` | `.feedback-state__desc`（说明）、`.feedback-state__compact-icon`、两个装饰圆环 | 说明文字 4.54:1 临界；圆环虚线对比不足 | 暗色 → text-2；contrast-more 圆环 → text-3 / text-2，文字 → text-2 |
| `components/Feedback/ErrorState.vue` | `.feedback-error__message`、图标外圈、重试按钮 | 同上 | 暗色 message → text-2；contrast-more 下外圈 / 重试按钮边框 → text-3 |

### 3.6 原生页面样式（第 2 轮新增的 UI）

| 文件 | 元素 | 修复 |
| --- | --- | --- |
| `adaptedStyles/pages/notificationsPage.scss` | 左栏分类标题 `.space-left .title`、时间 `.msg-time .time` | `html.bewly-design.notificationsPage.dark` → text-2；contrast-more 两模式同改 |
| `adaptedStyles/pages/searchPage.scss` | `.bili-video-card__info--date`、`.user-video-desc` | 暗色 → text-2；contrast-more 同改 |
| `adaptedStyles/pages/userSpacePage.scss` | `.n .n-data-k`（数据卡标签）、`.section .count`、`.small-item .meta` | 暗色 → text-2；contrast-more 同改 |

## 4. 暗色类名约定（本轮确认）

仓库里**没有** `.bewly-dark`，也**没有**使用 `prefers-color-scheme`（全部是显式主题设置）。实际约定：

| 作用域 | 暗色写法 | 出处 |
| --- | --- | --- |
| 文档（原生页面样式） | `html.dark` / `:root.dark`（及 B 站自己的 `.bili_dark` 兼容） | `variables.scss`、`useDark.ts`、`adaptedStyles/pages/*.scss` |
| `#bewly` shadow root 内的组件 / 全局样式 | 祖先类 `.dark`（App wrapper 上 `[{ dark: isDark }]`），即 `.dark .foo` | `views/App.vue`、组件 scoped 样式 |
| 各模块独立 shadow root（增强层） | `:host(.dark)`（host 即 `#bewly.dark`） | `variables.scss:199`、各 `*.shadow.scss` |

## 5. 范围说明（与简报的差异）

简报 B 节允许改 `adaptedStyles/pages/*.scss`、`contentScripts/**/*.shadow.scss`、
`components/Feedback/**`、`components/VideoCard/**`；但要求 1 点名了
**卡片操作条**、**动态卡互动条**、**列表工具栏**，这些分别在
`components/VideoCardQuickActions/**`、`views/Moments/**`、`views/listShared/styles/listPage.scss`。
为了覆盖要求里的审计项，本轮**额外**改了这三个位置（均为追加样式块，未改逻辑与既有规则），在此显式说明。

## 6. 已知局限

- **数值是公式计算**（令牌 HSL + alpha 合成），不是用取色器在真机截图上采样；
  `backdrop-filter` 毛玻璃、渐变、封面图透出来的颜色会让实际对比度随内容变化，
  所以把「刚好 4.5:1」的 text-3 一律提到 text-2，留出余量；
- 只修了「Bewly 新增 UI」与暗色；B 站原生页面自身的次要文字（搜索页筛选栏、消息页原生列表）
  仍由 B 站配色决定，未做全站覆盖；
- 未做自动化对比度测试（没有接入 axe / pa11y）；本轮是人工审计 + 公式计算；
- `prefers-contrast: more` 只覆盖了上述元素，`forced-colors` 已在第 11 轮处理；
- 未在真实浏览器里切换「强制高对比度」主题目测（按分工不碰浏览器），建议 Lead 在
  Windows 高对比度 / DeForce 主题下抽查一次浮层与列表工具栏。

## 7. 自测

- 改动的 SCSS / SFC 样式块全部通过 `sass` 编译（10 个文件）；
- `pnpm exec eslint`（含改动文件）`--fix` 后裸跑：0 error 0 warning；
- `pnpm run typecheck`：0 error（本轮只改样式，未动 TS）。
