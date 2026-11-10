# 动态页（Moments）

第 2 轮把 `src/contentScripts/views/Moments/Moments.vue` 从第 1 轮的占位骨架替换成**真实动态流**：
关注时间线的无限流卡片、九宫格图片、图片大图预览、正文折叠、互动数展示与键盘浏览。

## 文件结构

```
src/contentScripts/views/Moments/
├── Moments.vue                     # 页面：页头、状态（骨架/空态/错误）、列表、加载更多、大图
├── i18n.ts                         # 模块内 i18n（cmn-CN / en），含数字与相对时间格式化入口
├── types.ts                        # 视图模型（MomentCard）+ 接口原始类型（只声明用到的字段）
├── utils/
│   ├── normalize.ts                # 原始条目 → MomentCard，逐条容错
│   └── format.ts                   # 紧凑数字、相对时间
├── composables/
│   ├── useMomentsFeed.ts           # 分页数据层：首屏 / 触底加载 / 刷新 / 重试
│   ├── useMomentsOpen.ts           # 打开行为（视频遵循 settings.videoCardLinkOpenMode）
│   └── useMomentsShortcuts.ts      # j/k/↑/↓/o/Esc
└── components/
    ├── MomentCard.vue              # 卡片：作者行 → 正文（4 行折叠）→ 媒体 → 互动条
    ├── MomentMedia.vue             # 视频 / 图文九宫格 / 专栏 / 直播
    ├── MomentSkeleton.vue          # 首屏骨架
    └── MomentLightbox.vue          # 图片大图预览
```

写死范围外没有改动任何文件。

## 数据来源

- 接口：`api.moment.getMoments({ type: 'all', offset, update_baseline })`
  （定义在 `src/background/messageListeners/api/moment.ts`）。
- 鉴权：沿用页面 Cookie，无需额外接线；未登录时接口返回 `code = -101`，
  页面直接给出「动态流需要登录 B 站后才能加载」的错误态。
- 分页：首次请求不带 `offset`，之后把上一页返回的 `data.offset` 原样回传；
  `data.has_more === false` 时停止加载。跨页重复的 `id_str` 会被去重。

## 卡片类型与布局

| 卡片 | 判定（`module_dynamic.major`） | 展示 |
|---|---|---|
| 视频 | `archive` | 横向缩略卡：16:9 封面 + 时长角标 + 标题 2 行 + 播放/弹幕 |
| 番剧 | `pgc` | 同上，角标显示接口给的 badge（缺省「番剧」） |
| 图文 | `draw.items` / `opus.pics` | 九宫格：1 图大图（按原始比例、限高 420px）、2–4 图两列、5–9 图三列 |
| 专栏 | `article` | 横向卡：封面 96×96 + 标题 2 行 + 摘要 2 行 |
| 直播 | `live_rcmd`（含 JSON content）/ `live` | 16:9 封面 + LIVE 角标 + 标题 + 分区/在看人数 |
| 转发 | 顶层 `orig` / `DYNAMIC_TYPE_FORWARD` | 正文下方内嵌原动态（compact 变体，递归渲染一层）；原动态已删除时显示占位提示 |
| 纯文字 | 只有 `desc.text` | 作者行 + 正文 + 互动条 |
| 其它 | 课程、横幅等 | 有正文时按纯文字展示，完全无内容则整条丢弃 |

媒体之外的信息层级固定为：**作者行（头像 / 昵称 / 标签 / 动作 · 类型角标 / 时间）→ 正文 →
媒体 → 互动条（转发 / 评论 / 点赞 + 「打开原动态」）**。

正文默认折叠 4 行，超出时出现「展开 / 收起」；折叠用 `scrollHeight > clientHeight` 实测判断，
不靠字数估算。

## 交互

| 操作 | 行为 |
|---|---|
| 点击图片 | 打开大图预览（`MomentLightbox`），支持 Esc 关闭、`←/→` 切换、点击遮罩关闭 |
| 点击视频 / 番剧卡 | 按 `settings.videoCardLinkOpenMode`（drawer / newTab / currentTab）打开，与首页 `VideoCard` 一致 |
| 点击专栏 / 直播 / 「打开原动态」 | 新标签页打开 |
| 点击头像 / 昵称 | 新标签页打开 UP 空间 |
| `j` / `↓`、`k` / `↑` | 上下一张卡片，高亮描边；接近列表末尾会自动预取下一页 |
| `o` | 打开当前高亮卡片（无高亮时取第一张） |
| `Esc` | 取消高亮（大图打开时由大图关闭） |
| 触底 | App.vue 的 `handleReachBottom` 哨兵 + 本页列表末尾的 `IntersectionObserver`（`rootMargin 320px`）双保险；键盘浏览到末尾也会预取 |

