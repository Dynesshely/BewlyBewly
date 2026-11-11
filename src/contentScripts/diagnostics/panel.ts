import type { Ref } from 'vue'
import type { ProbeItem, ProbeResult } from './probe'

import { computed, ref } from 'vue'
import { useDiagnosticsMessages } from './i18n'
import { adviceText, collectProbeReport, reasonText, reportToMarkdown } from './probe'

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
  adviceOf: (item: ProbeItem) => string
  downloadMarkdown: () => void
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

  /** 可执行建议（原因说明「为什么」，建议说明「怎么办」） */
  function adviceOf(item: ProbeItem): string {
    return adviceText(item, t.value)
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

  /** 下载文件名：bewly-diagnostics-YYYYMMDD-HHmm.md（本地时间） */
  function downloadFileName(): string {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `bewly-diagnostics-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.md`
  }

  /** 下载 .md：Blob + a[download]，不经过任何服务端；失败静默 */
  function downloadMarkdown() {
    if (!result.value)
      return
    try {
      const blob = new Blob([markdown.value], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = downloadFileName()
      anchor.rel = 'noopener'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    catch {
      // 静默失败：用户仍可使用「复制为 Markdown」
    }
  }

  return {
    running,
    result,
    copied,
    run,
    copyMarkdown,
    reasonOf,
    adviceOf,
    downloadMarkdown,
    markdown,
  }
}
