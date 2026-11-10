/**
 * 用户空间增强模块的固定标识。
 *
 * 单独放一个文件，避免 actions / keyboard / index 互相 import 形成环。
 */

/** 浮层容器 id（nativeOverlay 用它做幂等判断，teardown 也用它） */
export const HOST_ID = 'bewly-space-enhance'

/** 内容卡标记（值为卡片类型，见 state.ts 的 SpaceContentKind） */
export const CARD_ATTR = 'data-bewly-space-card'
/** 内容卡类型属性 */
export const KIND_ATTR = 'data-bewly-space-kind'
/** j/k 当前高亮卡 */
export const ACTIVE_ATTR = 'data-bewly-space-active'
/** 筛选后整块没有可见卡片的区块（由 actions 计算后打上，CSS 负责隐藏） */
export const EMPTY_SECTION_ATTR = 'data-bewly-space-section-empty'

/** 挂在 <html> 上的紧凑密度状态类 */
export const ROOT_CLASS_COMPACT = 'bewly-space-compact'
/** 挂在 <html> 上的筛选状态类前缀，后接卡片类型 */
export const ROOT_CLASS_FILTER_PREFIX = 'bewly-space-filter-'

/** sessionStorage 键（只影响当前标签页） */
export const STORAGE_KEY_FILTER = 'bewly-space-filter'
export const STORAGE_KEY_DENSITY = 'bewly-space-density'
export const STORAGE_KEY_PANEL = 'bewly-space-panel'

/** 短暂提示的显示时长 */
export const TOAST_DURATION = 1600
