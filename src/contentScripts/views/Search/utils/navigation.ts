import type { DirectLinkResult } from './directLink'
import { addSearchHistory } from '~/components/SearchBar/searchHistoryProvider'
import { settings } from '~/logic'
import { isHomePage } from '~/utils/main'

/**
 * 搜索起始页的跳转行为。
 *
 * 打开方式沿用设置里的 `searchBarLinkOpenMode`（和搜索栏保持一致），
 * 不新增设置项。
 */
function resolveLinkTarget(): '_blank' | '_self' {
  const mode = settings.value.searchBarLinkOpenMode
  if (mode === 'currentTabIfNotHomepage') {
    return isHomePage()
      ? '_blank'
      : '_self'
  }
  if (mode === 'currentTab')
    return '_self'
  return '_blank'
}

export function openUrl(url: string) {
  if (!url)
    return
  window.open(url, resolveLinkTarget())
}

/** 走 B 站搜索，并写入搜索历史（与搜索栏行为一致） */
export async function navigateToSearch(keyword: string) {
  const term = keyword.trim()
  if (!term)
    return
  window.open(`//search.bilibili.com/all?keyword=${encodeURIComponent(term)}`, resolveLinkTarget())
  try {
    await addSearchHistory({
      value: term,
      timestamp: Date.now(),
    })
  }
  catch {
    // 搜索历史依赖 B 站的 cols iframe，拿不到就静默跳过
  }
}

export function openDirectLink(target: DirectLinkResult) {
  openUrl(target.url)
}
