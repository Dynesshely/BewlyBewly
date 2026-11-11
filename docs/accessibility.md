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

---

## 第 19 轮：键盘可达性与焦点管理收尾

第 1–18 轮陆续加了 7 个增强浮层 + 3 个全局面板，但焦点管理不统一：
有的打开后不聚焦、有的 Tab 会跑出面板、关闭后焦点丢到 body。本轮逐个核对并补齐（只改可聚焦性与焦点管理，不改业务逻辑 / 视觉布局）。

### 1. 核对清单（逐面板）

| 面板 / 组件 | 打开聚焦 | Tab / Shift+Tab 陷阱 | Esc 关闭 | 关闭恢复焦点 | aria
| --- | --- | --- | --- | --- | --- |
| 通知页面板 `bnp-panel` | ✅ 第一个可交互元素 | ✅ 循环 | ✅ 模块 shortcuts（stopPropagation） | ✅ 回到触发 FAB | role=dialog + aria-modal=false |
| 搜索页面板 `bse-panel` | ✅ | ✅ | ✅ | ✅ | role=dialog + aria-modal=false |
| 空间页面板 `bsp-panel` | ✅ | ✅ | ✅ | ✅ | role=dialog + aria-modal=false |
| 分区页面板 `bcp-panel` | ✅ | ✅ | ✅ | ✅ | role=dialog + aria-modal=false |
| 直播页面板 `blp-panel` | ✅ | ✅ | ✅ | ✅ | role=dialog + aria-modal=false |
| 播放页快捷键帮助 `bvp-help` | ✅ 关闭按钮 | ✅ | ✅（原有） | ✅ | role=dialog + aria-modal=true（原有） |
| 文章目录面板 `bap-toc` | ✅ 当前章节 / 第一条 | ✅ | ✅（原有） | ✅ | role=dialog + aria-modal=false（本轮补） |
| 文章大图 `bap-lightbox` | ✅ 关闭按钮 | ✅ | ✅（原有） | ✅ | role=dialog + aria-modal=true（原有） |
| 全局快捷键帮助 `KeyboardShortcutHelp` | ✅ 关闭按钮 | ✅ | ✅（原有） | ✅ | role=dialog + aria-modal=true（原有） |
| 命令面板 `CommandPalette` | ✅ 输入框（原有） | ✅ 只留在面板内 | ✅（原有，stopPropagation） | ✅ | 本轮补 role=dialog + aria-modal=true + aria-label |
| 设置「页面增强」`Pages.vue` | —（不是浮层） | — | — | — | 搜索框补 `:focus-visible` 描边；导航药丸、清空按钮已有 |

### 2. 实现方式（真机修复后：shadowRoot capture + preventDefault + 手动聚焦）

第一版实现把 `@keydown` 挂在面板根元素上、只在「焦点在最后一个元素」时 `preventDefault`。
真机实测（Lead，2026-11-11）命令面板打开后连按 Tab，焦点**跑出面板落到 Dock 按钮**（`activeElement = BUTTON.dock-item`），说明拦截没有生效。
根因有两条：

1. 面板 UI 在独立 **shadow root** 里，`document.activeElement` 只返回 shadow host，拿它判断「是否最后一个元素」永远对不上；
2. 只对「最后一个元素」做 `preventDefault` 不够：Tab 的落点判断稍偏，浏览器默认行为就会把焦点移到面板外，必须**无条件拦截 Tab**。

修复后的统一实现（五个增强模块面板 + 播放页帮助 + 文章目录 / 大图 + 全局快捷键帮助 + 命令面板）：

