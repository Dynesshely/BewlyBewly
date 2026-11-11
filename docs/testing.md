# E2E 测试策略

> 第 11 轮 B 节交付。覆盖 `tests/e2e/**` 的组织方式、稳定性约定、以及本轮新增用例与已知 flaky。

## 一、运行方式

```bash
# 前置：必须已有构建产物 extension/（Lead 统一执行 pnpm build；不要在本工作流里自己 build）
pnpm exec playwright test

# 只跑某一类
pnpm exec playwright test keyboard.spec.ts

# 稳定性复查：整套连跑 N 次
pnpm exec playwright test --repeat-each=1   # 连续执行命令 N 次
```

- 使用 Playwright 自带 Chromium（`channel: 'chromium'`），持久上下文加载 `extension/`；
- 所有「B 站页面」请求都用本地快照 `tests/e2e/fixtures/bilibili-home.html` 接管 document，不依赖线上首页 DOM；
- 首页卡片数据仍来自真实接口（网络不可达时会退化为骨架/空列表，相关用例会以等待条件超时失败）。

## 二、共享 helper（tests/e2e/utils.ts）

本轮把「启动扩展 / 打开 fixtures / 等待就绪」统一到一处，所有需要扩展的 spec 都从这里导入：

| helper | 作用 |
| --- | --- |
| `launchExtension({ allowPopups })` | 统一启动带扩展的持久 Chromium 上下文（args / channel / viewport 一处维护） |
| `routeBilibiliDocument(page, fixture)` | 用本地快照响应 www.bilibili.com 的 document 请求 |
| `openHomeFixture(page, { minCards })` | 挂载快照首页 + 等扩展就绪（可要求最少卡片数） |
| `waitForExtensionReady(page, { minCards })` | **统一的「扩展就绪」条件**：`#bewly` 存在、shadow root 有 wrapper、样式表已注入、`opacity === '1'` |
| `waitForStableCardCount(page, min)` | 等卡片数量足够且**连续两次采样相同**（异步分批渲染的竞态根治） |
| `waitForKeyboardHighlight` / `expectActiveCardUrl` | 用当前高亮卡片的 `data-video-url` 断言，而不是卡片索引 |
| `injectTestCards(page, n)` | 注入不受 Vue 管理的测试卡片（End / Enter / Space 用例用） |
| `focusPage(page)` | 页面聚焦 + 清掉残留焦点（避免输入框让行导致按键无效） |
| `clickDockItem(page, /history/i)` | 按 dock tooltip 文案切换页面（dock 在 shadow root 内） |
| `seedFakeLoginCookies(context)` | 伪造登录 cookie，让列表页跳过「请先登录」分支 |
| `waitForServiceWorker` / `stubBackgroundJson` | 在 background service worker 里给接口做 JSON 桩 |
| `patchExtensionSettings` / `readExtensionSettings` | 直接读写扩展 `storage.local` 的 settings（开关类断言用） |
| `skipIfExtensionMissing()` | 没有构建产物时统一 skip，并给出同一句提示 |

## 三、稳定性约定（写新用例请遵守）

1. **等状态，不等时间**：不写 `waitForTimeout` 当等待手段（允许作为轮询间隔）。
   等待条件用「元素出现 / 属性变化 / 数量稳定 / 指定 URL 高亮」。
2. **不用索引断言卡片**：卡片会分批渲染、无限滚动会追加，索引会漂移。
   用 `data-video-url`（或 `data-video-title`）做身份断言。
3. **新标签页用事件**：`context.waitForEvent('page')`，不要轮询 `context.pages().length`。
4. **快捷键前先归位**：`focusPage()` + 必要时先按 Home 把高亮归一化，再断言方向键效果。
5. **Shadow DOM**：一律从 `document.querySelector('#bewly').shadowRoot` 里查；Playwright locator 的 CSS 引擎可穿透 shadow root，可直接用。
6. **只读优先**：写操作类能力（点赞 / 收藏 / 稍后再看）只在手里没有登录态时不点；
   需要验证出现与否就断言可见性，避免真实写 B 站数据。
