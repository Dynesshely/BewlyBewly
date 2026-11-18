import md5 from 'md5'

/**
 * B 站 Web 接口的 wbi 签名（风控签名）。
 *
 * 背景：B 站给一批 Web 接口加了 wbi 签名，请求里缺 `wts` / `w_rid` 会被风控直接打回
 * （真机实测 `/x/space/wbi/arc/search`：匿名态不带签名 `-352 风控校验失败`，
 * 登录态不带签名 `-403 访问权限不足` —— 两种都是「没有有效签名」，别只认 -352）。
 *
 * 算法（与 B 站前端一致）：
 *   1. `GET /x/web-interface/nav` 的 `data.wbi_img.{img_url, sub_url}` 里各取文件名（去掉路径与扩展名）
 *      得到 img_key / sub_key，拼成 64 位 `orig`；
 *   2. 按固定打乱表重排 `orig`，取前 32 位得到 mixin_key；
 *   3. 参数按 key 升序，value 去掉 `!'()*` 后 URL 编码，拼成 query；
 *   4. `w_rid = md5(query + '&wts=' + wts + mixinKey)`，wts 为秒级时间戳；
 *   5. 请求带上 `wts` 与 `w_rid`。
 *
 * md5 用仓库已有的 `md5` 依赖（`src/utils/appSign.ts` 的 APP 签名同样在用），不引新依赖；
 * Web Crypto 的 `crypto.subtle.digest` 不支持 MD5，因此也不走它。
 *
 * 真机验证（2026-11-18，CDP 9333 页面上下文，登录态「Crequency」）：
 *   - `/x/space/wbi/arc/search`（mid=2）签名后 code 0、vlist 20 条、page.count 43；去掉签名 -403；
 *   - `/x/player/wbi/playurl`（quality 64）、`/x/space/wbi/acc/info`、
 *     `/x/v2/reply/wbi/main`（replies 20）签名后均 code 0；
 *   - **与 B 站自己的请求逐字节一致**：抓页面发出的 11 条纯 ASCII wbi 请求，
 *     把 `Date.now` 钉回那次请求的 `wts` 后重算 `w_rid`，11/11 完全相同；
 *   - 篡改 `w_rid` 任意一位、或签名后额外多带一个参数，都会被拒（-403），说明签名确实覆盖了参数集；
 *   - 未登录时 nav 返回 `code: -101` 但 `data.wbi_img` 照常有值，所以取 key 不能以 code 判成败；
 *   - 同一接口连续请求间隔小于 1s 会吃风控，建议调用方留出间隔。
 */

/** B 站 Web 接口根地址；传相对路径（如 `/x/space/wbi/arc/search`）时自动拼在它后面 */
const API_ORIGIN = 'https://api.bilibili.com'

/** nav 接口：拿 wbi_img 的两个 key */
const NAV_API = `${API_ORIGIN}/x/web-interface/nav`

/** 单次请求超时（毫秒），与 views/Popular、views/Channel 的 fetcher 保持一致 */
const REQUEST_TIMEOUT = 12_000

/** key 缓存时长：B 站的 key 每天换一次，12 小时足够且不会用到过期 key */
const WBI_KEY_TTL = 12 * 60 * 60 * 1000

/**
 * mixin_key 打乱表（固定 64 位索引）。
 *
 * 写成空格分隔的字符串再 split：既保持「一行看完整张表」的可读性，
 * 又不会被 antfu 的数组换行规则拆成 64 行。
 */
const MIXIN_KEY_ENC_TAB = '46 47 18 2 53 8 23 32 15 50 10 31 58 3 45 35 27 43 5 49 33 9 42 19 29 28 14 39 12 38 41 13 37 48 7 16 24 55 40 61 26 17 0 1 60 51 30 4 22 25 54 21 56 59 6 63 57 62 11 36 20 34 44 52'
  .split(' ')
  .map(Number)

