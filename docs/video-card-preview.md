# 视频卡悬停预览

悬停任意 `VideoCard` 900ms 后，用 `api.video.getVideoPreview` 取一段静音小片段，
覆盖在封面上播放最多 6 秒，然后淡出回到封面。

## 1. 用户可见行为

- **触发**：鼠标停在卡片上 900ms（用户开启「延迟悬停」设置时为 1200ms）才开始请求，不是一划过就加载。
- **播放**：拿到 `durl[0].url` 后，用 `<video muted autoplay playsinline>` 覆盖封面播放，**最多 6 秒**自动淡出。
  静音、无控件、`tabindex=-1`，不抢焦点、不进 Tab 序列；只有用户显式开启「显示播放控件」设置时才有控件。
- **同时最多 1 个预览**：悬停到另一张卡片会立刻停掉旧的并销毁其 `<video>`（释放播放资源）。
- **快速划过不发请求**：计时器 900ms，鼠标离开（或卡片卸载）立即取消；请求尚未返回也会丢弃结果。
- **失败静默**：请求失败、返回空地址、解码失败、自动播放被拦截都只回退到封面，不弹错、不重试；
  同一张卡片本次会话内不再重复请求。
- **不启用的情况**：触屏等 `(hover: none)` 设备、`prefers-reduced-motion: reduce`、
  页面处于后台标签页、浏览器离线、卡片没有 `cid`、用户关闭了开关。
- **缓存**：同一个 `bvid + cid` 的 playurl 结果在内存里缓存 5 分钟（playurl 链接带签名有效期），
  反复悬停同一张卡片不会重复请求；同一视频的并发请求会合并成一次。

## 2. 开关

| 开关 | 位置 | 默认 | 说明 |
| --- | --- | --- | --- |
| `settings.enableVideoCardPreview` | **设置 → 页面增强 → 视频卡片 → 悬停预览** | 开 | 第 7 轮起的正式开关（`src/logic/storage.ts`，模块只读使用） |
| `settings.enableVideoPreview` | 设置 → 通用 → 视频卡片 → 启用视频预览 | 开 | 旧实现的「视频预览」总闸，仍然参与判断：关闭后预览一并失效，避免留下死开关 |
| `settings.enableVideoCtrlBarOnVideoCard` | 设置 → 通用 → 视频卡片 | 关 | 开启后预览显示播放控件（否则无控件） |
| `settings.hoverVideoCardDelayed` | 设置 → 通用 → 视频卡片 | 关 | 开启后悬停延迟由 900ms 放宽到 1200ms |

启用条件是：`enableVideoCardPreview` 与旧的 `enableVideoPreview` 同时为开，且设备/动效偏好允许。

**旧 localStorage 开关的一次性迁移**：第 6 轮写在 `localStorage` 的 `bewly-card-preview`
（`'1'` / `'0'`）会在首次判定时迁移到 `settings.enableVideoCardPreview`：
只有旧值为 `'0'` 且设置仍为默认（开启）时才写入关闭，随后删除旧 key，之后不再读取。
用户如果已经在设置里改过，以设置为准。

## 3. 文件清单

新增 `src/components/VideoCardPreview/`：

- `previewSettings.ts`：开关（settings 为主 + 旧 localStorage 一次性迁移）、
  `(hover: none)` / `prefers-reduced-motion` 能力检测、悬停延迟与 6 秒上限常量、是否显示控件
- `useCardPreview.ts`：模块级单例控制器（唯一预览、900ms 计时、请求与缓存、并发合并、
  失败黑名单、6 秒计时、卸载清理），对外提供 `useCardPreview(cardId)` 句柄
- `VideoCardPreview.vue`：覆盖在封面上的 `<video>` 组件（静音、`playsinline`、可选控件、
  `ready` / `playing` / `ended` / `failed` 事件、淡出期间保留最后地址）
- `index.ts`：统一导出

改动 `src/components/VideoCard/VideoCard.vue`：

- 移除旧的「只在 `showPreview` + 设置开启时才预览、且缺 cid 时额外请求 `getVideoInfo`」逻辑，
  改为卡片悬停时调用 `useCardPreview` 的 `schedule` / `cancel`；
