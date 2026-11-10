/**
 * 消息页增强模块的固定标识。
 *
 * 单独放一个文件，避免 actions / shortcuts / index 互相 import 形成环。
 */

/** 浮层容器 id（nativeOverlay 用它做幂等判断，teardown 也用它） */
export const HOST_ID = 'bewly-notification-page'

/** 挂在 <html> 上的「只看未读」状态类 */
export const ROOT_CLASS_ONLY_UNREAD = 'bewly-notif-only-unread'

/** 挂在 <html> 上的「紧凑密度」状态类 */
export const ROOT_CLASS_COMPACT = 'bewly-notif-compact'