/** wbi_img 里解析出的两个 key（各 32 位） */
export interface WbiKeys {
  imgKey: string
  subKey: string
}

/** 参与签名的参数：值为 undefined / null 的键会被跳过（方便直接传可选参数） */
export type WbiParams = Record<string, string | number | undefined | null>

/** 签名结果，调用方一般只需要把这两个字段追加到 query 上 */
export interface WbiSignature {
  wts: number
  w_rid: string
}

/** B 站接口的通用响应结构 */
interface BiliResponse<T> {
  code: number
  message?: string
  data?: T
}

/**
 * 接口返回非 0 code 时抛出的错误：`code` 原样带出来，方便调用方区分
 * 「-352 风控 / -412 被拦截 / -404 不存在」这类语义，而不用去匹配中文 message。
 */
export class WbiApiError extends Error {
  /** 接口返回的 code（非 0） */
  readonly code: number

  constructor(code: number, message: string) {
    super(message)
    this.name = 'WbiApiError'
    this.code = code
  }
}

/** nav 接口里用到的那部分结构 */
interface NavData {
  isLogin?: boolean
  wbi_img?: {
    img_url?: string
    sub_url?: string
  }
}

/** 内存里的 key 缓存 */
let cachedKeys: WbiKeys | undefined
let cacheExpireAt = 0
/** 并发去重：多个调用同时发现缓存失效时只打一次 nav */
let pendingKeys: Promise<WbiKeys> | undefined

/**
 * 从 wbi_img 的 url 里取 key：去掉路径、query 与扩展名。
 *
 * `https://i0.hdslb.com/bfs/wbi/7cd08494....png` -> `7cd08494...`
 */
function extractKey(url: string): string {
  const name = url.split('?')[0].split('#')[0].split('/').pop() ?? ''
  const dot = name.lastIndexOf('.')
  if (dot <= 0)
    return name
  return name.slice(0, dot)
}

/** 用打乱表把 img_key + sub_key 重排成 32 位 mixin_key */
function buildMixinKey(keys: WbiKeys): string {
  const orig = keys.imgKey + keys.subKey
  if (orig.length < 64)
    throw new Error(`wbi keys malformed (img=${keys.imgKey}, sub=${keys.subKey})`)
  return MIXIN_KEY_ENC_TAB.map(index => orig[index]).join('').slice(0, 32)
}

/**
 * 把参数编码成待签名的 query：key 升序、value 去掉 `!'()*` 后做 URL 编码。
 *
 * encodeURIComponent 本身不转义 `!'()*`，所以「先过滤再编码」与官方前端等价。
 */
function encodeQuery(params: WbiParams): string {
  return Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== null)
    .sort()
    .map((key) => {
      const value = String(params[key]).replace(/[!'()*]/g, '')
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    })
    .join('&')
}

/** 用已取到的 key 算签名；query 一起返回，省得调用方再编码一次 */
function signWithKeys(params: WbiParams, keys: WbiKeys): WbiSignature & { query: string } {
  const query = encodeQuery(params)
  const wts = Math.round(Date.now() / 1000)
  const w_rid = md5(`${query}&wts=${wts}${buildMixinKey(keys)}`)
  return { wts, w_rid, query }
}

/** 发一个通用的 GET 并把响应解析成 JSON；超时 / HTTP 非 2xx 一律抛错 */
async function requestJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  // 用全局 setTimeout 而不是 window.setTimeout：本模块同时被 content script 与（潜在的）后台复用
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    const response = await fetch(url, {
      credentials: 'include',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok)
      throw new Error(`HTTP ${response.status}`)
    return await response.json()
  }
  finally {
    clearTimeout(timer)
  }
}

