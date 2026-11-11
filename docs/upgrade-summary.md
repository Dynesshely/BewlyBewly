# 升级总览（用户向）

本文汇总第 1–21 轮对 BewlyBewly（Dynesshely fork）的**用户可见改动**，按页面组织；
另附快捷键总表、设置项清单与已知限制。实现细节与调试信息见各模块文档（文末索引）。

适用页面：B 站桌面网页版。新增能力大多「不替换原生页面、只在上面叠加增强」；找不到页面结构时自动降级或隐藏，不会留下空浮层。

## 一、按页面总览

### 首页（推荐 / 关注 / 订阅剧集 / 热门 / 排行 / 直播）

- 首页 6 个子标签统一为卡片流，支持「自适应 / 两列 / 单列」网格布局并在工具栏快速切换，每个子标签单独记忆布局。
- 卡片密度可在「舒适 / 紧凑」间切换（紧凑档每行多一张、间距与标题字号更小），设置页与首页工具栏同源。
- 滚动超过两屏出现「回到顶部」浮动按钮，跟随 Dock 位置避让；切回子标签时恢复上次滚动位置，刷新页面回到顶部。
- 视频卡悬停出现点赞 / 收藏 / 稍后再看操作条（已赞、已收藏状态会显示），悬停 0.9 秒可静音预览片段。
- 键盘方向键可在卡片间移动，Enter 打开、Space 页面内预览、d 打开右键菜单；Shift+F 进入「聚焦浏览（封面流）」。
- 清屏模式（Shift+Z）只保留内容、隐藏顶栏 / Dock 等界面；打开设置、命令面板等浮层时临时恢复。
- 详见：[home-density](home-density.md)、[focus-browse](focus-browse.md)、[zen-mode](zen-mode.md)、[scroll-memory](scroll-memory.md)、[video-card-quick-actions](video-card-quick-actions.md)、[video-card-preview](video-card-preview.md)

### 视频播放页（/video/*、/bangumi/play/*）

