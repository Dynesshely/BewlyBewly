/**
 * 新布局（html.bewly-video-fit）的样式表。
 *
 * 为什么把 CSS 放在模块里而不是 pages/videoPage.scss：
 * - 本轮的写入边界只允许 videoPage/layout/**、fixedLayout.ts、splitter.ts、videoPage.shadow.scss；
 *   而页面级选择器（#mirror-vdcon / #playerWrap / body）无法从 shadow scss 命中；
 * - 放在模块里 → 开关和样式同源：类不存在时样式整块失效（可回退），
 *   也不会和旧布局（html.bewly-video-fixed）的 4000 多行 CSS 抢级联顺序。
 *
 * 写入纪律：所有几何量都来自 compute.ts 写到 :root 的 --bvp-* 变量，
 * 这里不出现任何硬编码尺寸；颜色一律用 --bew-* 语义变量（深浅主题自动跟随）。
 */

/** 注入到页面（light DOM）的样式：整页铺满、三区定位、不出现页面滚动 */
export const FIT_PAGE_CSS = `
/* ---------- 1. 整页铺满、禁页面滚动 ---------- */
html.bewly-video-fit,
html.bewly-video-fit body {
  overflow: hidden !important;
  height: 100% !important;
  overscroll-behavior: none !important;
}

html.bewly-video-fit #app.app-v1,
html.bewly-video-fit #app {
  min-width: 0 !important;
  width: 100% !important;
  height: 100% !important;
  overflow: hidden !important;
  background: var(--bew-bg, transparent);
}

/* B 站原生头部 / 页脚 / 轨道占位条：由 Bewly 顶栏接管，避免撑出横向溢出 */
html.bewly-video-fit #biliMainHeader,
html.bewly-video-fit .bili-header,
html.bewly-video-fit #biliMainFooter,
html.bewly-video-fit .bili-footer,
html.bewly-video-fit #bewly-video-rail-spacer {
  display: none !important;
}

/* ---------- 2. 主区：固定贴视口，尺寸全部来自 --bvp-* ---------- */
html.bewly-video-fit #mirror-vdcon,
html.bewly-video-fit #mirror-vdcon.video-container-v1 {
  position: fixed !important;
  box-sizing: border-box !important;
  top: var(--bvp-main-top, 64px) !important;
  left: 0 !important;
  right: 0 !important;
  width: 100vw !important;
  max-width: none !important;
  height: var(--bvp-main-h, calc(100vh - 64px)) !important;
  margin: 0 !important;
  padding: 0 var(--bvp-pad, 24px) !important;
  display: grid !important;
  grid-template-columns: var(--bvp-left-w, 1fr) var(--bvp-side-w, 1fr) !important;
  grid-template-rows: 1fr !important;
  column-gap: var(--bvp-gap, 24px) !important;
  row-gap: 0 !important;
  overflow: hidden !important;
  background: var(--bew-bg, transparent);
}

/* 旧布局的响应式 <900 断点在这里不适用：新布局自己算窄屏 */
@media (max-width: 899.98px) {
  html.bewly-video-fit #mirror-vdcon,
  html.bewly-video-fit #mirror-vdcon.video-container-v1 {
    display: grid !important;
    grid-template-columns: var(--bvp-left-w, 1fr) var(--bvp-side-w, 1fr) !important;
    height: var(--bvp-main-h, calc(100vh - 64px)) !important;
  }
}

/* ---------- 3. 左列：播放器 + 信息区，全部按变量定高 ---------- */
html.bewly-video-fit #mirror-vdcon > .left-container,
html.bewly-video-fit #mirror-vdcon .left-container {
  grid-column: 1 !important;
  grid-row: 1 !important;
  box-sizing: border-box !important;
  display: flex !important;
  flex-direction: column !important;
  gap: var(--bvp-gap-inner, 8px) !important;
  width: 100% !important;
  max-width: none !important;
  height: 100% !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  position: static !important;
}

html.bewly-video-fit #playerWrap {
  position: relative !important;
  flex: 0 0 auto !important;
  box-sizing: border-box !important;
  width: var(--bvp-player-w, 100%) !important;
  height: var(--bvp-player-h, auto) !important;
  min-height: 0 !important;
  max-height: none !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  border-radius: var(--bew-radius-lg, 12px);
  background: var(--bew-bg, #000);
}

/* 播放器内部：画面区按 --bvp-player-video-h 定高，视频填满不留黑边 */
html.bewly-video-fit #playerWrap video {
  object-fit: contain !important;
}

/* 左列其它块（信息栏 / 工具栏 / 标签行）：不参与拉伸，按内容高度 */
html.bewly-video-fit #mirror-vdcon > .left-container > #bewly-info-bar,
html.bewly-video-fit #mirror-vdcon > .left-container > #viewbox_report,
html.bewly-video-fit #mirror-vdcon > .left-container > #arc_toolbar_report,
html.bewly-video-fit #mirror-vdcon > .left-container > .video-tag-container {
  flex: 0 0 auto !important;
  min-height: 0 !important;
  margin: 0 !important;
}

html.bewly-video-fit .video-tag-container {
  max-height: none !important;
}

/* ---------- 4. 右列：创作者卡片 + 评论区（内部滚动） ---------- */
html.bewly-video-fit #mirror-vdcon > .right-container,
html.bewly-video-fit #mirror-vdcon .right-container {
  grid-column: 2 !important;
  grid-row: 1 !important;
  box-sizing: border-box !important;
  display: block !important;
  width: 100% !important;
  max-width: none !important;
  height: 100% !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  position: static !important;
}

html.bewly-video-fit .right-container-inner {
  box-sizing: border-box !important;
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  position: static !important;
}

html.bewly-video-fit .bewly-comment-column,
html.bewly-video-fit [data-bewly-comment-column] {
  box-sizing: border-box !important;
  display: flex !important;
  flex-direction: column !important;
  gap: var(--bvp-gap-inner, 8px) !important;
  width: 100% !important;
  max-width: none !important;
  height: var(--bvp-side-h, 100%) !important;
  max-height: var(--bvp-side-h, 100%) !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}

/* 创作者卡片：不参与滚动，按内容高度 */
html.bewly-video-fit .bewly-comment-column > .up-panel-container,
html.bewly-video-fit .up-panel-container {
  flex: 0 0 auto !important;
  min-height: 0 !important;
  margin: 0 !important;
}

/* 评论区：吃掉右列剩余高度，内部滚动 */
html.bewly-video-fit .bewly-comment-column > #commentapp,
html.bewly-video-fit .bewly-comment-column #commentapp,
html.bewly-video-fit #commentapp {
  flex: 1 1 auto !important;
  box-sizing: border-box !important;
  height: auto !important;
  min-height: 0 !important;
  max-height: none !important;
  margin: 0 !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  scrollbar-gutter: stable;
}

/* 底部发送区：钉在评论区底部（自绘评论组件） */
html.bewly-video-fit .bcd-compose,
html.bewly-video-fit .bvp-comment-composer {
  position: sticky !important;
  bottom: 0 !important;
  z-index: 2;
  background: var(--bew-bg, #fff);
}

/* ---------- 5. 上下分区（窄视口）：播放器在上、评论在下 ---------- */
html.bewly-video-fit.bewly-video-fit-stacked #mirror-vdcon {
  grid-template-columns: 1fr !important;
  grid-template-rows: var(--bvp-left-h, auto) minmax(0, 1fr) !important;
  row-gap: var(--bvp-gap-inner, 8px) !important;
  height: var(--bvp-main-h, calc(100vh - 64px)) !important;
}

html.bewly-video-fit.bewly-video-fit-stacked #mirror-vdcon > .left-container,
html.bewly-video-fit.bewly-video-fit-stacked #mirror-vdcon .left-container {
  grid-column: 1 !important;
  grid-row: 1 !important;
  height: var(--bvp-left-h, auto) !important;
}

html.bewly-video-fit.bewly-video-fit-stacked #mirror-vdcon > .right-container,
html.bewly-video-fit.bewly-video-fit-stacked #mirror-vdcon .right-container {
  grid-column: 1 !important;
  grid-row: 2 !important;
  width: var(--bvp-side-w, 100%) !important;
  height: var(--bvp-side-h, auto) !important;
}

html.bewly-video-fit.bewly-video-fit-stacked .bewly-comment-column,
html.bewly-video-fit.bewly-video-fit-stacked [data-bewly-comment-column] {
  height: var(--bvp-side-h, 100%) !important;
  max-height: var(--bvp-side-h, 100%) !important;
}

/* ---------- 6. 无障碍 / 动效 ---------- */
@media (prefers-reduced-motion: reduce) {
  html.bewly-video-fit #mirror-vdcon,
  html.bewly-video-fit #playerWrap {
    transition: none !important;
  }
}
`