/** 真正去 nav 拉 key（不走缓存） */
async function fetchWbiKeys(): Promise<WbiKeys> {
  const payload = await requestJson(NAV_API) as BiliResponse<NavData>
  const imgUrl = payload.data?.wbi_img?.img_url
  const subUrl = payload.data?.wbi_img?.sub_url
  // 注意：未登录时 nav 是 code -101「账号未登录」，但 wbi_img 依然下发（真机实测），
  // 所以这里只认 wbi_img 是否存在，不看 code。
  if (!imgUrl || !subUrl) {
    let detail = ''
    if (payload.message)
      detail = `: ${payload.message}`
    throw new Error(`wbi keys unavailable (nav code ${payload.code}${detail})`)
  }
  return {
    imgKey: extractKey(imgUrl),
    subKey: extractKey(subUrl),
  }
}

/**
 * 取当前生效的 wbi key，内存缓存 12 小时；并发的多次调用只会打一次 nav。
 *
 * 拉取失败不写缓存，下次调用会重试。
 */
export async function getWbiKeys(): Promise<WbiKeys> {
  if (cachedKeys && Date.now() < cacheExpireAt)
    return cachedKeys

  if (!pendingKeys) {
    pendingKeys = fetchWbiKeys()
      .then((keys) => {
        cachedKeys = keys
        cacheExpireAt = Date.now() + WBI_KEY_TTL
        return keys
      })
      .finally(() => {
        pendingKeys = undefined
      })
  }
  return pendingKeys
}

/** 手动清掉 key 缓存（调试、换账号后想立刻重新取 key 时用） */
export function clearWbiKeyCache(): void {
  cachedKeys = undefined
  cacheExpireAt = 0
  pendingKeys = undefined
}

/**
 * 计算 wbi 签名。
 *
 * @param params 参与签名的参数（undefined / null 会被跳过）
 * @returns `{ wts, w_rid }`，调用方拼到 query 上即可
 */
export async function signWbi(params: WbiParams): Promise<WbiSignature> {
  const keys = await getWbiKeys()
  const { wts, w_rid } = signWithKeys(params, keys)
  return { wts, w_rid }
}

/**
 * 调一个 B 站接口，默认带 wbi 签名，返回响应体里的 data。
 *
 * - url：相对路径（`/x/space/wbi/arc/search`，内部拼 https://api.bilibili.com）或完整 https 地址；
 * - params：查询参数，会与 url 上已有的 query 合并（同名以 params 为准）；
 * - options.sign：是否签名，默认 true。非 wbi 接口（如 `/x/relation/stat`）可传 false，
 *   避免把 wts / w_rid 塞给不需要它们的接口。
 *
 * 失败一律抛错：HTTP 非 2xx 抛 `HTTP <status>`；code !== 0 抛 {@link WbiApiError}
 * （`instanceof Error`，额外带 `code` 字段与接口 message）；data 缺失抛普通 Error。
 */
export async function wbiGet<T = unknown>(
  url: string,
  params?: WbiParams,
  options?: { sign?: boolean },
): Promise<T> {
  const target = new URL(url, API_ORIGIN)

  // url 自带的 query 与 params 合并：params 优先；旧的签名参数先清掉，避免重复 / 覆盖出错
  const merged: Record<string, string> = {}
  target.searchParams.forEach((value, key) => {
    merged[key] = value
  })
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null)
      continue
    merged[key] = String(value)
  }
  delete merged.wts
  delete merged.w_rid

  let query = encodeQuery(merged)
  if (options?.sign ?? true) {
    const keys = await getWbiKeys()
    const signature = signWithKeys(merged, keys)
    query = `${signature.query}&wts=${signature.wts}&w_rid=${signature.w_rid}`
  }

  const requestUrl = `${target.origin}${target.pathname}?${query}`
  const payload = await requestJson(requestUrl) as BiliResponse<T>
  if (payload.code !== 0)
    throw new WbiApiError(payload.code, payload.message || `API code ${payload.code}`)
  if (payload.data === undefined)
    throw new Error('API returned no data')
  return payload.data
}
