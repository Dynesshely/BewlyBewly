/**
 * 视频页「自绘评论区」阶段 3/4（第 80/81 轮）：只读渲染 + 点赞 / 回复 / 发表。
 *
 * 数据：B 站评论 API（`/x/v2/reply` pn 分页；子回复 `/x/v2/reply/reply`）。
 * 互动：`/x/v2/reply/action`（点赞）、`/x/v2/reply/add`（发表 / 楼中楼回复），
 * 需要 cookie 里的 `bili_jct`（非 httpOnly，content script 可读）。
 * 真机实测（未登录）：三个写接口都返回 `code -101 账号未登录`（HTTP 200，JSON），
 * 说明请求格式正确；列表接口带 `action` 字段（0 = 未赞）用于已赞状态。
 *
 * 不用 wbi（`/wbi/main` 会 -403）。
 * 兜底：拿不到 aid / 列表 API 失败 → 恢复原生评论区，绝不白屏。
 */
import { showToast } from './actions'
import { composerHtml, handleAttachImage, MAX_MESSAGE_LENGTH, openEmoteForForm, syncCount } from './commentComposer'
import { closeEmotePanel } from './emotePanel'
import { closeImageViewer, openImageViewer } from './imageViewer'

const LIST_ID = 'bewly-comment-list'
const COLUMN_SELECTOR = '[data-bewly-comment-column], #bewly-comment-column'
const NATIVE_APP_SELECTOR = '#commentapp'
const PAGE_SIZE = 20
const SUB_PAGE_SIZE = 20
const MAX_SUB_PAGES = 10
const MAX_ONLYUP_PAGES = 5
/** 分批渲染：每批条数（滚动接近底部再加一批，不额外请求接口） */
const RENDER_BATCH = 20

interface CommentItem {
  rpid: number | string
  mid: string
  uname: string
  face: string
  level: number
  message: string
  emote: Record<string, string>
  ctime: number
  like: number
  liked: boolean
  rcount: number
  location: string
  isUp: boolean
  isTop: boolean
  pictures: string[]
  /** 刚发表（本地插入）：渲染「刚刚发表」徽标（第 83 轮） */
  justPosted?: boolean
}

interface CommentState {
  aid: number | null
  bvid: string
  ownerMid: string
  isLogin: boolean
  sort: 2 | 0
  onlyUp: boolean
  page: number
  items: CommentItem[]
  hasMore: boolean
  loading: boolean
  failed: boolean
  subpage: { root: CommentItem, items: CommentItem[], loading: boolean } | null
  /** 回复目标：rpid + 上一层 rpid（楼中楼） */
  replyTarget: { rpid: string, parent: string, name: string, rootOf: string } | null
  /** 排序切换时记住的滚动位置 */
  scrollMemo: Record<string, number>
  /** 已渲染到 DOM 的条数（分批渲染，第 83 轮） */
  renderedCount: number
}

const state: CommentState = {
  aid: null,
  bvid: '',
  ownerMid: '',
  isLogin: false,
  sort: 2,
  onlyUp: false,
  page: 0,
  items: [],
  hasMore: false,
  loading: false,
  failed: false,
  subpage: null,
  replyTarget: null,
  scrollMemo: {},
  renderedCount: RENDER_BATCH,
}

let bridgeListening = false
let listMounted = false
const aidCache = new Map<string, number>()

function currentBvid(): string {
  return location.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/)?.[1] ?? ''
}

function readCookie(name: string): string {
  return document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1] ?? ''
}

function csrfToken(): string {
  return readCookie('bili_jct')
}

/** 登录态：桥 `isLogin` 优先，其次 cookie 里有没有 DedeUserID */
function detectLogin(): boolean {
  return state.isLogin || Boolean(readCookie('DedeUserID'))
}

function errorTip(code: number, message?: string): string {
  if (code === -101)
    return '请先登录后再操作'
  if (code === -111)
    return 'CSRF 校验失败，请刷新页面重试'
  if (code === -352)
    return '触发风控，请稍后再试'
  if (code === -400)
    return '请求参数有误'
  return message
    ? `操作失败：${message}`
    : `操作失败（code ${code}）`
}