- 封面区域渲染 `<VideoCardPreview>`，沿用全局 `fade` 过渡；
- `showPreview` 入参保留兼容：显式传 `false` 的卡片不预览，缺省（`undefined`）视为允许。

第 7 轮改动：

- `src/components/VideoCardPreview/previewSettings.ts`：开关数据源由 `localStorage` 改为
  `settings.enableVideoCardPreview`，保留旧 key 一次性迁移；
- `src/components/Settings/Pages/Pages.vue` + `i18n.ts`：新增「视频卡片 → 悬停预览」开关（中英文案）；
- `History.vue` / `WatchLater.vue` / `Favorites.vue`：`toCard()` 透传接口自带的 `cid`。

## 4. 生效范围（第 7 轮补齐后）

预览只出现在**渲染 `~/components/VideoCard.vue` 且卡片数据带 `cid`** 的地方。

| 页面 / 区域 | 是否预览 | 说明 |
| --- | --- | --- |
| 首页 → 推荐 / 热门 / 排行 | ✅ | `ForYou` / `Trending` / `Ranking` 映射时已带 `cid` |
| 首页 → 关注 / 订阅剧集 / 直播 | ❌ | 这三处映射没传 `cid`（接口模型里也没有稳定的 cid），需要时再补 |
| 历史 | ✅（普通投稿） | 透传 `history.bvid` + `history.cid`；番剧 / 直播 / 专栏条目不下发 |
| 稍后再看 | ✅ | 透传 `item.bvid` + `item.cid`（回退 `item.page.cid`） |
| 收藏 | ✅（视频） | 透传 `item.ugc.first_cid`；音频收藏没有 cid，不预览 |
| 动态页 | ❌ | 动态页用的是自定义 `MomentCard`，不是 `VideoCard`，悬停预览不适用 |
| 搜索（Bewly 搜索起始页 / 原生搜索结果增强） | ❌ | 搜索起始页没有卡片；原生搜索结果由 `searchPage` 浮层在原生 DOM 上操作，不渲染 `VideoCard` |
| 分区 / 热门 / 排行榜原生页、空间、消息、文章 | ❌ | 同为原生 DOM 浮层方案，没有 `VideoCard` |

所有 `cid` 都是**直接透传接口返回的字段**，不会为补 cid 新增任何网络请求；
接口没给 cid 的页面/条目保持无预览。

## 5. 给 Lead 的后续项

1. 旧「启用视频预览」（`settings.enableVideoPreview`，通用设置）与新「悬停预览」目前是「与」关系：
   两个都能关。若希望只保留一个开关，可把通用设置里的旧开关移除或改成指向新字段，并同步
   `previewSettings.isCardPreviewEnabled()`（本模块已按新字段为主、旧字段兜底实现）。
2. 首页「关注 / 订阅剧集 / 直播」若也要预览，需要在这三处的 `video` 映射里补 `cid`
   （数据源模型里当前没有 cid，可能得确认接口字段，不属于本轮写入范围）。
3. 无需改 `App.vue` / `contentScripts/index.ts`。

## 6. 已知限制

1. **必须有 `cid`**。按简报要求「cid 拿不到就不预览」，不会为了补 cid 再发一次 `getVideoInfo` 请求。
2. playurl 缓存 5 分钟；跨过有效期后再次悬停会重新请求一次。
3. 请求超时（api 客户端 3 秒）会走全局 `api-error` 提示条——这是既有基础设施行为，
   本模块自身不弹任何错误。接口返回业务错误码时完全静默。
4. 失败的卡片在本次会话内不再重试（刷新页面后重置）。
5. 6 秒上限从「开始播放」算起；若浏览器迟迟不解码，最多先黑一下封面再回退，不会卡住。
6. 预览不参与键盘导航焦点，也不会因预览而改变卡片的点击行为（`pointer-events: none`，
   只有开启播放控件时才允许鼠标操作预览）。
7. 6 秒结束后鼠标若仍停在卡片上，不会自动重播；需要移出再移入（或悬停另一张卡片后再回来）才会再次预览。
8. 缓冲抖动不会延长 6 秒上限：`playing` 只在首次播放时对齐一次计时。
9. 开关改动对**正在播放**的片段不立即生效：最多再播完当前这 6 秒，下一次悬停即按新设置执行。