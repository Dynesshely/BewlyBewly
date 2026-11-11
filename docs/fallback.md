# 图片加载失败兜底（第 19 轮）

统一的图片失败占位：`Picture.vue` 的 `error` 分支 + `Feedback/FallbackImage.vue`。
目标是在图片 404 / CDN 抖动 / 防盗链时给出可辨认的占位，而不是浏览器默认破图或空白，
并且**不重试、不引起布局跳动**。

## 1. API

### `src/components/Feedback/FallbackImage.vue`（新建）

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `kind` | `'image' \| 'video' \| 'avatar'` | `image` | 图标与默认无障碍文案：图片 / 视频封面 / 头像 |
| `text` | `string` | `''` | 可选文字，小尺寸场景留空只显示图标 |
| `ariaLabel` | `string` | `''` | 自定义无障碍名称；缺省用 kind 对应的「图片加载失败」等文案 |

- 渲染为 `<span role="img" aria-label="...">`，读屏能读出失败状态而不是空白；
- 尺寸 **100% 填充父容器**（`width/height: 100%`），父容器尺寸由调用方决定，因此不会改变原图占位；
- 视觉：`--bew-fill-2` 底 + 1px 虚线 `--bew-border-color` + 居中图标（可选文字 11px）；
- 暗色：文字/图标升到 `--bew-text-2`、虚线用 `--bew-text-4`；
- `prefers-contrast: more`：边框与图标再提一档（`--bew-text-3` / `--bew-text-2`）；
- `forced-colors: active`：改用系统色 `Canvas` / `CanvasText`；
- 无动画、无网络请求，reduced-motion 天然兼容。

### `src/components/Picture.vue`（扩展）

新增 props：

| Prop | 默认 | 说明 |
| --- | --- | --- |
| `fallbackKind` | `image` | 透传给 FallbackImage 的媒体类型 |
| `fallbackText` | `''` | 占位上的可选文字 |
| `fallbackAriaLabel` | `''` | 占位无障碍名称；缺省取 `alt` |
| `aspect` | `''` | 可选宽高比（如 `"16 / 9"`），用于父容器靠图片撑高的场景 |

失败行为：

1. `<img>` 的 `error` 事件把当前 `src` 记入 `failedSrc`，**同一张图只记录一次**
   （重复 error 直接忽略），不会再发任何请求；
2. 失败时 `<picture>` 内不再渲染 `<img>` / `<source>`，改为渲染 `FallbackImage`；
3. `src` prop 变化（列表复用组件 / 换数据）时重置失败态，允许新图重新尝试；
4. 懒加载图片在进入视口前不会发请求，所以「未进入视口的图」不会出现失败态；
5. `<picture>` 加了 `display: block; max-width: 100%`，尺寸仍由调用方的 class 决定
   （与之前直接用 `<img>` 的占位一致）。

## 2. 接入点

| 位置 | 文件 | kind | 占位尺寸来源 |
| --- | --- | --- | --- |
| 视频卡封面 | `components/VideoCard/VideoCard.vue` | `video` | 调用方的 `aspect-video` 19:6 容器 |
| 视频卡 UP 头像 | `VideoCard/VideoCardAuthor/components/VideoCardAuthorAvatar.vue` | `avatar` | 头像容器固定 34 / 28px（`h-inherit`） |
| 动态卡媒体 · 视频 / 直播封面 | `views/Moments/components/MomentMedia.vue` | `video` | 父级 `.moment-media__*-cover` 的 16:9 |
| 动态卡媒体 · 专栏封面 | 同上 | `image` | 父级 96 / 64px 方块 |
| 动态卡媒体 · 图文九宫格 | 同上 | `image` | `.moment-media__cell` 的 `aspect-ratio: 1` |
| 动态卡头像 | `views/Moments/components/MomentCard.vue` | `avatar` | 父按钮固定 44px；占位文字用昵称首字符 |
| 列表页头图 | `views/listShared/components/ListPageHeader.vue` | `image` | 父级 `.bewly-list-hero__bg` 的 `inset: 0` |
| 番剧时间表 · 当日主推 | `views/Anime/components/AnimeTimeTable.vue` | `video` | 新增 `aspect="16 / 9"`（父容器靠图撑高） |
| 番剧时间表 · 更新缩略图 | 同上 | `video` | `.hero-more-thumb` 28px 方块（class 移到 `<picture>`，补 `overflow: hidden`） |
| 文章页图片大图 | `articlePage/components/ArticleImageLightbox.vue` | `image` | 新增 `.bap-lightbox__fallback`：`min(70vw, 900px)` + 16:9；文字走模块 i18n `imageFallback` |

