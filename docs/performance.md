# 性能优化记录

## 首屏基线

`tests/e2e/perf.spec.ts` 会记录：

- `#bewly` Shadow DOM 挂载耗时（从导航开始到宿主节点出现）；
- 首屏视频卡片出现耗时。

运行：`pnpm exec playwright test tests/e2e/perf.spec.ts`（报告里查看 `perf` annotation）。
当前实测（fixture 页面，本机）：挂载约 1.5–2s，首屏卡片约 2–3s。

## 已完成的优化

- 页面级样式按页注入：主 `style.css` 约 583 KB → 394 KB，页面样式按 URL 动态加载。
- 内置字体子集化：`ShangguSansSC-VF` 9.79 MB → 1.86 MB，扩展总包约 4.2 MB。
- 封面 `loading="lazy"` + `aspect-video` 固定比例，减少 CLS。
- 卡片使用 `content-visibility: auto` + `intrinsic-size` 跳过屏外渲染。
- 触底加载改为 `IntersectionObserver` 哨兵（移除滚动阈值计算）。
- 修复 `queryDomUntilFound` 的 `setInterval` 泄漏（改 MutationObserver）。
- TopBar / OldTopBar 的未读轮询定时器在卸载时清理；App 的 window scroll 监听改为命名函数并在卸载时移除。

## 接管页原版脚本拦截

在首页、空间、历史、消息、动态等被 Bewly 完全接管的页面，原版 B 站页面虽被隐藏，
但整套脚本仍会执行（渲染节点、轮询推荐、上报埋点、加载 iframe）。现在：

- `document_start` 阶段由 `src/contentScripts/nativeGuard.ts` 挂 MutationObserver；
- 原版 `script` 一插入就改 `type` 并移除，预加载 `link` 与 `iframe` 一并清理；
- 保留 `application/json` / `application/ld+json` / `importmap` 数据岛；
- 设置页提供「接管页拦截原版 B 站脚本」开关，关闭后恢复原版行为。

实测（本机，首页）：开启拦截后 DOM 内 `<script>` 18 → 0、`<iframe>` 1 → 0，
首屏卡片渲染不受影响。已知限制：拦截依赖 `document_start` 时序，非接管页不启用。

## 共享周期任务调度器

`src/utils/scheduler.ts` 提供 `every(ms, fn)`：

- 全页面只保留一个 `setTimeout`，多个周期任务共享调度；
- 页面隐藏（`document.hidden`）时自动暂停，切回可见时过期任务只补跑一次；
- 到期时间相近的任务合并到同一次唤醒执行。

TopBar / OldTopBar 的未读消息与动态轮询已从独立 `setInterval` 迁移到该调度器。

## 原生页面过滤（标记式）

搜索页、播放页推荐、排行等原生页面没有 Bewly 卡片，B 站的节点也不能删除。现在由
`src/utils/nativeFilter.ts` 用选择器规则读取标题，命中屏蔽词时只加
`data-bewly-filtered="native"`，由 CSS 隐藏：

- 绝不删除节点，可逆（停止时移除标记）；
- 规则表按页面类型分组，支持多套选择器兜底；
- 读不到标题的卡片直接放行，避免误杀；
- 设置页开关「在原生页面应用标题过滤」，默认关闭。

## 字体切片（按 unicode-range 按需下载）

内置中文变量字体原先由 GB2312 子集化的单个 1.81 MB 文件提供。现在改为按码位切片：

- `scripts/font-slices.py` 把字体切成 24 片（每片 1000 个码位区间），输出到
  `assets/fonts/sc/sans-*.woff2`，并生成 `src/styles/fontSlices.ts`（`@font-face` +
  `unicode-range`）；
- 浏览器只会下载页面实际用到的切片，而不是一次性拉取整个字体；
- 单文件 `ShangguSansSC-VF.woff2` 保留作为切片源。

重新生成：`pnpm run fonts:slices`（需要 Python + fontTools）。

**验证结果**：本机（Windows）系统字体（HarmonyOS / PingFang / Microsoft YaHei）优先命中，
内置字体不会触发下载；只有系统缺少中文字体或用户显式选择内置字体时，浏览器才会按
unicode-range 拉取实际用到的切片（通常 2–5 片，而非整份 1.81 MB）。

## 列表渲染窗口化（评估，暂缓）

当前每页 30 张卡片、DOM 节点约 30–90 个，虚拟化的收益有限；但实现风险较高：

