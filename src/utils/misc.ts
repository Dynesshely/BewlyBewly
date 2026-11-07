/**
 * Remove the 'http:' or 'https:' prefix from a URL
 * @param url url to trim
 * @returns The result of removing the 'http:' or 'https:' prefix from a url
 */
export function removeHttpFromUrl(url: string): string {
  return url.replace(/^https?:/, '')
}

export function openLinkToNewTab(url: string, features: string = '') {
  window.open(url, '_blank', features)
}

/**
 * delay
 * @param ms milliseconds delay time
 */
export function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Compare two versions
 * @param version1 version string
 * @param version2 version string
 * @returns 1 if version1 is greater than version2, -1 if version1 is less than version2, 0 if version1 is equal to version2
 */
export function compareVersions(version1: string, version2: string): number {
  const v1Parts = version1.split('.').map(Number)
  const v2Parts = version2.split('.').map(Number)

  // Determine the longer length for iteration
  const maxLength = Math.max(v1Parts.length, v2Parts.length)

  for (let i = 0; i < maxLength; i++) {
    const num1 = v1Parts[i] || 0 // Defaults to 0 if undefined
    const num2 = v2Parts[i] || 0 // Defaults to 0 if undefined

    if (num1 > num2)
      return 1
    if (num1 < num2)
      return -1
  }

  return 0 // Versions are equal
}