7. **每个用例独立持久上下文**（`launchPersistentContext('')`）：天然隔离 localStorage / settings / sessionStorage，互不污染。

## 四、键盘用例 flaky 的定位与修复（keyboard.spec.ts）

**症状**：整套第一次跑偶发失败，单独复跑通过（Lead 反馈）。

**根因**（两条，都是时序）：

1. 旧用例在 `[data-video-card] 数量 > 3` 就立刻按 `End` 并断言「最后一张卡」：
   首页卡片是分批渲染的，判断后数量还会继续涨，导致「最后一张」的位置漂移；
2. 旧用例用高亮**索引**比较（`getActiveIndex`）：卡片数量变化会让同一物理卡片的索引改变，
   `ArrowRight` 之后可能"看起来没动"。

**修复做法**：

- 先 `openHomeFixture`（扩展就绪）→ `waitForStableCardCount`（数量连续两次不变）→ 再注入测试卡片；
- 用 `data-video-url` 断言高亮：`Home` 归一化后记下当前 URL，`ArrowRight` 后断言 URL 变化；
  `End` 后断言高亮 URL 等于注入的最后一张卡；
- 回车开新标签用 `context.waitForEvent('page')`；
- `?` 用例先用 `focusPage` 清焦点，再用 `press('?')`（不能用 `Shift+/`：
  Playwright 会发出 `key='/' + shiftKey`，而快捷键注册表里的规范组合是 `?`，两者不匹配）。

**验证**：`keyboard.spec.ts --repeat-each=5`（10 个用例）连续通过；随后整套 3 连跑全绿。

## 五、本轮新增用例（第 6–10 轮能力）

| 文件 | 覆盖能力 | 断言要点 |
| --- | --- | --- |
| `zen-mode.spec.ts` | 全站清屏（Shift+Z） | `html.bewly-zen` / 根节点 class、Dock `display:none`、sessionStorage `bewly-zen` = 1/0；Shift+Z 与 Esc 都能退出 |
| `home-density.spec.ts` | 首页卡片密度 | 默认舒适 → 点紧凑后 `home-density-compact` 出现、aria-pressed 切换、`settings.homeCardDensity` 持久化为 compact；再点回舒适还原 |
| `card-quick-actions.spec.ts` | 视频卡悬停操作条 | 未悬停时 `opacity:0` + `pointer-events:none`；悬停后 `opacity:1` + `pointer-events:auto`、按钮数 ≥ 2；移出后恢复隐藏；全程不点写操作、无 toast、无跳转 |
| `list-offscreen.spec.ts` | 列表页离屏优化（复用长列表开关） | 用 SW 桩 + 伪造登录渲染历史页：工具栏与卡片出现、**每张卡都可见**（高度 > 0、非 display:none）；关闭 `momentsOptimizeEnabled` 并刷新后卡片仍全部可见、无 `content-visibility` 内联样式 |
| `moments-offscreen.spec.ts` | 动态页离屏优化开关 | 命令面板 → 设置 → 页面增强，找到「离屏优化」默认开启；点击后关闭并持久化到 `storage.local` 的 `settings.momentsOptimizeEnabled`；再点回开启 |

所有新增用例也复用了第二节的 helper，没有重复的启动 / 等待代码。

## 六、已知 flaky / 限制

1. **依赖真实网络**：首页卡片来自真实 B 站推荐接口；网络异常时会以「卡片数量稳定」超时失败。
   本轮未做接口级离线化（需要给 background 全面做桩，成本高且容易与真实行为脱节）。
2. **登录态相关页面**：历史 / 稍后再看 / 收藏 / 动态 需要登录才能有真实数据。
   本轮用「伪造 cookie + background 接口桩」只覆盖了**渲染与离屏优化**，不覆盖真实业务数据形态；
   接口字段一旦变化，桩数据需要同步更新。