- 窗口化会破坏滚动锚定与"键盘导航滚动跟随"的位置计算；
- 卡片懒加载/悬停预览依赖元素存在；
- `content-visibility: auto` 已承担大部分屏外渲染成本。

结论：暂不做虚拟化；若未来单页卡片数显著增加（如 >200），再引入
`@tanstack/vue-virtual` 之类的窗口化方案，并同步改造滚动跟随逻辑。

## content-visibility 与滚动锚定（评估）

- 卡片已在根节点声明 `content-visibility: auto` 与 `intrinsic-size`，屏外跳过渲染。
- 本轮实测：给滚动容器或卡片加 `overflow-anchor: none` **不能**阻止"滚动位置被重置"
  的抽搐（该问题的真实根因是 ForYou 无限重请求导致持续重渲染，已修复）。
- 主滚动容器已加 `overscroll-behavior: contain`，避免滚动链传导到页面。

建议：保持卡片固定比例与 `intrinsic-size`；新增列表页时沿用同一套卡片骨架结构。

## 图片与 CLS

- 封面：`loading="lazy"`、`aspect-video object-cover`（已具备，第 12 轮又补了
  `decoding="async"` / `fetchpriority` 与容器 `aspect-ratio`，见下一节）。
- 骨架卡片与真实卡片共用卡片容器尺寸，避免数据到达后的布局跳动。

## 图片加载与 CLS 加固（第 12 轮）

### 改动

| 文件 | 改动 |
| --- | --- |
| `src/components/Picture.vue` | 新增 `decoding` / `fetchpriority` 两个可选 props（默认 `async` / `low`），透传到 `<img>`；`loading` 默认值改为 `lazy` |
| `src/components/VideoCard/VideoCard.vue` | 封面 `<Picture>` 补 `decoding="async"` + `:fetchpriority`；卡片根节点加 `ref`，挂载时按「是否在首屏（视口内 + 上方一行）」决定 `high` / `low`；横向 / 纵向封面容器补 `aspect-ratio: 16 / 9` |
| `VideoCardAuthorAvatar.vue` | 头像 `decoding="async"` + `fetchpriority="low"`（头像容器本来就有固定 34/28px 尺寸，无 CLS） |
| `views/Moments/components/MomentCard.vue` | 头像 `decoding="async"` + `fetchpriority="low"`；头像容器与内部 img 补 `aspect-ratio: 1 / 1` |
| `views/Moments/components/MomentLightbox.vue` | 大图 `decoding="async"` + `fetchpriority="high"`（用户点击后才加载） |
| `views/Moments/components/MomentMedia.vue` | 已有 `loading="lazy"` + `decoding="async"`，本轮未改（视频 / 专栏 / 直播封面自带 `aspect-ratio`） |
| `views/listShared/components/ListPageHeader.vue` | 列表页头图 `loading="lazy"` + `decoding="async"` + `fetchpriority="low"`（背景层已由容器 `inset: 0` 占位） |
| `views/Anime/components/AnimeTimeTable.vue` | 当日主推大图 `decoding="async"` + `fetchpriority="high"`；其余更新缩略图 `decoding="async"` + `fetchpriority="low"`（两者的容器已有 `aspect-ratio: 16 / 9` / 固定 28px） |

原则：**只加属性 / 占位，不改布局、不降分辨率**。封面 URL 仍是原有的 `@672w_378h_1c` 变体，
头像仍是 `@50w_50h_1c`。

### 基线数字（`tests/e2e/perf.spec.ts` + `visibility.spec.ts`）

测量口径（fixture 首页 `tests/e2e/fixtures/bilibili-home.html`，1440×900，headless Chromium）：

- `mountMs`：导航开始 → `#bewly` 挂载就绪（宿主可见 + shadow root 样式表注入）；
- `cardsMs`：导航开始 → 首屏卡片数量稳定；
- `CLS`：扩展就绪后再观察 1s，`layout-shift`（排除用户输入）累计值；
- 图片覆盖：`#bewly` shadow root 内 `<img>` 的 `loading` / `decoding` / `fetchpriority` 属性数量。

| 轮次 | mountMs | 首屏卡片 ms | 卡片数 | img 数 | lazy | decoding=async | fetchpriority high / low | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 改动前（现有构建产物） | 3066 | 3588 | 30 | 62 | 60 | 0 | 0 / 0 | 0 |
| 改动后 · 第 1 次（同一构建） | 2528 | 3053 | 30 | 62 | 60 | 0 | 0 / 0 | 0 |
| 改动后 · 第 2 次（同一构建） | 2507 | 3034 | 30 | 62 | 60 | 0 | 0 / 0 | 0 |

