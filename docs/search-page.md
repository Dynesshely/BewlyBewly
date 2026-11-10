# 搜索结果页交互增强

B 站搜索结果页（原生 `search.bilibili.com`）不是 Bewly 接管页：页面仍由 B 站渲染，
本模块只在上面叠加一层**独立 shadow root** 的浮层，并给原生结果卡打标记，
提供 j/k 键盘浏览、密度切换与快速筛选。

- 入口：`src/contentScripts/searchPage/index.ts`
  （`setupSearchEnhance()` / `teardownSearchEnhance()`，非搜索页是空操作、重复调用幂等）
- 容器：`#bewly-search-enhance`（用 `src/contentScripts/nativeOverlay` 挂载，与 `#bewly` 互不嵌套）
- 增强层自身样式：`src/contentScripts/searchPage/searchEnhance.shadow.scss`（`?inline` 注入 shadow root）
- 作用于原生 DOM 的样式：`src/styles/adaptedStyles/pages/searchPage.scss` 末尾「第 3 轮」区域（只追加）
- 结果页 CSS 由 `src/styles/adaptedStyles/index.ts` 既有的 `searchPage` 分支注入，**不需要额外接线**

## 模块组成

| 文件 | 职责 |
| --- | --- |
| `index.ts` | 挂载 / 卸载浮层、恢复偏好、首次扫描、监听 DOM 变化、绑定键盘 |
| `dom.ts` | 所有依赖 B 站页面结构的查询（结果页判定、结果卡收集、标题 / 链接提取、焦点判断） |
| `actions.ts` | 状态持久化、结果卡打标、密度 / 筛选切换、j/k 高亮与打开、DOM 清理 |
| `keyboard.ts` | j/k / ↑↓ / Enter / Esc 的按键处理与让行规则 |
| `i18n.ts` | 模块内简中 + 英文文案（缺省回退简中），跟随 `settings.language` 实时切换 |
| `state.ts` | 浮层 UI 状态（面板开合、密度、筛选、结果计数、当前高亮） |
| `components/SearchEnhanceOverlay.vue` | 右下角浮动按钮 + 面板（密度 / 筛选 / 浏览状态 / 快捷键说明） |

## 浮层

- 右下角固定按钮「搜索结果增强」，带当前页结果条数小胶囊；点击展开面板
- 面板内容：密度（舒适 / 紧凑）、快速筛选（全部 / 仅视频 / 仅用户）、
  当前浏览状态（「第 x / y 条」+ 当前卡标题）、快捷键说明、底部说明文字
- 面板开合状态也记在 `sessionStorage`，同一标签页刷新后保持
- 按钮均为 `type="button"`，密度 / 筛选按钮用 `aria-pressed`，按钮用 `aria-expanded`，
  面板是 `role="dialog"` + `aria-label`；提示条是 `role="status" aria-live="polite"`

## j/k 键盘浏览

| 按键 | 行为 |
|---|---|
| `J` | 下一张结果卡 |
| `K` | 上一张结果卡 |
| `↑` / `↓` | 同 J / K（**仅当 Bewly 既有键盘导航没有接管这个按键时**） |
| `Enter` | 在新标签页打开当前卡（`window.open(href, '_blank')`） |
| `Esc` | 先关面板；面板关着时取消高亮 |

- 高亮 = `data-bewly-search-active` 属性 + 页面级 CSS 的主题色 2px 描边与 6px 光圈，
  同时 `scrollIntoView({ block: 'center' })` 把卡片滚到视口中央
- 到列表两端**循环**（最后一张再按 J 回到第一张）
- 打开后提示「已在新标签页打开」；卡片没有可用链接时提示而不是静默失败
- 不劫持按键的场景：焦点在搜索框 / 下拉框 / `contenteditable` 里；带 `Ctrl` / `Cmd` / `Alt` 的组合；
  带 `Shift` 的字母组合（那是 Bewly 的 `Shift + F` 等快捷键）；事件来自 `#bewly` 或本模块浮层；
  事件已经被别人 `preventDefault()`

### 与 Bewly 既有键盘导航共存

搜索页上 Bewly 已经有一套卡片键盘导航（`src/composables/useKeyboardCardNavigation.ts`，
原生页上作用在 `.bili-video-card` 上，用 `data-keyboard-active` 标记当前卡，负责 `↑/↓/Enter`）。
两套实现不能互相抢：