3. **首页密度只断言开关链路**：紧凑档的布局效果是纯 CSS（`home-density-compact` + `:deep` 网格覆盖），
   不同子标签的网格类不同；用例把「列数 / 卡片宽度」写进 annotation 但不做硬断言，
   避免 B 站改版或网格实现微调就让用例变红。视觉密度建议用人工/截图对比确认。
4. **列表离屏优化的实现细节未绑定**：用例只断言「卡片仍然可见」，不断言 `content-visibility` 的具体取值。
   ⚠️ 本轮实测发现：`useListVirtual` 默认用 `document.querySelector('.bewly-list-page')` 找列表根节点，
   但 Bewly 的页面都在 `#bewly` 的 **shadow root** 内，`document.querySelector` 拿不到；
   因此「离屏优化」在真实列表页目前是 no-op（卡片没有 `content-visibility` 内联样式）。
   用例目前按「开启/关闭都不影响可用性」验证通过，等实现修好后会在 annotation 里体现优化命中数量。
5. **设置页用例依赖文案/结构**：`moments-offscreen` 依赖「Off-screen optimization / 离屏优化」文案与
   `.b-settings-item` 结构；改文案或换组件需要同步更新选择器。
6. **按键组合**：`Shift+/` 不等于 `?`（见第四节），新增快捷键用例请用 `press('?')` 这类「按键字符」写法。
7. **视频页 / 番剧页用例** 依赖自带的内联 fixture（`video-page.spec.ts`），与首页快照相互独立。
## 七、第 18 轮：E2E 覆盖补齐（文章 / 直播 / 合集 / 反馈态）

本轮新增 4 组 spec，全部用**本地 fixture 或 background service worker 桩**，不依赖线上页面：

| 文件 | 覆盖能力 | 断言要点 |
| --- | --- | --- |
| `article-page.spec.ts` | 文章 / opus 阅读模式 | fixture 用真机形态 `.bili-opus-view > .opus-detail > .opus-module-content`（正文 ≥ 200 字 + 2 张图 + 1 个 `pre`）；断言 `#bewly-article-page` 浮层就绪、5 个按钮、点「沉浸阅读」后 `html.bewly-article-reading` 生效、正文 `max-width: 720px` 且实测正文宽（去掉内边距）≤ 720、`pre` 注入 `[data-bewly-code-copy]`、点图片打开 `.bap-lightbox`（同文图片可切换）、Esc 关闭、再点退出阅读模式 |
| `live-page.spec.ts` | 直播页影院模式 | fixture 复刻 `.live-non-revenue-player` + `.live-player-handle-bar` + `.live-player-bg`；断言 `#bewly-live-page` 挂载、`html.bewly-live-page` 接管标记、按 T 后 `html.bewly-live-cinema` 生效、操作条 `display:none`、舞台 `position:fixed` 且高度 ≈ 视口高；Esc 与再按 T 都能退出 |
| `collection-panel.spec.ts` | 合集选集面板 | fixture header「测试合集 （1/3）…订阅合集」+ `video-pod__list section`（无 multip）+ 3 个不同 bvid 的 `<a>` 条目；断言入口文案是「合集」（不是「选集」）、面板 `data-kind="collection"`、3 项、唯一 `aria-current="true"` 指向第 2 项、点第 3 项触发 `BV1collect03` |
| `feedback-states.spec.ts` | 反馈态组件 | 伪造登录 cookie + SW 桩动态接口：`code=-500` 时 `.feedback-error` 可见且 `role="alert"`、含接口 message 与重试按钮；把桩切成空列表后点重试，变成 `.feedback-state` 且 `role="status"` |

### 本轮全量运行结果（`pnpm exec playwright test --retries=0`）

| 运行 | 用例数 | passed | skipped | failed | 耗时 |
| --- | --- | --- | --- | --- | --- |
| 第 1 次 | 48 | 44 | 4 | 0 | 2.2m |
| 第 2 次 | 48 | 44 | 4 | 0 | 2.3m |