键盘处理规则：

- 先看 `event.defaultPrevented`，全局快捷键（App 层的键盘导航 / 聚焦浏览）已经处理过的按键
  一律让行；`Ctrl/Meta/Alt` 组合、输入框内、聚焦浏览模式、大图打开时都不接管；
- 自己处理过的按键都会 `preventDefault`，避免方向键滚动页面；
- 卡片不使用 `data-video-card` 属性，因此不会触发首页卡片导航（`useKeyboardCardNavigation`）的
  方向键 / Enter / Space 接管。

## 状态

| 状态 | 表现 |
|---|---|
| 首屏加载 | 3 张骨架卡（`MomentSkeleton`） |
| 首屏失败 / 未登录 | 错误态：标题 + 接口 message + 「重试」 |
| 空列表 | 标题 + `Empty` 插画 + 说明 + 「重试」 |
| 刷新 | 刷新按钮 / Dock 刷新：保留旧列表直到新数据回来（列表为空时才回到骨架） |
| 加载更多失败 | 列表底部「加载更多失败」+「重试」，不打断已加载内容 |
| 没有更多 | 列表底部「没有更多动态了」 |

## i18n

文案全部在 `i18n.ts` 内（cmn-CN / en 两份），按 `settings.language` 切换，缺省回退简中。
数字（`1.2万` / `12.3K`）与相对时间（`3 小时前` / `3 h ago`）也在模块内格式化，
不依赖 `src/_locales`。切换语言后卡片上的时间/数字会随渲染重新计算。

## 容错

- 单条解析失败只丢这一条（`normalizeMoments` 逐条 try/catch）；
- 接口返回整页「不可见」条目时，首屏会自动再补一页，避免误判成空列表；
- 加载更多失败后不会自动重试（防止滚动 / 键盘浏览时刷请求），需要用户点「重试」；
- 请求超时由 `utils/api.ts` 统一兜底（返回 `undefined`），这里按失败处理。

## 无新增设置项

本模块只读取既有设置：

- `settings.language`（文案）
- `settings.videoCardLinkOpenMode`（视频卡打开方式）

不需要新增 `storage.ts` 字段，也不需要改 `_locales`。

## Lead 需要接线

无。页面入口仍是 `App.vue` 里既有的 `[AppPage.Moments]: defineAsyncComponent(() => import('./Moments/Moments.vue'))`，
面包屑 / Dock 入口不变；`handlePageRefresh` / `handleReachBottom` 通过既有的 `BEWLY_APP` provide 注入，
不需要改 `App.vue`。

## 已知限制

1. 正文按纯文本渲染（`desc.text`），没有解析富文本节点里的 @、表情图片与话题链接；
   需要图片表情时可后续接 `rich_text_nodes`。
2. 转发只渲染一层原动态；原动态里再嵌套转发的极端情况会被当作纯文字。
3. 接口 `type` 固定为 `all`（关注 + 推荐混合），未提供「仅关注 / 仅转发 / 仅视频」的分组切换。
4. 未做列表虚拟滚动；单页 20 条左右、靠图片懒加载与 `data-moment-id` 定位，长时间滚动后
   DOM 数量会增加（B 站原版同样如此）。
5. 互动数只读展示，不提供点赞 / 转发 / 评论写操作（本轮明确不做写操作）。
6. 时长、播放量等字段直接透传接口给出的字符串（如 `12.3万`），不再二次格式化。

## 第 3 轮增强（卡片密度 / 只看视频 / 复制正文 / 图片下载）

四项都是**只读操作**：不调用任何 B 站写接口、不上传数据、不改动态内容。

### 卡片密度（舒适 / 紧凑）

- 工具条里的「舒适 / 紧凑」分段控件，密度存 `localStorage` 的 `bewly-moments-density`
  （取值 `comfortable` / `compact`，缺省 `comfortable`）；刷新页面、切走再回来都会保持。
- 紧凑档变化：卡片内边距 `16px 20px` → `12px 16px`、头像 44 → 36px、**正文折叠 4 行 → 2 行**、
  视频/直播封面 200 → 150px、专栏封面 96 → 72px、九宫格单图 420 → 320px（2–4 图与 5–9 图最大宽度同步收窄）、
  首屏骨架同步收窄。
- 转发卡内嵌的原动态始终用更小的「引用」样式，不随密度再缩。

### 只看视频

- 工具条右侧的筛选胶囊，过滤出 `video` 与 `pgc`（视频 / 番剧）卡片。
- **与键盘浏览兼容**：`j` / `k`、`↑` / `↓` 只在过滤后的列表里移动，预取下一页也按过滤后列表的末尾触发；
  切换筛选时按「当前高亮卡片的 id」在新列表里重新定位，原卡片不在筛选结果里就清空高亮。