1. 既有导航在原生页上先注册 `keydown`，处理完会 `preventDefault()`；
   本模块注册在其之后，**一旦发现 `defaultPrevented` 就直接让行**，不会出现「按一次 ↓ 移动两格」
   或「Enter 打开两个标签页」；
2. 本模块用 J/K 移动高亮时，会**顺带把 `data-keyboard-active` / `aria-current` 挪到同一张卡**，
   于是接着按 `↑/↓` 时既有导航会从同一位置继续，两边共享同一个「当前卡」，不会出现两套高亮；
3. 既有导航关闭（设置里「键盘卡片导航」关掉）时，`↑/↓` 不再被它 `preventDefault`，
   本模块自动接管这两键，`Enter` 也由本模块负责打开。

这套同步是 best-effort：上游若改掉 `data-keyboard-active` 属性名，同步失效但不影响本模块功能。

## 密度切换

- 面板里「舒适 / 紧凑」两档，状态记在 `sessionStorage`（key：`bewly-search-density`）
- 切换时给 `<html>` 加 / 去 `bewly-search-compact`，页面级 CSS 收紧：
  结果网格行距 24px → 8px、卡片圆角 12px → 8px、标题从两行截断变一行（14px）、
  作者 / 日期字号降一档、UP 主卡内边距收紧、结果块之间的留白 32px → 16px
- 只改观感，不改栅格列数与断点

## 快速筛选

- 面板里「全部 / 仅视频 / 仅用户」，状态记在 `sessionStorage`（key：`bewly-search-filter`）
- 切换时给 `<html>` 加 `bewly-search-filter-video` / `bewly-search-filter-user`，
  页面级 CSS 按**结果卡类型标记**隐藏非目标结果：
  `html.searchPage.bewly-search-filter-video [data-bewly-search-kind="user"] { display: none !important; }`
  以及反向规则
- 为什么不是直接按类名隐藏：用户（UP 主）结果卡内部还有一层 `.bili-video-card` 小视频网格，
  直接隐藏 `.bili-video-card` 会把 UP 主卡掏空。所以由模块在扫描时区分**顶层结果卡**的类型
  （`.b-user-video-card` = 用户；`.bili-video-card` 且不在 UP 主卡内 = 视频），
  写成 `data-bewly-search-kind`，CSS 只按这个标记隐藏
- 当前页没有某一类结果时，对应按钮**禁用**并在面板里说明「当前页没有这类结果」；
  如果记忆里的筛选到新页面没有对应结果，自动回退「全部」并提示一次（只在确实识别到结果后判断，
  避免首屏没渲染完就把偏好冲掉）
- 隐藏只加 CSS，不删节点、不改 `display` 内联样式，切回「全部」立刻恢复

## 状态持久化

全部用 `sessionStorage`，不新增 settings 字段：

| key | 内容 |
| --- | --- |
| `bewly-search-density` | `comfortable` / `compact` |
| `bewly-search-filter` | `all` / `video` / `user` |
| `bewly-search-panel` | `1` / `0`（面板开合） |

存储被禁用（隐私模式等）时静默降级为「本次不记忆」，不影响功能。

## 结果卡识别

所有依赖 B 站页面结构的查询集中在 `dom.ts`，选择器来源：

- 视频结果卡：`.bili-video-card`（仓库既有 `searchPage.scss` 第 2 轮已确认的真实类名），
  兜底 `.video-list-item` / `.search-page-video`（`src/utils/nativeFilter.ts` 搜索页规则里已有的候选）
- 用户结果卡：`.b-user-video-card`（同上）
- 结果区根节点：`.search-content` → `.search-layout` → `#search-content` → `document.body`
- 排除区域：`.search-header` / `.bili-header` / `.search-tabs` / `.search-conditions` 等；
  UP 主卡内部的小视频网格也不算独立结果
- 标题：视频卡 `.bili-video-card__info--tit` / `h3` / `.title`；用户卡 `.user-name` 等
- 链接：视频卡 `a[href*="/video/"]`；用户卡 `a[href*="space.bilibili.com"]`，最后兜底卡内第一个链接

结果卡是异步渲染、滚动分页时不断追加的，所以：

- 挂载时扫一次，挂载后 800ms 再补扫一次；
- 用 `MutationObserver`（`childList + subtree`，300ms 去抖）监听整页新增节点后重扫；
- 重扫时保留原有高亮（元素还在就按元素找回序号），元素被移除则取消高亮；
- 扫描会给卡片写 `data-bewly-search-card` / `data-bewly-search-kind`，卸载时全部移除。