- 影院模式（T）：播放器铺满视口、隐藏右栏与推荐；滚动迷你播放器（P）在滚出视口后收缩到右下角。
- 增强快捷键：J/L 快退快进、K 播放暂停、←/→ 5 秒、C 弹幕、M 静音、F 全屏、Shift+P 画中画、0–9 跳进度。
- 选集面板：播放列表页（/list/*）显示播放列表、普通多 P 视频显示分 P、合集视频显示合集；[ / ] 切上一个 / 下一个，A 自动连播。
- 紧凑信息栏与播放器浮动按钮可一键还原、退出影院、打开快捷键帮助。
- 详见：[video-page](video-page.md)

### 番剧页

- 一周番剧时间表：按更新日浏览当季番剧，今日主推、当日全部更新、其余日程分区展示。
- 键盘：←/→ 切换日期、Home/End 跳到周一/周日、Enter 打开当日主推；追番人数、更新时间直接显示。
- 其余板块（追番 / 热播榜 / 推荐）保留原有数据流。
- 详见：[anime-search-pages](anime-search-pages.md)

### 列表页（观看历史 / 稍后再看 / 收藏夹）

- 三种视图：舒适网格 / 紧凑网格 / 列表；排序：时间 / 时长 / 标题；顶部统一工具条含视图切换、排序、关键词过滤。
- 按「今天 / 昨天 / 本周 / 更早」时间分组；卡片显示观看进度；空态、错误态、骨架屏风格统一。
- 滚动位置记忆：从视频页返回列表时恢复到上次浏览的卡片附近；刷新页面回到顶部。
- 离屏优化：长列表只渲染视口附近的卡片，滚动更流畅（可在设置页关闭）。
- 收藏页的收藏夹胶囊支持「更多」菜单：重命名、删除（含二次确认）、「+ 新建收藏夹」；当前收藏夹被删除时自动切到第一个可用夹或显示空态。
- 快捷键：V 切换视图、Shift+V 切换排序、/ 聚焦过滤框、H 本页快捷键说明。
- 详见：[list-pages](list-pages.md)、[scroll-memory](scroll-memory.md)

### 搜索

- 搜索起始页：最近搜索、热门搜索（B 站真实热搜取 12 条显示 8 条，可「换一批」，10 分钟缓存，失败回落内置词表）、BV 号 / 链接直达。
- 页面内粘贴 BV 号或 B 站链接可直接打开目标（可在设置页关闭）；Esc 立即清除提示。
- 原生搜索结果页增强：右下角面板提供结果密度（舒适 / 紧凑）与快速筛选（全部 / 仅视频 / 仅用户），J/K（或 ↑/↓）浏览、Enter 新标签页打开、Esc 关面板 / 取消高亮。
- 首页可切换「搜索页模式」（用搜索页替代原生首页）。
- 详见：[search-page](search-page.md)、[anime-search-pages](anime-search-pages.md)

### 动态页

- 关注时间线卡片流：视频 / 番剧 / 图文 / 专栏 / 直播 / 转发 / 纯文字卡片，九宫格图片按张数自适应。
- 卡片密度（舒适 / 紧凑）、「只看视频」筛选、离屏优化开关，工具栏直接切换。
- 点赞 / 取消点赞（乐观更新，失败回滚）；复制正文、下载图片；点击图片打开大图预览（←/→ 切换、Esc 关闭、点击遮罩关闭）。
- 键盘：j/k 或 ↑/↓ 移动卡片、o 打开当前卡片、Esc 取消高亮；接近列表末尾自动预取下一页。
- 详见：[moments-page](moments-page.md)

### 消息页

- 右下角浮动按钮（带未读角标）打开增强面板：只看未读、分类跳转（回复 / @ / 点赞 / 系统）、全部已读、列表密度。
- 快捷键：U 切换只看未读、D 切换密度、1–4 跳分类、Esc 关面板；未读筛选不可用时开关禁用并说明。
- 详见：[notification-page](notification-page.md)

### 用户空间

- 浮动面板提供内容筛选（全部 / 视频 / 专栏 / 动态 / 合集）、密度（舒适 / 紧凑）、快速跳转（主页 / 投稿 / 合集 / 收藏夹）。
- J/K 浏览内容卡、Enter 新标签页打开、Esc 关面板 / 取消高亮；面板显示当前浏览位置。
- 详见：[space-page](space-page.md)

### 文章 / 专栏 / OPUS

- 沉浸阅读（R）：正文 720px 居中、隐藏侧栏 / 推荐 / 评论，字号三档（[ / ]），目录（当前章节进度圆点），阅读进度条，回到顶部（T）。
- 点击正文图片打开大图：←/→ 切换同文图片、Esc / 点遮罩关闭、关闭恢复滚动位置；代码块右上角「复制」按钮，复制成功显示「已复制」1.5 秒。
- 兼容普通专栏、OPUS 图文与旧专栏「跳转 OPUS」过渡页（过渡页静默等待跳转，不显示浮层）。
- 详见：[article-page](article-page.md)

### 分区页 / 热门页 / 排行榜

- 浮动面板提供密度（舒适 / 紧凑）；分区页支持排序快捷（综合 / 播放多 / 最新）；排行榜支持日榜 / 周榜 / 月榜切换（1 / 2 / 3）。
- 视频卡显示排名徽标；J/K 浏览、Enter 打开、Esc 关面板 / 取消高亮。
- 详见：[channel-page](channel-page.md)

### 直播页

- 浮动面板：影院模式（T）、隐藏右侧栏（H，真机结构不支持时禁用并说明）、弹幕开关（C）、全屏（F）、快捷键说明（?）。
- 影院模式隐藏顶部操作条、播放器按视口高度铺满并保持画面完整；窄屏（≤900px）不遮挡播放器控件。
- 详见：[live-page](live-page.md)

### 全局

- 快捷键帮助（?）：按页面分组展示全部快捷键，可自定义绑定；命令面板（Ctrl/Cmd+K）支持按当前页上下文过滤动作。
- 清屏模式（Shift+Z）、聚焦浏览（Shift+F）、键盘卡片导航、AI 卡片初筛（需自备 OpenAI 兼容 API Key）。
- 设置页新增「页面增强」分组，集中管理上述页面增强开关；设置项含说明与默认值。
- 界面支持简中 / 繁中 / 粤语 / 英文四种语言；暗色模式、高对比度、减少动态效果、窄屏（≤900 / ≤640px）适配。
- 图片加载失败统一显示虚线占位（按图片 / 视频封面 / 头像区分图标与读屏文案），不重试、不抖动；空态 / 错误态 / 骨架屏统一风格。
- 详见：[keyboard-registry](keyboard-registry.md)、[keyboard-navigation](keyboard-navigation.md)、[zen-mode](zen-mode.md)、[focus-browse](focus-browse.md)、[ai-filter](ai-filter.md)、[settings-pages](settings-pages.md)、[i18n-modules](i18n-modules.md)、[accessibility](accessibility.md)、[responsive](responsive.md)、[fallback](fallback.md)、[feedback-states](feedback-states.md)

## 二、快捷键总表（按页面）

> 全局动作可在「设置 → 键盘 → 自定义快捷键」里改键；下表为默认值。

### 全局（卡片导航 / 浮层 / 模式）

| 按键 | 行为 |
| --- | --- |
| `←` `↑` `→` `↓` | 在卡片间按网格移动高亮 |
| `Home` / `End` | 跳到第一张 / 最后一张卡片 |
| `Enter` | 打开当前卡片（按设置：新标签页 / 当前页 / 页面内预览） |
| `Space` | 页面内打开（默认页面内预览） |
| `w` | 加入稍后再看 |
| `d` | 打开卡片右键菜单 |
| `s` / `f` | 切换排序 / 筛选 |
| `i` | 切换卡片详细信息 |
| `q` | 加入本地待看队列 |
| `Shift + Q` | AI 初筛当前页 |
| `/` | 聚焦搜索框 |
| `?` | 打开 / 关闭快捷键帮助 |
| `Shift + F` | 进入 / 退出聚焦浏览（封面流） |
| `Shift + Z` | 切换清屏模式 |
| `Ctrl/Cmd + K` | 打开命令面板 |
| `Esc` | 退出聚焦浏览 / 清屏 / 关闭浮层 |

### 首页

| 按键 | 行为 |
| --- | --- |
| 方向键 / Enter / Space / d / s / f / i / w / q | 与「全局」一致（卡片导航） |
| `Shift + F` / `Shift + Z` | 聚焦浏览 / 清屏模式 |

### 视频播放页

| 按键 | 行为 |
| --- | --- |
| `J` / `L` | 后退 / 前进 10 秒 |
| `K` | 播放 / 暂停 |
| `←` / `→` | 后退 / 前进 5 秒 |
| `C` / `M` / `F` | 弹幕 / 静音 / 全屏 |
| `T` | 影院模式 |
| `Shift + P` | 画中画 |
| `P` | 还原迷你播放器 |
| `0` – `9` | 跳到 0% – 90% 进度 |
| `[` / `]` | 选集面板：上一个 / 下一个（播放列表 / 分 P / 合集） |
| `A` | 自动连播开关（播放列表页可用） |
| `?` / `Esc` | 快捷键帮助 / 退出影院或关闭帮助 |

### 番剧 / 电影播放页

| 按键 | 行为 |
| --- | --- |
| `[` / `]` | 上一集 / 下一集（交给 B 站原生能力） |
| 播放器键位 | 同视频播放页（J/K/L、C/M/F 等） |

### 列表页（历史 / 稍后再看 / 收藏）

| 按键 | 行为 |
| --- | --- |
| `V` | 循环切换视图（舒适 → 紧凑 → 列表） |
| `Shift + V` | 循环切换排序（时间 → 时长 → 标题） |
| `/` | 聚焦关键词过滤框 |
| `H` | 打开 / 关闭本页快捷键说明 |
| `?` | 全局快捷键帮助 |

### 搜索

| 按键 | 行为 |
| --- | --- |
| `/` | 在搜索起始页聚焦搜索框 |
| `Enter` | 搜索（起始页）/ 新标签页打开当前结果（结果页） |
| `J` / `K`（或 `↓` / `↑`） | 下一张 / 上一张结果卡（原生搜索结果页） |
| `Esc` | 关面板 / 取消高亮 / 清除粘贴提示 |

### 动态页

| 按键 | 行为 |
| --- | --- |
| `j` / `k`（或 `↓` / `↑`） | 下一张 / 上一张卡片 |
| `o` | 打开当前高亮卡片 |
| `Esc` | 取消高亮 / 关闭大图 |
| `←` / `→` | 大图打开时切换图片 |

### 消息页

| 按键 | 行为 |
| --- | --- |
| `U` | 切换「只看未读」 |
| `D` | 切换列表密度 |
| `1` – `4` | 跳到分类（回复 / @ / 点赞 / 系统） |
| `Esc` | 关闭面板 |

### 用户空间

| 按键 | 行为 |
| --- | --- |
| `J` / `K` | 下一个 / 上一个内容卡 |
| `Enter` | 新标签页打开当前卡 |
| `Esc` | 关面板 / 取消高亮 |

### 分区页 / 热门页 / 排行榜

| 按键 | 行为 |
| --- | --- |
| `J` / `K` | 下一个 / 上一个视频卡 |
| `Enter` | 新标签页打开当前卡 |
| `Esc` | 关面板 / 取消高亮 |
| `1` / `2` / `3` | 排行榜：日榜 / 周榜 / 月榜（仅排行榜页） |

### 文章 / 专栏 / OPUS

| 按键 | 行为 |
| --- | --- |
| `R` | 切换沉浸阅读 |
| `[` / `]` | 字号减小 / 增大 |
| `T` | 回到顶部 |
| `Esc` | 大图 → 目录 → 退出阅读（按顺序） |
| `←` / `→` | 大图打开时切换图片 |

### 直播页

| 按键 | 行为 |
| --- | --- |
| `T` | 影院模式 |
| `H` | 隐藏 / 显示右侧栏 |
| `C` / `F` | 弹幕开关 / 全屏 |
| `?` / `Esc` | 打开或关闭面板 / 先关面板再退影院 |

### 全局浮层与模式

| 按键 | 行为 |
| --- | --- |
| `?` | 快捷键帮助（Esc 关闭，焦点在面板内循环） |
| `Ctrl/Cmd + K` | 命令面板（Esc 关闭） |
| `Shift + Z` | 清屏模式（Esc 退出） |
| `Shift + F` | 聚焦浏览（Esc 退出） |

## 三、设置项清单（全部字段与默认值）

> 来源：`src/logic/storage.ts` 的 `originalSettings`。共 **115** 个字段；标「本升级新增」的分组为第 1–21 轮过程中加入或接入的页面增强设置。
> 值为 `空字符串` / `空数组` / `空对象` 表示对应控件未填写或列表为空。

### 页面增强（本升级新增）

| 字段 | 默认值 |
| --- | --- |
| `enableGridLayoutSwitcher` | `true` |
| `videoPageCinemaMode` | `true` |
| `videoPageMiniPlayer` | `true` |
| `videoPageShortcuts` | `true` |
| `enableVideoPreview` | `true` |
| `enableVideoCardPreview` | `true` |
| `enableVideoCardQuickActions` | `true` |
| `historyViewMode` | `comfortable` |
| `watchLaterViewMode` | `comfortable` |
| `favoritesViewMode` | `comfortable` |
| `listDefaultSort` | `time` |
| `momentsDensity` | `comfortable` |
| `momentsOptimizeEnabled` | `true` |
| `notificationOnlyUnread` | `false` |
| `notificationDensity` | `comfortable` |
| `searchDensity` | `comfortable` |
| `spaceDensity` | `comfortable` |
| `channelDensity` | `comfortable` |
| `articleReadingMode` | `false` |
| `articleFontSize` | `m` |
| `homeCardDensity` | `comfortable` |
| `nativeGuardEnabled` | `true` |
| `nativeFilterEnabled` | `false` |
| `followingTabShowLivestreamingVideos` | `false` |
| `homePageTabVisibilityList` | `空数组` |
| `alwaysShowTabsOnHomePage` | `false` |
| `useSearchPageModeOnHomePage` | `false` |
| `searchPageModeWallpaperFixed` | `false` |
| `searchPageDirectPasteEnabled` | `true` |
| `recommendationMode` | `web` |
| `touchScreenOptimization` | `false` |

### 键盘与卡片导航

| 字段 | 默认值 |
| --- | --- |
| `keyboardNavEnabled` | `true` |
| `keyboardNavLockScroll` | `true` |
| `keyboardEnterAction` | `newTab` |
| `keyboardSpaceAction` | `preview` |
| `keyboardShortcuts` | `空对象` |

### 语言、字体与外观

| 字段 | 默认值 |
| --- | --- |
| `language` | `空字符串` |
| `customizeFont` | `recommend` |
| `fontFamily` | `空字符串` |
| `overrideDanmakuFont` | `true` |
| `removeTheIndentFromChinesePunctuation` | `false` |
| `disableFrostedGlass` | `true` |
| `reduceFrostedGlassBlur` | `false` |
| `disableShadow` | `false` |
| `theme` | `auto` |
| `themeColor` | `#00a1d6` |
| `useLinearGradientThemeColorBackground` | `false` |
| `adaptToOtherPageStyles` | `true` |
| `customizeCSS` | `false` |
| `customizeCSSContent` | `空字符串` |

### 顶栏 / Dock / 侧边栏

| 字段 | 默认值 |
| --- | --- |
| `useOldTopBar` | `false` |
| `showTopBar` | `true` |
| `useOriginalBilibiliTopBar` | `false` |
| `autoHideTopBar` | `false` |
| `showTopBarThemeColorGradient` | `true` |
| `showBewlyOrBiliTopBarSwitcher` | `true` |
| `showBewlyOrBiliPageSwitcher` | `true` |
| `topBarIconBadges` | `number` |
| `openNotificationsPageAsDrawer` | `true` |
| `alwaysUseDock` | `false` |
| `autoHideDock` | `false` |
| `halfHideDock` | `false` |
| `dockPosition` | `right` |
| `dockItemVisibilityList` | `空数组` |
| `dockItemsConfig` | `空数组` |
| `disableDockGlowingEffect` | `false` |
| `disableLightDarkModeSwitcherOnDock` | `false` |
| `backToTopAndRefreshButtonsAreSeparated` | `true` |
| `sidebarPosition` | `right` |
| `autoHideSidebar` | `false` |

### 壁纸

| 字段 | 默认值 |
| --- | --- |
| `wallpaperMode` | `buildIn` |
| `wallpaper` | `空字符串` |
| `wallpaperAutoSwitch` | `false` |
| `enableWallpaperMasking` | `false` |
| `wallpaperMaskOpacity` | `80` |
| `wallpaperBlurIntensity` | `0` |
| `locallyUploadedWallpaper` | `null` |

### 搜索页外观

| 字段 | 默认值 |
| --- | --- |
| `searchPageDarkenOnSearchFocus` | `true` |
| `searchPageBlurredOnSearchFocus` | `false` |
| `searchPageLogoColor` | `themeColor` |
| `searchPageLogoGlow` | `true` |
| `searchPageShowLogo` | `true` |
| `searchPageSearchBarFocusCharacter` | `空字符串` |
| `individuallySetSearchPageWallpaper` | `false` |
| `searchPageWallpaperMode` | `buildIn` |
| `searchPageWallpaper` | `空字符串` |
| `searchPageEnableWallpaperMasking` | `false` |
| `searchPageWallpaperMaskOpacity` | `0` |
| `searchPageWallpaperBlurIntensity` | `0` |

### 链接打开行为 / 广告

| 字段 | 默认值 |
| --- | --- |
| `videoCardLinkOpenMode` | `newTab` |
| `topBarLinkOpenMode` | `currentTabIfNotHomepage` |
| `searchBarLinkOpenMode` | `currentTabIfNotHomepage` |
| `closeDrawerWithoutPressingEscAgain` | `false` |
| `blockAds` | `false` |
| `blockTopSearchPageAds` | `false` |
| `enableVideoCtrlBarOnVideoCard` | `false` |
| `hoverVideoCardDelayed` | `false` |

### AI 筛选

| 字段 | 默认值 |
| --- | --- |
| `aiFilterEnabled` | `false` |
| `aiBaseURL` | `空字符串` |
| `aiApiKey` | `空字符串` |
| `aiModel` | `gpt-4o-mini` |
| `aiUserPrompt` | `空字符串` |
| `aiFilterOnlyRecommended` | `false` |

### 推荐流过滤

| 字段 | 默认值 |
| --- | --- |
| `disableFilterForFollowedUser` | `false` |
| `filterOutVerticalVideos` | `false` |
| `enableFilterByViewCount` | `false` |
| `filterByViewCount` | `10000` |
| `enableFilterByDuration` | `false` |
| `filterByDuration` | `3600` |
| `enableFilterByTitle` | `false` |
| `filterByTitle` | `空数组` |
| `enableFilterByUser` | `false` |
| `filterByUser` | `空数组` |

### 上游既有设置（本次升级未改动）

| 字段 | 默认值 |
| --- | --- |
| `enableHorizontalScrolling` | `false` |
| `useOriginalBilibiliHomepage` | `false` |


## 四、已知限制与降级策略

### 通用

- **依赖 B 站页面结构**：各增强模块的选择器来自仓库既有样式与真机确认，B 站改版后可能失效；失效时模块会隐藏浮层或禁用对应开关（不报错、不破坏原生页面）。
- **未登录行为**：点赞 / 收藏 / 稍后再看 / 消息未读等写操作需要登录；未登录只提示，不发请求。
- **会话级偏好**：各原生页面板的密度 / 筛选 / 展开状态存在 `sessionStorage`，不跨标签页、不跨会话；设置页里的开关才持久化。
- **性能**：离屏优化 / 内容虚拟化只在支持的列表生效；极端长列表或低端设备仍可能掉帧。
- **可访问性**：暗色、高对比度、减少动态效果、键盘焦点均有适配，但未在全部主题与读屏软件组合下逐项实测。

### 各页面降级

- **首页 / 卡片**：悬停预览需要卡片数据带 `cid`，否则不预览（不发额外请求）；操作条未登录时只提示。
- **视频页**：影院 / 迷你播放器找不到播放器时对应按钮不生效；选集面板探测不到播放列表 / 分 P / 合集结构时入口不渲染。
- **列表页**：离屏优化关闭后恢复全量渲染；收藏夹管理需要登录，接口失败时 toast 并保持原状态。
- **搜索**：热搜接口失败 / 未登录时回落到内置词表；10 分钟缓存内不重复请求最新热搜。
- **动态页**：离屏优化在长列表更吃性能的取舍；只看视频时若整页无视频会限制自动补页并提示。
- **消息 / 空间 / 分区 / 直播**：页面结构不匹配时对应功能禁用/隐藏（如直播「隐藏侧栏」在真机结构下保持禁用）。
- **文章**：普通专栏 / OPUS 支持；旧专栏「跳转 OPUS」过渡页 5 秒内未跳转保持静默；移动版专栏只做兜底判定。
- **窄屏**：≤900 / ≤640px 已做换行与次要元素隐藏，但未在全部机型实测；部分工具条在窄屏会隐藏文字只留图标。
- **AI 筛选**：需要自备 OpenAI 兼容接口与 Key，卡片标题等公开信息会发送到你配置的 AI 服务；不配置则不启用。
- **图片兜底**：只在图片真正加载失败后显示占位，不重试；不能替代网络问题排查。

## 五、文档索引

- 功能与页面：[home-density](home-density.md)、[focus-browse](focus-browse.md)、[zen-mode](zen-mode.md)、[scroll-memory](scroll-memory.md)、[video-page](video-page.md)、[list-pages](list-pages.md)、[search-page](search-page.md)、[moments-page](moments-page.md)、[notification-page](notification-page.md)、[space-page](space-page.md)、[article-page](article-page.md)、[channel-page](channel-page.md)、[live-page](live-page.md)、[anime-search-pages](anime-search-pages.md)
- 卡片与交互：[video-card-preview](video-card-preview.md)、[video-card-quick-actions](video-card-quick-actions.md)、[keyboard-navigation](keyboard-navigation.md)、[keyboard-registry](keyboard-registry.md)
- 全局与工程：[settings-pages](settings-pages.md)、[i18n-modules](i18n-modules.md)、[accessibility](accessibility.md)、[responsive](responsive.md)、[fallback](fallback.md)、[feedback-states](feedback-states.md)、[performance](performance.md)、[design-tokens](design-tokens.md)、[native-pages-style](native-pages-style.md)、[testing](testing.md)