- 当前一屏没有视频卡时，列表位置显示「当前筛选下还没有视频动态」空态 + 「关闭筛选」按钮；
  底部「加载更多」/ 滚动触底仍会继续拉后续页。
- 筛选状态只存内存（不写 localStorage），刷新页面后回到「全部」。

### 复制正文

- 每张卡片的互动条右侧新增「复制正文」（正文为空时不显示该按钮）。
- 优先 `navigator.clipboard.writeText`，失败回退隐藏 `textarea` + `document.execCommand('copy')`；
  按钮就地变为「已复制」/「复制失败」，1.6s 后恢复。
- 只复制正文文本本身（不含作者、链接、互动数）；转发卡复制的是转发理由，不含原动态内容。

### 图片下载

- lightbox 底部新增「下载图片」按钮：先 `fetch` 成 blob 再触发浏览器下载，文件名
  `bilibili-moments-<时间戳>-<序号>.<扩展名>`，使用不带 `@` 尺寸后缀的原图。
- B 站图床是跨域地址，`<a download>` 会被浏览器忽略（退化成导航），所以走 blob 方案；
  `fetch` 失败（CORS / 离线 / 非图片响应）时自动在新标签页打开原图，并显示
  「下载失败，已在新标签页打开原图」。
- 下载中按钮禁用并显示旋转图标，遵循 `prefers-reduced-motion`。

### 第 3 轮新增文件

- `composables/useMomentsDensity.ts` —— 密度偏好（模块级单例 + localStorage 持久化）
- `utils/clipboard.ts` —— 复制文本 + execCommand 回退
- `utils/download.ts` —— 图片 fetch-blob 下载 + 扩展名推断

## 第 8 轮增强：离屏优化（虚拟列表）

> 只改「列表渲染与离屏样式」，**没有改 `MomentCard.vue`**（同一目录下另有「动态页点赞」工作流在改它），
> 也没有改 `i18n.ts` / `useMomentsFeed.ts`（同样由点赞工作流占用）。
> 开关文案放在独立的小字典 `composables/useVirtualListI18n.ts`，避免并发写同一个 i18n 文件。

### 目标

长列表（1000+ 条）时只让视口附近的卡片真正渲染，离屏卡片**保留 DOM**（不卸载），
图片状态、正文展开状态、点赞等局部状态都不会丢；同时滚动条高度保持稳定。

### 实现

新增 `composables/useVirtualList.ts`（轻量虚拟列表，不定高、不卸载节点）：

1. **两个 IntersectionObserver 划分区间**（`root` = App 的 `.bewly-scroll-container`）：
   - 活跃带：`rootMargin: "150% 0px"` → 视口上下各 1.5 屏；
   - 缓冲区：`rootMargin: "300% 0px"` → 视口上下各 3 屏。
   用 `rootMargin` 的百分比而不是手算偏移量，天然适配不定高卡片，也不依赖整体高度测量。
2. **按区间给卡片根节点写内联样式**（只写这两个属性，不碰其它内联样式与类名）：

   | 位置 | content-visibility | 说明 |
   | --- | --- | --- |
   | 当前 j/k 高亮卡 | `visible` | 强制正常渲染，scrollIntoView 一定落到真实位置 |
   | 活跃带内 | `visible` | 正常渲染 |
   | 缓冲区（1.5–3 屏） | `auto` | 浏览器跳过离屏渲染，仍参与布局 |
   | 3 屏以外 | `hidden` | 跳过渲染与布局，但 DOM 与内部状态完整保留 |

   三种状态都写 `contain-intrinsic-size: auto <高度>px`，用记住的真实高度占位，避免滚动条跳动。
3. **高度来源**：进入活跃带的卡片用**一个共享的 ResizeObserver** 量真实高度并按 index 缓存；
   从未进过活跃带的卡片用估算高度（320px）兜底，进入活跃带后立刻换成真实高度。
   卡片本身不改，只在列表层用 ResizeObserver 量根节点。
4. **不卸载、不重排**：所有卡片始终由 `v-for="visibleCards"` 渲染，DOM 顺序、key、事件、
   组件状态都不变；虚拟化只控制「渲染不渲染内容」。
5. **性能取舍**：没有使用 `will-change` —— 它是会持续占用合成层的提示，给上千张卡片加
   `will-change` 反而更吃内存 / 合成开销；这里靠 `content-visibility` 的 contenment +
   `contain-intrinsic-size` 达到跳过渲染的目的（文档留档，避免后续被误加回去）。

### 开关