function onBridgeData(event: Event): void {
  const detail = (event as CustomEvent).detail as {
    bvid?: string
    aid?: number
    isLogin?: boolean
    owner?: { mid?: string | number }
  } | null
  if (!detail)
    return
  let changed = false
  if (typeof detail.aid === 'number' && detail.aid > 0 && detail.aid !== state.aid) {
    state.aid = detail.aid
    changed = true
  }
  if (detail.owner && detail.owner.mid !== undefined) {
    const mid = String(detail.owner.mid)
    if (mid && mid !== state.ownerMid) {
      state.ownerMid = mid
      changed = true
    }
  }
  if (typeof detail.isLogin === 'boolean' && detail.isLogin !== state.isLogin) {
    state.isLogin = detail.isLogin
    changed = true
  }
  if (detail.bvid && detail.bvid !== state.bvid)
    changed = true
  if (changed)
    void reloadComments()
}

function startBridge(): void {
  if (bridgeListening)
    return
  window.addEventListener('bewly-video-data', onBridgeData)
  bridgeListening = true
  window.dispatchEvent(new CustomEvent('bewly-video-data-request'))
}

function stopBridge(): void {
  if (!bridgeListening)
    return
  window.removeEventListener('bewly-video-data', onBridgeData)
  bridgeListening = false
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(url, { credentials: 'include', ...init })
    if (!response.ok)
      return null
    return await response.json() as T
  }
  catch {
    return null
  }
}