```ts
// 面板打开时，把捕获阶段的 keydown 挂到面板所在 root（ShadowRoot / Document）
function bindTabTrap(): void {
  const node = rootRef.value?.getRootNode()
  if (node instanceof ShadowRoot || node instanceof Document)
    node.addEventListener('keydown', onTabCapture, true)
}

function onTabCapture(event: Event): void {
  if (!(event instanceof KeyboardEvent) || event.key !== 'Tab')
    return
  event.preventDefault() // 必须拦掉浏览器默认的 Tab 移动
  event.stopPropagation()
  moveFocusInPanel(event.shiftKey)
}

function moveFocusInPanel(backward: boolean): void {
  const items = panelFocusables() // 面板内可见的 button / input / select / a / [tabindex]
  if (!items.length) {
    rootRef.value?.focus({ preventScroll: true }) // 没有可聚焦元素时聚焦面板容器（tabindex=-1）
    return
  }
  const active = activeElementDeep() // 穿透 shadow root 的真实焦点
  const current = active
    ? items.indexOf(active)
    : -1
  const next = current < 0
    ? (backward
        ? items.length - 1
        : 0)
    : (current + (backward
        ? -1
        : 1) + items.length) % items.length
  items[next]?.focus({ preventScroll: true })
}
```

- **为什么是 capture**：Tab 事件的默认行为发生在冒泡阶段之后；只在冒泡里 `preventDefault` 有时机差异，
  而挂到 shadow root 的 capture 阶段能保证「面板内任意元素按下 Tab」都先被我们处理；
- **为什么用 getRootNode()**：增强模块 UI 在自己独立的 shadow root 里，事件只在该 root 内派发，
  `document` 上的监听收不到；`getRootNode()` 返回面板所在的 `ShadowRoot`（非 shadow 场景回退 `Document`）后挂 capture 监听，
  关闭 / 卸载时 `removeEventListener` 清理；
- **activeElementDeep()**：`document.activeElement` 在 shadow 里只能拿到 host，循环遍历 `shadowRoot.activeElement` 才能拿到真正的按钮；
- **无元素兜底**：面板内没有可聚焦元素（或全部 disabled）时 `preventDefault` 后聚焦面板容器（`tabindex="-1"`），
  保证焦点不会掉回页面；
- **打开聚焦**：watch 打开状态 → `nextTick` → 绑定 capture + 聚焦第一个可聚焦元素（目录面板优先当前章节）；
- **关闭恢复**：打开时记录 `activeElementDeep()`（触发按钮），关闭 / 卸载时 `focus({ preventScroll: true })` 还回去；
- **Esc**：沿用各模块键盘层已有逻辑（面板开着时 `preventDefault + stopPropagation` 后关闭），本轮未改；
- **aria**：五个浮动面板 `role="dialog" + aria-modal="false"`（非模态工具面板）；
  真正模态的全局帮助 / 命令面板 / 文章大图用 `aria-modal="true"`。
### 3. focus-visible 可见性

- 各模块 shadow scss 早就有统一的 `:host :focus-visible { outline: 2px solid var(--bew-theme-color); outline-offset: 2px; }`；
  暗色模式下主题色仍是高对比色，`outline-offset` 保证描边不被圆角/背景吞掉；
- 本轮补充 `Pages.vue` 搜索输入框的 `:focus-visible`（此前依赖组件默认样式，暗色下不够明显）；
  导航药丸、`清空` 按钮、空态按钮已有同款描边；
- 所有新增规则只用 `outline`，不改盒模型与布局。

### 4. 未改动 / 已知限制

- **不引入焦点陷阱库**：仓库没有现成的 `useFocusTrap`，本轮按「最小代码」原则在需要的组件内各写约 40 行（含 capture 绑定 / activeElementDeep）；
- **非模态面板不做遮罩**：通知 / 搜索 / 空间 / 分区 / 直播面板是 `aria-modal="false"` 的浮动工具面板，
  Tab 循环只保证「不跑丢」，页面其它区域仍可点击（符合非模态语义）；
- **视频卡右键菜单 / 收藏夹面板 / 列表快捷键帮助** 不在本轮写入范围（分别属于 VideoCardQuickActions、listShared 组件），
  其 `aria-modal="false"` 与焦点表现沿用原状，后续如需要可套用同一套路；
