# 番剧页 / 搜索起始页 / 动态占位页（第 1 轮）

本轮由 `anime-search` 子智能体交付，对应设计简报 C 节。三块都是 Bewly 自己的视图，
挂在 `views/App.vue` 的 `pages` 表里，**没有改动 App.vue / contentScripts/index.ts / storage.ts / _locales**。

## 交付范围

| 模块 | 目录 | 说明 |
| --- | --- | --- |
| 番剧页 | `src/contentScripts/views/Anime/**` | 时间表整体重做；其余板块（追番 / 热播榜 / 推荐）保留原有数据流 |
| 搜索起始页 | `src/contentScripts/views/Search/**` | 最近搜索 + 热门推荐词 + BV 号 / 链接直达 |
| 动态占位页 | `src/contentScripts/views/Moments/**` | 替换 `Moments (WIP)`，给出骨架 + 说明 + 原生页入口 |

## 番剧时间表

### 布局

`AnimeTimeTable.vue` 从「七列平铺」改成三段式：

1. **一周时间轴条**：7 个日格（星期 + 日期 + 当日更新数），选中日高亮（主题色下划线 + 卡片底），
   今天额外带「今天」徽标与主题色星期文字；无更新的日子降透明度。
2. **当日主推大卡**：16:9 剧集封面 + 「当日主推 / 今日主推」角标 + 星期/日期/当日更新数、
   剧集标题、更新时刻 / 集数 / 追番数 / 延期原因标签、主 CTA「去看」与「在新标签页打开」，
   以及当日其余更新的缩略列表（可滚动，最多 168px 高）。
3. **其余日卡片流**：其余 6 天以卡片网格呈现（星期 + 日期 + 更新数 + 前 3 部的时刻与标题 + `+N`），
   点卡片即把该日切成主推日。

时间表排在番剧页第一位（原本在追番/热播榜之后），让「这周看什么」成为页面入口。

### 键盘

时间表整块是 `tabindex="0"` 的 `role="group"`，日期条是 `role="tablist"` + roving tabindex：

| 键 | 行为 |
| --- | --- |
| `←` / `→` | 前一天 / 后一天，并把焦点移到新的日格 |
| `Home` / `End` | 跳到周一 / 周日 |
| `Enter` | 焦点在整块区域（不是子控件）时，在新标签页打开当日主推番剧 |
| `Tab` | 在日期条、主推 CTA、当日其余更新、其余日卡片之间移动 |

- 组件内自带「键盘操作」折叠面板（`components/AnimeTimeTable.vue` 里的 `helpOpen`），列出上述按键；
- 处理的按键都会 `preventDefault + stopPropagation`，不会和全局卡片导航抢方向键；
- 选中日变化时通过 `aria-live="polite"` 播报「星期 · 日期 · 今日 · 主推标题」；
- 今天高亮与「回到今天」按钮（已经是今天时禁用）。

### 数据

- 仍然只调 `api.anime.getAnimeTimeTable()`，没有改 API 语义，也没有新增接口；
- 首次加载自动定位到今天（没有 `is_today` 时退化为第一个有更新的日子）；
- 失败时给出可重试的空状态，加载中给出骨架；
- `refreshAnimeTimeTable()` 通过 `defineExpose` 暴露，`Anime.vue` 的页面刷新逻辑照旧调用它。

## 搜索起始页

### 结构

`Search.vue` 保留原来的居中 Logo + `SearchBar`，下方新增 `components/SearchQuickPanel.vue`：

1. **最近搜索**：复用 `components/SearchBar/searchHistoryProvider` 的同一份 B 站搜索历史
   （只读 + 清空，不另开存储），最多显示 8 条；没有历史时给引导文案。
2. **热门推荐词**：内置策展词（简中/英文各 12 个，显示 8 个），「换一批」重排；
   点击走 B 站搜索并写入搜索历史。
3. **直达**：输入框 + 「打开」按钮，支持
   - BV 号（`BV` + 10 位）、av 号、番剧 `ss`/`ep` 号；
   - B 站链接（含分享文案里的链接、`//` 协议相对链接、`b23.tv` 短链、`space.` / `live.` / `t.` 子域）；
   - 输入时实时预览「已识别为 BV 号：BVxxxx」，回车即打开。

### 页面内粘贴直达

在搜索起始页**任意位置**粘贴内容时会先尝试解析：

- 命中 BV 号 / av 号 / 番剧号 / B 站链接 → `preventDefault`，直接打开目标，并在搜索栏下方
  给出 2.6 秒的「已识别 BV 号，正在打开」提示，内容不会落进搜索框；
- 不是直达目标 → 不干预，按普通粘贴处理（例如粘贴一串中文关键词）。