async function postForm(url: string, body: Record<string, string>): Promise<{ code: number, message?: string, data?: unknown } | null> {
  const params = new URLSearchParams(body)
  return fetchJson<{ code: number, message?: string, data?: unknown }>(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
}

async function resolveAid(): Promise<number | null> {
  if (state.aid)
    return state.aid
  const bvid = currentBvid()
  if (!bvid)
    return null
  if (aidCache.has(bvid)) {
    state.aid = aidCache.get(bvid) ?? null
    return state.aid
  }
  const data = await fetchJson<{ code: number, data?: { aid?: number } }>(
    `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`,
  )
  if (data?.code === 0 && typeof data.data?.aid === 'number') {
    aidCache.set(bvid, data.data.aid)
    state.aid = data.data.aid
    return state.aid
  }
  return null
}

function normalizeReply(raw: Record<string, any>): CommentItem {
  const member = raw.member ?? {}
  const content = raw.content ?? {}
  const control = raw.reply_control ?? {}
  const emote: Record<string, string> = {}
  if (content.emote && typeof content.emote === 'object') {
    for (const [key, value] of Object.entries(content.emote)) {
      const url = (value as { url?: string })?.url
      if (url)
        emote[key] = url
    }
  }
  const pictures: string[] = Array.isArray(content.pictures)
    ? content.pictures.map((pic: { img_src?: string }) => pic.img_src).filter((src: unknown): src is string => typeof src === 'string')
    : []
  const mid = String(member.mid ?? raw.mid ?? '')
  const action = Number(raw.action ?? 0)
  return {
    rpid: raw.rpid,
    mid,
    uname: member.uname ?? '',
    // 第 95 轮（真机实测）：评论接口 member 里是 `avatar`，`face` 只是兜底；两者都无则首字占位
    face: member.avatar || member.face || '',
    level: member.level_info?.current ?? 0,
    message: content.message ?? '',
    emote,
    ctime: raw.ctime ?? 0,
    like: raw.like ?? 0,
    liked: action > 0,
    rcount: raw.rcount ?? 0,
    location: control.location ?? '',
    isUp: Boolean(mid && state.ownerMid && mid === state.ownerMid) || Boolean(control.is_up_top),
    isTop: Boolean(control.is_up_top ?? raw.top),
    pictures,
  }
}

/** 当前登录用户信息（发表后本地插入评论用）；失败时用一个占位 */
let selfProfile: { uname: string, face: string, level: number } | null = null
let selfProfileRequested = false

async function fetchSelfProfile(): Promise<{ uname: string, face: string, level: number }> {
  if (selfProfile)
    return selfProfile
  if (selfProfileRequested)
    return { uname: '我', face: '', level: 0 }
  selfProfileRequested = true
  const data = await fetchJson<{ code: number, data?: { uname?: string, face?: string, level_info?: { current_level?: number } } }>(
    'https://api.bilibili.com/x/web-interface/nav',
  )
  if (data?.code === 0 && data.data?.uname)
    selfProfile = { uname: data.data.uname, face: data.data.face ?? '', level: data.data.level_info?.current_level ?? 0 }
  return selfProfile ?? { uname: '我', face: '', level: 0 }
}

/** 本地构造一条刚发表的评论（接口返回数据不完整时也能先显示，下次刷新自然校准） */
function makeLocalItem(rpid: string, message: string, self: { uname: string, face: string, level: number }): CommentItem {
  return {
    rpid,
    mid: readCookie('DedeUserID'),
    uname: self.uname,
    face: self.face,
    level: self.level,
    message,
    emote: {},
    ctime: Math.floor(Date.now() / 1000),
    like: 0,
    liked: false,
    rcount: 0,
    location: '',
    isUp: false,
    isTop: false,
    pictures: [],
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderMessage(item: CommentItem): string {
  let html = escapeHtml(item.message)
  for (const [key, url] of Object.entries(item.emote)) {
    const token = `<img class="bvp-cmt__emote" src="${escapeHtml(url)}" alt="${escapeHtml(key)}" loading="lazy" referrerpolicy="no-referrer">`
    html = html.split(escapeHtml(key)).join(token)
  }
  html = html.replace(/@([\w\u4E00-\u9FA5.-]{1,20})/g, '<span class="bvp-cmt__at">@$1</span>')
  return html.replace(/\n/g, '<br>')
}

function formatTime(ctime: number): string {
  if (!ctime)
    return ''
  const date = new Date(ctime * 1000)
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60)
    return '刚刚'
  if (diff < 3600)
    return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400)
    return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 86400 * 30)
    return `${Math.floor(diff / 86400)} 天前`
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatCountShort(value: number): string {
  if (!Number.isFinite(value) || value <= 0)
    return ''
  if (value >= 1e4)
    return `${(value / 1e4).toFixed(1)}万`
  return String(value)
}

function itemHtml(item: CommentItem, depth: number): string {
  const avatar = item.face
    ? `<img class="bvp-cmt__avatar-img" src="${escapeHtml(item.face)}" alt="${escapeHtml(item.uname)}" loading="lazy" referrerpolicy="no-referrer">`
    : escapeHtml(item.uname.slice(0, 1))
  const upBadge = item.isUp ? '<span class="bvp-cmt__badge bvp-cmt__badge--up">UP</span>' : ''
  const topBadge = item.isTop ? '<span class="bvp-cmt__badge">置顶</span>' : ''
  const justBadge = item.justPosted ? '<span class="bvp-cmt__badge bvp-cmt__badge--new">刚刚发表</span>' : ''
  const pictures = item.pictures.length
    ? `<div class="bvp-cmt__pictures">${item.pictures.map((src, index) => `<button type="button" class="bvp-cmt__picture" data-action="preview-image" data-rpid="${item.rpid}" data-index="${index}"><img src="${escapeHtml(src)}" alt="" loading="lazy" referrerpolicy="no-referrer"></button>`).join('')}</div>`
    : ''
  const subReplies = depth === 0 && item.rcount > 0
    ? `<button type="button" class="bvp-cmt__more" data-action="open-subpage" data-rpid="${item.rpid}">共 ${item.rcount} 条回复</button>`
    : ''
  const replyForm = state.replyTarget && state.replyTarget.rpid === String(item.rpid)
    ? composerHtml({
        placeholder: `回复 @${escapeHtml(item.uname)}`,
        compact: true,
        rpid: String(item.rpid),
        withCancel: true,
      })
    : ''
  return `<article class="bvp-cmt${depth > 0
    ? ' bvp-cmt--sub'
    : ''}${item.isUp ? ' bvp-cmt--up' : ''}" data-rpid="${item.rpid}" data-mid="${escapeHtml(item.mid)}">
    <div class="bvp-cmt__avatar">${avatar}</div>
    <div class="bvp-cmt__main">
      <div class="bvp-cmt__head">
        <span class="bvp-cmt__name">${escapeHtml(item.uname)}</span>
        ${item.level
          ? `<span class="bvp-cmt__level">Lv${item.level}</span>`
          : ''}
        ${upBadge}${topBadge}${justBadge}
      </div>
      <div class="bvp-cmt__text">${renderMessage(item)}</div>
      ${pictures}
      <div class="bvp-cmt__meta">
        <span class="bvp-cmt__time">${formatTime(item.ctime)}</span>
        ${item.location
          ? `<span class="bvp-cmt__location">${escapeHtml(item.location)}</span>`
          : ''}
        <span class="bvp-cmt__spacer"></span>
        <button type="button" class="bvp-cmt__action${item.liked ? ' is-active' : ''}" data-action="like" data-rpid="${item.rpid}">赞 ${formatCountShort(item.like)}</button>
        <button type="button" class="bvp-cmt__action" data-action="reply" data-rpid="${item.rpid}" data-name="${escapeHtml(item.uname)}">回复</button>
      </div>
      ${subReplies}
      ${replyForm}
    </div>
  </article>`
}

/** 已登录：完整输入框；未登录：提示 + 去登录 */
function composerSection(): string {
  if (!detectLogin()) {
    return `<div class="bvp-cmt__login-tip">
      <span>登录后可以发评论</span>
      <a class="bvp-cmt__login-link" href="https://passport.bilibili.com/login" target="_blank" rel="noopener noreferrer">去登录</a>
    </div>`
  }
  return composerHtml({ placeholder: '发一条友善的评论' })
}

function renderList(): void {
  const container = document.getElementById(LIST_ID)
  if (!container)
    return
  const subpage = state.subpage
  if (subpage) {
    const subItems = subpage.items.length
      ? subpage.items.map(item => itemHtml(item, 1)).join('')
      : `<div class="bvp-cmt__empty">${subpage.loading ? '加载回复中…' : '暂无回复'}</div>`
    container.innerHTML = `<div class="bvp-cmt__subpage-head">
        <button type="button" class="bvp-cmt__tab" data-action="close-subpage">← 返回评论列表</button>
      </div>
      <div class="bvp-cmt__list">${itemHtml(subpage.root, 0)}${subItems}</div>
      <div class="bvp-cmt__footer">${composerSection()}</div>`
    bindContainerActions(container)
    return
  }
  const visible = state.onlyUp
    ? state.items.filter(item => item.isUp)
    : state.items
  const shown = visible.slice(0, state.renderedCount)
  const itemsHtml = shown.length
    ? shown.map(item => itemHtml(item, 0)).join('')
    : `<div class="bvp-cmt__empty">${state.loading
      ? '加载中…'
      : (state.onlyUp ? '正在查找 UP 主的评论…' : '还没有评论')}</div>`
  container.innerHTML = `<div class="bvp-cmt__toolbar">
      <div class="bvp-cmt__sort">
        <button type="button" class="bvp-cmt__tab${state.sort === 2
          ? ' is-active'
          : ''}" data-action="sort-hot">最热</button>
        <button type="button" class="bvp-cmt__tab${state.sort === 0
          ? ' is-active'
          : ''}" data-action="sort-new">最新</button>
      </div>
      <button type="button" class="bvp-cmt__tab${state.onlyUp ? ' is-active' : ''}" data-action="toggle-up">只看 UP 主</button>
    </div>
    <div class="bvp-cmt__list" id="bewly-comment-items">${itemsHtml}</div>
    <div class="bvp-cmt__footer" id="bewly-comment-footer">
      ${state.loading
        ? '<div class="bvp-cmt__loading">加载中…</div>'
        : state.hasMore
          ? '<div class="bvp-cmt__loading">滚动到底自动加载…</div>'
          : visible.length ? '<div class="bvp-cmt__end">没有更多了</div>' : ''}
        ${state.failed && !state.loading
          ? '<button type="button" class="bvp-cmt__load-more" data-action="retry-load">加载失败，点此重试</button>'
          : ''}
      ${composerSection()}
    </div>`
  bindContainerActions(container)
  bindAutoRender(container)
  // 排序切换后恢复滚动位置
  const listEl = container.querySelector<HTMLElement>('.bvp-cmt__list')
  if (listEl) {
    const memo = state.scrollMemo[String(state.sort)]
    if (memo)
      listEl.scrollTop = memo
  }
}

/**
 * 无限滚动（第 95 轮）：滚到距底部 < 200px 时自动请求下一页。
 * - 同一时间只允许一个请求在飞（`state.loading` 守卫）；
 * - 500ms 防抖，避免快速滚动连发；
 * - 失败只标记 failed，不再自动重试（footer 显示重试按钮，用户点才重试）。
 */
/** 自动加载下一页的防抖定时器（无限滚动） */
let autoLoadTimer = 0
function bindAutoRender(container: HTMLElement): void {
  const listEl = container.querySelector<HTMLElement>('.bvp-cmt__list')
  if (!listEl || listEl.dataset.autoRender === '1')
    return
  listEl.dataset.autoRender = '1'
  listEl.addEventListener('scroll', () => {
    if (state.subpage)
      return
    const nearBottom = listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 200
    if (!nearBottom || state.loading || !state.hasMore)
      return
    if (autoLoadTimer)
      window.clearTimeout(autoLoadTimer)
    autoLoadTimer = window.setTimeout(() => {
      autoLoadTimer = 0
      if (!state.loading && state.hasMore && !state.failed)
        void loadPage(state.page + 1)
    }, 500)
  }, { passive: true })
}

/**
 * 本地插入新发表的评论（第 83 轮）。
 *
 * 选择：**热门排序下插到「置顶」之后**（无置顶则顶部第二条），最新排序下插顶部。
 * 理由：热门排序的首条通常是置顶公告，新评论紧随其后最符合「刚发表就在显眼处」的预期，
 * 又不会把置顶挤掉；同时给「刚刚发表」徽标说明它不在严格热度序列里。
 */
function insertPostedItem(item: CommentItem): void {
  if (state.sort === 0) {
    state.items.unshift(item)
    return
  }
  const lastTopIndex = state.items.reduce((acc, entry, index) => (entry.isTop ? index : acc), -1)
  const insertAt = lastTopIndex >= 0
    ? lastTopIndex + 1
    : Math.min(1, state.items.length)
  state.items.splice(insertAt, 0, item)
}

function updateItem(rpid: string, patch: Partial<CommentItem>): void {
  const item = state.items.find(entry => String(entry.rpid) === rpid)
  if (item)
    Object.assign(item, patch)
  if (state.subpage) {
    const sub = state.subpage.items.find(entry => String(entry.rpid) === rpid)
    if (sub)
      Object.assign(sub, patch)
  }
}

async function toggleLike(rpid: string): Promise<void> {
  const item = state.items.find(entry => String(entry.rpid) === rpid)
    ?? state.subpage?.items.find(entry => String(entry.rpid) === rpid)
  if (!item)
    return
  const aid = await resolveAid()
  if (!aid)
    return
  const nextLiked = !item.liked
  // 乐观更新
  updateItem(rpid, {
    liked: nextLiked,
    like: Math.max(0, item.like + (nextLiked
      ? 1
      : -1)),
  })
  renderList()
  const result = await postForm('https://api.bilibili.com/x/v2/reply/action', {
    oid: String(aid),
    type: '1',
    rpid,
    action: nextLiked ? '1' : '0',
    csrf: csrfToken(),
  })
  if (!result || result.code !== 0) {
    // 回滚
    updateItem(rpid, { liked: item.liked, like: item.like })
    renderList()
    showToast(errorTip(result?.code ?? -1, result?.message))
  }
}

async function submitComment(message: string, target?: { root: string, parent: string }): Promise<{ ok: boolean, rpid: string, message: string }> {
  const text = message.trim()
  if (!text)
    return { ok: false, rpid: '', message: '' }
  if (!detectLogin()) {
    showToast('请先登录后再发评论')
    return { ok: false, rpid: '', message: '' }
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    showToast(`评论不能超过 ${MAX_MESSAGE_LENGTH} 字`)
    return { ok: false, rpid: '', message: '' }
  }
  const aid = await resolveAid()
  if (!aid)
    return { ok: false, rpid: '', message: '' }
  const body: Record<string, string> = {
    oid: String(aid),
    type: '1',
    message: text,
    csrf: csrfToken(),
  }
  if (target) {
    body.root = target.root
    body.parent = target.parent
  }
  const result = await postForm('https://api.bilibili.com/x/v2/reply/add', body)
  if (!result || result.code !== 0) {
    showToast(errorTip(result?.code ?? -1, result?.message))
    return { ok: false, rpid: '', message: text }
  }
  const rpid = String((result.data as { rpid?: number | string } | undefined)?.rpid ?? '')
  return { ok: true, rpid, message: text }
}

/** 插入本地评论后：高亮 + 滚动到它 */
function revealNewComment(rpid: string): void {
  const container = document.getElementById(LIST_ID)
  const listEl = container?.querySelector<HTMLElement>('.bvp-cmt__list')
  const node = rpid
    ? container?.querySelector<HTMLElement>(`.bvp-cmt[data-rpid="${rpid}"]`)
    : null
  if (node) {
    node.classList.add('is-new')
    node.scrollIntoView({ block: 'nearest' })
    window.setTimeout(() => node.classList.remove('is-new'), 2200)
  }
  else if (listEl) {
    listEl.scrollTop = 0
  }
}

function bindContainerActions(container: HTMLElement): void {
  if (container.dataset.bound === '1')
    return
  container.dataset.bound = '1'
  container.addEventListener('input', (event) => {
    const target = event.target as HTMLElement
    if (!target.classList.contains('bvp-cmt__input'))
      return
    syncCount(target as HTMLTextAreaElement)
  })
  container.addEventListener('click', async (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')
    if (!target)
      return
    const action = target.dataset.action
    const rpid = target.dataset.rpid ?? ''
    if (action === 'sort-hot' || action === 'sort-new') {
      const listEl = container.querySelector<HTMLElement>('.bvp-cmt__list')
      if (listEl)
        state.scrollMemo[String(state.sort)] = listEl.scrollTop
      const next = action === 'sort-hot'
        ? 2
        : 0
      if (state.sort === next)
        return
      state.sort = next
      await reloadComments()
      return
    }
    if (action === 'toggle-up') {
      state.onlyUp = !state.onlyUp
      renderList()
      if (state.onlyUp)
        void ensureOnlyUpContent()
      return
    }
    if (action === 'load-more') {
      await loadPage(state.page + 1)
      return
    }
    if (action === 'open-emote') {
      const form = target.closest<HTMLElement>('.bvp-cmt__compose')
      if (form)
        await openEmoteForForm(form)
      return
    }
    if (action === 'attach-image') {
      handleAttachImage()
      return
    }
    if (action === 'cancel-reply') {
      state.replyTarget = null
      renderList()
      return
    }
    if (action === 'preview-image') {
      const index = Number(target.dataset.index ?? 0)
      const owner = state.items.find(entry => String(entry.rpid) === rpid)
        ?? state.subpage?.items.find(entry => String(entry.rpid) === rpid)
        ?? (state.subpage && String(state.subpage.root.rpid) === rpid
          ? state.subpage.root
          : undefined)
      if (owner?.pictures.length)
        openImageViewer(owner.pictures, index)
      return
    }
    if (action === 'like' && rpid) {
      await toggleLike(rpid)
      return
    }
    if (action === 'reply') {
      const name = target.dataset.name ?? ''
      const parent = await resolveRootForReply(rpid)
      state.replyTarget = {
        rpid,
        parent: parent.parent,
        rootOf: parent.root,
        name,
      }
      renderList()
      return
    }
    if (action === 'cancel-reply') {
      state.replyTarget = null
      renderList()
      return
    }
    if (action === 'open-subpage' && rpid) {
      await openSubpage(rpid)
      return
    }
    if (action === 'retry-load') {
      state.failed = false
      await loadPage(state.page + 1)
      return
    }
    if (action === 'close-subpage') {
      state.subpage = null
      renderList()
    }
  })
  container.addEventListener('submit', async (event) => {
    const form = event.target as HTMLFormElement
    if (!form.matches('.bvp-cmt__compose'))
      return
    event.preventDefault()
    const input = form.querySelector<HTMLTextAreaElement>('.bvp-cmt__input')
    if (!input)
      return
    const replyRpid = form.dataset.rpid ?? ''
    const isReply = Boolean(replyRpid)
    const parentInfo = isReply
      ? (state.subpage
          ? {
              root: String(state.subpage.root.rpid),
              parent: replyRpid,
            }
          : { root: replyRpid, parent: replyRpid })
      : undefined
    const result = await submitComment(input.value, parentInfo)
    if (!result.ok)
      return
    const self = await fetchSelfProfile()
    const item = makeLocalItem(result.rpid || `local-${Date.now()}`, result.message, self)
    item.justPosted = true
    if (isReply) {
      if (state.subpage) {
        state.subpage.items.push(item)
        state.subpage.root.rcount += 1
      }
      else {
        const rootItem = state.items.find(entry => String(entry.rpid) === replyRpid)
        if (rootItem)
          rootItem.rcount += 1
      }
      state.replyTarget = null
    }
    else {
      insertPostedItem(item)
    }
    renderList()
    revealNewComment(String(item.rpid))
  })
  // Ctrl / Cmd + Enter 快捷发布
  container.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement
    if (!target.classList.contains('bvp-cmt__input'))
      return
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      const form = target.closest<HTMLFormElement>('.bvp-cmt__compose')
      form?.requestSubmit()
    }
  })
}

