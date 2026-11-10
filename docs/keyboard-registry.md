# 统一快捷键注册表

第 5 轮 B 节交付。把散落在各模块里的按键汇总成一份**只读登记表**，供 `? 快捷键帮助`
按页面分组展示、`Ctrl/Cmd + K` 命令面板搜索；帮助面板与命令面板共用同一份数据，
不再各自维护一份硬编码清单。

配套文件：

| 文件 | 作用 |
| --- | --- |
| `src/constants/shortcutRegistry.ts` | 全站动作登记表 + 分组 / 展示 / 搜索工具函数 |
| `src/components/KeyboardShortcutHelp.vue` | `?` 帮助面板：按 scope 分组渲染 |
| `src/components/CommandPalette.vue` | 命令面板：保留原命令，新增快捷键动作搜索（只展示） |
| `src/_locales/{cmn-CN,cmn-TW,jyut,en}.yml` | 新增 `keyboard_registry.*` 与 `command_palette.shortcut_unavailable` |

**不改任何模块内部的按键处理逻辑**（视频页 / 列表页 / 动态页 / 消息页 / 搜索结果页 /
用户空间 / 文章页的 keydown 监听原样保留），本表只做登记与展示，避免同一按键被处理两次。

## 数据结构

```ts
type ShortcutScope
  = | 'global' | 'video' | 'list' | 'moments'
    | 'notification' | 'search' | 'space' | 'article'

interface ShortcutRegistryEntry {
  id: string // 稳定 id，跨版本不要改
  scope: ShortcutScope
  keys: string[] // 展示用按键片段
  i18nKey: string // keyboard_help.* 或 keyboard_registry.*
  chord?: boolean // true = 组合键（A + B），否则是「或」（J 或 ↓）
  shortcutActionId?: ShortcutActionId // 可自定义动作，读 settings.keyboardShortcuts
  emitEvent?: string // App 层已有全局事件，命令面板可安全触发
  keywords?: string[] // 命令面板额外搜索词
}
```

导出工具：

- `SHORTCUT_REGISTRY`：登记表本体（顺序即展示顺序）；
- `SHORTCUT_SCOPES`：分组顺序（global 恒在最前）；
- `groupShortcutsByScope()`：按 scope 分组，空分组不返回；
- `getEntryKeyTokens(entry, overrides)`：取展示用的按键片段（可自定义动作会应用用户改键）；
- `getPaletteShortcutEntries(overrides, { scopes })`：命令面板用的参考条目（只取 `emitEvent` 为空的）；
- `matchesShortcutQuery(entry, query, labels, overrides)`：动作名 / 分组名 / id / 别名 / 按键任一命中；
- `getActiveShortcutScopes(url)`：按 URL（含 `?page=xxx`）判断当前页涉及的 scope；
- `scopeLabelKey(scope)`：分组标题的 i18n key。

**可自定义动作不做复制**：登记表通过 `shortcutActionId` 引用 `constants/shortcuts.ts` 的
`SHORTCUT_ACTIONS`，展示时用 `resolveShortcut()` 取改键后的真实组合键，
因此用户在「设置 → 键盘与快捷键」改键后，帮助面板与命令面板会同步变化。

## 已登记动作（54 条）

### global（16）
| 键 | 动作 |
| --- | --- |
| ← ↑ → ↓ | 在卡片间移动 |
| Home / End | 跳到第一张 / 最后一张 |
| Enter | 在新标签页打开 |
| Space | 在当前页打开预览 |
| W | 加入稍后再看 |
| D | 打开卡片右键菜单 |
| S | 切换卡片排序 |
| F | 切换卡片筛选 |
| I | 切换卡片详细信息 |
| Q | 加入本地待看队列 |
| Shift + Q | AI 初筛当前页 |
| Shift + F | 进入 / 退出聚焦浏览 |
| Esc | 退出聚焦浏览 / 关闭浮层 |
| / | 聚焦搜索框 |
| Ctrl/Cmd + K | 打开命令面板 |
| ? | 显示 / 隐藏本帮助 |

### video（13，`videoPage/shortcuts.ts`）
J 后退 10 秒 · K 播放/暂停 · L 前进 10 秒 · ←/→ 后退/前进 5 秒 · C 弹幕 · M 静音 ·
F 全屏 · T 影院模式 · Shift + P 画中画 · P 还原迷你播放器 · 0–9 跳到百分比 · Esc 退出影院 / 关闭帮助

### list（4，`views/listShared/useListShortcuts.ts`）
V 循环视图 · Shift + V 循环排序 · / 聚焦过滤框 · H 打开本页快捷键说明

### moments（4，`views/Moments/composables/useMomentsShortcuts.ts`）
J / ↓ 下一条 · K / ↑ 上一条 · O 打开当前条目 · Esc 取消高亮

### notification（4，`notificationPage/shortcuts.ts`）
U 只看未读 · D 切换密度 · 1–4 跳分类 · Esc 关闭面板

### search（4，`searchPage/keyboard.ts`）
J / ↓ 下一张结果 · K / ↑ 上一张 · Enter 打开当前结果 · Esc 关闭面板 / 取消高亮