> 48 个用例里包含前几轮积累的全部 spec；4 个 skipped 是既有的在线探测 / 需要额外环境变量的用例，
> 本轮新增的 4 个 spec 全部执行并通过。

两次全量运行均无新增 flaky；`article-page / live-page / collection-panel / feedback-states` 四个新 spec 也各自单独复跑通过。

### 新增已知限制

1. **文章页 fixture 的宽度语义**：`max-width: 720px` 作用在内容盒上，用例测量的是「去左右内边距后的正文宽度」，
   因此 fixture 里给正文加 padding 不会让断言假红；真实页面同样适用。
2. **直播 fixture 没有真实控制条**：因此只覆盖影院模式的页面级标记 / 布局，不覆盖弹幕开关与全屏按钮
   （找不到原生控件时模块会正确禁用对应项）。
3. **合集 fixture 用页面脚本记录点击**：避免真的导航离开 fixture，断言的是「点第 3 项会触发指向第 3 个 bvid 的链接」。
4. **反馈态依赖动态页**：动态页需要登录态，用伪造 cookie + SW 桩只验证反馈组件渲染，不验证真实动态数据形态。
5. 动态页的 ErrorState 只在**首屏加载失败**时出现；已有内容后翻页失败只显示底部「重试」提示（这是产品行为）。

## 八、第 21 轮：滚动记忆 e2e + 首屏 eager 护栏

### 新增 / 修改的 spec

| 文件 | 变更 | 覆盖 |
| --- | --- | --- |
| `scroll-memory.spec.ts`（新建） | 3 条用例（1 条 fixme） | 首页子标签切换恢复、首页刷新回顶部（已知缺陷）、历史列表离开再返回的锚点恢复 |
| `perf.spec.ts` | 基线用例加 2 条断言 | `eager > 0`、`fetchHigh >= 8`（实测 12/12），防止第 14 轮的 eager/high 属性链路再次断掉 |
| `article-page.spec.ts` | 图片请求桩 | fixture 里的 `i0.hdslb.com` 图片地址在真实网络是 404，第 19 轮图片兜底会把 `<img>` 换成占位，导致 lightbox 断言拿不到原图 src（假红）；现在把图片请求统一 fulfill 成 1×1 PNG，用例确定性通过 |

### 用例要点

1. **首页滚动记忆**：滚到 800px → 点第二个子标签（For you / Following / …）→ 点回原标签 →
   `poll` 滚动容器 `scrollTop`；同时断言 `sessionStorage` 里出现 `bewly-home-scroll-*` 记录。
   断言「恢复确实生效（>300px）」+「偏差在已知范围（±400px）」。
2. **首页刷新回顶部**：目前是 `test.fixme`，因为 Chromium 刷新时会恢复内层滚动容器位置（实测 496px），
   需要 src 修复（`history.scrollRestoration = 'manual'`）。现象与复现步骤见 `docs/scroll-memory.md` 第 4 节。
3. **历史列表锚点恢复**：背景服务 worker 给历史接口打桩（与 `list-offscreen.spec.ts` 同一套），
   滚动后读 `sessionStorage` 里的锚点 key/offset → 回首页再点回历史 → 断言 scrollTop > 100、
   且该卡片落在记录偏移 ±200px 内；同时断言记录被消费（恢复一次后清空）。
   不用 `reload` 是因为扩展会记住上次页面，reload 后历史页自己就恢复了，再点 dock 会重置滚动。

### 全量运行结果（`pnpm exec playwright test`，workers=1）

