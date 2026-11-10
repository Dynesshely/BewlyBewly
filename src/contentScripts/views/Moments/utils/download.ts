/**
 * 图片下载（纯只读操作：把图片取成 blob 后交给浏览器下载器）。
 *
 * B 站图床是跨域地址，`<a download>` 对跨域链接会被浏览器忽略（退化成导航），
 * 所以这里走 fetch + blob；任何一步失败都返回 false，由调用方回退到新标签打开原图。
 */
export async function downloadImage(url: string, filename: string): Promise<boolean> {
  if (!url)
    return false

  try {
    // 不带 cookie：图床不需要登录态，也避免把凭据发给第三方域
    const response = await fetch(url, { credentials: 'omit' })
    if (!response.ok)
      return false

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = filename
    anchor.rel = 'noopener'
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
    return true
  }
  catch {
    return false
  }
}

/** 从图片地址推断扩展名，缺省 jpg */
export function imageFileExtension(url: string): string {
  const match = url.match(/.(jpe?g|png|webp|gif|avif)/i)
  const extension = match?.[1]?.toLowerCase()
  if (!extension)
    return 'jpg'
  return extension === 'jpeg'
    ? 'jpg'
    : extension
}
