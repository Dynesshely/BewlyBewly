/**
 * 分区 / 频道页增强模块的固定标识。
 *
 * 单独放一个文件，避免 actions / keyboard / index 互相 import 形成环。
 */

/** 浮层容器 id（nativeOverlay 用它做幂等判断，teardown 也用它） */
export const HOST_ID = 'bewly-channel-enhance'

/** 内容卡标记 */
export const CARD_ATTR = 'data-bewly-channel-card'
/** j/k 当前高亮卡 */
export const ACTIVE_ATTR = 'data-bewly-channel-active'

/** 挂在 <html> 上的「本模块已接管」标记（页面级样式的作用域，卸载时移除） */
export const ROOT_CLASS_PAGE = 'bewly-channel-page'
/** 挂在 <html> 上的紧凑密度状态类 */
export const ROOT_CLASS_COMPACT = 'bewly-channel-compact'

/** 页面级 <style> 的 id（模块在 /v/*、/channel/* 上自行注入，见 docs） */
export const PAGE_STYLE_ID = 'bewly-channel-page-style'

/** sessionStorage 键（只影响当前标签页） */
export const STORAGE_KEY_DENSITY = 'bewly-channel-density'
export const STORAGE_KEY_PANEL = 'bewly-channel-panel'

/** 短暂提示的显示时长 */
export const TOAST_DURATION = 1600