灯箱的失败态是组件内 `imageFailed` + `@error` 实现的（它不经过 `Picture`，因为需要保留
`object-fit: contain` 与原生尺寸），但使用的仍是同一个 `FallbackImage` 视觉；
切换图片 / 重新打开灯箱时重置失败态。

## 3. 新增 i18n

`src/contentScripts/articlePage/i18n.ts` 增 `imageFallback`：简中「图片加载失败」、
英文「Image failed to load」、繁中/粤语「圖片載入失敗」。未改全局 `_locales`。

## 4. 未覆盖 / 已知限制

- **B 站原生文章正文的 `<img>`**（`.opus-detail img` 等）不由我们渲染，无法挂统一兜底；
  现有 `src/styles/main.scss` 里针对破图的 `img::before` 背景仍会生效，属于 B 站/全局兜底；
- **动态灯箱大图**（`MomentLightbox.vue`）本轮未接统一占位：它只在用户点开时加载，
  失败时保留浏览器默认破图；如需要可在下一轮复用 `FallbackImage`（与文章灯箱同一改法）；
- `<picture>` 的 `<source>`（AVIF / WebP）失败时浏览器会继续尝试下一个候选，
  只有最终 `<img>` 失败才会触发兜底 —— 这是期望行为；
- 占位不会尝试换协议 / 换尺寸重试（按需求「不发重试请求」）；
- 本轮**未做浏览器验证**：图片 404 的真实触发建议用 Playwright `page.route('**/*.jpg', r => r.fulfill({ status: 404 }))`
  断言 `.bewly-image-fallback` 出现、且该 URL 只被请求一次（建议加进 e2e，不在本轮写入范围）。

## 5. 自测

- `pnpm exec eslint <改动文件> --fix` 后裸跑：0 error 0 warning；
- `pnpm run typecheck`：0 error（含新增 Picture props / FallbackImage / 灯箱失败态）；
- `articlePage.shadow.scss` 通过 sass 编译；
- 未跑 build / playwright；未碰浏览器；未做 git 操作。
## 6. 第 20 轮：封面 404 兜底的 e2e 验证

第 4 节里「建议加进 e2e」的验证已在第 20 轮落地：`tests/e2e/image-fallback.spec.ts`。

- **做法**：`page.route('**/*')` 里把 `*.hdslb.com` 的 image 请求全部 `fulfill({ status: 404 })`，
  文档请求仍用本地首页快照；
- **断言**：
  1. `[data-video-card] .bewly-image-fallback` 可见，且带 `role="img"`（读屏可读「视频封面加载失败」）；
  2. 同一封面的 `<img src>`（排除 `.avif` / `.webp` 候选）**只被请求一次** ——
     `Picture.vue` 失败后把 `<img>` 换成占位，不会重试、也不会新增请求；
  3. 请求计数作为 annotation 输出，便于排查。
- **结果**：用例稳定通过（与 `focus-trap.spec.ts`、`card-quick-actions.spec.ts` 一起 `--repeat-each=2` 共 6/6 passed）。

### 仍未覆盖

- B 站原生文章正文 `<img>`（不归我们渲染）仍然只有全局 `img::before` 兜底；
- 视频卡封面在「悬停预览失败」时走的是预览模块自己的失败回调（不是图片兜底），本轮未改。
