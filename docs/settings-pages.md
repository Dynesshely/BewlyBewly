# 设置整合：页面增强

> 第 2 轮 C 工作流。把第 1/2 轮新增功能的开关收进设置页，并把相关模块从 `localStorage` 迁移到
> `settings`（`src/logic/storage.ts` 中由 Lead 统一新增的字段）。

## 一、设置页

新增「页面增强」页：`src/components/Settings/Pages/Pages.vue`，在 `Settings.vue` 左侧菜单中注册
（`MenuType.Pages`，图标 `i-mingcute:layout-grid-line/fill`），位于「BewlyBewly 页面」之后。
页面分三组：

| 分组 | 项 | settings 字段 | 控件 |
|---|---|---|---|
| 视频播放页 | 影院模式 | `videoPageCinemaMode` | Radio |
| 视频播放页 | 滚动迷你播放器 | `videoPageMiniPlayer` | Radio |
| 视频播放页 | 增强快捷键 | `videoPageShortcuts` | Radio |
| 列表页 | 观看历史视图 | `historyViewMode` | Select（舒适 / 紧凑 / 列表） |
| 列表页 | 稍后再看视图 | `watchLaterViewMode` | Select |
| 列表页 | 收藏夹视图 | `favoritesViewMode` | Select |
| 列表页 | 默认排序 | `listDefaultSort` | Select（时间 / 时长 / 标题） |
| 搜索页 | 粘贴直达 | `searchPageDirectPasteEnabled` | Radio |

文案使用模块内 i18n：`src/components/Settings/Pages/i18n.ts`（cmn-CN + en，其余语言回落 cmn-CN），
不改 `src/_locales/**`。菜单标题与页面内容共享同一份文案，切换语言后立即生效。

## 二、模块迁移

### 视频播放页（`src/contentScripts/videoPage/**`）

- 入口在挂载时按 `settings.value.videoPageShortcuts` 决定是否安装键盘监听，并用 `watch` 实时响应设置变化；
- 影院模式：关闭后不恢复 sessionStorage 里的旧状态，`setCinema(true)` / `toggleCinema()` 直接返回，
  浮动按钮「影院模式」与快捷键 `T` 一并失效；页面内切换成立即退出（静默，无 toast）；
- 迷你播放器：关闭后滚动判定不再收缩播放器，已在浮窗中的会被还原，浮动按钮与 `P` 失效；
- 快捷键：关闭后 `keydown` 监听整体移除，所有按键完全交还 B 站原生快捷键；
  单个功能关闭时对应按键（`T` / `P`）也不再被本模块拦截；
- 快捷键帮助面板会过滤掉已关闭功能的条目，浮动按钮组在三个开关全关时不渲染。

### 列表页（`src/contentScripts/views/listShared/preferences.ts`）

`useListPreferences(scope)` 的返回值仍是 `{ viewMode, sortMode, cycleViewMode, cycleSortMode }`，
但 `viewMode` / `sortMode` 变成可写 `computed`，读写直接打到 settings：

| scope | 视图字段 |
|---|---|
| `history` | `historyViewMode` |
| `watch-later` | `watchLaterViewMode` |
| `favorites` | `favoritesViewMode` |

排序三个页面共用 `listDefaultSort`。

一次性迁移：首次调用时读取旧的 `bewly-list-view-<scope>` / `bewly-list-sort-<scope>`，
仅当 settings 仍是默认值（`comfortable` / `time`）时才覆盖，随后删除旧 key，之后不再读 localStorage。

### 搜索页（`src/contentScripts/views/Search/composables/useDirectPasteSetting.ts`）

改为返回绑定 `settings.searchPageDirectPasteEnabled` 的可写 `computed`，
页面内开关与设置页共享同一状态。首次调用时读取旧的 `bewly-search-direct-paste` 并迁移一次，随后删除该 key。

## 三、Lead 需要接线

无。所有改动均在允许的文件范围内，入口与设置页注册已自行完成。

## 四、已知限制

