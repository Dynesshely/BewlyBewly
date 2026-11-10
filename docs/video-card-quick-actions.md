# 视频卡快捷互动（点赞 / 收藏 / 稍后再看）

悬停（或键盘聚焦）任意 `VideoCard` 时，封面右下角出现一条紧凑操作条：
**点赞 / 收藏（可多选收藏夹）/ 稍后再看**。所有写操作都有登录判断、乐观更新、失败回滚与 toast 反馈。

## 1. 用户可见行为

- **显示时机**：悬停整张卡片（`group-hover`）或操作条内某个按钮获得焦点（`focus-within`）时淡入；
  其余时候透明且 `pointer-events: none`，不遮挡封面点击（条本身只有约 100×36px，位于封面右下角）。
- **位置原因**：右下角在 hover 时原本只有「时长徽标」，而它本来就在 hover 时淡出；
  为键盘聚焦也加了 `group-focus-within:opacity-0` 让时长徽标让位，所以操作条不会和任何徽标重叠。
  右上角留给列表页自己的快捷操作条（`ListVideoCard`），互不干扰。
- **点赞**：
  - 首次点击 → `api.video.likeVideo({ aid, like: 1, csrf })`，图标即时高亮，成功 toast「已点赞」；
  - 同一会话内再点 → `like: 2` 取消点赞，成功 toast「已取消点赞」；
  - 失败（`code !== 0` / 网络异常 / api 超时）→ **回滚**图标状态并 toast「点赞失败，请稍后重试」；
  - `code === -101 / -111`（未登录 / csrf 失效）→ 提示登录，同样回滚。
- **收藏**（第 9 轮起改为收藏夹面板）：
  - 未收藏时点击 → 弹出收藏夹面板，可**多选**收藏夹，提交 `add_media_ids`（逗号分隔）；
  - 已收藏（本会话成功提交过）时再点按钮 → **直接取消收藏**（`del_media_ids`，一次点击即生效）；
    想换成别的收藏夹时，先取消、再点一次重新在面板里选择；
  - 失败回滚收藏归属并 toast「收藏失败，请稍后重试」；`-101 / -111` 提示登录。
- **稍后再看**：沿用原有逻辑（`api.watchlater.saveToWatchLater` / `removeFromWatchLater`），
  图标在已加入时切换为对勾并高亮；列表页（`ListVideoCard`）传 `showWatcherLater=false` 时这一项不渲染，
  由列表页自己的快捷操作条负责。
- **登录判断**：点击时先检查 `getUserID()` 与 `getCSRF()`，缺任一只 toast「需要先登录 B 站账号」，**不发请求**。
- **直播卡片**：没有点赞 / 收藏语义，只显示「稍后再看」。
- **并发保护**：同一个按钮请求在途时 `disabled`，避免连点重复提交。

## 2. 收藏夹面板

- **数据源**：`api.favorite.getFavoriteCategories`（`up_mid` 取自 `getUserID()`），结果缓存 5 分钟，
  并发调用合并成一次请求；收藏夹结构变化后可调用 `invalidateFavoriteFolders()` 强制刷新。
- **默认预选**：未收藏时打开面板，预选「默认收藏夹」（`attr & 2`；取不到退第一个公开夹，再退列表首个），
  这样不勾选直接点「收藏」也能一键收藏。
- **回显**：若该视频在本会话已经被收藏（例如同一视频的多张卡片），面板会用已记录的收藏夹回显勾选状态。
- **关闭**：面板右上角 ×、底部「取消」、`Esc`、点击面板外部都能关闭；关闭不发任何请求。
- **差异提交**：提交时只发送差异——
  `add_media_ids` = 新勾选但未收藏的夹子，`del_media_ids` = 之前收藏但被取消勾选的夹子；
  两者都为空时提示「收藏夹没有变化」且不发请求。
- **写接口**：`api.favorite.dealFavoriteResource({ rid: aid, type: 2, add_media_ids, del_media_ids, csrf })`。
- **键盘可达**：打开后焦点移到面板第一个可操作元素；每个收藏夹是原生 `button`（`role="checkbox"` +
  `aria-checked`），Tab 逐个遍历、Enter / Space 切换勾选；`Esc`、右上角 ×、底部「取消」都能关闭；
  面板打开期间即使鼠标移出卡片也保持可见可点。
- **点击外部关闭**：监听 `document` 的 click，用 `event.composedPath()` 判断是否点在面板内（Shadow DOM 下
  `event.target` 会被重定向到宿主元素，不能直接用）；外部点击监听在面板打开后延迟一帧再挂，
  操作条自己的按钮也都 `.stop`，所以不会出现「刚打开就被同一次点击关掉」。
- **窄屏**：面板宽 236px（`max-width: calc(100vw - 24px)`），列表区 `max-height: min(340px, 46vh)` +
  `overflow-y: auto`，收藏夹很多时内部滚动，不会撑破视口。
