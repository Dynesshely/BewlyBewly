# 首页卡片密度（舒适 / 紧凑）

第 7 轮 C 节交付。首页（Bewly 接管后的推荐 / 关注 / 订阅剧集 / 热门 / 排行 / 直播六个子标签）
支持**舒适**与**紧凑**两档卡片密度：紧凑档每行多一张卡片、间距更小、标题字号小一档。

需求来自 `settings.homeCardDensity`（`'comfortable' | 'compact'`，默认 `comfortable`，由 Lead 在
`storage.ts` 里预置），**本模块不写 storage**，只读 + 回写该字段。

## 改动文件

| 文件 | 改动 |
| --- | --- |
| `src/contentScripts/views/Home/Home.vue` | 读 `settings.homeCardDensity`；根节点加 `home-density-compact` class；顶部工具条新增密度分段控件；切换后按卡片锚点校正滚动位置；聚焦浏览期间临时暂停密度样式 |
| `src/contentScripts/views/Home/i18n.ts` | 新建：密度相关的中英文案（cmn-CN + en，其余语言回退简中） |
| `src/components/Settings/Pages/Pages.vue` | **只追加**「首页」分组：卡片密度下拉（复用已有的 `densityOptions`） |
| `src/components/Settings/Pages/i18n.ts` | **只追加** 4 个文案 key：`groupHome` / `groupHomeDesc` / `homeCardDensity` / `homeCardDensityDesc`（中英） |
| `docs/home-density.md` | 本文件 |

> 与 A 工作流（悬停预览开关）并行修改 `Pages.vue` / `i18n.ts`：
> 我的改动全部是**在文件末尾追加**（Pages.vue 加「首页」分组、i18n.ts 加 4 个 key 到两个语言对象末尾），
> 不重排既有分组与 key，git 合并时应无冲突；若冲突，以保留双方新增为准。

## 实现方式（纯 CSS）

### 1. 容器 class

`Home.vue` 根节点：

```vue
<div :class="densityClass">   <!-- { 'home-density-compact': 紧凑 && 非聚焦浏览 } -->
```

密度状态直接从 settings 计算：

```ts
const cardDensity = computed(() => settings.value.homeCardDensity === 'compact'
  ? 'compact'
  : 'comfortable')
```

### 2. 网格列数与间距

六个子组件各自用 scoped 样式定义网格类（`.grid-adaptive` / `.grid-adaptive-video` /
`.grid-adaptive-bangumi` / `.grid-two-columns` / `.grid-one-column`），列数是 UnoCSS 的响应式
`cols-N` + `@media`。父组件的 scoped 样式要覆盖子组件，只能用 `:deep()`，且必须 `!important`
（子组件里的 `@media` 规则与父级选择器同特异性）：

| 网格类 | 舒适档（原样） | 紧凑档（新增） |
| --- | --- | --- |
| `.grid-adaptive` / `.grid-adaptive-video` | 2xl 5 列 / xl 4 / lg 3 / md 2 / sm 1，gap 20px | `repeat(auto-fill, minmax(240px, 1fr))`，gap 12px |
| `.grid-adaptive-bangumi`（番剧排行，封面 3:4） | 2xl 5 列 … md 2，gap 20px | `repeat(auto-fill, minmax(200px, 1fr))`，gap 12px |
| `.grid-two-columns` / `.grid-one-column` | xl 2 列 / 1 列，gap 16px | 列数不变，gap 12px |

自适应档用 `auto-fill + minmax(240px, 1fr)` 而不是写死 `cols-6`：
Bewly 的页面宽度是 `calc(100% - 150/200px)`、上限 `--bew-page-max-width`，
用最小卡片宽 240px 让浏览器按**当前容器宽度**自动决定列数，宽屏下自然比舒适档多 1 列（见下节实测）。

### 3. 标题字号降一档

VideoCard 组件的标题 `<h3 class="keep-two-lines">`（全局组件，本轮未改），
在紧凑档下由父容器统一降一档：

```scss
:deep(.keep-two-lines) {
  font-size: calc(var(--bew-base-font-size) * 0.93) !important;
}
```

舒适档仍是原来的 `text-lg`（约 1.125× 基准字号）。

## 切换行为

- **顶部工具条**：首页 sticky 头部右侧新增「舒适 / 紧凑」分段控件（原生 `<button type="button">`，
  `aria-pressed` + `aria-label` + `title`，Tab 可达），位置在原有「网格布局切换」左侧；
  两个控件用同一个 `.grid-layout-item-activated` 高亮样式。
- **设置页**：「页面增强」页新增「首页 → 卡片密度」下拉，与首页控件读写同一个
  `settings.homeCardDensity`，任一处切换另一处立即同步（响应式 settings）。