- 设置通过 `webextension-polyfill` 的 `storage.local` 异步同步，播放页内的 `watch` 依赖该同步链路；
  若存储读取尚未完成就挂载（极少数冷启动场景），会短暂按默认值（全开）工作，同步到达后自动纠正；
- 旧 localStorage 迁移只在 settings 仍为默认值时生效：如果用户先改了设置、再打开旧的本地存储值，以设置为准（这是有意为之）；
- 三个列表页的排序现在是**共用**一个设置，单独给某一页换排序会同时影响另外两页（按简报「默认排序」语义实现）；
- 设置页文案只提供简中 / 英文两套，其他语言（cmn-TW、jyut）回落简中，与第 1/2 轮的模块内 i18n 约定一致。
## 五、第 5 轮：模块偏好并入设置页

> 把第 3–4 轮散落在 localStorage / sessionStorage 的模块偏好收进 settings（字段由 Lead 在 `src/logic/storage.ts` 新增，模块只读使用）。

### 新增分组（仍在「页面增强」页）

| 分组 | 项 | settings 字段 | 控件 |
|---|---|---|---|
| 动态页 | 卡片密度 | `momentsDensity` | Select（舒适 / 紧凑） |
| 消息页 | 默认只看未读 | `notificationOnlyUnread` | Radio |
| 消息页 | 列表密度 | `notificationDensity` | Select |
| 搜索结果页 | 结果密度 | `searchDensity` | Select |
| 用户空间 | 内容密度 | `spaceDensity` | Select |
| 文章页 | 默认进入阅读模式 | `articleReadingMode` | Radio |
| 文章页 | 正文字号 | `articleFontSize` | Select（小 / 中 / 大） |

文案仍走模块内 i18n（`src/components/Settings/Pages/i18n.ts`，cmn-CN + en）。

### 各模块改动

- **动态页**（`src/contentScripts/views/Moments/composables/useMomentsDensity.ts`）：密度直接绑定 `settings.momentsDensity` 的可写 computed，页面工具条切换即回写 settings；旧 key `bewly-moments-density`（localStorage）一次性迁移后删除。设置页改动通过响应式依赖实时反映到卡片上。
- **消息页**（`notificationPage/preferences.ts`、`actions.ts`、`index.ts`）：「只看未读」与「列表密度」改为读写 settings，旧 session key `bewly-notif-only-unread` / `bewly-notif-density` 迁移后删除；面板展开状态继续留在 sessionStorage。入口 `watch` 两个 settings 字段，设置页改动立刻应用（打开未读筛选时若页面暂时识别不到未读状态，会等下一次同步再应用）。
- **搜索结果页**（`searchPage/actions.ts`、`index.ts`）：密度改为 `settings.searchDensity`，旧 `bewly-search-density` 迁移后删除；快速筛选与面板展开仍在 sessionStorage。入口 `watch(settings.searchDensity)` 实时同步 `<html>` 上的密度类。
- **用户空间**（`spacePage/preferences.ts`、`actions.ts`、`index.ts`）：密度改为 `settings.spaceDensity`，旧 `bewly-space-density` 迁移后删除；内容筛选与面板状态仍在 sessionStorage。入口 `watch` 实时同步。
- **文章页**（`articlePage/preferences.ts`、`actions.ts`、`index.ts`）：默认阅读模式与字号改为 `settings.articleReadingMode` / `settings.articleFontSize`，旧 `bewly-article-reading` / `bewly-article-font` 迁移后删除；目录展开仍在 sessionStorage。入口 `watch` 两个字段：字号立即换算，阅读模式按需切换（正文未就绪时等 `sync` 补进，避免把页面藏空）。

### 迁移策略（统一）

1. 首次使用时读取旧 key；**仅当对应 settings 字段仍是默认值**时才覆盖（用户先改过设置则以设置为准）；
2. 无论是否覆盖，读完立即删除旧 key，保证只迁移一次；
3. 纯会话内 UI 状态（面板展开、目录展开、快速筛选）不进 settings，保持 sessionStorage。