### space（4，`spacePage/keyboard.ts`）
J 下一条 · K 上一条 · Enter 打开当前条目 · Esc 取消高亮

### article（5，`articlePage/shortcuts.ts`）
R 沉浸阅读 · [ 字号减小 · ] 字号增大 · T 回到顶部 · Esc 退出阅读 / 关闭目录

## 帮助面板（`?`）

- 数据来自 `groupShortcutsByScope()`，**8 个分组始终完整展示**（一处可查全站），
  顺序固定 global → video → list → moments → notification → search → space → article；
- 当前页面涉及的 scope 在分组标题旁显示「当前页」徽标（由 `getActiveShortcutScopes()` 判断）；
- 组合键渲染为 `Ctrl` `K` 之间带 `+`，或关系渲染为 `/`，「范围键」用 `–`（如 `0 – 9`）；
- 可自定义动作展示用户改键后的组合键；
- `Esc` 或点击遮罩关闭；打开时焦点落在关闭按钮；尺寸 `min(620px, 92vw)`，
  宽度 ≤520px 时行内改为纵向排布；
- 颜色只用 `--bew-*` 变量，`prefers-reduced-motion` 下取消按钮过渡。

## 命令面板（`Ctrl/Cmd + K`）

- 原有命令（首页 tab、聚焦浏览、键盘模式、排序 / 筛选 / 详细信息 / 搜索 / AI 初筛 / 帮助 / 设置）保持不变，**排在最前**；
- 新增「快捷键动作」条目：
  - 未输入时只补**当前页相关**的快捷键，避免把命令挤下去；
  - 输入关键词时搜索全表：动作名、分组名、条目 id、别名、按键组合都参与匹配
    （例如输入 `video`、`影院`、`j` 都能命中对应条目）；
- **只展示不执行**：这些条目标灰、带分组徽标与「当前页不可用」提示，`aria-disabled="true"`；
  `Enter` / 点击对它们无效果，上下键会自动跳过；
- 能从命令面板安全触发的动作走原有全局事件（`emitEvent`），在登记表里标记后
  会从参考条目里排除，避免与已有命令重复（例如 S / F / I / / / Shift+Q / Shift+F / ?）。

## i18n

- 复用既有 `keyboard_help.*`（全局动作文案），新增 `keyboard_registry` 段：
  `close`、`current_scope`、`scopes.{8 个}`、`actions.{33 条}`，
  以及 `command_palette.shortcut_unavailable`；
- 四个语言文件同步：`cmn-CN` / `cmn-TW` 为对应中文，`en` 为英文，
  **`jyut` 本轮用英文占位**（简报允许「缺的用英文占位」）；
- 已校验：四个文件的 `keyboard_registry` key 集合完全一致，
  登记表用到的 60 个 key 在四个语言里都能解析到。

## 新增 / 修改快捷键时怎么做

1. 先改模块内部的按键处理（本表不执行逻辑）；
2. 在 `SHORTCUT_REGISTRY` 里补一条：`id` 用 `<scope>-<action>`、`keys` 写展示片段、
   `i18nKey` 指向 `keyboard_help.*`（现有动作）或新增 `keyboard_registry.actions.*`；
3. 若动作可自定义，加 `shortcutActionId`；若 App 层已有全局事件，加 `emitEvent`；
4. 新增 i18n key 时四个 `_locales` 文件同步补；
5. 不需要改 `KeyboardShortcutHelp.vue` / `CommandPalette.vue` —— 它们完全由登记表驱动。

## Lead 需要接线

无。`KeyboardShortcutHelp` 与 `CommandPalette` 已由 `App.vue` 按原有方式挂载，
本轮只改它们内部的数据来源；未改 `App.vue` / `contentScripts/index.ts` / `storage.ts` /
`nativeOverlay` / `main.scss`。

可选：如果以后要让设置页的「快捷键」分组也复用这张表，可以直接 import
`SHORTCUT_REGISTRY` / `getEntryKeyTokens`，但注意可自定义动作仍应以
`SHORTCUT_ACTIONS` 为改键数据的唯一来源。

## 已知限制

- `1–6`（切换首页标签页）当前**没有**按键实现（只有命令面板条目），因此未登记，
  避免帮助面板出现「按了没反应」的键；
- 各原生页增强层自带的面板（视频页 `?`、列表页 `H`、文章页目录等）仍然保留，
  这里只汇总不替换；
- `scope` 判定基于 URL（含 `?page=xxx`），原生页内嵌抽屉（iframe）里不算对应 scope；
- 命令面板里同名动作（如下一个条目）靠分组徽标区分，不合并显示；
- 命令面板不执行参考条目（本轮只做展示），真正执行仍走各页面自己的按键；
- 旧帮助面板用过的 `keyboard_help.tabs`（1 - 6 切标签页）与 `keyboard_help.sort_filter`
  两个 key 现在没有被引用（前者本来就没有按键实现，后者被 S / F 两条独立动作取代），
  为兼容保留在四个语言文件里，未删除。
