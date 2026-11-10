import type { Ref } from 'vue'

import type { ListSortMode, ListViewMode } from './types'
import { isTypingTarget } from './utils'

interface ListShortcutOptions {
  viewMode: Ref<ListViewMode>
  sortMode: Ref<ListSortMode>
  cycleViewMode: () => void
  cycleSortMode: () => void
  focusFilter: () => void
  toggleHelp: () => void
}

/**
 * 列表页模块内快捷键：
 * V 循环切换视图、Shift+V 循环切换排序、/ 聚焦过滤框、H 打开本页快捷键说明。
 * 全局快捷键（?、Enter、Space、W、S 等）由 App.vue 统一处理，这里不重复接管。
 */
export function useListShortcuts(options: ListShortcutOptions) {
  function handleKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing)
      return
    if (event.ctrlKey || event.metaKey || event.altKey)
      return
    if (isTypingTarget(event.target))
      return

    if (event.key === '/' && !event.shiftKey) {
      event.preventDefault()
      options.focusFilter()
      return
    }

    if (event.key.toLowerCase() === 'v') {
      event.preventDefault()
      if (event.shiftKey)
        options.cycleSortMode()
      else
        options.cycleViewMode()
      return
    }

    if (event.key.toLowerCase() === 'h' && !event.shiftKey) {
      event.preventDefault()
      options.toggleHelp()
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKeydown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
}