- **加载 / 失败**：加载中显示「收藏夹加载中…」；失败/为空显示提示与「重试」按钮（重试会强制刷新缓存）。

## 3. 开关

| 开关 | 位置 | 默认 | 存储 |
| --- | --- | --- | --- |
| 悬停操作条 | 设置 → 页面增强 → 视频卡片 → 悬停操作条 | 开 | `settings.enableVideoCardQuickActions` |

- 第 9 轮起开关直接读写 `settings.enableVideoCardQuickActions`（`src/logic/storage.ts`，模块只读字段名、
  写值经 `settings` 响应式引用），设置页与卡片共用同一状态，改动立即生效，无需刷新；
- **旧 localStorage 迁移**：第 8 轮写在 `localStorage` 的 `bewly-card-quick-actions`（`'1'` / `'0'`）
  会在首次挂载操作条时一次性迁移到 settings：只有旧值为 `'0'` 且设置仍为默认（开启）时才写入关闭，
  随后删除旧 key，之后不再读取；
- 关闭后卡片不再渲染操作条；VideoCard 会回退渲染原先封面右上角单独的「稍后再看」按钮，能力不回退。

## 4. aid 解析（唯一允许的额外请求）

写接口需要 `aid`，但多数页面的卡片数据只有 `bvid`：

1. 优先用卡片自带的 `video.aid`；
2. 其次查本次会话的 `bvid → aid` 缓存；
3. 仍然缺失且卡片有 `bvid` 时，调用 `api.video.getVideoInfo({ bvid })` 换一次 aid 并缓存
   （仅在本模块、仅在用户**真的点击**时才请求，不会因为渲染 / 悬停而请求）。

解析失败时 toast「点赞失败 / 收藏失败」，不发送写请求。

## 5. 文件清单

`src/components/VideoCardQuickActions/`：

| 文件 | 作用 |
| --- | --- |
| `preferences.ts` | 开关（settings 为主 + 旧 localStorage 一次性迁移 + 程序化切换） |
| `favoriteFolders.ts` | 收藏夹列表（5 分钟缓存、并发合并、归一化 `isDefault` / `isPrivate`）、默认夹兜底 |
| `useCardQuickActions.ts` | 单卡状态与操作：aid 解析、点赞、收藏夹面板状态、差异提交、乐观更新与回滚、toast、登录判断 |
| `FavoriteFolderPanel.vue` | 收藏夹多选面板（键盘可达、点击外部关闭、窄屏滚动、加载/失败/重试） |
| `VideoCardQuickActions.vue` | 操作条 UI（点赞 / 收藏 / 稍后再看 + 挂载收藏面板） |
| `i18n.ts` | 模块内文案（cmn-CN + en，其余语言回落简中） |
| `index.ts` | 统一导出 |

相关改动（前几轮）：`src/components/VideoCard/VideoCard.vue` 渲染操作条（关闭时回退原「稍后再看」按钮）、
`src/components/Settings/Pages/Pages.vue` + `i18n.ts` 的「视频卡片」分组开关。

## 6. Lead 需要接线 / 后续项

1. 无需改 `App.vue` / `contentScripts/index.ts` / `background`；开关已并入 settings。
2. （可选）如果希望「取消收藏」能覆盖在 B 站原生页面点过收藏的视频，需要新增「查询视频收藏状态」的接口
   （如 `x/v3/fav/folder/collected/list`）或在卡片数据里带上收藏状态；当前按简报只依赖会话内记录。
3. （可选）多 P 视频目前按 `aid` 维度收藏，收藏夹里的具体分 P 不影响。

## 7. 已知限制

1. **点赞 / 收藏状态只用内存记录本次会话内本扩展完成的操作**，不查询服务端状态：
   在 B 站原生页面点过赞 / 收藏过的视频，卡片上仍显示为未操作；点赞再点会正常成功（B 站接口幂等），
   收藏会走「加分 P 到默认夹」的路径。
2. 因此「已收藏再点取消」只对**本会话内**收藏过的视频生效；对历史已收藏的视频，按钮显示为未收藏，
   打开面板默认勾选默认收藏夹，取消勾选后提交也不会移除其他未知收藏夹里的收藏。
3. 收藏夹列表缓存 5 分钟：期间在 B 站网页上新建 / 删除收藏夹不会立即出现在面板里（面板失败态可点「重试」
   强制刷新）。
4. 面板默认预选默认收藏夹；若用户改了默认夹或 `attr & 2` 识别不到，会按「第一个公开夹 → 列表首个」兜底。
5. 操作条依赖 `hover` / 键盘焦点；`(hover: none)` 触屏设备上不会自动出现（可键盘 Tab 聚焦触发）。
6. 与悬停预览共存：预览视频在封面最底层（`z-index: 0`），操作条 `z-index: 2`，面板 `z-index: 6`。
7. 所有写操作都有 try/catch 且只包住自己的按钮点击，不会影响卡片本身的点击 / 打开逻辑。