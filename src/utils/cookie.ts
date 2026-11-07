/**
 * Get cookie by name
 * @param name cookie name
 * @returns cookie value
 */
export function getCookie(name: string): string {
  const value = `; ${document.cookie}`
  const parts: Array<string> = value.split(`; ${name}=`)
  if (parts.length === 2)
    return parts?.pop()?.split(';').shift() || ''
  return ''
}

/**
 * Set cookie
 * @param name cookie name
 * @param value cookie value
 * @param expDays expire days
 */
export function setCookie(name: string, value: any, expDays: number) {
  const date = new Date()
  date.setTime(date.getTime() + expDays * 24 * 60 * 60 * 1000)
  const expires = `expires=${date.toUTCString()}`
  document.cookie = `${name}=${value}; ${expires}; domain=.bilibili.com; path=/`
}

/**
 * Get current login user id
 * @returns userId
 */
export const getUserID = (): string => getCookie('DedeUserID')

/**
 * Get csrf token
 */
export const getCSRF = (): string => getCookie('bili_jct')
