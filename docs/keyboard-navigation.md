# 键盘卡片导航

实现：`src/composables/useKeyboardCardNavigation.ts`，在 `App.vue` 顶层安装（全局单例）。

## 交互语义

| 输入 | 行为 |
| --- | --- |
| 方向键 | 按网格移动高亮卡片（列数自动探测） |
| Home / End | 跳到第一张 / 最后一张 |
| Enter | 新标签页打开当前高亮视频 |
| Space | 当前标签页打开当前高亮视频 |
| 滚轮 | 默认逐张切换卡片（页面锁定滚动），每一下输入只切一张 |

## 高亮

- 通过 `data-keyboard-active` 属性标记（不用 class，避免 Vue 重渲染覆盖）。
- 切换后通过 OverlayScrollbars/原生滚动容器把卡片滚入视口（顶部留 96px、
  底部留 32px），并在下一帧断言可见性、失败时校正一次。

## 设置项

`settings.keyboardNavLockScroll`（设置 → 首页）：

- 开启（默认）：滚轮锁定页面滚动、逐张切换卡片；
- 关闭：滚轮正常滚动页面，高亮跟随视口内卡片。

## 状态恢复

离开页面（`pagehide`）时把滚动位置与当前高亮视频 URL 写入 `sessionStorage`，
返回首页时恢复。

## 已知限制

- 卡片通过 `[data-video-card]` 选择器识别，新页面若使用不同卡片结构需同步标记。
- 弹窗/输入框聚焦时自动放行按键（`hasOpenModal` / `isEditableTarget`）。
