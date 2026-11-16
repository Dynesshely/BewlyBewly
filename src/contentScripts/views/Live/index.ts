import {
  HOME_HOST_ID,
  ROOM_BAR_HOST_ID,
  ROOM_RECOMMEND_HOST_ID,
  ROOT_CLASS_HOME_DRAWN,
  ROOT_CLASS_ROOM_DRAWN,
} from './constants'
import {
  findHomeNativeContent,
  findRoomHeadInfo,
  findRoomPlayerColumn,
  findRoomRightColumn,
  hideNativeElements,
  injectPageCss,
  measureNavbarHeight,
  muteRoomHeadInfo,
  pauseNativeVideos,
  removePageCss,
  restoreNativeElements,
  restoreRoomHeadInfo,
  resumeNativeVideos,
  waitForElement,
} from './dom'
/**
 * 直播页（live.bilibili.com）自绘模块入口。
 *
 * 由 `contentScripts/index.ts` 调用 `setupLiveDrawnPage()` / `teardownLiveDrawnPage()`（接线见交付说明）。
 *
 * 接管范围（真机 CDP 核实，2026-11）：
 *   - **直播首页**：隐藏原生 `main`（banner / 小播放器 / 我的关注 / 原生推荐流）与原生分区行，
 *     在顶栏下方的固定浮层里自绘「分区 pill + 直播卡片网格」；
 *   - **直播间**：只接管两处——原生顶部信息栏（`#head-info-vm`，52px）自绘，
 *     右侧列（`#sections-vm .right-container`，300px）下方追加自绘「推荐直播」列表。
 *     播放器 / 弹幕 / 礼物 / 输入框一概不动。
 *
 * 失败回退：结构判定不到挂载点 → 完全不接管；数据加载失败 → 撤销接管、保持 / 还原原生页面。
 */
import LiveHome from './home/LiveHome.vue'
import { getLiveMessages } from './i18n'
import { getShadowMount, mountShadow, unmountShadow } from './mount'
import LiveRoomBar from './room/LiveRoomBar.vue'
import LiveRoomRecommend from './room/LiveRoomRecommend.vue'
import livePageCss from './styles/live.page.scss?inline'
import liveShadowCss from './styles/live.scss?inline'
import { isLiveHost, parseRoomId, resolvePageKind } from './utils'

/** 首页浮层的层叠顺序：低于 Bewly 顶栏（99），高于直播站原生内容 */
const HOME_OVERLAY_Z_INDEX = '90'
/** 直播间顶部栏：盖住原生信息栏即可，不能盖到播放器控制条上 */
const ROOM_BAR_Z_INDEX = '6'
/** 回退提示的展示时长 */
const TOAST_DURATION = 8_000
const TOAST_HOST_ID = 'bewly-live-drawn-toast'

type DrawnKind = 'home' | 'room'

interface DrawnState {
  kind: DrawnKind
  /** 本模块挂载过的容器 id（容器被 Vue 重渲染摘掉时按它重新挂回去） */
  hosts: string[]
}

let state: DrawnState | null = null
let domObserver: MutationObserver | null = null
let observeFrame = 0
let lastHref = ''

/** 站点路由（live 站主要是整页跳转，但分区页内也有 pushState） */
function currentHref(): string {
  return location.href
}

function addRootClass(className: string) {
  document.documentElement.classList.add(className)
}

function removeRootClass(className: string) {
  document.documentElement.classList.remove(className)
}

/** 首页首屏 / 结构失败：撤销接管，回到原生页面并提示 */
function fallbackHome() {
  teardownLiveDrawnPage()
  showFallbackToast(() => {
    setupLiveDrawnPage()
  })
}

/** 直播间信息栏加载失败：只放弃信息栏，原生信息栏保持可见 */
function fallbackRoomBar() {
  unmountShadow(ROOM_BAR_HOST_ID)
  removeRootClass(ROOT_CLASS_ROOM_DRAWN)
  restoreRoomHeadInfo()
  if (state)
    state.hosts = state.hosts.filter(id => id !== ROOM_BAR_HOST_ID)
}

/** 底部提示条（自绘失败时给用户一个可读的说明 + 重试） */
function showFallbackToast(onRetry: () => void) {
  unmountShadow(TOAST_HOST_ID)
  const messages = getLiveMessages()
  const host = document.createElement('div')
  host.id = TOAST_HOST_ID
  host.style.cssText = [
    'position:fixed',
    'left:50%',
    'bottom:28px',
    'transform:translateX(-50%)',
    'z-index:2147483000',
    'pointer-events:auto',
  ].join(';')
  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = [
    ':host{all:initial}',
    '.toast{display:flex;gap:12px;align-items:center;padding:10px 16px;font:13px/1.5 system-ui,sans-serif;',
    'color:var(--bew-text-1,#18191c);background:var(--bew-elevated-solid,#fff);border-radius:999px;',
    'box-shadow:0 10px 30px rgb(0 0 0 / 20%)}',
    '.toast button{padding:4px 14px;font:inherit;color:#fff;cursor:pointer;background:var(--bew-theme-color,#00aeec);',
    'border:0;border-radius:999px}',
  ].join('')
  const body = document.createElement('div')
  body.className = 'toast'
  const text = document.createElement('span')
  text.textContent = messages.fallbackToast
  const retry = document.createElement('button')
  retry.type = 'button'
  retry.textContent = messages.retry
  retry.addEventListener('click', () => {
    host.remove()
    onRetry()
  })
  body.append(text, retry)
  shadow.append(style, body)
  document.body.appendChild(host)
  window.setTimeout(() => host.remove(), TOAST_DURATION)
}