/** 计算回复的 root / parent（子页内回复某条子回复时 parent = 该条，root = 主评论） */
async function resolveRootForReply(rpid: string): Promise<{ root: string, parent: string }> {
  if (state.subpage) {
    const rootRpid = String(state.subpage.root.rpid)
    return { root: rootRpid, parent: rpid }
  }
  return { root: rpid, parent: rpid }
}

/** 只看 UP：过滤结果为空且还有更多 → 自动翻页（上限 5 页，避免一次拉太多） */
async function ensureOnlyUpContent(): Promise<void> {
  let guard = 0
  while (state.onlyUp && !state.items.some(item => item.isUp) && state.hasMore && guard < MAX_ONLYUP_PAGES) {
    guard += 1
    await loadPage(state.page + 1)
  }
  if (state.onlyUp)
    renderList()
}

async function fetchMainPage(page: number): Promise<boolean> {
  const aid = await resolveAid()
  if (!aid)
    return false
  const data = await fetchJson<{
    code: number
    data?: { replies?: Record<string, any>[], top_replies?: Record<string, any>[], page?: { count?: number } }
  }>(`https://api.bilibili.com/x/v2/reply?type=1&oid=${aid}&pn=${page}&ps=${PAGE_SIZE}&sort=${state.sort}`)
  if (!data || data.code !== 0 || !data.data)
    return false
  const list = [
    ...(data.data.top_replies ?? []),
    ...(data.data.replies ?? []),
  ]
  const seen = new Set<string>()
  const pageItems: CommentItem[] = []
  for (const raw of list) {
    const item = normalizeReply(raw)
    if (seen.has(String(item.rpid)))
      continue
    seen.add(String(item.rpid))
    pageItems.push(item)
  }
  if (page === 1)
    state.renderedCount = RENDER_BATCH
  state.items = page === 1
    ? pageItems
    : [
        ...state.items,
        ...pageItems.filter(item => !state.items.some(existing => String(existing.rpid) === String(item.rpid))),
      ]
  state.page = page
  const total = data.data.page?.count ?? 0
  state.hasMore = pageItems.length >= PAGE_SIZE && state.items.length < total
  return true
}

