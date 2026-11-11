export { useDiagnosticsPanel } from './panel'
export type { DiagnosticsPanelState } from './panel'
/**
 * 页面自检（Diagnostics）模块入口（第 24 轮）。
 *
 * 与其它增强模块不同：它**不自带 shadow 浮层**，而是把探测能力包装成一个可组合函数，
 * 由设置页「页面增强 → 诊断」组直接调用（`useDiagnosticsPanel()`），
 * 因此不需要 `setupDiagnostics()` 的恢复 / 卸载生命周期，也不会在任意页面注入 UI。
 */
export { collectProbeItems, collectProbeReport, detectPageKind, reasonText, reportToMarkdown } from './probe'
export type { ProbeEnvironment, ProbeResult } from './probe'
export type { ProbeGroupName, ProbeItem, ProbeReasonCode, ProbeReport, ProbeStatus, SelectorCount } from './types'
