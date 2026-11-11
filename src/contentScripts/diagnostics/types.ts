/** 页面自检的结果类型（第 24 轮） */

export type ProbeStatus = 'ok' | 'degraded' | 'unavailable'

/** 降级 / 不可用的原因代码（UI 层按当前语言翻译） */
export type ProbeReasonCode
  = | 'ok'
    | 'not-applicable'
    | 'user-disabled'
    | 'login-required'
    | 'selectors-miss'
    | 'no-selectors'
    | 'host-missing'

/** 结果分组：正常 / 降级 / 不可用 + 页面类型 */
export type ProbeGroupName
  = | 'home'
    | 'video'
    | 'bangumi'
    | 'anime'
    | 'list'
    | 'search'
    | 'moments'
    | 'notification'
    | 'space'
    | 'article'
    | 'channel'
    | 'live'
    | 'global'
    | 'degraded'
    | 'unavailable'

/** 单个关键选择器的命中数量 */
export interface SelectorCount {
  selector: string
  count: number
}

/** 一个增强模块的自检结果 */
export interface ProbeItem {
  /** 用户看到的模块名 */
  name: string
  /** 结果分组（正常时是页面类型，降级 / 不可用是对应分组） */
  group: ProbeGroupName
  status: ProbeStatus
  /** 模块浮动层宿主 id（没有浮层为 null） */
  hostId: string | null
  /** 浮动层是否已挂载；hostId 为 null 时为 null */
  hostMounted: boolean | null
  /** 每个关键选择器的命中数量 */
  selectorCounts: SelectorCount[]
  /** 命中的选择器数量 / 声明的选择器总数 */
  matchedCount: number
  selectorCount: number
  /** 降级 / 不可用原因代码（正常为 ok） */
  reasonCode: ProbeReasonCode
  /** 额外说明（可选，展示用） */
  note?: string
}

/** 一次自检的报告 */
export interface ProbeReport {
  /** 页面类型（未知时为 unknown） */
  pageKind: string
  items: ProbeItem[]
  okCount: number
  degradedCount: number
  unavailableCount: number
}
