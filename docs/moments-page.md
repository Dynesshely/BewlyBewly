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