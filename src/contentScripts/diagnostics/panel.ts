import type { Ref } from 'vue'
import type { ProbeItem, ProbeResult } from './probe'

import { computed, ref } from 'vue'
import { useDiagnosticsMessages } from './i18n'
import { collectProbeReport, reasonText, reportToMarkdown } from './probe'

/**
 * 页面自检面板的共享状态（第 24 轮）。
 *
 * 设置页只需要一个 `useDiagnosticsPanel()` 就能拿到「运行 / 结果 / 复制」的全部行为，
 * 面板组件本身只负责展示，避免把探测逻辑塞进设置页。
 */
export interface DiagnosticsPanelState {
  running: Ref<boolean>
  result: Ref<ProbeResult | null>
  copied: Ref<boolean>
  run: () => void
  copyMarkdown: () => Promise<void>
  reasonOf: (item: ProbeItem) => string
  markdown: Ref<string>
}

export function useDiagnosticsPanel(): DiagnosticsPanelState {
  const t = useDiagnosticsMessages()
  const running = ref(false)
  const copied = ref(false)
  const result = ref<ProbeResult | null>(null)
  let copiedTimer: number | null = null

  /** 运行探测：纯同步 DOM 查询，不发请求 */
  function run() {
    running.value = true
    try {
      result.value = collectProbeReport()
    }
    finally {
      running.value = false
    }
  }

  /** 原因代码 → 当前语言文案 */
  function reasonOf(item: ProbeItem): string {
    return reasonText(item, t.value)
  }

  const markdown = computed(() => result.value
    ? reportToMarkdown(result.value, t.value)
    : '')

  async function copyMarkdown() {
    if (!result.value)
      return
    try {
      await navigator.clipboard.writeText(markdown.value)
      copied.value = true
      if (copiedTimer !== null)
        window.clearTimeout(copiedTimer)
      copiedTimer = window.setTimeout(() => {
        copied.value = false
        copiedTimer = null
      }, 1800)
    }
    catch {
      // 剪贴板不可用：由调用方给「复制失败」提示，不抛错、不重试
      copied.value = false
    }
  }

  return {
    running,
    result,
    copied,
    run,
    copyMarkdown,
    reasonOf,
    markdown,
  }
}
