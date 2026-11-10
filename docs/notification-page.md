# 消息页交互增强（native message.bilibili.com）

第 3 轮 A 工作流，负责人 `notifications`。

消息页是 **B 站原生页面**（`message.bilibili.com`），Bewly 不能替换它的 DOM，
只能在上面叠加浮层。本模块用 Lead 提供的通用外壳
`src/contentScripts/nativeOverlay/index.ts`（`mountNativeOverlay` /
`unmountNativeOverlay` / `hasNativeOverlay`）挂一个独立 shadow root 的增强层，
提供「右下角浮动按钮 + 展开面板」：未读筛选、分类快捷跳转、批量已读、列表密度。

## 1. 改动文件

| 文件 | 说明 |
| --- | --- |
| `src/contentScripts/notificationPage/index.ts` | **新建**：入口 `setupNotificationPage()` / `teardownNotificationPage()`，挂载、轮询、MutationObserver 与事件接线 |
| `src/contentScripts/notificationPage/dom.ts` | **新建**：DOM 适配层（页面判定、条目识别、未读判定、分类项、全部已读按钮、输入框让行） |
| `src/contentScripts/notificationPage/actions.ts` | **新建**：行为层（面板、未读筛选、密度、分类跳转、全部已读、DOM 状态同步） |
| `src/contentScripts/notificationPage/state.ts` | **新建**：`reactive` UI 状态 |
| `src/contentScripts/notificationPage/i18n.ts` | **新建**：模块内 i18n（简中 + 英文，其余语言回退简中） |
| `src/contentScripts/notificationPage/preferences.ts` | **新建**：sessionStorage 偏好读写（key 全部以 `bewly-notif-` 开头） |
| `src/contentScripts/notificationPage/constants.ts` | **新建**：浮层 id 与状态类名常量（避免 actions / shortcuts / index 循环 import） |
| `src/contentScripts/notificationPage/shortcuts.ts` | **新建**：键盘快捷键（捕获阶段） |
| `src/contentScripts/notificationPage/components/NotificationOverlay.vue` | **新建**：浮层组件（`<script setup lang="ts">`） |
| `src/contentScripts/notificationPage/notificationPage.shadow.scss` | **新建**：浮层样式（`?inline` 注入 shadow root） |
| `src/styles/adaptedStyles/pages/notificationsPage.scss` | **只追加**末尾「第 3 轮」区域（未读筛选 / 紧凑密度两组规则），既有规则一行未删 |
| `docs/notification-page.md` | 本文件 |

未修改：`views/App.vue`、`contentScripts/index.ts`、`logic/storage.ts`、`_locales/**`、
`composables/**`、`styles/main.scss`、`contentScripts/nativeOverlay/**`、`package.json`、`vite.config*`。

## 2. 用户可见行为

- **右下角浮动按钮**：铃铛图标 + 未读数字徽标（读不到未读计数时不显示数字）+ 文案；
  点击展开 / 收起面板，展开状态记在 sessionStorage（刷新后仍展开）。
- **未读筛选**：面板里「只看未读」开关。打开后给 `<html>` 加 `bewly-notif-only-unread`，
  已读条目被 CSS 隐藏（`html.notificationsPage.bewly-notif-only-unread [data-bewly-notif-read="1"]`）。
  页面识别不到任何已读 / 未读标记时，开关**置灰**并给出说明，而不是假装生效。
- **分类快捷跳转**：回复 / @我 / 点赞 / 系统 四个胶囊，点击派发原生分类项点击
  （优先点分类项里的 `<a>`，hash 路由 `#/reply` `#/at` `#/love` `#/system`），
  当前页面找不到的分类置灰。
- **批量已读**：只有页面上真的存在原生「全部已读」类按钮时，面板才显示该按钮，
  点击即点原生按钮（找不到就不显示，不会留一个点了没反应的按钮）。
- **密度切换**：舒适 / 紧凑。紧凑档给 `<html>` 加 `bewly-notif-compact`，
  条目上下内边距减半、行高收紧、时间字号降一级、左栏条目更紧。
- **键盘**：`U` 切换只看未读、`1`–`4` 跳分类、`D` 切换密度、`Esc` 关面板；
  在输入框 / 回复框里、带 Ctrl/Cmd/Alt、以及来自 Bewly 自身 UI 的按键全部让行。
- 面板与按钮都有 `aria-label`、`type="button"`、`aria-pressed` / `aria-checked` /
  `aria-expanded`，键盘焦点有 `focus-visible` 描边；`prefers-reduced-motion: reduce`
  下所有过渡与位移/缩放动画关闭。

## 3. 状态存储

全部在 **sessionStorage**（只影响当前标签页，刷新保留、关标签页即清），不新增设置项：

| key | 值 | 用途 |
| --- | --- | --- |
| `bewly-notif-only-unread` | `'1'` / `'0'` | 只看未读 |
| `bewly-notif-density` | `'comfortable'` / `'compact'` | 列表密度 |
| `bewly-notif-panel-open` | `'1'` / `'0'` | 面板展开状态 |

对应挂在 `<html>` 上的状态类：`bewly-notif-only-unread`、`bewly-notif-compact`。
条目上写入的属性：`data-bewly-notif-read`（`'0'` = 未读，`'1'` = 已读，未识别时不写）。

## 4. DOM 依赖（全部来自仓库既有 scss，没有凭空造类名）

