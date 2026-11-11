/**
 * 专栏 / 文章页阅读模块的常量。
 *
 * host id 同时用于 nativeOverlay 的幂等去重与「事件是否来自本模块 UI」判断。
 */
export const HOST_ID = 'bewly-article-page'

/** 页面级样式（注入到 document.documentElement，卸载时移除） */
export const PAGE_STYLE_ID = 'bewly-article-page-style'

/** 进入沉浸阅读时给 <html> 加的类名 */
export const ROOT_CLASS_READING = 'bewly-article-reading'

/** 正文容器标记：只有运行时确认存在的元素才会被打上这个属性 */
export const CONTENT_ATTR = 'data-bewly-article-content'
/** 目录锚点标记：可用于 scroll-margin-top 留白，避免跳转后被吸顶头挡住 */
export const TOC_TARGET_ATTR = 'data-bewly-article-toc-target'
/** 目录锚点序号（与 ui.tocItems 下标一致） */
export const TOC_INDEX_ATTR = 'data-bewly-article-toc-index'
/** 字号档位属性（s / m / l），只在阅读模式下存在 */
export const FONT_STEP_ATTR = 'data-bewly-font-step'

/** 代码块复制按钮标记（按钮本身与所在 pre 都打） */
export const CODE_COPY_ATTR = 'data-bewly-code-copy'
/** 已注入复制按钮的代码块标记，避免重复注入 */
export const CODE_BLOCK_ATTR = 'data-bewly-code-block'
/** 图片大图打开时给 <html> 加的类名（锁定页面滚动，关闭时恢复滚动位置） */
export const ROOT_CLASS_LIGHTBOX = 'bewly-article-lightbox-open'

/** sessionStorage key（`bewly-` 前缀，不新增全局设置项） */
export const STORAGE_READING = 'bewly-article-reading'
export const STORAGE_FONT_STEP = 'bewly-article-font'
export const STORAGE_TOC_OPEN = 'bewly-article-toc-open'

/** 滚动进度 / 目录高亮的节流帧数上限内直接 rAF，无需额外节流 */
export const PROGRESS_THROTTLE = 0