## 无障碍与动效

- 所有按钮 `type="button"`，有 `aria-pressed` / `aria-expanded` / `aria-label` / `title`；
  面板 `role="dialog"` + `aria-label`；提示条 `role="status" aria-live="polite"`
- `:focus-visible` 统一 2px 主题色描边
- 过渡 180ms、`cubic-bezier(.22,.61,.36,1)`；
  `prefers-reduced-motion: reduce` 时面板不做位移淡入、按钮与高亮不做过渡，
  滚动卡片改用 `behavior: 'auto'`
- 颜色 / 圆角 / 阴影全部走 `--bew-*` 变量，跟随主题色与 `.dark`

## Lead 需要接线

**无。** 搜索页样式注入沿用 `src/styles/adaptedStyles/index.ts` 既有的 `searchPage` 分支；
只需在 `src/contentScripts/index.ts` 的 `onDOMLoaded()` 里接上入口（Lead 统一处理）：

```ts
import { setupSearchEnhance, teardownSearchEnhance } from './searchPage'

// onDOMLoaded() 内，与 setupVideoPage() / setupNotificationPage() 并列
setupSearchEnhance()

// 需要热路径卸载时（正常页面卸载不需要显式调用）
teardownSearchEnhance()
```

`setupSearchEnhance()` 内部会自行判断是否搜索页，其它页面是空操作。

## 已知限制

- **只用 `sessionStorage`**：密度 / 筛选不跨标签页、不跨会话记忆，这是本轮简报的要求
  （不新增 settings 字段）。若要改成持久偏好，需要由 Lead 在 `src/logic/storage.ts` 里加字段并在
  设置页接线，本模块读 `sessionStorage` 的位置集中在 `actions.ts` 顶部，替换成本很低
- **筛选隐藏与既有键盘导航的边角**：筛选用 CSS 类隐藏（不用内联 `display`），
  而 Bewly 既有键盘导航用内联 `display` 判断可见性；因此在筛选生效时按 `↑/↓`，
  既有导航仍可能滚到一张被 CSS 隐藏的卡片。用 J/K 浏览不受影响（本模块会跳过隐藏卡）。
  彻底解决需要改既有导航的可见性判断，超出本工作流的文件所有权，未做
- **结果卡类型判定依赖类名**：如果 B 站把 `.b-user-video-card` 改名，用户卡会被判成视频卡
  （J/K 仍可用，但「仅用户」筛选会失效并在面板里禁用该选项）。改版时只需改 `dom.ts`
- **没有右侧栏适配**：第 2 轮已经记录过，线上搜索页快照里没有稳定的右侧栏类名，
  本轮的快速筛选只作用于结果列表
- **未在真实浏览器里验证**：按分工由 Lead 统一构建与回归；本轮只做了 sass 单文件编译、
  eslint 与 `pnpm run typecheck`

## 自测记录

- `sass` 单文件编译：`searchPage.scss`（含 `@use "native-shared"`）与
  `searchEnhance.shadow.scss` 均编译通过（0 error）
- `pnpm exec eslint src/contentScripts/searchPage src/styles/adaptedStyles/pages/searchPage.scss`：
  0 error 0 warning
- `pnpm run typecheck`（`vue-tsc`）：0 error
- 未修改 `App.vue` / `contentScripts/index.ts` / `storage.ts` / `_locales` / `nativeOverlay` /
  `main.scss`；未跑 build / playwright；未启动浏览器；未做 git 操作

---

## 附：Bewly 搜索起始页「真实热搜」（第 11 轮 A）

> 本文档主体描述的是**原生搜索结果页**的增强浮层（`src/contentScripts/searchPage/`）。
> 本附节记录的是 **Bewly 搜索起始页**（`src/contentScripts/views/Search/`）的第 11 轮改动，
> 两者是不同页面/不同模块，互不依赖。

### 1. 真实热搜数据来源

- 接口：`api.search.getHotSearchWords()`（Lead 已加在 background，只读）
  → `https://s.search.bilibili.com/main/hotword`；
- 实际结构：`res.data.trending.list[]`，条目里通常有 `keyword`（检索词）与 `show_name`（展示名）；
- **防御式解析**（`composables/useHotSearch.ts` 的 `parseHotSearchResponse`）：
  - 优先 `show_name`，回退 `keyword`，两者都为空就跳过；
  - `list` 不是数组 / 条目不是对象 / 重复词全部跳过；
  - 最多取 12 条；一个有效词都没解析出来就视为失败；
  - 不新增任何接口、不修改 background。