开关在面板里（「页面内粘贴直达时自动直达」），存在 `localStorage` 的
`bewly-search-direct-paste`（默认开启）。打开方式的复用 `settings.searchBarLinkOpenMode`
（新标签页 / 当前标签页 / 首页外当前标签页），不新增设置项。

只接受 B 站域名，其他 URL 一律按关键词处理，避免把任意链接当跳转目标。

## 动态占位页

`Moments.vue` 替换掉原来的 `Moments (WIP)`：

- 顶部标题 + 「占位页」徽标 + 一句话说明 + 「打开原生动态页」主按钮（`https://t.bilibili.com`，新标签页）；
- 中间是与最终信息结构一致的三张骨架卡（头像 + 昵称/时间 + 正文行 + 图片/视频占位 + 点赞/评论/转发条），
  纯 CSS 骨架，不做假数据；
- 右侧说明卡：为什么是占位（动态流依赖 B 站原生时间线接口与长列表虚拟滚动）、
  计划中的形态（分组 + sticky 分段控件、卡片复用首页节奏、详情走抽屉）、以及原生页入口。
- 骨架动画与所有过渡都遵守 `prefers-reduced-motion: reduce`；按钮可 Tab 到达并有 `focus-visible` 描边。

## i18n

三个模块各自有 `i18n.ts`，导出 `MESSAGES = { 'cmn-CN': {...}, 'en': {...} }` 与 `useXxxI18n()`：

- 语言取 `settings.value.language`，只有 `en` 走英文，其余（含空值 / `cmn-TW` / `jyut`）回退简中；
- 支持 `{name}` 形式的参数插值；
- **没有改 `src/_locales`**，原有 `$t('anime.xxx')` 文案保持不变；
- 新增文案全部走模块内 i18n，没有硬编码中文；骨架只画结构，不塞假数据文案。

## 样式与可访问性

- 颜色只用 `--bew-*` 变量（主题色、`--bew-elevated`/`--bew-elevated-alt`、`--bew-fill-1..4`、
  `--bew-text-1..4`、`--bew-border-color`、`--bew-shadow-1/2`、`--bew-skeleton`、`--bew-radius`），
  没有硬编码十六进制颜色，暗色模式随变量自动适配；
- 圆角：外层卡片 `var(--bew-radius)`，内部控件 8–12px；内边距 12/16/20 三档；
- 动效 180–200ms，`cubic-bezier(.22,.61,.36,1)`，三块都写了 `prefers-reduced-motion: reduce` 降级；
- 所有新增可点区域都是原生 `button` / `a`，或带 `role`+`tabindex`+`Enter/Space` 的卡片，
  统一有 `focus-visible` 描边；
- 中文标题 `text-wrap: balance`，正文没有 `text-align: justify`。

## Lead 需要做的接线

1. **（可选）把粘贴直达开关并入 `storage.ts`**：建议字段
   `searchPageDirectPasteEnabled: boolean`（默认 `true`），迁移后把
   `views/Search/composables/useDirectPasteSetting.ts` 里的 `useStorage('bewly-search-direct-paste')`
   换成该字段，并可在「设置 → 搜索页」加一个开关。
2. **（可选）快捷键帮助面板补番剧行**：全局 `? 快捷键帮助`（`components/KeyboardShortcutHelp.vue`）
   属于共享组件，本轮没有改；建议补一行「番剧时间表 `← / →` 切日」。
   时间表已自带模块内快捷键面板，不补也能发现。
3. **（可选）热门推荐词接真实热词接口**：本轮没有新增 `getHotSearch` 一类接口，
   策展词在 `views/Search/i18n.ts` 的 `HOT_KEYWORDS`；若要真实热词，可在
   `background/messageListeners/api/search.ts` 增加一个接口后把 `hotKeywords` 换成接口数据。
4. 无需改动 `App.vue`：三个视图都还是按 `AppPage` 异步加载的原有方式挂载。

## 自测与门禁

- `pnpm exec eslint <本轮改动文件> --fix` 后再跑一次：**0 error 0 warning**；
- `pnpm run typecheck`：**0 error**；
- 未运行 `pnpm build` / `pnpm pack` / `playwright test`，未做任何 git 操作，未启动或关闭浏览器。

## 已知限制

- 热门推荐词是**本地策展词**，不是真实热榜（原因见上）；
- 番剧时间表的主推取当日第一部更新的剧集，没有做「按追番状态 / 想看优先级排序」；
- 时间表没有做「同一天内跨时段（凌晨 / 中午 / 深夜）分组」，保持单列按接口顺序；
- 搜索直达不解析 UID 数字、番剧 `md` 号裸号（只有链接才行）；
- 动态页只是占位：不请求动态接口，也不嵌入 iframe（跨域与登录态限制多，本轮明确不做）；
- 最近搜索依赖 B 站 `search_history` 的 cols iframe；原生搜索页没有该 iframe 时会显示空态引导（600ms 超时兜底，不会卡住）。