/** 挂载直播首页 */
function setupHome(): void {
  const native = findHomeNativeContent()
  if (!native.content.length) {
    // 结构不认识（比如又改版了）：不接管，保留原生首页
    console.warn('[BewlyBewly] 直播首页结构未识别，保留原生页面')
    return
  }

  mountShadow({
    id: HOME_HOST_ID,
    parent: document.body,
    component: LiveHome,
    props: { onFatal: fallbackHome },
    css: liveShadowCss,
    hostStyle: {
      position: 'fixed',
      top: `${measureNavbarHeight()}px`,
      right: '0',
      left: '0',
      bottom: '0',
      zIndex: HOME_OVERLAY_Z_INDEX,
      pointerEvents: 'none',
    },
    attributes: { 'data-bewly-live-home': '' },
  })

  addRootClass(ROOT_CLASS_HOME_DRAWN)
  hideNativeElements(native.content)
  pauseNativeVideos()

  state = {
    kind: 'home',
    hosts: [HOME_HOST_ID],
  }
}

/** 挂载直播间（顶部信息栏 + 侧栏推荐） */
async function setupRoom(roomId: number): Promise<void> {
  const playerColumn = await waitForElement(findRoomPlayerColumn)
  if (!playerColumn)
    return

  mountShadow({
    id: ROOM_BAR_HOST_ID,
    parent: playerColumn,
    component: LiveRoomBar,
    props: {
      roomId,
      onReady: () => {
        const headInfo = findRoomHeadInfo()
        if (headInfo)
          muteRoomHeadInfo(headInfo)
        addRootClass(ROOT_CLASS_ROOM_DRAWN)
      },
      onFatal: fallbackRoomBar,
    },
    css: liveShadowCss,
    hostStyle: {
      position: 'absolute',
      top: '0',
      right: '0',
      left: '0',
      height: '52px',
      zIndex: ROOM_BAR_Z_INDEX,
    },
    attributes: { 'data-bewly-live-room-bar': '' },
  })
  const hosts = [ROOM_BAR_HOST_ID]

  const rightColumn = findRoomRightColumn()
  if (rightColumn) {
    mountShadow({
      id: ROOM_RECOMMEND_HOST_ID,
      parent: rightColumn,
      component: LiveRoomRecommend,
      props: { roomId },
      css: liveShadowCss,
      hostStyle: { display: 'block' },
      attributes: { 'data-bewly-live-room-recommend': '' },
    })
    hosts.push(ROOM_RECOMMEND_HOST_ID)
  }

  state = { kind: 'room', hosts }
}

/**
 * 观察体 DOM 变化：
 *   1. 自绘容器被 Vue 重渲染摘掉时重新挂回去（直播间容器在 Vue 管理范围内）；
 *   2. 站点路由变化（SPA）时重新判定接管方案。
 */
function startDomObserver() {
  if (domObserver)
    return
  domObserver = new MutationObserver(() => {
    if (observeFrame)
      return
    observeFrame = window.requestAnimationFrame(() => {
      observeFrame = 0
      if (currentHref() !== lastHref) {
        lastHref = currentHref()
        teardownLiveDrawnPage()
        setupLiveDrawnPage()
        return
      }
      if (!state)
        return
      for (const id of state.hosts) {
        const handle = getShadowMount(id)
        if (handle && !handle.isConnected())
          handle.reattach()
      }
    })
  })
  domObserver.observe(document.body, { childList: true, subtree: true })
}

function stopDomObserver() {
  domObserver?.disconnect()
  domObserver = null
  if (observeFrame) {
    window.cancelAnimationFrame(observeFrame)
    observeFrame = 0
  }
}

/**
 * 启动自绘接管（幂等；非直播页 / iframe 内是空操作）。
 */
export function setupLiveDrawnPage(): void {
  if (!isLiveHost())
    return
  if (window.self !== window.top)
    return
  if (state)
    return
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => setupLiveDrawnPage(), { once: true })
    return
  }

  const kind = resolvePageKind()
  if (kind === 'other')
    return

  injectPageCss(livePageCss)
  lastHref = currentHref()
  startDomObserver()

  if (kind === 'home') {
    setupHome()
    return
  }

  const roomId = parseRoomId()
  if (!roomId)
    return
  void setupRoom(Number(roomId))
}

/** 撤销自绘接管，把页面完全还原成原生状态（幂等） */
export function teardownLiveDrawnPage(): void {
  stopDomObserver()

  unmountShadow(HOME_HOST_ID)
  unmountShadow(ROOM_BAR_HOST_ID)
  unmountShadow(ROOM_RECOMMEND_HOST_ID)
  unmountShadow(TOAST_HOST_ID)

  removeRootClass(ROOT_CLASS_HOME_DRAWN)
  removeRootClass(ROOT_CLASS_ROOM_DRAWN)
  restoreNativeElements()
  restoreRoomHeadInfo()
  resumeNativeVideos()
  removePageCss()

  state = null
}

export { LiveHome, LiveRoomBar, LiveRoomRecommend }
export { isLiveHost, parseRoomId, resolvePageKind } from './utils'