| 用途 | 选择器 | 来源 |
| --- | --- | --- |
| 条目根类 | `.reply-card` / `.at-card` / `.love-card` / `.msg-notify` | `notificationsPage.scss` 既有规则（第 2 轮文档也确认是「回复 / @ / 点赞 / 系统」四类条目） |
| 列表容器 | `.space-right .message-list` → `.space-right .space-right-bottom` → `.space-right` → `#link-message-container` | 同上（逐级 fallback） |
| 左栏分类 | `.space-left .side-bar .item`（内含 `a[href]`） | 同上 |
| 未读数字 | `.side-bar .notify-number` | 同上 |
| 未读圆点 | `.notify-dot` | 同上 |
| 分类路由 | `#/reply` `#/at` `#/love` `#/system` | `src/components/TopBar/components/NotificationsPop.vue` 里确认过的 URL |
| 全部已读 | 文字匹配 `全部已读` / `一键已读` / `标记全部已读` / `Mark all read`，类名 `read-all` 兜底 | 文字为主路径（类名没有仓库证据，所以不写死） |

**已读 / 未读判定**（`dom.ts` 的 `isItemUnread` / `hasReadStateSignal`）用**语义 token 识别**
而不是写死某个类名，因为仓库里没有 B 站条目的已读类名证据：

1. 条目里有 `.notify-dot`；
2. 条目类名里出现 `unread` / `is-new` / `new-msg` 等 token（正则 `UNREAD_CLASS_RE`）；
3. `data-unread` / `data-is-unread` / `data-read` 属性为真；
4. `aria-label` 或条目内的短文字标签写了「未读」。

一个都识别不到时，`canFilterUnread` 为 `false`，面板把开关置灰并提示
「当前页面没有可识别的已读 / 未读标记，筛选不可用」；此时不会给条目写
`data-bewly-notif-read`，CSS 规则也不会命中，页面保持原样。

## 5. 幂等与生命周期

- `setupNotificationPage()`：非 `message.bilibili.com` 直接 return（空操作）；
  `document.body` 还没好时挂 `DOMContentLoaded` 一次；
  已挂载（`hasNativeOverlay('bewly-notification-page')`）时直接 return，不会重复挂。
- `teardownNotificationPage()`：断 observer / 定时器 / 事件、`unmountNativeOverlay`、
  撤掉 `<html>` 状态类、清掉条目属性与吐司；sessionStorage 偏好保留，下次进页恢复。
- DOM 同步有三条来源：MutationObserver（150ms 合并）、打开消息后的延迟同步（350ms）、
  1.5s 兜底轮询（`document.hidden` 时跳过）。三处都只在值变化时写 DOM。

## 6. Lead 接线情况

`src/contentScripts/index.ts` 里已有的 `import { setupNotificationPage } from './notificationPage'`
与 `setupNotificationPage()` 调用**已满足**本模块入口约定，**不需要再改**；本文件的创建
同时修好了主分支「入口 import 但文件不存在」导致的编译失败。

`teardownNotificationPage()` 目前没有调用点（页面卸载时浏览器会一并回收）；
如果以后要做 SPA 式切换或需要在 `beforeunload` 前主动清理，再接线即可。

## 7. 已知限制

- **未读判定的兜底是「语义识别」**：如果线上消息页既没有 `.notify-dot`，又只用一个
  `css-xxxx` 哈希类名标记未读，本模块就识别不到，此时筛选开关会置灰（这是有意为之：
  宁可不可用，也不给出一个开了没反应的开关）。要修的话，先在浏览器里取到真实类名，
  加进 `dom.ts` 的 `UNREAD_CLASS_RE` / 选择器即可，不用动 UI。
- **「全部已读」依赖文案**：B 站若把按钮文案改成我们不认识的说法（且类名不含 `read-all`），
  按钮就不显示；不会误点别的按钮。
- **未读数字来自左栏徽标求和**：抽屉模式（`settings.openNotificationsPageAsDrawer`）下
  iframe 里若隐藏了左栏（`.space-left .title` 被隐藏但 `.side-bar` 仍在），仍能读到；
  若左栏整个不存在，退化为「当前列表里识别到的未读条目数」，再不行就隐藏数字。
- **面板固定右下角**：抽屉模式（窄 iframe）下面板宽度 `min(340px, 100vw - 48px)`，
  不会被裁切，但会占据较多可视面积；这是刻意的取舍（不做拖拽 / 记忆位置）。
- **严格不调用写接口**：批量已读只点原生按钮，本模块自身不发任何网络请求。
- 本轮**没有跑浏览器验证**（按分工由 Lead 统一构建与回归），也没有跑 `pnpm build` / playwright。

## 8. 自测记录

- `pnpm exec eslint src/contentScripts/notificationPage src/styles/adaptedStyles/pages/notificationsPage.scss --fix`
  → 0 error 0 warning；不带 `--fix` 再跑一次仍为 0 error 0 warning。
- `pnpm run typecheck`（`vue-tsc`）→ 0 error。
- `pnpm exec sass` 编译 `notificationsPage.scss` 成功（含本轮追加区域），无警告。
- 组件模板语义检查：所有 `<button>` 均显式 `type="button"`；面板为 `role="dialog"` +
  `aria-label`；开关为 `role="switch"` + `aria-checked`；密度为 `role="radiogroup"` +
  `role="radio"` + `aria-checked`；数字徽标与吐司分别有 `aria-live` / `role="status"`。
- 未启动 / 关闭浏览器，未做 git 操作，未跑 build / pack / playwright。