- 工具条右侧新增「离屏优化」胶囊（原生 `<button type="button">`，`aria-pressed` + `title` 说明，Tab 可达），
  与「只看视频」并排；
- 状态存 `localStorage` 的 `bewly-moments-optimize`（`1` / `0`，缺省开启）；
- **关闭时**：断开两个观察器 + ResizeObserver，移除所有卡片上的 `content-visibility` /
  `contain-intrinsic-size`，完全退回改动前的「全部渲染」行为。

### 与既有功能的兼容

| 功能 | 为什么不受影响 |
| --- | --- |
| j/k / ↑↓ 高亮 | 高亮卡被强制 `visible`；`useMomentsShortcuts.scrollIntoView` 对 `hidden` 卡片也有盒模型，能正确滚到位 |
| 只看视频筛选 | 过滤后的列表仍是同一批 `key`，函数 ref 在重排时重新注册 index；筛选逻辑本身未改 |
| 无限加载 | 新卡片挂载时由函数 ref 注册并立即写入当前状态；观察器只增不减，不重建列表 |
| 图片大图 | lightbox 是列表外的独立组件，与卡片渲染状态无关 |
| 卡片密度 | 密度切换后调用 `resetMeasurements()` 清掉旧高度，进入活跃带时重新测量 |
| 展开 / 收起正文 | 展开是卡片内部状态；`content-visibility` 不重挂组件，状态保留 |

### 新增文件

- `composables/useVirtualList.ts` —— 区间观察 + 内联样式写入 + 高度测量
- `composables/useVirtualListI18n.ts` —— 开关的 3 个文案 key（cmn-CN / en）

### 已知限制

- `content-visibility: hidden` 的卡片不在无障碍树里，读屏用户快速跳转时只会读到视口附近的卡片
  （虚拟列表的通用取舍；卡片本身没有可聚焦元素，j/k 高亮卡始终可见）；
- 从未滚动到过的卡片用 320px 估算高度，首屏的滚动条总高度是近似值，滚到附近后自动校正；
- 浏览器需支持 `content-visibility`（Chromium 85+ / Firefox 125+ / Safari 18+）；
  不支持时该属性被忽略，功能退化为「全部渲染」，不报错；
- 观察器随「列表长度变化」整体重新 observe 一遍（每加载一页一次），1000 条量级下的开销可忽略；
- 本轮不处理转发卡内部嵌套的原动态（它随外层卡片一起显隐）。

## 第 8 轮：点赞写操作

互动条里的「点赞」由只读计数变成可点的真实操作（整个模块里**唯一**的写操作，转发 / 评论仍不做）。

- **接口**：`api.moment.likeMoment({ dyn_id_str, up, csrf })`，`dyn_id_str` 取卡片的 `id`
  （即接口返回的 `id_str`），`up: 1` 点赞 / `2` 取消，`csrf` 用 `getCSRF()`。
- **登录判断**：点击时先看 `getUserID()` 与 `getCSRF()`；没有就只给
  「需要先登录 B 站才能点赞」的警告 toast，**不发请求**。接口返回 `-101` 时按未登录处理并回滚。
- **乐观更新**：点击后立刻切换高亮（实心红心）与计数 `+1 / -1`（计数不会小于 0），
  再发请求；失败（`code !== 0`、网络异常、接口无响应）一律回滚到点击前的值并 toast
  （优先用接口 message，没有就用「点赞失败，请稍后重试」）。成功 toast「已点赞 / 已取消点赞」。
- **防重复提交**：同一张卡在请求期间按钮 `disabled` + `aria-busy`，重复点击不会并发写。
- **点赞态来源**：列表首次加载时读取接口的 `module_stat.like.status`（已赞的官方状态），
  之后由本地乐观更新维护；刷新页面会重新以接口返回为准。
- **键盘可达**：点赞是原生 `<button type="button">`，Tab 可聚焦、Enter / Space 触发；
  点击用 `.stop` 阻止冒泡，不会触发卡片点击或 j/k 高亮；`aria-pressed` 暴露当前状态。
- **只读边界**：除点赞外没有任何写接口调用；点赞失败不会影响卡片其它交互（打开、复制、图片放大）。

### 第 8 轮改动文件

- `components/MomentCard.vue` —— 互动条点赞按钮（高亮态、pending 态、无障碍属性）
- `composables/useMomentLike.ts`（新增）—— 点赞请求、乐观更新、回滚、toast、防并发
- `composables/useMomentsFeed.ts` —— 新增 `toggleLike` / `isLikePending` 列表侧入口
- `types.ts`、`utils/normalize.ts` —— `MomentStats.liked` 与 `module_stat.like.status` 解析
- `i18n.ts` —— 点赞相关文案（cmn-CN / en）