### 第 5 轮 Lead 接线

无。设置页分组、各模块读写与 watch 均已完成；分区 / 频道页（`channelPage`）按简报 C 节仍用 sessionStorage，本轮不进设置页。

### 第 5 轮已知限制

- 各模块的旧值迁移在模块挂载时同步执行，与 settings 的异步读取存在极小的冷启动竞态（若读取晚于迁移完成，可能短暂按默认值显示；settings 读完后由 watch 纠正）。原生页模块在 DOM 就绪后才挂载，实际几乎不会命中；
- 消息页「默认只看未读」是页面级偏好：页面识别不到未读标记时不会强行开启筛选，避免出现空白列表；
- 动态页密度只影响卡片内部排版，不改变卡片流的分栏数量（分栏仍由页面宽度决定）。
## 六、第 7 轮：视频卡片悬停预览开关

> 把第 6 轮悬停预览的开关从 `localStorage` 迁到 settings（字段由 Lead 在 `src/logic/storage.ts` 新增，
> 模块只读使用），并在「页面增强」页新增「视频卡片」分组。

### 新增分组（仍在「页面增强」页）

| 分组 | 项 | settings 字段 | 控件 |
|---|---|---|---|
| 视频卡片 | 悬停预览 | `enableVideoCardPreview` | Radio（默认开） |

文案仍走模块内 i18n（`src/components/Settings/Pages/i18n.ts`，cmn-CN + en）。
分组插在「视频播放页」与「列表页」之间；分组说明为「视频卡片本身的交互增强」。

### 模块改动（`src/components/VideoCardPreview/previewSettings.ts`）

- `isCardPreviewEnabled()` 改为读 `settings.enableVideoCardPreview`；
- 旧 localStorage key `bewly-card-preview`（第 6 轮，`'1'` / `'0'`）一次性迁移：
  只有旧值为 `'0'` 且设置仍是默认（开启）时才写入关闭，读完立即删除旧 key，之后不再读 localStorage；
- 旧的全局「启用视频预览」（`enableVideoPreview`，通用设置里的视频卡片分组）仍作为总闸参与判断，
  避免留下一个不起作用的死开关；其联动项 `enableVideoCtrlBarOnVideoCard`（预览控件条）与
  `hoverVideoCardDelayed`（延迟 900ms → 1200ms）继续复用；
- 设置页改动通过响应式依赖立即生效（下一次悬停按新值执行），无需刷新页面。

### 第 7 轮 Lead 接线

无。设置页分组、开关与迁移均已完成；悬停预览依赖卡片数据里的 `cid`，
相关页面透传见 `docs/video-card-preview.md` 的「生效范围」。

### 第 7 轮已知限制

- 旧开关 `enableVideoPreview` 与新开关 `enableVideoCardPreview` 目前是「与」关系，两个都能关；
  若后续只想保留一个开关，需要同时调整通用设置页与 `previewSettings`（本模块已按「新字段为主、旧字段兜底」实现）；
- 开关变化不会打断正在播放的那一段预览（最多再播 6 秒），下一次悬停生效；
- 迁移与 settings 的异步读取存在极小的冷启动竞态（与第 5 轮各模块相同）：设置读完后由响应式依赖纠正。
## 七、第 9 轮：分区密度 + 动态页离屏优化并入设置页

> 把分区 / 排行页的密度与动态页的离屏优化从 localStorage / sessionStorage 收进 settings（字段由 Lead 新增，模块只读使用）。

### 新增分组 / 项

| 分组 | 项 | settings 字段 | 控件 |
|---|---|---|---|
| 动态页 | 离屏优化 | `momentsOptimizeEnabled` | Radio（默认开） |
| 分区 / 排行页 | 列表密度 | `channelDensity` | Select（舒适 / 紧凑） |

「分区 / 排行页」分组插在「用户空间」与「文章页」之间；「离屏优化」作为「动态页」分组的第二项。
文案仍走模块内 i18n（`src/components/Settings/Pages/i18n.ts`，cmn-CN + en）。

