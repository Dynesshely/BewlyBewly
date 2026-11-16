/**
 * 动态页自绘（原生 t.bilibili.com）的常量与选择器。
 *
 * 选择器全部来自第 93 轮真机 dump（见交付说明里的 dump 表），
 * 只读：解析原生 DOM，不写回任何原生节点（隐藏 switch 见 SCSS 注释）。
 */

/** 自绘生效时挂在 <html> 上的类：所有自绘样式都以它为前提，teardown 后零残留 */
export const DRAWN_ROOT_CLASS = 'bewly-moments-drawn'

/** 单条原生列表项一旦被成功自绘，会带上这个属性（CSS 据此隐藏原生卡片） */
export const DRAWN_ITEM_ATTR = 'data-bewly-moments-drawn'

/** 原生列表容器（动态流卡片都在它下面） */
export const NATIVE_LIST_SELECTOR = '.bili-dyn-list__items'

/** 单条原生列表项（外层 wrapper，保留它才能不破坏原生无限滚动） */
export const NATIVE_ITEM_SELECTOR = '.bili-dyn-list__item'

/** 原生卡片本体（自绘成功后隐藏的是它，wrapper 仍然留在文档里） */
export const NATIVE_CARD_SELECTOR = '.bili-dyn-item'

/** 原生操作栏按钮（赞 / 评 / 转），自绘操作栏点击时直接代理到它 */
export const NATIVE_ACTION_SELECTOR = '[data-module="action"]'

/** DOM 变化合并窗口：动态流自动加载/点赞回写很频繁，逐次同步会浪费 */
export const SYNC_DEBOUNCE = 160
