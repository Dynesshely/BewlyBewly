# 页面自检（Diagnostics）

第 24 轮 A 节交付（负责人：`anime-search` 子智能体）。

把「这个页面的增强到底有没有生效」固化成产品能力：设置页「页面增强 → 诊断」组里点一次，
就能看到每个增强模块的挂载 / 命中 / 降级原因，并可复制为 Markdown 反馈给维护者。
**纯本地只读**：不发网络请求、不写存储、不上报任何数据，也不包含账号 / 隐私信息。

## 1. 文件

| 文件 | 作用 |
| --- | --- |
| `src/contentScripts/diagnostics/probe.ts` | 探测：页面类型、各模块挂载 / 选择器命中 / 降级原因、环境信息 |
| `src/contentScripts/diagnostics/types.ts` | 结果类型（`ProbeItem` / `ProbeReport` / 原因代码） |
| `src/contentScripts/diagnostics/i18n.ts` | 模块内四语言文案（简中 / 繁中 / 粤语 / 英文） |
| `src/contentScripts/diagnostics/panel.ts` | `useDiagnosticsPanel()`：运行 / 复制 / 原因翻译 |
| `src/contentScripts/diagnostics/DiagnosticsPanel.vue` | 设置页内嵌的结果面板 |
| `src/contentScripts/diagnostics/index.ts` | 对外导出（探测函数 + 面板 composable） |
| `src/components/Settings/Pages/Pages.vue` | 新增「诊断」组（`show-reset=false`，不参与顶部导航与搜索过滤） |
| `src/components/Settings/Pages/i18n.ts` | 新增 `groupDiagnostics` / `groupDiagnosticsDesc`（四语言） |

各增强模块的 `dom.ts` 追加只读导出 `probeSelectors`（不参与业务逻辑）：
`videoPage` / `notificationPage` / `searchPage` / `spacePage` / `channelPage` / `livePage` / `articlePage`。
诊断模块直接汇总这些选择器，不再单独维护一份。

## 2. 探测内容

### 页面与环境

- 页面类型：首页 / 视频播放页 / 番剧播放页 / 番剧页 / 列表页 / 搜索结果页 / 动态页 / 消息页 / 用户空间 / 文章 / 分区排行榜 / 直播页 / 未知；
- 浏览器 User-Agent、视口尺寸、`devicePixelRatio`；
- 暗色模式（`html.dark`）、`prefers-reduced-motion`；
- `#bewly` 主应用是否挂载；
- 当前页面生效的快捷键数量（按 `SHORTCUT_REGISTRY` + `getActiveShortcutScopes()` 过滤，纯本地计算）。

### 增强模块（逐个）

| 模块 | 判定依据 |
| --- | --- |
| 首页卡片增强 | `.feed-card` / `.bili-grid .feed-card` / `.bili-video-card` / `[data-video-card]` |
| 视频播放页增强 | 模块 `probeSelectors`（播放器容器 / 标题）+ 浮层 `#bewly-video-page` |
| 视频页评论区增强 | `#commentapp` / `bili-comments` / `bili-comment-thread-renderer`；受 `settings.videoPageComments` 控制 |
| 番剧时间表 | `.anime-timetable` / `.timeline-item` / `.anime-card` 等 |
| 列表页增强 | `.bewly-list-page` / `.bewly-list-toolbar` / `.bili-video-card` |
| 列表页滚动恢复 | 同上；受 `settings.enableListScrollMemory` 控制 |
| 搜索结果页增强 | 模块 `probeSelectors` + 浮层 `#bewly-search-enhance` |
| 动态页 | `.bili-dyn-list__item` / `.bili-dyn-item` / `.moments-page` |
| 消息页增强 | 模块 `probeSelectors` + 浮层 `#bewly-notification-page` |
| 空间页增强 | 模块 `probeSelectors` + 浮层 `#bewly-space-enhance` |
| 文章阅读模式 | 模块 `probeSelectors`（正文容器候选）+ 浮层 `#bewly-article-page` |
| 分区 / 排行榜增强 | 模块 `probeSelectors` + 浮层 `#bewly-channel-enhance` |
| 直播页增强 | 模块 `probeSelectors`（播放器 / 侧栏候选）+ 浮层 `#bewly-live-page` |

### 判定逻辑（状态与原因代码）

| 状态 | 原因代码 | 含义 |
| --- | --- | --- |
| 正常 | `ok` | 页面适用、用户开关开启、关键选择器有命中、浮层已挂载 |
| 降级 | `user-disabled` | 用户已在设置里关闭该功能（例如评论区 / 滚动恢复） |
| 降级 | `login-required` | 需要登录（当前没有此类模块直接判定，预留） |
| 降级 | `selectors-miss` | 关键选择器一个都没命中：页面未渲染完、未登录看到的空页，或 B 站改版 |
| 降级 | `no-selectors` | 模块没有声明关键选择器（开发期保护） |
| 降级 | `host-missing` | 选择器命中，但对应浮层没有挂载（被其它扩展 / 浏览器拦截等） |
| 不可用 | `not-applicable` | 当前页面不适用（URL / 页面结构未命中） |

判定顺序：页面不适用 → 用户关闭 → 需登录 → 无选择器 → 选择器未命中 → 浮层未挂载 → 正常。

## 3. 设置页入口

- 「页面增强 → 诊断」组：点「运行页面自检」→ 结果按 **正常 / 降级 / 不可用** 分组展示；
- 每项显示：模块名、原因、浮层宿主与是否挂载、命中选择器数量（命中 / 总数）；
- 顶部显示环境信息（页面类型、浏览器、视口、暗色、减少动态效果、`#bewly` 挂载）；
- 「复制为 Markdown」：把同一份结果复制到剪贴板（按钮短暂变「已复制」）；剪贴板不可用时静默失败，不弹错；
- 结果摘要用 `role="status"` + `aria-live="polite"` 播报；按钮为原生 `<button>`、`:focus-visible` 有主题色描边；
- 暗色 / 高对比度 / reduced-motion 沿用设置页既有变量与降级规则。