**关于属性列恒为 0**：e2e 加载的是 `extension/` 里**上一次构建**的产物，本轮只改了源码；
按分工本轮不允许 `pnpm build`，所以运行时覆盖率要在 Lead 统一重建后才会变化。
源码侧已经用静态编译核对过属性确实进入了渲染函数（`vue/compiler-sfc` 编译 `Picture.vue` /
`VideoCard.vue`，产物中出现 `decoding`、`fetchpriority`、`coverFetchPriority`），
并且 typecheck + eslint 通过。重建后预期：`decodingAsync` = 页面全部卡片头像 + 封面（fixture 首屏 62 张里
约 60 张），`fetchHigh` ≥ 首屏卡片数（约 8–12），其余为 `low`。

**关于 CLS 恒为 0**：首页封面本来就有 `aspect-video`，骨架与真实卡片同尺寸，所以基线就是 0；
本轮补的容器 `aspect-ratio` 是针对**横向列表模式**与动态页头像的防御性占位（这些位置此前依赖子元素
撑高），不会改变现有首屏测量值，也不会引入新的跳动。

### 结论与限制

- 首屏挂载 / 卡片耗时的波动（2500–3100ms / 3000–3600ms）属于本机噪声范围，
  本轮是**纯属性级改动**，没有改 JS 执行路径，耗时不构成回归；
- CLS 代理值两轮均为 0，未发现新的布局抖动；
- e2e 的图片覆盖列只有在 Lead 重新构建 `extension/` 之后才有意义，建议重建后把
  `optimized` 风格断言升级为 `expect(metrics.decodingAsync).toBeGreaterThan(0)`；
- 本轮**未做网络限速 / 冷缓存**场景测量（fixture 不走真实网络），真实网络下的
  `fetchpriority` 收益需要 Lead 用真实页面或 CDP 限速再验一次。

## 限速验证：fetchpriority 的实际收益（第 14 轮）

第 12 轮给卡片封面 / 头像补了 `loading="lazy"`、`decoding="async"` 与 `fetchpriority`（首屏 high、
其余 low）；Lead 已重建 `extension/`，本节用 **CDP 网络限速** 复测这些属性是否真的落到
运行时、以及 `fetchpriority` 在这个场景里的实际效果。

### 测量方法

- `tests/e2e/perf.spec.ts` 新增「限速下的图片加载收益」：`context.newCDPSession(page)` +
  `Network.emulateNetworkConditions`，**在导航之前**应用限速；
- 网络档位（每档重复 2 次，取关键指标 min / 两次均值）：

  | 档位 | latency | download | upload |
  | --- | --- | --- | --- |
  | Fast 3G | 150ms | 1.6 Mbps | 750 kbps |
  | Slow 4G | 150ms | 4 Mbps | 3 Mbps |

- 采集：`Network.requestWillBeSent`（图片请求开始时间）、`Network.responseReceived`（首字节到达）、
  DOM 里卡片图片的 `fetchpriority` / `loading` 与卡片在视口内的位置、`layout-shift` 累计值；
- 图片 URL 归一化：封面 / 头像是协议相对地址且 `<picture>` 会请求 `.avif` 变体，
  按「绝对地址 + 变体后缀前缀」关联 DOM 与网络请求；
- 分组口径：**只比较 672w 封面**（头像 50w 体积小、会干扰），按 DOM `fetchpriority` 分 high / low 两组。

### 基线（不限速，同一构建；`perf.spec.ts` 第一条用例）

| mountMs | 首屏卡片 ms | 卡片数 | 图片数 | lazy | decoding=async | high | low | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2513 | 3037 | 30 | 62 | 60 | 60 | 12 | 48 | 0 |

`high=12 / low=48` 与「首屏 12 张卡 + 30 张卡各 2 张图（封面 + 头像）」完全对得上：
首屏 12 张封面 high、其余封面与全部头像 low，`lazy` 与 `decoding=async` 覆盖率 60/60 —
**第 12 轮的图片属性在重建后已确认生效**。

### 限速结果（每档 2 次，第二行为两次的内部值）