- **命令面板列表项不是 DOM 可聚焦元素**：键盘操作依赖输入框上的 ↑/↓/Enter（既有设计），
  因此 Tab 陷阱实际上把焦点固定在输入框（唯一可聚焦元素）；若将来要求列表项可 Tab，需要改 DOM 结构（超出「只改焦点管理」范围）；
- 未做真实键盘走查（按分工由 Lead 统一构建回归）；本轮只做静态实现 + eslint + typecheck。

### 5. 自测

- `pnpm exec eslint`（11 个改动文件）：0 error 0 warning；
- `pnpm run typecheck`：0 error；
- 未跑 build / playwright；未碰浏览器；未做 git 操作。
## 6. 第 20 轮：三处焦点补漏 + e2e 断言

第 19 轮给 10 个浮层加了焦点陷阱，但明确排除了三处组件；本轮补齐，写法与第 19 轮完全一致
（`getRootNode()` 捕获监听 + `preventDefault` + `activeElementDeep()`）。

### 6.1 收藏夹面板（`FavoriteFolderPanel.vue`）

- **Tab 循环**：面板打开后在所在 ShadowRoot（没有则 Document）上挂 capture 阶段的 Tab 监听，
  `preventDefault` 后在面板内可聚焦元素之间循环；Shift+Tab 反向；没有可聚焦元素时聚焦面板容器（`tabindex="-1"`）。
- **打开即聚焦**：面板打开后焦点落在第一个可操作元素（关闭按钮）。
- **Esc**：关闭面板并收起「+ 新建收藏夹」输入（清空草稿）；在输入框里按 Esc 同样关闭面板，
  输入框内的「取消」按钮只取消输入、不关面板。Esc 已 `stopPropagation`，不会触发下层快捷键。
- **焦点回归**：打开前记录 `activeElementDeep()`（点击收藏按钮时它已是焦点），
  关闭 / 卸载时把焦点还给该按钮。
- 面板仍在操作条内（非模态），因此保持 `aria-modal="false"`。

### 6.2 视频卡右键菜单（`VideoCardContextMenu.vue`）

- 菜单容器 `role="menu"`，每个选项 `role="menuitem"` + `tabindex="-1"`（程序化聚焦、不进入 Tab 序列）。
- **键盘可达**：打开后自动聚焦第一个菜单项；`ArrowUp` / `ArrowDown` 循环移动，`Home` / `End` 到首尾，
  `Enter` 执行当前项（复用原有 click 处理），`Esc` 关闭；所有按键都 `preventDefault` + `stopPropagation`，
  不会触发卡片或页面快捷键。
- **焦点回归**：关闭后焦点回到卡片 —— 优先卡片内的 `<a href>`（本身可聚焦），否则卡片根节点，
  保证「右键 → Esc」后键盘用户还能继续操作同一张卡。
- 焦点可见：`.context-menu-item:focus-visible` 用主题色描边 + `--bew-fill-2` 背景。

### 6.3 列表页快捷键帮助（`ListShortcutHelp.vue`）

- 与 6.1 同一套 Tab 陷阱；打开后聚焦关闭按钮，没有可聚焦元素时聚焦面板容器。
- Esc 关闭并 `stopPropagation`，避免冒泡到列表页的 `H` / `?` 等快捷键。
- 焦点回归到列表工具条上的「快捷键」触发按钮（打开前的 `activeElementDeep()`）。

### 6.4 新增 e2e（可运行 playwright）

| 文件 | 用例 | 断言 |
| --- | --- | --- |
| `tests/e2e/focus-trap.spec.ts` | 命令面板（Ctrl+K）焦点陷阱 | 打开后焦点在 `.command-palette-mask` 内；连按 Tab 5 次、再连按 Shift+Tab 5 次，每次焦点仍在面板内；Esc 关闭后面板消失 |
| `tests/e2e/image-fallback.spec.ts` | 封面图 404 兜底 | 拦截 hdslb 图片返回 404 → `[data-video-card] .bewly-image-fallback` 可见且 `role="img"`；同一封面 `<img src>` 只被请求 1 次（失败后不重试） |