## 4. 本地与隐私

- **不发任何网络请求**：只读 `location` / `document` / `matchMedia` / 已注入的浮层宿主；
- **不写存储**：不读写 `settings`（除只读用户开关以解释降级原因）、不写 `sessionStorage` / `localStorage`；
- **不上报**：没有遥测、没有日志外传；复制出来的 Markdown 也只在用户主动点击时写入剪贴板；
- 结果中不包含账号、Cookie、视频标题等业务数据，只有 UA / 视口 / 选择器命中数量。

## 5. 自测

- `pnpm exec eslint`（15 个改动文件）：0 error 0 warning；
- `pnpm run typecheck`：0 error；
- 未跑 build / playwright；未碰浏览器；未做 git 操作。

## 6. 已知限制

- 「当前页生效的快捷键数量」按 registry 的 scope 计算，不校验用户改键后的冲突（快捷键冲突由第 24 轮 C 的单元测试兜底）；
- 评论区是 Web Components + shadow DOM，只从宿主元素（`bili-comments` 等）判断，不深入 shadow 内部统计条目；
- 首页 / 动态 / 列表等 Bewly 内部视图没有 nativeOverlay 宿主，因此「浮层挂载」为 `null`，只展示选择器命中；
- 选择器命中数量受页面懒加载影响：刚打开页面立刻自检可能报「未命中」，稍等再运行即可；
- 部分页面（如未登录的消息页 / 空收藏页）本身没有内容节点，会显示为降级而不是故障。

### 设置页覆盖时的特殊处理（第 24 轮真机反馈修复）

诊断是从**设置页**里运行的，而设置页是全屏浮层：打开后首页 / 列表 / 动态等页面内容会被卸载或隐藏，
直接探测会把「依赖页面内容」的模块误判成「关键选择器未命中」。真机反馈正是这种情况（首页 0/4）。

修复：

- 探测开始时检测是否处于设置覆盖状态：`#bewly` shadow root 内存在 `#settings-window`（当前版本）
  或 `.settings-content` 的全屏 fixed 包裹层（兼容旧版）；函数：`isCoveredBySettings()`；
- 若处于覆盖状态：结果里依赖页面内容的模块（home / list / moments / video / bangumi / anime / channel / space / article / search / notification / live）
  且「选择器 0 命中」时，原因改为新代码 **`covering-overlay`**（文案「设置页覆盖中，无法探测」），
  **不计入「降级」统计**，在面板与 Markdown 里单列为「覆盖中」分组；
- 报告顶部显示一条提示（四语言）：「当前设置页覆盖了页面内容，部分模块无法探测；关闭设置页后重跑更准确」；
- 其余 13 项探测、原因判定顺序、Markdown 导出结构保持不变；`coveringCount` / `coveredBySettings` 为新增字段。

判定顺序更新为：页面不适用 → 设置页覆盖中 → 用户关闭 → 需登录 → 无选择器 → 选择器未命中 → 浮层未挂载 → 正常。

### 第 25 轮：可执行修复建议 + 报告下载

真机使用后补充了两件事：**每项降级/不可用都给出下一步该怎么做**，以及**报告可导出为文件**。

#### 1. 可执行建议（四语言）

| 原因 | 建议（简中示例） |
| --- | --- |
| `covering-overlay` | 关闭设置页后重新运行自检；若仍显示覆盖中，请刷新页面 |
| `not-applicable` | 这是当前页面的正常状态；切换到对应页面后重新运行自检即可看到结果 |
| `user-disabled`（视频页） | 在「设置 → 页面增强 → 视频播放页」中开启影院模式 / 迷你播放器 / 快捷键任一开关 |
| `user-disabled`（评论区） | 在「设置 → 页面增强 → 视频播放页」中开启「视频页评论区增强」 |
| `user-disabled`（滚动恢复） | 在「设置 → 页面增强 → 列表页」中开启「列表页返回恢复滚动位置」 |
| `login-required` | 登录 B 站账号后重新运行自检；未登录时只提示、不发请求 |
| `selectors-miss` | 可能是页面还没加载完或 B 站已改版：稍等片刻重跑；若持续出现，请复制报告提 issue |
| `no-selectors` | 这是开发期保护：请联系维护者补充该模块的 `probeSelectors` |
| `host-missing` | 尝试刷新页面；若仍缺失，检查是否有其它扩展 / 浏览器策略拦截了扩展浮层 |

建议与原因分开显示：原因说明「为什么」，建议说明「怎么办」，方便用户自助处理或附报告反馈。

#### 2. 报告元信息

- **版本号**：从 `browser.runtime.getManifest().version` 读取（失败回退 `unknown`），面板与 Markdown 都显示；
- **时间戳**：报告生成时间（ISO 字符串，展示时本地化）；
- 版本号 / 时间戳让收到的报告可以直接对应到构建与运行时刻，便于排查。

#### 3. 下载 .md

- 「复制为 Markdown」旁新增「下载 .md」按钮：Blob + `a[download]`，文件名为
  `bewly-diagnostics-YYYYMMDD-HHmm.md`（本地时间），生成后立即 `revokeObjectURL`；
- 失败**静默**（不弹错），用户仍可复制；全程不经过任何服务端。

#### 4. 与窄屏工作流的协调

- 本轮只改结构 / 文案 / 逻辑；`DiagnosticsPanel.vue` 的 CSS 媒体查询区块由窄屏工作流负责，未与之冲突。
