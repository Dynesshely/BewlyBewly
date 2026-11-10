/**
 * 动态页的打开行为。
 *
 * - 视频卡复用 `settings.videoCardLinkOpenMode`（drawer / newTab / currentTab），
 *   与首页 `VideoCard` 的点击行为保持一致；
 * - 专栏、直播、原动态、UP 主主页一律新标签页打开（跨域，drawer 不适用）。
 */
import { useBewlyApp } from '~/composables/useAppProvider'
import { settings } from '~/logic'
import { openLinkToNewTab } from '~/utils/main'

export function useMomentsOpen() {
  const { openIframeDrawer } = useBewlyApp()

  function openInNewTab(url?: string) {
    if (!url)
      return
    openLinkToNewTab(url)
  }

  /** 视频（含番剧）按设置里的打开方式打开 */
  function openVideo(url?: string) {
    if (!url)
      return

    const mode = settings.value.videoCardLinkOpenMode
    if (mode === 'drawer') {
      openIframeDrawer(url)
      return
    }
    if (mode === 'currentTab') {
      window.location.href = url
      return
    }
    openLinkToNewTab(url)
  }

  return { openInNewTab, openVideo }
}
