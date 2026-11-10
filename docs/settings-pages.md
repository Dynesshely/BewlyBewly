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