async function loadPage(page: number): Promise<void> {
  if (state.loading)
    return
  state.loading = true
  renderList()
  const ok = await fetchMainPage(page)
  state.loading = false
  if (!ok) {
    state.failed = true
    if (!state.items.length)
      restoreNative()
    else
      renderList()
    return
  }
  state.failed = false
  renderList()
}

async function reloadComments(): Promise<void> {
  state.renderedCount = RENDER_BATCH
  state.page = 0
  state.items = []
  state.hasMore = false
  state.subpage = null
  state.replyTarget = null
  state.failed = false
  await loadPage(1)
}

/** 子页：自动把子回复全部加载完（pn 递增，最多 10 页 / is_end 判定） */
async function openSubpage(rpid: string): Promise<void> {
  const aid = await resolveAid()
  const root = state.items.find(item => String(item.rpid) === String(rpid))
  if (!aid || !root)
    return
  state.subpage = { root, items: [], loading: true }
  state.replyTarget = null
  renderList()

  const collected: CommentItem[] = []
  for (let page = 1; page <= MAX_SUB_PAGES; page++) {
    const data = await fetchJson<{
      code: number
      data?: {
        replies?: Record<string, any>[]
        page?: { count?: number }
        is_end?: boolean
      }
    }>(`https://api.bilibili.com/x/v2/reply/reply?type=1&oid=${aid}&root=${rpid}&pn=${page}&ps=${SUB_PAGE_SIZE}`)
    if (!data || data.code !== 0 || !data.data?.replies?.length)
      break
    const items = data.data.replies.map(normalizeReply)
    collected.push(...items)
    const isEnd = data.data.is_end ?? items.length < SUB_PAGE_SIZE
    if (isEnd || collected.length >= (root.rcount || collected.length))
      break
  }
  state.subpage = { root, items: collected, loading: false }
  renderList()
}