### 模块改动

- **动态页**（`src/contentScripts/views/Moments/Moments.vue`）：离屏优化开关改为绑定 `settings.momentsOptimizeEnabled` 的可写 `computed`，页面顶部按钮切换即回写 settings；设置页改动通过响应式依赖即时改变渲染策略（无需刷新）。旧 localStorage key `bewly-moments-optimize`（`'0'` 表示关闭）一次性迁移后删除。
- **分区 / 排行页**（`src/contentScripts/channelPage/preferences.ts`、`actions.ts`、`index.ts`）：列表密度改为 `settings.channelDensity`，旧 session key `bewly-channel-density` 迁移后删除；面板展开状态仍在 sessionStorage。入口 `watch(settings.channelDensity)` 实时同步 `<html>` 上的密度类。

### 迁移策略

与第 5 / 7 轮一致：仅当对应 settings 字段仍是默认值时才用旧值覆盖，读完立即删除旧 key；设置页优先。

### 第 9 轮 Lead 接线

无。设置页分组、模块读写、迁移与 watch 均已完成。

### 第 9 轮已知限制

- 动态页离屏优化只影响卡片根节点上的 `content-visibility` / `contain-intrinsic-size`，不卸载节点；关闭后完全退回「全部渲染」；
- 设置页改动对已打开的分区页实时生效依赖 `settings` 的 storage 同步链路（与前面各轮相同）；
- 迁移与 settings 异步读取存在极小的冷启动竞态，settings 读完后由响应式依赖 / watch 纠正。
## 八、第 14 轮：设置页信息架构优化

> 「页面增强」页已有 11 个分组、20+ 个设置项，垂直很长。本轮加分组导航、设置搜索与分组重置，不改任何字段绑定，也不改 `storage.ts`。

### 新增文件

- `src/components/Settings/components/SettingsGroupSection.vue`（新的通用小组件）：与 `SettingsItemGroup` 视觉一致的设置分组卡片，额外提供分组标题行右侧的「重置本组」按钮、`data-settings-group` 定位标记与「已重置」反馈；
- `Pages.vue` 改用该组件承载每个分组（内容与字段绑定保持不变）。

### 1. 顶部分组导航

- 横向胶囊导航列出全部 11 个分组：视频播放页 / 视频卡片 / 列表页 / 搜索页 / 动态页 / 消息页 / 搜索结果页 / 用户空间 / 分区排行页 / 文章页 / 首页；
- 点击胶囊平滑滚动到对应分组（`scrollIntoView` + 分组上的 `scroll-margin-top` 让标题不被吸顶导航挡住）；`prefers-reduced-motion: reduce` 时改为瞬时定位；
- 当前分组随滚动用 `IntersectionObserver` 高亮（`root` 为设置面板内部的 OverlayScrollbars 滚动容器，`rootMargin` 预留吸顶导航的高度）；当前胶囊激活时会横向滚进导航条可视区；
- 过滤时导航只保留仍有可见项的分组；当前高亮分组被过滤掉时自动切到第一个可见分组；
- 工具栏整体吸顶（`position: sticky; top: 80px`，即设置面板标题条下方），背景与设置内容同色，避免内容透出。

### 2. 设置搜索

- 顶部搜索框即时过滤（无输入时全部展示）；匹配范围：分组标题 / 分组说明 / 设置项标题 / 设置项说明 / 选项名（舒适、紧凑、时间、时长、标题、小、中、大等）；
- 匹配到分组标题 / 说明时，整组设置项都显示；只匹配到个别设置项时，组内其余项隐藏；
- 过滤后为空的分组整体隐藏（`v-show`，保留 DOM 供 IntersectionObserver 继续工作）；
- 无匹配时显示「没有匹配的设置」空状态 + 「清空」按钮，搜索框右侧也提供「清空」；
- 分组标题 / 说明 / 设置项文案变化（切换语言）后搜索索引立刻跟随（搜索文案用 getter 取当前语言）。

