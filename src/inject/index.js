const isArray = val => Array.isArray(val)
function injectFunction(
  origin,
  keys,
  cb,
) {
  if (!isArray(keys))
    keys = [keys]

  const originKeysValue = keys.reduce((obj, key) => {
    obj[key] = origin[key]
    return obj
  }, {})

  keys.map(k => origin[k])

  keys.forEach((key) => {
    const fn = (...args) => {
      cb(...args)
      return (originKeysValue[key]).apply(origin, args)
    }
    fn.toString = (origin)[key].toString
    ;(origin)[key] = fn
  })

  return {
    originKeysValue,
    restore: () => {
      for (const key in originKeysValue) {
        origin[key] = (originKeysValue[key]).bind(origin)
      }
    },
  }
}

injectFunction(
  window.history,
  ['pushState', 'forward', 'replaceState'],
  (...args) => {
    window.dispatchEvent(new CustomEvent('historyChange', { detail: args }))
  },
)

window.___inject = true

// History.prototype.pushState = history.pushState
// History.prototype.replaceState = history.replaceState
// History.prototype.forward = history.forward
// #region 站点增强（第 40 轮）：URL 清理 + P2P 绕过
//
// 这两件事必须在**页面世界**做（改 history 入参 / 改 media 的 src setter），
// 内容脚本（ISOLATED world）读不到页面对象的 write 行为。
// 开关由内容脚本通过 window 事件下发：window.dispatchEvent(new CustomEvent('bewly-site-tweaks', { detail }))
//
// 默认值与 src/logic/storage.ts 中 siteTweaks* 的默认值保持一致：
//   cleanUrlParams: true、disableP2P: false。

const BEWLY_SITE_TWEAKS = {
  cleanUrlParams: true,
  disableP2P: false,
}

/** URL 里需要清掉的追踪参数（与内容脚本 urlCleaner.ts 保持同一份清单） */
const TRACKING_PARAMS = new Set([
  'buvid',
  'is_story_h5',
  'launch_id',
  'live_from',
  'mid',
  'session_id',
  'timestamp',
  'up_id',
  'vd_source',
])

function isTrackingParam(name) {
  const key = String(name).toLowerCase()
  return TRACKING_PARAMS.has(key) || key.startsWith('share') || key.startsWith('spm')
}

/** 只清理 bilibili 站内链接，站外原样返回 */
function cleanTrackingUrl(input) {
  if (typeof input !== 'string' || !input)
    return input
  let url
  try {
    url = new URL(input, location.href)
  }
  catch {
    return input
  }
  if (!/(?:^|\.)bilibili\.com$/.test(url.hostname))
    return input

  const removals = []
  url.searchParams.forEach((_value, key) => {
    if (isTrackingParam(key))
      removals.push(key)
  })
  if (!removals.length)
    return input
  removals.forEach(key => url.searchParams.delete(key))

  return `${url.pathname}${url.search}${url.hash}`
}

/** 包一层 history.pushState / replaceState：入参 URL 先清理再交给原函数 */
function wrapHistoryForUrlClean() {
  const wrap = (key) => {
    const original = history[key]
    if (typeof original !== 'function' || original.__bewlyWrapped)
      return
    const wrapped = function (state, title, url) {
      const next = BEWLY_SITE_TWEAKS.cleanUrlParams
        ? cleanTrackingUrl(url)
        : url
      return original.call(history, state, title, next)
    }
    wrapped.__bewlyWrapped = true
    history[key] = wrapped
  }
  wrap('pushState')
  wrap('replaceState')
}

// #region P2P 绕过
//
// B 站对部分视频会下发 mcdn / szbdyd 的 P2P CDN 地址（上传/分享加速），
// 这些域名在部分网络下会 403 / 404。开启后把 URL 回落到 upos 源站域名；
// 一旦某个源站域名出错（media error / XHR 4xx），把它记进 blockedHosts 一段时间，
// 期间的请求自动回退到原始地址（脚本原作者的 recentErrors 思路）。
const P2P_HOST_RE = /(?:^|\.)mcdn\.bilivideo\.(?:cn|com)$|(?:^|\.)szbdyd\.com$/i
const UPOS_FALLBACK_HOST = 'upos-sz-mirrorali.bilivideo.com'
const P2P_BLOCK_MS = 10 * 60 * 1000
/** host -> 解禁时间戳 */
const p2pBlockedHosts = new Map()

function isP2PHost(host) {
  return P2P_HOST_RE.test(host)
}

function replaceP2PUrl(input) {
  if (!BEWLY_SITE_TWEAKS.disableP2P)
    return input
  if (typeof input !== 'string' || !input)
    return input

  let url
  try {
    url = new URL(input, location.href)
  }
  catch {
    return input
  }
  if (!isP2PHost(url.hostname))
    return input
  if ((p2pBlockedHosts.get(UPOS_FALLBACK_HOST) ?? 0) > Date.now())
    return input

  url.hostname = UPOS_FALLBACK_HOST
  url.port = ''
  url.protocol = 'https:'
  return url.href
}

function markP2PFailure(host) {
  if (!host)
    return
  p2pBlockedHosts.set(host, Date.now() + P2P_BLOCK_MS)
}

/** 劫持 HTMLMediaElement.src setter（B 站播放器主要走这个） */
function wrapMediaSource() {
  const proto = window.HTMLMediaElement && window.HTMLMediaElement.prototype
  if (!proto)
    return
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'src')
  if (!descriptor || !descriptor.set || descriptor.set.__bewlyWrapped)
    return

  const originalSet = descriptor.set
  const wrappedSet = function (value) {
    const next = replaceP2PUrl(value)
    try {
      return originalSet.call(this, next)
    }
    catch {
      markP2PFailure(UPOS_FALLBACK_HOST)
      return originalSet.call(this, value)
    }
  }
  wrappedSet.__bewlyWrapped = true
  Object.defineProperty(proto, 'src', {
    configurable: descriptor.configurable,
    enumerable: descriptor.enumerable,
    get: descriptor.get,
    set: wrappedSet,
  })
}

/** 劫持 XHR.open（部分清晰度走 XHR 拉 m3u8/视频分片） */
function wrapXhrOpen() {
  const proto = window.XMLHttpRequest && window.XMLHttpRequest.prototype
  if (!proto || proto.open.__bewlyWrapped)
    return
  const originalOpen = proto.open
  const wrappedOpen = function (method, url, ...rest) {
    return originalOpen.call(this, method, replaceP2PUrl(url), ...rest)
  }
  wrappedOpen.__bewlyWrapped = true
  proto.open = wrappedOpen
}

/** media 元素出错时登记失败域名（403 / 404 都算），下次自动回退 */
function watchMediaErrors() {
  document.addEventListener('error', (event) => {
    const target = event.target
    if (target instanceof HTMLMediaElement && target.src) {
      try {
        markP2PFailure(new URL(target.src).hostname)
      }
      catch {
        // 忽略解析失败的地址
      }
    }
  }, true)
}
// #endregion

wrapHistoryForUrlClean()
wrapMediaSource()
wrapXhrOpen()
watchMediaErrors()

// 内容脚本下发开关（settings 变更时也会重新下发）
window.addEventListener('bewly-site-tweaks', (event) => {
  const detail = (event && event.detail) || {}
  if (typeof detail.cleanUrlParams === 'boolean')
    BEWLY_SITE_TWEAKS.cleanUrlParams = detail.cleanUrlParams
  if (typeof detail.disableP2P === 'boolean')
    BEWLY_SITE_TWEAKS.disableP2P = detail.disableP2P
})
// #endregion
