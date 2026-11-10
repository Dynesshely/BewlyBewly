import type { ShortcutLabelKey } from './i18n'

import {
  restorePlayer,
  seekBy,
  seekToPercent,
  setCinema,
  toggleCinema,
  toggleDanmaku,
  toggleFullscreen,
  toggleMute,
  togglePictureInPicture,
  togglePlay,
  toggleShortcutsHelp,
} from './actions'
import { isEditableTarget, isFromBewlyUi } from './dom'
import { ui } from './state'

const SMALL_SEEK_STEP = 5
const BIG_SEEK_STEP = 10

export interface ShortcutDefinition {
  keys: string[]
  labelKey: ShortcutLabelKey
}

/** 快捷键帮助面板的数据源（同时也是行为清单，改这里就是改帮助） */
export const VIDEO_PAGE_SHORTCUTS: ShortcutDefinition[] = [
  {
    keys: ['J'],
    labelKey: 'seekBack',
  },
  {
    keys: ['K'],
    labelKey: 'playPause',
  },
  {
    keys: ['L'],
    labelKey: 'seekForward',
  },
  {
    keys: ['←'],
    labelKey: 'back5',
  },
  {
    keys: ['→'],
    labelKey: 'forward5',
  },
  {
    keys: ['C'],
    labelKey: 'danmaku',
  },
  {
    keys: ['M'],
    labelKey: 'mute',
  },
  {
    keys: ['F'],
    labelKey: 'fullscreen',
  },
  {
    keys: ['T'],
    labelKey: 'cinema',
  },
  {
    keys: ['Shift', 'P'],
    labelKey: 'pip',
  },
  {
    keys: ['P'],
    labelKey: 'restore',
  },
  {
    keys: ['0', '–', '9'],
    labelKey: 'percent',
  },
  {
    keys: ['?'],
    labelKey: 'help',
  },
  {
    keys: ['Esc'],
    labelKey: 'escape',
  },
]

interface ShortcutAction {
  match: (key: string, lower: string) => boolean
  run: (key: string) => void
}

const SHORTCUT_ACTIONS: ShortcutAction[] = [
  {
    match: (_, lower) => lower === 'j',
    run: () => seekBy(-BIG_SEEK_STEP),
  },
  {
    match: (_, lower) => lower === 'k',
    run: () => togglePlay(),
  },
  {
    match: (_, lower) => lower === 'l',
    run: () => seekBy(BIG_SEEK_STEP),
  },
  {
    match: key => key === 'ArrowLeft',
    run: () => seekBy(-SMALL_SEEK_STEP),
  },
  {
    match: key => key === 'ArrowRight',
    run: () => seekBy(SMALL_SEEK_STEP),
  },
  {
    match: (_, lower) => lower === 'c',
    run: () => toggleDanmaku(),
  },
  {
    match: (_, lower) => lower === 'm',
    run: () => toggleMute(),
  },
  {
    match: (_, lower) => lower === 'f',
    run: () => void toggleFullscreen(),
  },
  {
    match: (_, lower) => lower === 't',
    run: () => toggleCinema(),
  },
  {
    match: (_, lower) => lower === 'p',
    run: () => restorePlayer(),
  },
  {
    match: key => /^\d$/.test(key),
    run: key => seekToPercent(Number(key) * 10),
  },
]

function consume(event: KeyboardEvent): void {
  event.preventDefault()
  event.stopPropagation()
}

function handleKeyDown(event: KeyboardEvent): void {
  // 已经有人（B 站原生 / 其它扩展）处理过的按键一律让行
  if (event.defaultPrevented || event.isComposing) {
    return
  }
  if (isEditableTarget(event.target) || isFromBewlyUi(event)) {
    return
  }

  const key = event.key
  const lower = key.toLowerCase()

  if (key === '?') {
    consume(event)
    toggleShortcutsHelp()
    return
  }

  if (key === 'Escape') {
    if (ui.helpOpen) {
      consume(event)
      toggleShortcutsHelp(false)
      return
    }
    if (ui.cinema) {
      consume(event)
      setCinema(false)
      return
    }
    // 其它 Esc 交给原生（退出全屏、关闭弹窗等）
    return
  }

  // 带系统修饰键的组合不抢（macOS 的 Cmd 快捷键、Ctrl+方向键调时间轴等）
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return
  }

  if (event.shiftKey) {
    if (lower === 'p') {
      consume(event)
      void togglePictureInPicture()
    }
    return
  }

  // 播放器还没渲染好时不要吞掉按键，避免用户以为快捷键失效
  if (!ui.ready) {
    return
  }

  for (const action of SHORTCUT_ACTIONS) {
    if (!action.match(key, lower)) {
      continue
    }
    consume(event)
    action.run(key)
    return
  }
}

/**
 * 在捕获阶段接管本模块负责的按键。
 *
 * 捕获阶段先于 B 站原生播放器的冒泡监听器执行，处理完直接 stopPropagation，
 * 因此不会出现「原生 ±5 秒 + 本模块 ±5 秒 = ±10 秒」这种重复处理；
 * 不认识的按键不拦截，原生快捷键（空格、↑↓ 音量等）照旧生效。
 */
export function setupShortcuts(): () => void {
  window.addEventListener('keydown', handleKeyDown, true)
  return () => window.removeEventListener('keydown', handleKeyDown, true)
}
