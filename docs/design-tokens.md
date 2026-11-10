# 全站设计令牌：动效 / 间距 / 圆角（第 9 轮）

第 9 轮 C 工作流，负责人 `native-style`。目标：把散落在各处的动效时长、缓动曲线、间距与圆角
收敛成**一套令牌**，并让 `prefers-reduced-motion` 的降级只在一处生效。

## 1. 改动文件

新增：

| 文件 | 内容 |
| --- | --- |
| `src/styles/tokens/_motion.scss` | 动效时长 / 缓动曲线（Sass 变量 + `tokens` / `reduced-tokens` / `reduced-motion` mixin） |
| `src/styles/tokens/_spacing.scss` | 6 档间距（4 / 8 / 12 / 16 / 24 / 32） |
| `src/styles/tokens/_radius.scss` | 4 档圆角（sm 8 / md 12 / lg 16 / pill 999） |
| `docs/design-tokens.md` | 本文件 |

修改（只追加 / 只动自己写过的区域）：

| 文件 | 改动 |
| --- | --- |
| `src/styles/main.scss` | 顶部 3 行 `@use`；末尾追加「设计令牌」区域（`:root`/`:host` 暴露变量 + reduced-motion 令牌降级）。**既有规则一行未动。** |
| `src/styles/adaptedStyles/pages/_native-shared.scss` | native 令牌改为指向全站令牌（不再写死数值）；`reduced-motion` mixin 转发到 tokens/motion |
| `searchPage.scss` / `notificationsPage.scss` / `userSpacePage.scss` | **只替换第 2 轮（我写的）区域**：微间距改令牌、reduced-motion 块收敛（只保留悬停位移重置） |
| `channelPage.scss` | 无规则可替（我第 5 / 7 轮写的页面规则在模块 `pageStyles.scss` 里，本轮写入范围不含模块），未改动 |

未改动：`App.vue`、`contentScripts/index.ts`、`storage.ts`、`nativeOverlay`、`variables.scss`、
其它轮次由别的子智能体写的区域（第 3 轮搜索 / 消息增强、第 4 轮空间增强、上游既有规则）。

## 2. 令牌表

### 动效（`tokens/_motion.scss`）

| CSS 变量 | 值 | 说明 |
| --- | --- | --- |
| `--bew-motion-fast` | `120ms` | 悬停、焦点、小图标反馈 |
| `--bew-motion-base` | `180ms` | 面板过场、卡片状态切换（默认档） |
| `--bew-motion-slow` | `240ms` | 展开/收起、需要被注意到的过渡 |
| `--bew-ease-out` | `cubic-bezier(0.22, 0.61, 0.36, 1)` | 第 1–8 轮统一使用的曲线（快进慢出） |
| `--bew-ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | 位移动画 |
| `--bew-ease-linear` | `linear` | 进度条等线性变化 |

### 间距（`tokens/_spacing.scss`）

| CSS 变量 | 值 |
| --- | --- |
| `--bew-space-4` | 4px |
| `--bew-space-8` | 8px |
| `--bew-space-12` | 12px |
| `--bew-space-16` | 16px |
| `--bew-space-24` | 24px |
| `--bew-space-32` | 32px |

命名后缀即像素值，便于换算；超出这 6 档的微值（2px 描边偏移、0.4px 字距等）不强行套令牌。

### 圆角（`tokens/_radius.scss`）

| CSS 变量 | 值 | 说明 |
| --- | --- | --- |
| `--bew-radius-sm` | 8px | 按钮、标签、角标 |
| `--bew-radius-md` | 12px | 卡片、封面（等价于既有的 `--bew-radius`） |
| `--bew-radius-lg` | 16px | 吸顶栏、数据卡、动态卡 |
| `--bew-radius-pill` | 999px | 胶囊按钮、徽标 |

> 既有的 `--bew-radius: 12px`（`variables.scss`）**保持不变**，本轮只补 `--bew-radius-md` 作为同义别名，
> 以及缺失的 sm / lg / pill。三个页面里统一通过 `--bew-native-radius*` 间接引用。

## 3. 暴露方式（main.scss）

```scss
@use "./tokens/motion" as motion;
@use "./tokens/radius" as radius;
@use "./tokens/spacing" as spacing;

