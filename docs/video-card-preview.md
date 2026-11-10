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
| `bewly-card-preview` | localStorage | 开启 | `'1'` 开 / `'0'` 关；缺省视为开启。**本轮不改 `logic/storage.ts`**，后续可并入设置页 |
| `settings.enableVideoPreview` | 设置 → 卡片 | 开 | 作为总开关参与判断（既有的「视频预览」设置继续有效） |
| `settings.enableVideoCtrlBarOnVideoCard` | 设置 → 卡片 | 关 | 开启后预览显示播放控件（否则无控件） |
| `settings.hoverVideoCardDelayed` | 设置 → 卡片 | 关 | 开启后悬停延迟由 900ms 放宽到 1200ms |

启用条件是：`bewly-card-preview` 与 `settings.enableVideoPreview` 同时为开，且设备/动效偏好允许。

> 临时关闭预览：控制台执行 `localStorage.setItem('bewly-card-preview', '0')` 后刷新；
> 恢复：`localStorage.removeItem('bewly-card-preview')`。

## 3. 文件清单

新增 `src/components/VideoCardPreview/`：

- `previewSettings.ts`：localStorage 开关、`(hover: none)` / `prefers-reduced-motion` 能力检测、
  悬停延迟与 6 秒上限常量、是否显示控件
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

## 4. 给 Lead 的接线 / 后续项

1. **设置页开关（可选）**：如需把 `bewly-card-preview` 并入设置，建议在
   `logic/storage.ts` 增加 `enableVideoCardPreview: boolean`（默认 `true`），
   `Settings` → 卡片分组加 `Radio`，再把 `previewSettings.isCardPreviewEnabled()` 的数据源换过去。
   本轮按要求未改 `storage.ts`。
2. **页面补 `cid`**：预览依赖卡片数据里的 `cid`（拿不到就不请求、不预览）。目前只有
   Home 的 ForYou / Ranking / Trending 在映射时传了 `cid`；Following、搜索页、历史 / 稍后再看 / 收藏
   等列表页的卡片数据未带 `cid`，这些页面暂时不会出现预览。
   若希望全站生效，需要在这些页面的 `video` 映射里补 `cid`（接口返回里有 cid 时直接透传即可）。
3. 无需改 `App.vue` / `contentScripts/index.ts`，组件内生效。

## 5. 已知限制

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