- **即时生效、不重新请求**：只切 class，不动 `videoList` 等数据，不触发 `initData()`。
- **滚动位置**：切换前记住视口内第一张卡片的 `data-video-url` 与屏幕位置，切换后等 DOM 重排
  再按 URL 找回该卡片，用 `scrollTop` 补偿它与原位置的差值（`nextTick + rAF`）。
  找不到锚点（空列表 / 骨架）时不做任何滚动操作。
- **与悬停预览共存**：预览挂在卡片封面上，密度只改列宽 / 间距 / 标题字号，不影响预览逻辑。
- **与聚焦浏览（Cover Flow）共存**：聚焦浏览会接管卡片尺寸（inline `width/height/transform`），
  密度样式此时已无实际作用；为避免两者叠加导致边缘状态，`Home.vue` 监听
  `focus-browse-change`，进入聚焦浏览时**临时移除** `home-density-compact` class，退出后自动恢复。

## 列数实测（按 1440px 视口估算）

- 内容区宽 ≈ `1440 - 200` = 1240px（`lg:[calc(100%-200px)]`）；
- 舒适档 `xl` 断点（≥1280px）：4 列，卡片宽 ≈ `(1240 - 3×20) / 4` ≈ 295px；
- 紧凑档 `minmax(240px)`：`floor((1240 + 12) / (240 + 12))` = 4 列 → 卡片宽 ≈ 295px，
  与舒适档相同列数时**仅间距与字号变小**；
  视口再宽一档（内容区 ≥ 1260px，即屏宽 ≥ 1460px）时紧凑档算得 5 列，比舒适档 4 列多一张；
  1920px 屏（内容区 ≈ 1720px）紧凑档 6 列 vs 舒适档 4 列。

> 说明：简报要求「列数 +1、最小卡片宽从 ~300 降到 ~240」。Bewly 的舒适档不是固定 300px
> 最小宽，而是响应式断点（1440px 屏 4 列、1920px 屏 4 列）。因此紧凑档统一用
> 「最小卡片宽 240px + 自动填充」表达「列数 +1」的意图：屏幕越宽越准确，
> 恰好卡在断点附近的宽度上可能不增加列数（只缩间距），这是 CSS 自动填充的固有特性。

## 降级与约束

- 所有新增样式只用 `--bew-base-font-size` 与原有网格类，不写死颜色，暗色自动跟随；
- 动效沿用原有 300ms 过渡，没有新增位移 / 缩放动画，无需额外 `prefers-reduced-motion` 处理；
- 密度只影响首页子标签；番剧页、列表页、搜索页各自的密度（已有实现）不受影响；
- 切换不做请求、不重建列表，不改变任何数据字段。

## 已知限制

- 紧凑档列数由容器宽度自动计算，**不是严格的「永远 +1 列」**（见上面实测说明）；
- 标题字号只作用于 VideoCard 的标题（`.keep-two-lines`），其它元信息字号保持不变；
- 滚动位置补偿以「视口内第一张卡片」为锚点；若该卡片在重排后被虚拟化 / 重新创建（骨架占位），
  锚点会失效，退化为不校正；
- 让首页提示条（`bewly-active-info`）等固定浮层不受密度影响；
- 设置页与首页控件都直接写 `settings.homeCardDensity`，没有单独的表单校验（类型由 storage 保证）。

## 首页「回到顶部」浮动按钮（第 10 轮）

- **出现条件**：首页滚动超过 **2 屏**（以首页滚动容器的可见高度为准）时，右下角淡入一个圆形按钮；
  回到顶部后自动隐藏，切子标签 / 清屏也会同步更新。
- **交互**：原生 `<button type="button">`，`aria-label` / `title` 来自首页模块内 i18n（中英），
  Tab 可达；点击平滑滚回顶部，`prefers-reduced-motion: reduce` 时直接跳。
- **外观**：`--bew-theme-color` 圆形底 + 白色箭头 + `--bew-shadow-2/3`，hover 上浮、active 轻微缩放，
  reduced-motion 下取消过渡与位移。
- **不与 Dock 冲突**：按 `settings.dockPosition` 让位 —— Dock 在右侧时右移 72px，在底部时上移 72px；
  其余情况固定在右下角（24px 边距）。
- **Zen 清屏模式隐藏**：监听 `<html class="bewly-zen">`（MutationObserver），清屏期间不渲染按钮；
  退出清屏后若仍在两屏以下，按钮自动回来。
- **不影响密度切换**：两者互不依赖；密度切换时按钮位置不变，仍按滚动距离判定。