| 档位 | mountMs | 首屏卡片 ms | 首屏卡片数 | 封面首次开始 | high / low 张数 | high 封面在首屏 | low 封面在首屏 | high 首响应 | low 首响应 | high 响应中位 | low 响应中位 | 开始时间差 | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fast 3G | 2383 | 2994 | 12 | 2905ms | 12 / 48 | 12 | 0 | 3634ms | 3460ms | 3714ms | 3566ms | -1ms | 0 |
| Fast 3G（第 2 次） | 2460 | 3035 | 12 | 2938ms | 12 / 48 | 12 | 0 | 3640ms | 3485ms | 3702ms | 3562ms | -1ms | 0 |
| Slow 4G | 1877 | 2397 | 12 | 1709ms | 12 / 48 | 12 | 0 | 2143ms | 1934ms | 2586ms* | 2435ms | -1ms | 0 |
| Slow 4G（第 2 次） | 2510 | 3032 | 12 | 2398ms | 12 / 48 | 12 | 0 | 2777ms | 2600ms | 2823ms | 2760ms | -1ms | 0 |

\* Slow 4G 两次内部中位数为 2186ms / 2823ms，表中外层取两次均值 2505ms；为便于对照表中按每次运行列出。

（时间均为「相对首个网络请求」的毫秒值。每次运行都会重新拉起浏览器，绝对耗时有 ±0.5s 波动。）

### 结论

1. **属性分配是正确的**：12 张 high 封面全部在首屏、12 张 low 封面全部在首屏之外
   （`highCoverFirstScreenCount=12`、`lowCoverFirstScreenCount=0`），说明
   `VideoCard.vue` 里「挂载时按视口位置决定 high/low」的逻辑在重建后按预期工作。
2. **请求开始时间不受 fetchpriority 影响**：high 与 low 封面的首个请求几乎同帧发出
   （差 −1ms），符合预期 —— `fetchpriority` 是调度提示，不是延迟/提前发起请求的开关。
3. **本机这套测量下没有观察到 high 优先完成**：封面响应的**首批 8 个全部是 low**，
   high 封面首个响应比 low 晚 170–200ms（Fast 3G）、209ms（Slow 4G），中位数同样晚 148–170ms。
   也就是说：DOM 属性正确，但「首屏封面先到」这个收益在 fixture + CDP 限速环境里**没有复现**。
4. **CLS 全档位为 0**：限速把图片拖慢后也没有出现布局抖动，说明封面
   `aspect-ratio: 16/9` + 骨架同尺寸的占位是有效的。
5. **无法读取浏览器实际网络优先级**：本机 Chromium 的 `Network.requestWillBeSent` 事件字段为
   `requestId/loaderId/request/timestamp/wallTime/initiator/type/frameId/hasUserGesture...`，
   **不含 `initialPriority`**，因此不能断言「浏览器是否采纳了 high」；只能在 DevTools
   Network 面板的 Priority 列人工核对。

### 对第 12 轮实现的建议（本轮未改业务代码）

1. **首屏封面用 `loading="eager"`**：首屏 12 张当前仍是 `lazy`，浏览器会先跑一轮
   lazy 可见性判定；改成「首屏 eager + 其余 lazy」通常比只加 fetchpriority 更直接。
   实现上可以复用现有的 `coverFetchPriority` 判定（同一处 ref + 视口检查）。
2. **不要指望 fetchpriority 单独生效**：实测它没有改变完成顺序，收益可能在
   「同主机多图竞争 + lazy 判定」下被抵消；如需确定性优先首屏，建议配合
   `<link rel="preload">`（仅首屏 3–4 张）或直接 eager。
3. 若要继续验证，请在 **真实 B 站首页 + DevTools 限速**下看 Priority 列与
   「Load 时间瀑布」，fixture 环境无法代表真实 CDN / HTTP2 多路复用表现。

### 局限

- 页面文档走本地 fixture（`tests/e2e/fixtures/bilibili-home.html`），图片仍走真实 CDN，
  与真实首页的 DOM/请求数量不同；
- 每档只跑 2 次，样本小；`responseReceived` 受连接池与 HTTP 复用影响，单次差异可达 100ms+；
- CDP 不提供 priority 字段，无法从协议层确认调度决策（见结论 5）；
- 扩展自身的 JS / CSS 从本地扩展加载，不受限速影响，所以 mount / 首屏卡片耗时
  主要受页面 fixture 与 CPU 影响，不代表真实弱网下的首屏；
- 本轮**只测不改**：没有修改任何业务代码，建议项留给后续轮次。

## 首屏封面 preload 实验（第 18 轮）

### 实现