**自测结果**：两条新用例单独运行 2/2 passed；与 `card-quick-actions.spec.ts` 一起 `--repeat-each=2` 共 6/6 passed（29.9s）。
未跑全量、未 build、未 git。

---

## 第 26 轮：暗色 / 高对比度 / 强制色彩一致性审计

审计口径（`src/contentScripts/**` 与 `src/components/**` 的 `*.scss` / `*.vue` scoped style）：

1. **硬编码颜色**：`#fff` / `#000` / `rgba(0,0,0` / `rgba(255,255,255` 是否出现在自定义控件上而未走 `--bew-*`；
2. **缺 `@media (forced-colors: active)`** 的自定义控件（按钮 / 开关 / 选中态 / 面板）；
3. **暗色选择器遗漏**：只写 `html.dark` 漏 `:root.dark` / `:host(.dark)`，或 shadow 组件根本没写暗色块。

### 1. 汇总

- **发现 38 处硬编码颜色**（grep `#fff` / `#000` / `rgba(0,0,0` / `rgba(255,255,255)`），其中多数为设计意图或装饰；
- **发现 8 个自定义控件密集的文件缺 `forced-colors: active` 兜底**（videoPage / playlistPanel / MomentLightbox / Moments / Home / ListCategoryChips / DiagnosticsPanel / FavoriteFolderPanel）；
- **发现 1 类真实暗色遗漏**：nativeOverlay 的 8 个 shadow 模块里 `:host(.dark)` 永远不会命中（host 不挂 dark 类）；
- **已修 8 个样式文件**（2 个 shadow scss + 6 个 Vue scoped style）：补 forced-colors / 暗色提级 / 选择器改成 `:host-context(.dark)`；

### 2. 逐项处理


| 位置 | 发现 | 处理 |
| --- | --- | --- |
| `videoPage/videoPage.shadow.scss` | 播放页增强层**完全没有**暗色与 `forced-colors` 处理，`--bew-text-3` 的说明 / 快捷键 / 提示文字在暗色浮层上约 4.5:1 临界 | **已修**：补 `:host-context(.dark)` 提一级到 `--bew-text-2`、`prefers-contrast: more` 同步 + 控件边框、`forced-colors` 下按钮 / 选中态 / 快捷键块回落 CanvasText / Highlight |
| `videoPage/playlistPanel.shadow.scss` | 同上（播放列表面板独立 host，无暗色 / 强制色彩处理） | **已修**：补暗色序号 / 提示提级、`prefers-contrast`、`forced-colors` 面板与当前项高亮 |
| `Moments/components/MomentLightbox.vue` | 灯箱是深色遮罩 + 半透明白按钮，日常对比度足够，但 High Contrast 下自定义半透明按钮可能不可见 | **已修**：补 `forced-colors`（按钮 / 焦点环 / 说明文字回落系统色） |
| `Moments/Moments.vue` | 主题色按钮 / 选中 chip / 计数徽标在 forced-colors 下会丢边界 | **已修**：补 `forced-colors`（ButtonFace / Highlight） |
| `Home/Home.vue` | 回到顶部按钮、密度与布局胶囊是自定义控件，无强制色彩兜底 | **已修**：补 `forced-colors` |
| `views/listShared/components/ListCategoryChips.vue` | 收藏夹胶囊 / 「⋯」菜单 / 删除确认框是自定义控件，无强制色彩兜底 | **已修**：补 `forced-colors`（含 danger 项用 LinkText） |
| `diagnostics/DiagnosticsPanel.vue` | 结果面板只写了 `forced-colors` 的 item 边框；暗色下提示 / 次要文字未提级 | **已修**：补暗色提级 + 按钮 / item 的强制色彩兜底 |
| `components/VideoCardQuickActions/FavoriteFolderPanel.vue` | 收藏夹浮层勾选框 / 主按钮 / 面板边框无强制色彩兜底 | **已修**：补 `forced-colors` |