### 3. 分组重置

- 每个分组标题右侧有「重置本组」按钮：只把该组涉及的 settings 字段恢复为 `originalSettings` 里的默认值（`src/logic/storage.ts` 只读引用，未修改）；
- 重置后按钮短暂（1.8s）显示「已重置」，期间不可重复点击；不弹全局 toast；
- 各组的重置字段：视频播放页 3 项；视频卡片 2 项（预览 / 操作条）；列表页 4 项（三个视图 + 默认排序）；搜索页 1 项；动态页 2 项；消息页 2 项；搜索结果页 / 用户空间 / 分区排行页 / 首页各 1 项；文章页 2 项。

### 4. 键盘可达与动效

- 导航胶囊、清空按钮、重置按钮都是原生 `<button type="button">`，Tab 可达、Enter / Space 触发；胶囊有 `aria-current`，导航有 `aria-label`，搜索区 `role="search"`，空状态 `role="status"`；
- 胶囊 / 重置按钮的过渡用 `--bew-motion-fast` / `--bew-ease-out` 令牌，`prefers-reduced-motion: reduce` 下去掉过渡，平滑滚动降级为瞬时定位。

### 第 14 轮 Lead 接线

无。新增组件由 `Pages.vue` 直接引入（Settings 目录不参与全局组件注册，符合既有冷路径约定）。

### 第 14 轮已知限制

- 分组导航的滚动高亮依赖设置面板内部的 OverlayScrollbars 滚动容器；若宿主结构变化导致找不到滚动容器，会退化为以视口为 root 的 `IntersectionObserver`，高亮仍可用但位置可能略偏；
- 搜索按文案做简单的 `includes` 匹配（不区分大小写），不做拼音 / 模糊匹配；
- 重置只恢复 `originalSettings` 的字段默认值，不清理旧 localStorage / sessionStorage 残留（各模块的一次性迁移逻辑照常生效）；
- 分组导航与搜索栏吸顶高度按设置面板标题 80px 估算，若后续标题条高度调整，`Pages.vue` 里的 `top: 5rem` 与 `SettingsGroupSection.vue` 的 `scroll-margin-top: 172px` 需同步调整。
## 九、第 22 轮：设置导入 / 导出

> 「页面增强」页底部新增「数据」区：把当前 `settings` 导出成 JSON 备份，或从备份文件导入并整体覆盖。
> 只读写 `settings` 响应式对象，未改 `src/logic/storage.ts` 的结构。

### 1. 导出

- 点击「导出设置」→ 生成 `bewly-settings-YYYYMMDD.json`（本地时区日期）并触发浏览器下载；
- 文件结构：

```json
{
  "version": 1,
  "exportedAt": "2025-01-01T00:00:00.000Z",
  "settings": {
    "videoPageCinemaMode": true,
    "historyViewMode": "comfortable",
    "momentsDensity": "comfortable"
  }
}
```

> `settings` 的键与 `originalSettings` 完全一致（上例只列了 3 个字段）。
>
> - `settings` 里只包含 `originalSettings` 定义的字段（按同一份字段清单遍历），**不含**其它 storage key
  （如 `gridLayout`、`sidePanel`、`accessKey` 等都不导出）；
- 导出失败（Blob / 下载被拦截等）时状态行提示「导出失败，请重试」，不影响当前设置。

### 2. 导入（校验 → 二次确认 → 覆盖）

点击「导入设置」→ 选择 JSON 文件后，先做**纯校验**，全部通过才弹出面板内的二次确认：

| 校验项 | 规则 | 失败提示 |
|---|---|---|
| JSON 语法 | `JSON.parse` 成功 | 文件不是有效的 JSON |
| 顶层结构 | 必须是普通对象；`settings` 必须是普通对象 | 文件格式不正确：需要包含 settings 对象 |
| 版本 | `version` 必须等于当前导出格式版本 `1` | 不支持的设置版本：`{version}` |
| 字段类型 | 已知字段的值类型必须与 `originalSettings` 的默认值一致（数组 / 普通对象 / 其它按 `typeof` 比较） | 字段 `{field}` 的类型与默认值不一致 |
| 可导入项 | 至少有一个已知字段被提供 | 文件里没有可导入的设置项 |