`src/components/VideoCard/coverPreload.ts` + `VideoCard.vue` 的挂载逻辑：

- 仅在**首页**（`www.bilibili.com/`）生效；
- 仅当卡片在**首屏**内、且是页面上 DOM 顺序前 **4** 张卡片时，注入
  `<link rel="preload" as="image" type="image/avif" href="<cover>.avif">`；
- 按 href 做**引用计数**：同一张图只注入一条 link，多张卡片共享；释放函数幂等；
- 卡片卸载时释放引用，归零后移除 link（长列表滚动不会累积 preload 标签）；
- 只预载 `<picture>` 的首选候选（AVIF + `type`），不支持 AVIF 的浏览器会直接跳过该提示，
  不会出现「预载 avif、实际取 webp」的重复请求；
- 全部用 `setAttribute` 写属性（jsdom / 老浏览器对 `link.as` IDL 支持不一致）。

**单元级验证**（jsdom，一次性脚本跑完即删）：15 条断言全过 —— 首次注入 1 条、
绝对地址、`type=image/avif`、同 URL 不重复、引用计数与幂等释放、不同 URL 各一条、
首页前 4 张才注入、第 5/6 张与非首页不注入。

### 复测（同一构建：扩展产物构建于 09:25，本轮源码改动晚于它）

`pnpm exec playwright test tests/e2e/perf.spec.ts tests/e2e/visibility.spec.ts` +
第 14 轮的限速用例（Fast 3G / Slow 4G，各跑 2 次）：

| 指标 | 基线（本轮复测，构建未含 preload） |
| --- | --- |
| mountMs | 2352 |
| 首屏卡片 ms | 2878 |
| 首屏可见（≥8 张）ms | 2880 |
| `coverPreloads` | **0**（构建产物还没有 preload 代码） |
| 卡片数 / 图片数 | 30 / 62 |
| lazy / eager | 48 / 12（首屏 12 张 eager，第 14 轮复测后的实现） |
| decoding=async | 60 |
| fetchpriority high / low | 12 / 48 |
| CLS | 0 |

限速复测（首屏封面首次开始 / 首响应 / 响应中位，单位 ms，相对首个网络请求）：

| 档位 | 首屏可见 | 封面首次开始 | high 首响应 | high 响应中位 | low 响应中位 | high−low 开始差 | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fast 3G | 2161 | 1031 | 1476 | 2004 | 4557 | +2963 | 0 |
| Slow 4G | 2027 | 956 | 1210 | 1402 | 2018 | +330 | 0 |

> 与第 14 轮相比，high 封面现在确实**先于** low 开始/完成（第 14 轮结论是反的）——
> 因为第 14 轮之后的改动把首屏封面从 `lazy` 换成了 `eager`，「提前发请求」比
> `fetchpriority` 单独生效更有效。这也让 preload 的预期收益进一步变小。

### preload 收益评估：模拟实验（A/B，同进程内对照）

因为构建产物还没有 preload 代码，无法直接测「组件注入」的效果；这里用
`page.addInitScript` 在**文档开始**时注入与组件完全一致的 4 条 preload，构造上界场景
（真实组件要到扩展就绪后才注入，收益只会更小）。用 `PERF_PRELOAD_EXPERIMENT=1` 启用，
每档同一进程内先跑对照组、再跑实验组：

| 运行 | 档位 | 首屏可见（对照 → 实验） | 封面首次开始 | high 响应中位 | low 响应中位 |
| --- | --- | --- | --- | --- | --- |
| #1 | Fast 3G | 2109 → 2206（**+97**） | 1178 → 1178 | 1690 → 1671（−19） | 4181 → 4310（+129） |
| #1 | Slow 4G | 2120 → 2015（−105） | 897 → 948（+51） | 1158 → 1195（+37） | 2111 → 1739（−372） |
| #2 | Fast 3G | 2216 → 2173（−43） | 1087 → 1071（−16） | 1569 → 1608（+39） | 4394 → 4257（−137） |
| #2 | Slow 4G | 1990 → 1986（−4） | 920 → 798（−122） | 1191 → 1092（−99） | 2218 → 1982（−236） |

### 结论：没有稳定收益，建议回退

- **首屏可见时间**：4 组对照的差值 +97 / −105 / −43 / −4 ms，符号来回翻，幅度在
  fixture 的噪声范围内（同一档位两次运行自身就有 ±40~100ms 抖动）；
