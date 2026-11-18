import type { Ref } from 'vue'

import type { AppPage } from '~/enums/appEnums'

export interface BewlyAppProvider {
  activatedPage: Ref<AppPage>
  scrollbarRef: Ref<any>
  reachTop: Ref<boolean>
  mainAppRef: Ref<HTMLElement>
  handleReachBottom: Ref<(() => void) | undefined>
  handlePageRefresh: Ref<(() => void) | undefined>
  handleBackToTop: (targetScrollTop?: number) => void
  haveScrollbar: () => Promise<boolean>
  openIframeDrawer: (url: string) => void
}

export function useBewlyApp(): BewlyAppProvider {
  const provider = inject<BewlyAppProvider>('BEWLY_APP')

  if (import.meta.env.DEV && !provider)
    throw new Error('AppProvider is not injected')

  return provider!
}

/**
 * 可选版本：不在 App 树内（或还没 provide）时返回 null，不抛错。
 *
 * 命令面板需要在「能拿到 provider 就切 dock 页、拿不到就退回整页跳转」之间做选择，
 * 用 `useBewlyApp()` 会在开发环境直接抛错，所以单独开一个不抛的入口。
 */
export function useAppProviderOptional(): BewlyAppProvider | null {
  return inject<BewlyAppProvider | null>('BEWLY_APP', null)
}