补充规则：

- **未知字段忽略**：`settings` 里不属于 `originalSettings` 的键会被直接丢弃，不报错、不写入；
- **缺失字段保留**：文件中没有出现的已知字段不会被清空（保持当前值）；即「覆盖文件里给出的字段」；
- 校验阶段不改动任何设置；任何一步失败只显示原因并回到原样；
- 校验通过后显示「确认导入？」面板：说明将覆盖的条目数，提供「确认导入 / 取消」；
- 确认后把字段逐个写入 `settings`，状态行提示「已导入 N 项设置」；写入异常时只提示错误，已写入的字段不会回滚（见「已知限制」）；
- 导入会立即生效：`settings` 是响应式的，各模块的 `watch` / 计算属性会跟着更新；`useStorageLocal` 会把新值写回 `storage.local`；
- 取消 / 确认后焦点回到「导入设置」按钮；二次确认出现时焦点自动落在「确认导入」上。

### 3. 键盘与无障碍

- 导出 / 导入 / 确认 / 取消都是原生 `<button type="button">`，Tab 可达、Enter / Space 触发；
- 二次确认面板 `role="alertdialog"`，带 `aria-label`；打开时自动聚焦「确认导入」；
- 面板内按 `Esc` 取消导入（`@keydown.esc` 阻止冒泡，避免顺手关掉整个设置面板）；
- 状态行 `role="status"` + `aria-live="polite"`，成功 / 失败都会播报；
- 隐藏的原生 `input[type=file]` 保留 `aria-label`，选完文件后焦点回到导入按钮；
- 所有按钮 `:focus-visible` 用主题色描边；暗色沿用 `--bew-*` 变量；
- `@media (forced-colors: active)` 下按钮 / 确认框改用系统色（`ButtonText` / `Highlight`），避免高对比度模式对比不足；
- `prefers-reduced-motion: reduce` 关闭按钮过渡。

### 4. 已知限制

- 导出格式版本固定为 `1`，没有兼容旧版本文件的能力（旧/未知版本会被明确拒绝，不会静默导入）；
- 字段类型校验只到「数组 / 普通对象 / 基础类型」这一层，不校验嵌套结构（例如 `dockItemsConfig` 内部字段、`keyboardShortcuts` 的键名）与枚举取值合法性；导入后若出现非法枚举，由对应模块按自身兜底逻辑处理；
- 只覆盖文件中出现的已知字段，未出现的字段保持当前值（相当于「按字段覆盖」而不是「整对象替换」）；
- 导入写入不可中断：若极端情况下写入中途抛错，已写入的字段不会回滚（正常路径已用 try/catch 包裹，仅提示，不回滚）；
- 导出 / 导入只覆盖「页面增强」页涉及的 `settings` 字段清单，不包含其它模块的 localStorage / sessionStorage 偏好；
- 文件选择 / 下载行为依赖浏览器；在扩展的 shadow DOM 里通过临时 `<a download>` 触发，未做「另存为」对话框定制。

### 5. 自测记录

- `pnpm exec eslint src/components/Settings/Pages/Pages.vue src/components/Settings/Pages/i18n.ts --fix` 后再裸跑：0 error 0 warning；
- `pnpm run typecheck`：0 error；
- 未跑 build / playwright、未碰浏览器、未 git。
## 十、第 24 轮：两个缺失的开关（评论区增强 / 列表页滚动记忆）

> 第 23 轮及之前已实现「视频页评论区增强」与「列表页返回恢复滚动位置」，但设置页没有对应开关。
> 本轮把 `videoPageComments` 与 `enableListScrollMemory` 接进「页面增强」页，字段由 `storage.ts` 提供（默认 `true`，只读使用、未改默认值）。