- **首屏封面首次开始时间**：4 组里 2 组不变或更差（0 / +51 / −16 / −122），没有一致提前；
- **high 封面响应中位数**：+37 / −19 / +39 / −99，同样来回翻；
- **low 封面反而常常更慢**（+129 / −372 / −137 / −236）：符合「preload 挤占同主机
  连接池，把低优先级图片往后推」的解释，但幅度同样不稳定；
- **CLS 全程 0**，没有引入布局副作用；也没有观测到重复请求（preload 与 srcset 候选完全同 URL）。

**建议：回退这次 preload 实现**。理由：收益不可测且不稳定，而它带来了额外复杂度
（引用计数、shadow root 顺序查询、AVIF 候选耦合），并且首屏封面已经是
`eager + fetchpriority=high`，真正起作用的是「eager」而不是 preload 提示。

回退步骤（两处，改动都很小）：

1. 删除 `src/components/VideoCard/coverPreload.ts`；
2. `VideoCard.vue` 中删掉 `preloadCoverImage / shouldPreloadCover` 的 import、
   `releaseCoverPreload` 变量、`onMounted` 里的 preload 分支与 `onBeforeUnmount` 释放
   （`cardCoverSrc` 可以保留，它只是模板地址复用）。

回退后 perf.spec 里的 `coverPreloads` 统计会一直是 0，属预期；如果保留实现，
请在 Lead 重建 `extension/` 后复跑 perf.spec，确认 `coverPreloads === 4` 且无重复 link。

### 局限

- e2e 加载的是上一次构建产物（本轮代码没有进构建），所以「容器注入」路径只能靠模拟实验
  评估；模拟注入时机比真实组件更早，属于**乐观上界**；
- fixture 首页只有 30 张卡、图片走真实 CDN，单次运行的网络噪声可达 ±100ms，
  每档 2 次样本仍不足以给出统计显著结论；
- 只验证了 AVIF 候选；不支持 AVIF 的浏览器的 preload 会被跳过（按设计不会重复下载）；
- 未评估长列表滚动后 preload 标签的生命周期（实现有引用计数与卸载清理，但没有真机验证）。

## 第 21 轮复测：首屏封面 eager 确认（e2e 护栏）

第 14 轮把首屏封面从 `lazy` 改成 `eager + fetchpriority=high`，本轮在**当前构建产物**
（`extension/` 构建于 2026-11-11 10:58）上复跑 `perf.spec.ts`，确认属性确实进了产物：

| 指标 | 数值 | 说明 |
| --- | --- | --- |
| mountMs | 1685 | #bewly 挂载完成 |
| 首屏卡片 ms | 2214 | 卡片首帧渲染 |
| 首屏可见（≥8 张） | 2216 | |
| 卡片 / 图片 | 30 / 62 | |
| **`loading="eager"`** | **12** | 首屏 12 张封面全部 eager（第 14 轮回归点） |
| `loading="lazy"` | 48 | 非首屏封面 + 头像 |
| **`fetchpriority="high"`** | **12** | 与首屏卡数一致 |
| `fetchpriority="low"` | 48 | |
| `decoding="async"` | 60 | 全部卡片图 |
| `coverPreloads` | 0 | 第 18 轮的 preload 方案**未进入当前产物**（该轮结论是建议回退） |
| CLS | 0 | 限速档位同样为 0 |

限速复测（Fast 3G / Slow 4G，各 2 次，相对首个网络请求）：

| 档位 | 首屏可见 | 封面首次开始 | high 首响应 | high 响应中位 | low 响应中位 | high−low 开始差 |
| --- | --- | --- | --- | --- | --- | --- |
| Fast 3G | ~2400ms | ~1400ms | 1849ms | 1901ms | 4596ms | +2575ms |
| Slow 4G | 2497–2524ms | 1365–1431ms | 1561–1658ms | 1679–1726ms | 2077–2123ms | +292–312ms |

结论：**首屏封面 eager 在产物里稳定生效**（`eager=12`、`fetchHigh=12`，与首屏卡数一致），
并且 high 封面确实先于 low 开始/完成（第 14 轮之后的 eager 改动起主要作用）。

### 新增的回归护栏

`perf.spec.ts` 的「首屏性能基线」用例新增两条断言，防止属性链路再次断掉：

```ts
expect(metrics.eager).toBeGreaterThan(0)
expect(metrics.fetchHigh).toBeGreaterThanOrEqual(8)
```

阈值取 8（实际 12）而不是 12，避免首屏卡片数因视口/数据微小变化时误报。