### 2. 展示与「换一批」

- 面板「热门搜索」区显示 **8 条**（池子里最多 **12 条**）；
- 「换一批」把展示窗口在 12 条池里后移 8 条并循环，例如第二批显示第 9–12 名 + 第 1–4 名；
  **序号仍然是真实热搜排名**，不重新编号；
- 序号徽标：胶囊左侧 18px 小徽标，**前三名用主题色**（`--bew-theme-color` / `--bew-theme-color-10`），
  其余用 `--bew-fill-2` + `--bew-text-3`；
- 「换一批」在池子不足 8 条或请求中时禁用（`disabled` + `title`）。

### 3. 回落与缓存

| 情况 | 行为 |
| --- | --- |
| 请求成功且解析出 ≥1 条 | 显示真实热搜；写入内存缓存；底部提示「来自 B 站实时热搜 · 结果缓存 10 分钟」 |
| 请求失败 / `code !== 0`（含未登录）/ 返回空 / 结构异常 | 回落到内置词表（12 条，按当前语言），仍显示 8 条；底部提示「热搜加载失败或未登录，已回落到内置词表」并给「重试」 |
| 缓存命中（10 分钟内） | 直接用缓存，不重复请求 |

- 缓存：模块级内存 `setTimeout`-free 时间戳缓存，TTL **10 分钟**（`HOT_SEARCH_CACHE_TTL`）；
  只在成功时写入，**失败结果不缓存**，下次进搜索页会重新尝试；
- 刷新页面 / 收起再打开扩展会重置内存缓存；
- 提供 `clearHotSearchCache()` 供调试 / 将来设置页「刷新热搜」复用。

### 4. 搜索体验收尾

- **直达粘贴提示的 Escape**：页面内粘贴 BV 号 / 链接出现「已识别…，正在打开」提示后，
  按 `Esc` 会立即清掉提示与自动消失计时器（此前只能等 2.6 秒自动消失）；
  监听挂在 `window` 的 keydown（不 preventDefault，不影响搜索框自己的 Esc 行为），组件卸载时解绑并清理计时器。
- **窄屏不溢出**（≤640px）：
  - 快捷面板 `max-width: 100%`、padding 20 → 16px；
  - 胶囊 `max-width: 100%`、文本 `min-width: 0` + 省略号，长热词不会撑破；
  - 直达表单 `flex-wrap`：输入框独占一行、按钮下一行居中；
  - 粘贴开关文案允许换行，标题行顶部对齐；
  - 搜索起始页 `margin-top: 14vh → 8vh`、左右留 12px，logo 与面板间距收窄。

### 5. 文件清单

- 新建 `src/contentScripts/views/Search/composables/useHotSearch.ts`：接口请求、防御式解析、10 分钟内存缓存、回落词池；
- 修改 `src/contentScripts/views/Search/components/SearchQuickPanel.vue`：
  真实热搜展示、序号徽标（前三主题色）、换一批轮换、来源提示 / 重试、窄屏样式；
- 修改 `src/contentScripts/views/Search/Search.vue`：Escape 清理粘贴提示、窄屏布局；
- 修改 `src/contentScripts/views/Search/i18n.ts`：`hot_title` 改为「热门搜索」，新增 `hot_retry` /
  `hot_source_remote` / `hot_source_fallback`（移除旧的 `hot_hint`）。

### 6. 已知限制

- 热搜接口未登录也可能可用，但若被风控拦截或返回空，会走回落词表（不报错、不空白）；
- 10 分钟缓存内「换一批」只是在已取回的 12 条里轮换，**不会重新请求**最新热搜；
- 池子只有 12 条，第二批必然与第一批有 4 条重叠；
- 请求期间先显示内置词表（没有骨架屏），拿到结果后原地替换；
- 热搜请求失败时，既有 API 客户端会触发一次全局「请求失败」提示条（3 秒）——这是基础设施行为，
  本模块自身不弹任何错误；失败结果不缓存，10 分钟外的下一次进入会重试；
- 未在浏览器中实测（按分工由 Lead 统一构建与回归）；本轮自测仅 eslint + typecheck。

### 7. 自测记录

- `pnpm exec eslint src/contentScripts/views/Search`：0 error 0 warning；
- `pnpm run typecheck`（`vue-tsc`）：**0 error**；
- 未跑 build / playwright；未碰浏览器；未做 git 操作。
