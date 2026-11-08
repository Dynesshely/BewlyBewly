/**
 * 接管页的原版脚本拦截。
 *
 * 在首页（以及空间/历史/消息等被 Bewly 完全接管的页面）上，原版 B 站页面虽然被隐藏，
 * 但它的整套脚本仍会执行：渲染大量节点、轮询推荐、上报埋点、加载 iframe，白白消耗 CPU、
 * 内存和流量。这里在 document_start 阶段挂一个 MutationObserver，原版脚本一插入就改掉
 * type 并移除，在它执行前拦下（外链脚本要先下载，观察者回调一定比执行早）。
 *
 * 安全边界：
 * - 只拦截 script / 预加载 link / iframe；
 * - 保留 application/json 与 application/ld+json（B 站用内联 JSON 传递数据）；
 * - 用户关闭接管（使用原版首页 / 键盘模式无关）时不拦截；
 * - 通过 localStorage 镜像标记保证开关在 document_start 就能读到。
 */

const FLAG = 'bewly:native-guard'

const BLOCKED_TYPE = 'javascript/bewly-blocked'

export function isNativeGuardEnabled(): boolean {
  try {
    return localStorage.getItem(FLAG) !== '0'
  }
  catch {
    return true
  }
}

export function setNativeGuardEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(FLAG, enabled ? '1' : '0')
  }
  catch {
    // 隐私模式等场景忽略
  }
}

function shouldKeepJson(script: HTMLScriptElement): boolean {
  const type = (script.type || '').toLowerCase()
  return type === 'application/json' || type === 'application/ld+json' || type === 'importmap'
}

function killNode(node: Node): void {
  if (node instanceof HTMLScriptElement) {
    if (shouldKeepJson(node))
      return
    // 先改 type 再移除：避免个别浏览器/框架在移除前已触发执行
    node.type = BLOCKED_TYPE
    node.remove()
    return
  }

  if (node instanceof HTMLLinkElement) {
    const rel = (node.rel || '').toLowerCase()
    if ((rel === 'modulepreload' || rel === 'preload' || rel === 'prefetch') && (node.as === 'script' || rel === 'modulepreload'))
      node.remove()
    return
  }

  if (node instanceof HTMLIFrameElement) {
    try {
      node.src = 'about:blank'
    }
    catch {
      // ignore
    }
    node.remove()
  }
}

function killTree(root: ParentNode): void {
  root.querySelectorAll('script, link, iframe').forEach(killNode)
}

/**
 * 开始拦截原版脚本；返回停止函数。
 *
 * 应在 document_start 阶段尽早调用（早于原版脚本执行）。
 */
export function muteNativeScripts(): () => void {
  if (!isNativeGuardEnabled())
    return () => {}

  // 已经存在于文档里的节点
  killTree(document)

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const added = Array.from(record.addedNodes)
      for (const node of added) {
        killNode(node)
        if (node instanceof Element && node.firstElementChild)
          killTree(node)
      }
    }
  })
  observer.observe(document, { childList: true, subtree: true })

  return () => observer.disconnect()
}