### 新增开关

| 分组 | 开关 | settings 字段 | 默认 | 说明 |
|---|---|---|---|---|
| 视频播放页 | 评论区增强 | `videoPageComments` | `true` | 评论排序快捷（最热 / 最新）、只看 UP 主、长评论折叠；关闭后评论区保持 B 站原生样式 |
| 列表页 | 返回恢复滚动位置 | `enableListScrollMemory` | `true` | 从视频页返回历史 / 稍后再看 / 收藏时，恢复离开前的浏览位置并高亮原来那张卡 |

### 交互细节

- 两个开关都放在各自分组已有设置项之后（视频播放页第 4 项、列表页第 5 项），参与分组搜索过滤；
- 都参与「重置本组」：`reset()` 会把字段恢复为 `originalSettings.videoPageComments` / `originalSettings.enableListScrollMemory`（即 `true`）；
- **`aria-describedby`**：说明文案渲染在带固定 id 的 `<span>` 上（`pages-desc-video-comments` / `pages-desc-list-scroll-memory`），并关联到真正被读屏识别的原生 `<input type="checkbox">`；
- 为此新增通用小组件 `src/components/Settings/Pages/PagesSwitch.vue`：
  - 视觉与全局 `Radio` 一致（同尺寸 50×25 拨杆、主题色选中态），但原生 checkbox 用「视觉隐藏但仍可获得焦点」的方式隐藏（`clip-path`，而非 `hidden`），因此 `aria-describedby` 真正生效；
  - 支持 `v-model`（`defineModel<boolean>`）、`describedby`、`inputId`；
  - `focus-visible` 主题色描边、`prefers-reduced-motion: reduce` 关闭过渡、`@media (forced-colors: active)` 下用系统色（`ButtonText` / `Highlight`）；
- 运行时行为不变：两个字段早已被对应模块（视频页评论区 / 列表页滚动记忆）以 `settings.xxx` 为总开关读取，设置一改即实时生效，无需刷新；
- 不改任何业务默认值，也未修改 `storage.ts` 的结构与默认值。

### 文案（四语言）

| key | cmn-CN | cmn-TW | en |
|---|---|---|---|
| `videoPageComments` | 评论区增强 | 留言區增強 | Comment enhancements |
| `videoPageCommentsDesc` | 评论排序快捷（最热 / 最新）、只看 UP 主、长评论折叠；关闭后评论区保持 B 站原生样式 | 留言排序快捷（最熱 / 最新）、只看 UP 主、長留言摺疊；關閉後留言區保持 B 站原生樣式 | Quick sort (hot / latest), only-uploader filter and long-comment collapsing. When off, the comment area keeps its native Bilibili style. |
| `listScrollMemory` | 返回恢复滚动位置 | 返回時恢復捲動位置 | Restore scroll position on return |
| `listScrollMemoryDesc` | 从视频页返回历史 / 稍后再看 / 收藏时，恢复离开前的浏览位置并高亮原来那张卡 | 由影片頁返回歷史 / 稍後再看 / 收藏時，恢復離開前的瀏覽位置並高亮原本那張卡 | When coming back from a video to history / watch later / favorites, restore the previous position and highlight the card you left on. |

jyut 继承 cmn-TW（与其它数据类文案一致）。

### 已知限制

- 开关只负责总开关：关闭后对应模块不接管，但已产生的本地状态（例如列表页已记录的滚动位置）不会被清理，重新打开后继续沿用；
- 「只重置本组」会同时把这两个开关恢复为默认 `true`，列表页分组的重置按钮因此会一起重置视图 / 排序 / 滚动记忆四项；
- `PagesSwitch` 只为本轮两个开关新增，其它开关仍是全局 `Radio`（无 `aria-describedby`）；若后续要统一，可逐步替换；
- 本次自测仅 eslint + typecheck（按分工未跑 build / playwright、未碰浏览器）。
