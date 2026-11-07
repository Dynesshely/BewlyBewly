/**
 * Check if the url is the home page
 * @param url the url to check
 * @returns true if the url is the home page
 */
export function isHomePage(url: string = location.href): boolean {
  if (
    /https?:\/\/(?:www\.)?bilibili.com\/?(?:#\/?)?$/.test(url)
    || /https?:\/\/(?:www\.)?bilibili.com\/index\.html$/.test(url)
    || /https?:\/\/(?:www\.)?bilibili.com\/\?spm_id_from=.*/.test(url)
    || /https?:\/\/www\.bilibili\.com\/\?.*$/.test(url)
  ) {
    return true
  }
  return false
}

/**
 * Check if the url is a video or bangumi page
 * @param url the url to check
 * @returns true if the url is a video or bangumi page
 */
export function isVideoOrBangumiPage(url: string = location.href): boolean {
  if (
    // video page
    /https?:\/\/(?:www\.)?bilibili\.com\/(?:video|list)\/.*/.test(url)
    // anime playback & movie page
    || /https?:\/\/(?:www\.)?bilibili\.com\/bangumi\/play\/.*/.test(url)
    // watch later playlist
    || /https?:\/\/(?:www\.)?bilibili\.com\/list\/watchlater\?bvid.*/.test(url)
    || /https?:\/\/(?:www\.)?bilibili\.com\/watchlater\/list.*/.test(url)
    // favorite playlist
    || /https?:\/\/(?:www\.)?bilibili\.com\/list\/ml.*/.test(url)
  ) {
    return true
  }
  return false
}

/**
 * Check if the url is the notifications page
 * @param url the url to check
 * @returns true if the url is the notifications page
 */
export function isNotificationPage(url: string = location.href): boolean {
  if (
    /https?:\/\/message\.bilibili\.com\.*/.test(url)
  ) {
    return true
  }
  return false
}

/**
 * Check if the current page is in an iframe
 * @returns true if the current page is in an iframe
 */
export function isInIframe(): boolean {
  try {
    return window.self !== window.top
  }
  catch {
    // If we can't access window.top due to security restrictions,
    // we're definitely in an iframe
    return true
  }
}