### 3. 刻意保留（有命中但不是真实风险）

| 位置 | 内容 | 保留原因 |
| --- | --- | --- |
| `Moments/components/MomentMedia.vue` | 时长 / 播放量角标的 `rgba(0,0,0,.45~.62)` 底 + `#fff` 字 | 叠在图片上的深色小角标，白字对比度 > 7:1；forced-colors 下图片区域与角标仍可见，改动反而破坏「图片上浮层」的视觉 |
| `articlePage/articlePage.shadow.scss` | 大图 lightbox 的 `#000` 遮罩、`#fff` 图标/计数 | 全屏深色遮罩上的白字是刻意的高对比设计（> 12:1），已有 `forced-colors` 块覆盖按钮与焦点 |
| `Moments/Moments.vue`、`Home.vue`、`ListCategoryChips.vue`、`FavoriteFolderPanel.vue`、`DiagnosticsPanel.vue` | 主题色底上的 `#fff` 文字 | 主题色底 + 白字属于设计意图（主题色为深色时对比度充足）；暗色主题色仍带足够亮度，改为变量反而破坏品牌色 |
| `Dock.vue` / `TopBar.vue` / `About.vue` / `Logo.vue` | `rgba(255,255,255,…)` 阴影、`#fb7299` 等品牌色、mask 渐变 | 阴影 / mask 不承载文字信息；About 的品牌色是刻意配色；`dark:` 变体已跟随主题 |
| `App.vue` | `color: #fff`（浮层状态条） | 属于全局 UI（`App.vue` 不在本轮写入范围），且为深色主题色底白字 |
| `VideoCard.vue` | `rgba(255,255,255,.35)` 用作骨架占位色 | 骨架是装饰元素，不承载信息；`--bew-skeleton` 已承载主色 |

### 4. 暗色选择器检查

- 全仓 `html.dark` 命中 **0**：目前暗色类统一由 `useDark()` 加在 `#bewly`、`documentElement`、`body` 上，
  组件内使用的是 `.dark .xxx`（后代选择器），不存在「只写 html.dark」的遗漏；
- **发现真实遗漏**：nativeOverlay 的 host 元素本身**没有** dark 类（`useDark()` 只给 `#bewly` / html / body 加），
  所以各 shadow 模块原有的 `:host(.dark)` 永远不会命中 —— 暗色下这些「次要文字提级」规则实际上从未生效过。
  本轮把 8 个 shadow scss 里的 `:host(.dark)` 全部改成 **`:host-context(.dark)`**（沿 host 祖先链匹配 `body/html.dark`），
  暗色下才真正生效；不支持 `:host-context` 的浏览器会忽略该块，退回 `--bew-*` 变量默认值，不会破坏显示。
- `videoPage` / `playlistPanel` 两个 shadow 之前完全没有暗色块与强制色彩块，本轮补齐。

### 5. 校验

- 8 个改动样式（2 个 scss + 6 个 Vue style 块）用 `pnpm exec sass` 单文件编译：**8/8 通过**；
- 未跑 build / playwright；未碰浏览器；未做 git 操作。

### 6. 已知限制

- 暗色提升依赖 `:host-context(.dark)`（祖先 `body/html` 有 dark 类时生效）；
- 硬编码 `#fff` 的白字仍保留在主题色按钮 / 深色遮罩上（设计意图）；若用户使用自定义亮色主题色，对比度由主题色本身决定；
- forced-colors 只覆盖了「自定义控件密集」的模块；图片角标、阴影、mask 等装饰不处理。
