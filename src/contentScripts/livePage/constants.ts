/**
 * 直播页增强模块的固定标识。
 *
 * 单独放一个文件，避免 actions / keyboard / index 互相 import 形成环。
 */

/** 浮层容器 id（nativeOverlay 用它做幂等判断，teardown 也用它） */
export const HOST_ID = 'bewly-live-page'

/** 挂在 <html> 上的「模块已接管」标记 */
export const ROOT_CLASS_PAGE = 'bewly-live-page'
/** 影院模式（压暗 + 播放器铺满） */
export const ROOT_CLASS_CINEMA = 'bewly-live-cinema'
/** 隐藏右侧栏 */
export const ROOT_CLASS_HIDE_ASIDE = 'bewly-live-hide-aside'

/** 页面级 <style> 的 id（直播页没有 adaptedStyles 分支，由模块自行注入） */
export const PAGE_STYLE_ID = 'bewly-live-page-style'

/** 播放器舞台（JS 打标记，样式只认属性，不依赖 B 站类名） */
export const PLAYER_ATTR = 'data-bewly-live-player'
/** 播放器所在布局容器（播放器与侧栏的共同祖先） */
export const LAYOUT_ATTR = 'data-bewly-live-layout'
/** 右侧栏 */
export const ASIDE_ATTR = 'data-bewly-live-aside'
/** 播放器祖先链：影院模式下要清掉它们的层叠上下文 / 变换，否则播放器会被遮罩盖住 */
export const ANCESTOR_ATTR = 'data-bewly-live-ancestor'

/** sessionStorage 键（只影响当前标签页） */
export const STORAGE_KEY_CINEMA = 'bewly-live-cinema'
export const STORAGE_KEY_HIDE_ASIDE = 'bewly-live-hide-aside'
export const STORAGE_KEY_PANEL = 'bewly-live-panel'

/** 短暂提示的显示时长 */
export const TOAST_DURATION = 1600