:root,
:host {
  @include motion.tokens;
  @include spacing.tokens;
  @include radius.tokens;
}
```

- 只追加，不改既有规则；
- `:root` 覆盖页面，`:host` 覆盖 Bewly 自己的 shadow root，两处都能拿到令牌；
- Sass 侧变量（`$duration-base`、`$space-16` 等）留给需要编译期求值的地方（mixin 默认值、媒体查询）。

## 4. reduced-motion 收敛

**一处生效**：`main.scss` 末尾

```scss
@media (prefers-reduced-motion: reduce) {
  :root,
  :host {
    @include motion.reduced-tokens; // 三个时长令牌 → 0ms
  }
}
```

因为所有页面过渡都写成 `var(--bew-motion-*)`（或经 `--bew-native-dur` 间接引用），
reduced-motion 下过渡时长恒为 0ms，**不需要每个文件再写 `transition: none`**。
本轮据此删掉了三个页面里「只关过渡」的降级块，只保留真正需要额外处理的：

| 页面 | 保留的降级内容 |
| --- | --- |
| 搜索结果页 | 悬停升起 `transform: none` |
| 消息页 | 无（纯过渡，令牌已覆盖） |
| 用户空间 | 悬停升起 `transform: none` |

`_native-shared.scss` 的 `reduced-motion` mixin 现在只是转发到 `tokens/motion` 的同名 mixin，
语义（`@media (prefers-reduced-motion: reduce)`）全站只有一份定义。

## 5. native 页面替换范围

`_native-shared.scss` 的 `tokens` mixin 改为**纯引用**：

| native 令牌 | 指向 |
| --- | --- |
| `--bew-native-gap-xs / sm / md / gap / lg / xl` | `--bew-space-4 / 8 / 12 / 16 / 24 / 32`（新增 md=12） |
| `--bew-native-radius-sm / radius / lg / pill` | `--bew-radius-sm / md / lg / pill` |
| `--bew-native-dur-fast / dur / dur-slow` | `--bew-motion-fast / base / slow`（新增 fast） |
| `--bew-native-ease` | `--bew-ease-out` |

每个引用都带原值兜底（如 `var(--bew-space-8, 8px)`），页面 CSS 单独加载也不会失效。

替换明细（只在我写的第 2 轮区域）：

- 搜索页：分区计数胶囊 `padding: 0 5px` → `padding: 0 var(--bew-native-gap-xs)`；
  圆角 / 间距原本已走 native 令牌，本轮顺着令牌链自动指向全站值；
- 消息页：未读数字胶囊 `padding: 0 5px` → `padding: 0 var(--bew-native-gap-xs)`；
  删掉只关过渡的 reduced-motion 块；
- 用户空间：reduced-motion 块收敛到只保留 `transform: none`。

**视觉变化**：`--bew-native-radius-lg` 从旧的 `calc(--bew-radius * 1.5) ≈ 18px` 收敛为全站 `16px`，
影响第 2 轮里用到「大圆角」的元素（吸顶筛选栏、UP 数据卡、动态卡、玻璃卡），其余值不变。

## 6. 没有覆盖到的部分（已知限制）

- **第 3 轮起的区域**（搜索结果页交互增强 `searchPage.scss` 第 3 轮段、消息页第 3 轮段、
  空间页第 4 轮段）由其它子智能体编写，本轮按「不动他人区域」的约束**没有替换**；
  它们已经在用 `var(--bew-native-*, 兜底值)` 的写法，会随 native 令牌一起指向全站令牌，
  只是仍有少量内联兜底值；
- **channelPage 模块**（`src/contentScripts/channelPage/pageStyles.scss`、
  `channelPage.shadow.scss`）与 **livePage 模块**（第 6 轮）里还留着字面量时长 / 圆角，
  本轮写入范围不含模块目录，未替换；建议后续单独一轮用同样的令牌；
- suggested next step：把 `--bew-native-*` 这一层逐步替换成直接用 `--bew-space-* / --bew-radius-*`，
  native 令牌可作为过渡期的兼容层保留。

## 7. 自测记录

- 本地 `sass@1.108` 编译：`tokens/_*.scss`、`main.scss`、`_native-shared.scss`、
  三个页面 scss、`channelPage.scss` 全部通过；`main.scss` 产物里能看到完整的
  `--bew-motion-* / --bew-ease-* / --bew-space-* / --bew-radius-*` 与 reduced-motion 的 0ms 覆盖；
- `pnpm exec eslint`（含 CSS Prettier 格式化）：0 error 0 warning；
- `pnpm run typecheck`：0 error（本轮没有改 TS）；
- 未跑 build / playwright；未碰浏览器；未做 git 操作。
