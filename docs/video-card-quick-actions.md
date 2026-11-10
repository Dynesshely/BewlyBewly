# 视频卡快捷互动（点赞 / 收藏 / 稍后再看）

悬停（或键盘聚焦）任意 `VideoCard` 时，封面右下角出现一条紧凑操作条：
**点赞 / 收藏到默认收藏夹 / 稍后再看**。所有写操作都做了登录判断、乐观更新、失败回滚与 toast 反馈。

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
- **收藏**：点击后收藏到**默认收藏夹**：
  - 收藏夹列表来自 `api.favorite.getFavoriteCategories`，5 分钟缓存；
  - 默认收藏夹判定：`attr` 的 bit1（`attr & 2`）为默认为默认收藏夹，取不到则退到第一个公开收藏夹，最后退到列表首个；
  - 写接口 `api.favorite.dealFavoriteResource({ rid: aid, type: 2, add_media_ids: String(folderId), del_media_ids: '', csrf })`；
  - 已收藏（本会话内）再点只提示「已收藏在默认收藏夹」，不发请求；
  - 失败回滚高亮并 toast「收藏失败，请稍后重试」；找不到默认收藏夹时提示且不发请求。
- **稍后再看**：沿用原有逻辑（`api.watchlater.saveToWatchLater` / `removeFromWatchLater`），
  图标在已加入时切换为对勾并高亮；列表页（`ListVideoCard`）传 `showWatcherLater=false` 时这一项不渲染，
  由列表页自己的快捷操作条负责。
- **登录判断**：点击时先检查 `getUserID()` 与 `getCSRF()`，缺任一只 toast「需要先登录 B 站账号」，**不发请求**。
- **直播卡片**：没有点赞 / 收藏语义，只显示「稍后再看」。
- **并发保护**：同一个按钮请求在途时 `disabled`，避免连点重复提交。

## 2. 开关

| 开关 | 位置 | 默认 | 存储 |
| --- | --- | --- | --- |
| 悬停操作条 | 设置 → 页面增强 → 视频卡片 → 悬停操作条 | 开 | `localStorage` 的 `bewly-card-quick-actions`（`'1'` / `'0'`） |

- 关闭后卡片不再渲染操作条，立刻生效（响应式状态，无需刷新）；
  此时会保留原先封面右上角单独出现的「稍后再看」按钮，能力不回退；
- 同一标签页内的修改由 `setCardQuickActionsEnabled()` 直接写内存 + localStorage；
  其他标签页修改通过 `storage` 事件同步；
- 本轮按简报要求**没有新增 `storage.ts` 字段**；后续若要并入设置，可加
  `enableVideoCardQuickActions: boolean`（默认 `true`）后把 `preferences.ts` 的数据源换掉即可。

## 3. 文件清单

新增 `src/components/VideoCardQuickActions/`：

| 文件 | 作用 |
| --- | --- |
| `preferences.ts` | 开关状态（localStorage + 响应式 ref + storage 事件同步） |
| `favoriteFolders.ts` | 默认收藏夹 id 解析与 5 分钟缓存、并发合并、`invalidateDefaultFavoriteFolder()` |
| `useCardQuickActions.ts` | 单卡状态与操作：aid 解析（`video.aid` → 缓存 → `getVideoInfo`）、点赞 / 取消、收藏、乐观更新与回滚、toast、登录判断 |
| `i18n.ts` | 模块内文案（cmn-CN + en，其余语言回落简中） |
| `VideoCardQuickActions.vue` | 操作条 UI（原生 `button` + `aria-pressed` + `aria-label` + 禁用态） |
| `index.ts` | 统一导出 |

改动：

- `src/components/VideoCard/VideoCard.vue`：删除原封面右上角独立的「稍后再看」按钮，改为在封面左下角渲染
  `<VideoCardQuickActions>`（`show-watcher-later` 语义保持不变，`isInWatchLater` / `toggleWatchLater` 传入组件）；
- `src/components/Settings/Pages/Pages.vue` + `i18n.ts`：在「视频卡片」分组新增「悬停操作条」开关（中英文案）。

## 4. aid 解析（唯一允许的额外请求）

写接口需要 `aid`，但多数页面的卡片数据只有 `bvid`：

1. 优先用卡片自带的 `video.aid`；
2. 其次查本次会话的 `bvid → aid` 缓存；
3. 仍然缺失且卡片有 `bvid` 时，调用 `api.video.getVideoInfo({ bvid })` 换一次 aid 并缓存
   （仅在本模块、仅在用户**真的点击**时才请求，不会因为渲染 / 悬停而请求）。

解析失败时 toast「点赞失败 / 收藏失败」，不发送写请求。

## 5. Lead 需要接线 / 后续项

1. （可选）把开关并入 settings：新增 `enableVideoCardQuickActions: boolean`，然后把
   `preferences.ts` 里的 localStorage 改为读写该字段（接口不变，设置页只需换数据源）。
2. （可选）如果希望收藏按钮支持「取消收藏 / 选收藏夹」，需要先产品化交互（本轮的实现是固定收藏到默认夹、
   已收藏再点只提示）。多 P 视频请以具体分 P 的 cid 为准时，`aid` 不受影响（点赞 / 收藏都按 aid 维度）。
3. 无需改 `App.vue` / `contentScripts/index.ts` / `background`。

## 6. 已知限制

1. **点赞状态只用内存 Set 记录本次会话的结果**，刷新后会回到「未点赞」外观（不会主动查询服务端点赞状态，
   避免每张卡发请求）。因此在 B 站原生页面点过赞的视频，卡片上可能显示为未赞；点一次会变成「已赞」外观
   （若本来就是已赞，B 站接口会幂等成功）。
2. **收藏状态同理**只记录本次会话成功的收藏；不查询服务端是否已收藏。已收藏过的视频再点会真的发一次
   收藏请求（B 站会返回成功并保持已收藏），随后本地记为已收藏。
3. 收藏固定进「默认收藏夹」，没有选择收藏夹的 UI；`attr & 2` 取不到时按公开收藏夹兜底，可能与用户在 B 站
   设的默认夹不一致（此时可用 `invalidateDefaultFavoriteFolder()` 强制刷新缓存）。
4. 默认收藏夹缓存 5 分钟：期间在 B 站网页上新建 / 删除收藏夹不会立即生效。
5. 操作条依赖 `hover` / 键盘焦点；`(hover: none)` 触屏设备上不会出现（可用键盘 Tab 聚焦触发）。
6. 与悬停预览共存：预览视频在封面最底层（`z-index: 0`），操作条在 `z-index: 2`，预览播放时操作条照常可用。
7. 所有写操作都有 try/catch 且只包住自己的按钮点击，不会影响卡片本身的点击 / 打开逻辑。