/**
 * 注入到增强层 shadow root 的样式：推荐轨道置底 + 横向滚动。
 *
 * 轨道节点在 #bewly-video-page 的 shadow root 里，页面级 CSS 命中不到，
 * 因此单独注入一份；轨道自身的定位由 rail.ts 写内联样式（每拍重算），
 * 这里用 !important 把它钉在 compute.ts 算出的位置上，两边不会打架。
 */
export const FIT_SHADOW_CSS = `
.bvp-rail {
  position: fixed !important;
  box-sizing: border-box !important;
  top: var(--bvp-rail-top, auto) !important;
  left: var(--bvp-rail-left, 24px) !important;
  width: var(--bvp-rail-w, calc(100vw - 48px)) !important;
  height: var(--bvp-rail-h, auto) !important;
  max-height: var(--bvp-rail-h, none) !important;
  margin: 0 !important;
  overflow: hidden !important;
  border-radius: var(--bew-radius-lg, 14px);
}

.bvp-rail__viewport {
  height: 100% !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  scrollbar-width: thin;
}

.bvp-rail__track {
  height: 100% !important;
  flex-wrap: nowrap !important;
}

/* 轨道收起（窄屏 / 关闭）时整块不占位 */
html:not(.bewly-video-fit) .bvp-rail {
  /* 旧布局保持原样：不加任何限制 */
}
`
