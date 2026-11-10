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
