import type { ShortcutLabelKey } from './i18n'

import { settings } from '~/logic'

import {
  restorePlayer,
  seekBy,
  seekToPercent,
  setCinema,
  stepEpisode,
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
  /** 只在特定条件下才存在/可用（用于「页面上没有集数列表就不列切集」这类场景） */
  requires?: 'episodeNav'
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
    keys: ['['],
    labelKey: 'prevEpisode',
    requires: 'episodeNav',
  },
  {
    keys: [']'],
    labelKey: 'nextEpisode',
    requires: 'episodeNav',
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
    // 番剧 / 电影：切上一集
    match: key => key === '[',
    run: () => stepEpisode(-1),
  },
  {
    // 番剧 / 电影：切下一集
    match: key => key === ']',
    run: () => stepEpisode(1),
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
  // 设置页关闭「增强快捷键」后，本模块完全不接管键盘
  if (!settings.value.videoPageShortcuts) {
    return
  }

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
      return
    }
    // 切集别名：部分键盘 `[` `]` 需要 AltGr，这里同时支持 Shift+, / Shift+. 产生的 `<` `>`
    if (ui.episodeNav && (key === '<' || key === '>')) {
      consume(event)
      stepEpisode(key === '<'
        ? -1
        : 1)
    }
    return
  }

  // 播放器还没渲染好时不要吞掉按键，避免用户以为快捷键失效
  if (!ui.ready) {
    return
  }

  // 对应功能被设置页关掉时，这些按键交还给 B 站原生处理
  if (lower === 't' && !settings.value.videoPageCinemaMode) {
    return
  }
  if (lower === 'p' && !settings.value.videoPageMiniPlayer) {
    return
  }
  // 页面上没有集数列表（电影单集 / 结构改版）时不抢 [ ]，交还给 B 站原生
  if ((key === '[' || key === ']') && !ui.episodeNav) {
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
 * 帮助面板实际展示的快捷键列表。
 *
 * 设置页关掉的功能、以及页面上不存在的功能（番剧切集）都不列出，
 * 保证「帮助里有的按键一定能用」。
 */
export function getShortcutDefinitions(): ShortcutDefinition[] {
  return VIDEO_PAGE_SHORTCUTS.filter((item) => {
    if (item.labelKey === 'cinema')
      return settings.value.videoPageCinemaMode
    if (item.labelKey === 'restore')
      return settings.value.videoPageMiniPlayer
    if (item.requires === 'episodeNav')
      return ui.episodeNav
    return true
  })
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