function mountList(column: HTMLElement, nativeApp: HTMLElement): void {
  let container = document.getElementById(LIST_ID)
  if (!container) {
    container = document.createElement('div')
    container.id = LIST_ID
    column.insertBefore(container, nativeApp)
  }
  nativeApp.style.setProperty('display', 'none', 'important')
  listMounted = true
}

function restoreNative(): void {
  document.getElementById(LIST_ID)?.remove()
  const nativeApp = document.querySelector<HTMLElement>(NATIVE_APP_SELECTOR)
  nativeApp?.style.removeProperty('display')
  listMounted = false
}

/** 首屏 / 切视频时调用；返回 false 表示本次未启用自绘 */
export function syncCommentList(): boolean {
  const bvid = currentBvid()
  if (!bvid)
    return false
  if (bvid !== state.bvid) {
    state.bvid = bvid
    state.aid = null
    state.items = []
    state.page = 0
    state.subpage = null
    state.replyTarget = null
    state.failed = false
  }
  const column = document.querySelector<HTMLElement>(COLUMN_SELECTOR)
  const nativeApp = document.querySelector<HTMLElement>(NATIVE_APP_SELECTOR)
  if (!column || !nativeApp)
    return false
  if (!listMounted) {
    mountList(column, nativeApp)
    void loadPage(1)
  }
  return true
}

export function setupCommentList(): () => void {
  startBridge()
  if (!syncCommentList())
    restoreNative()
  return teardownCommentList
}

export function teardownCommentList(): void {
  stopBridge()
  closeImageViewer()
  closeEmotePanel()
  restoreNative()
  state.aid = null
  state.bvid = ''
  state.ownerMid = ''
  state.isLogin = false
  state.items = []
  state.page = 0
  state.subpage = null
  state.replyTarget = null
  state.failed = false
  state.scrollMemo = {}
}
