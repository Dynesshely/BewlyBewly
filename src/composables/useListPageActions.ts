import type { Ref } from 'vue'

import { useBewlyApp } from './useAppProvider'

export interface ListPageActionsOptions {
  /** Whether the list is currently loading */
  isLoading: Ref<boolean>
  /** Whether the list has reached its end (optional) */
  noMoreContent?: Ref<boolean>
  /** Load the next page */
  reachBottom: () => void | Promise<void>
  /** Reset and reload the list */
  refresh: () => void | Promise<void>
}

export interface ListPageActionsHandle {
  /** Re-bind actions after a KeepAlive re-activation */
  rebindPageActions: () => void
}

/**
 * Centralise the repeated "scroll to bottom / page refresh" guards used by
 * every list page:
 * - ignore reach-bottom while loading or when no more content
 * - ignore refresh while loading
 */
export function useListPageActions(options: ListPageActionsOptions): ListPageActionsHandle {
  const { handleReachBottom, handlePageRefresh } = useBewlyApp()

  function rebindPageActions() {
    handleReachBottom.value = () => {
      if (options.isLoading.value)
        return
      if (options.noMoreContent?.value)
        return
      options.reachBottom()
    }

    handlePageRefresh.value = () => {
      if (options.isLoading.value)
        return
      options.refresh()
    }
  }

  rebindPageActions()

  return { rebindPageActions }
}