| 运行 | 用例数 | passed | skipped | failed | 耗时 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| #1 | 54 | 47 | 5 | 2 | 3.3m | 修 article 图片桩之前：`article-page`（图片 404 触发兜底）+ `favorites-category-manage`（A 工作流新 spec）失败 |
| #2 | 54 | 47 | 5 | 2 | 3.4m | 与 #1 完全一致（同样两条，非 flaky） |
| #3 | 54 | 48 | 5 | 1 | 3.3m | 修好 article 图片桩：只剩 `favorites-category-manage`（A 工作流未完成，需重建产物后复跑） |
| #4 | 54 | 48 | 5 | 1 | 3.2m | 与 #3 一致 |

5 个 skipped 是常量集合：

- `background.spec.ts`「getRecommendVideos 返回真实数据」（需要真实登录态）
- `dom-probe.spec.ts`「线上首页 DOM 结构检测」（在线探测）
- `perf.spec.ts` 两条 preload 模拟实验（默认需要 `PERF_PRELOAD_EXPERIMENT=1`）
- `scroll-memory.spec.ts`「首页刷新回顶部」（本轮新增的已知缺陷 fixme）

### 结论与已知限制

- 任一轮改动后连跑 2 次全量（#1/#2 与 #3/#4），**本轮新增的两个用例稳定通过，无 flaky**；
- `favorites-category-manage.spec.ts` 是并发 A 工作流的新用例，其依赖的「新建收藏夹」UI
  还没进当前构建产物（`extension/` 构建于 10:58），失败原因是找不到 `.bewly-list-chip.is-create`；
  重建产物后需要复跑，与本轮改动无关；
- 首页恢复的偏差与刷新不回顶，都是**产品实现缺陷**而非测试问题，已写进 `docs/scroll-memory.md`。

## 九、第 21 轮 B 工作流：滚动记忆两个 BUG 修复后的验收

### 根因（与最初的判断不同，记录如下）

- **不是 KeepAlive 名字问题**（虽然 `ForYou` 补 `defineOptions({ name: 'ForYou' })` 仍有收益：切回不再重新请求）；
- 真正根因：`Home.vue` 里的 `scrollbarRef` 是 **OverlayScrollbars 组件实例**，不是 HTMLElement。
  第 20 轮的 `restoreHomeScroll(savedTop, () => scrollbarRef.value)` 把 `scrollTop` 写到了组件实例上（无效），
  `currentScrollTop()` 也一直读到 0。所以「恢复」从未真正执行过，496px 只是浏览器滚动锚定的落点。
- 其它修复：`resolveScrollElement()` 优先查 `#bewly` shadow root 的 `.bewly-scroll-container`；
  恢复落位后做 rAF×2 + 300ms 二次校正（之前被 `stopped` 提前中止）；
  列表页恢复后按同一锚点校正 rAF×2 / 300ms / 800ms；
  首页挂载后 1.6s 内用 scroll 监听 + 多个定时点压过浏览器的 scroll restoration（用户一滚动就放弃）。

### 验收结果

| 项目 | 结果 |
| --- | --- |
| `scroll-memory.spec.ts` 连续 3 次 | ✅ 3/3 passed（每次 3 条用例全过，5.7–8.4s/条） |
| 断言收紧 | 首页 ±80px、列表 ±80px、刷新 `scrollTop < 5`（原 fixme 已改为正式断言） |
| 全量 1 次 | **51 passed / 4 skipped / 0 failed（3.0m）** |
| 稳定性 | 3 次连续运行无 flaky；切标签恢复会先出现 496px 中间态（浏览器滚动锚定），约 100–200ms 后落到 800px，用例用「连续两次采样都接近目标」判断稳定，避免读中间态假红 |

### 测试写法要点（给后续用例）

1. **等「稳定」而不是等「一次命中」**：滚动恢复有中间态，`expect.poll` 单次命中后立刻读值可能读到回落值；
2. **按真实滚动元素断言**：`.bewly-scroll-container` 在 `#bewly` shadow root 内，`document.querySelector` 拿不到；
3. **首页刷新用例要容错浏览器 restoration 的时机**：轮询到回顶后再断言，不要固定 `waitForTimeout`。
