/**
 * Smooth scroll to the top of the element
 */
export function scrollToTop(element: HTMLElement, targetScrollTop = 0 as number) {
  // cancel if already on top
  if (element.scrollTop === targetScrollTop)
    return

  element.scrollTo({
    top: targetScrollTop,
    behavior: 'smooth',
  })
}

export function injectCSS(css: string, element: HTMLElement | ShadowRoot = document.documentElement): HTMLStyleElement {
  const el = document.createElement('style')
  el.setAttribute('rel', 'stylesheet')
  el.textContent = css
  element.appendChild(el)
  return el
}

/**
 * Wait until an element matching the selector appears in the DOM.
 *
 * Uses a MutationObserver instead of the old interval polling, which could
 * leak a timer forever when the element never appeared and no abort signal
 * was provided.
 *
 * @param selector CSS selector to wait for
 * @param _timeout kept for backward compatibility, no longer used as polling interval
 * @param abort optional AbortController; aborting resolves with null
 * @param maxWaitMs optional hard timeout in ms; 0 means wait forever (default, matches old behaviour)
 * @returns the matched element, or null if aborted / timed out
 */
export function queryDomUntilFound(
  selector: string,
  _timeout = 500,
  abort?: AbortController,
  maxWaitMs = 0,
): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const found = document.querySelector(selector)
    if (found) {
      resolve(found as HTMLElement)
      return
    }

    if (abort?.signal.aborted) {
      resolve(null)
      return
    }

    let observer: MutationObserver | undefined
    let timer: ReturnType<typeof setTimeout> | undefined

    function cleanup() {
      observer?.disconnect()
      if (timer)
        clearTimeout(timer)
      abort?.signal.removeEventListener('abort', onAbort)
    }

    function settle(el: HTMLElement | null) {
      cleanup()
      resolve(el)
    }

    function onAbort() {
      settle(null)
    }

    abort?.signal.addEventListener('abort', onAbort, { once: true })

    observer = new MutationObserver(() => {
      const el = document.querySelector(selector)
      if (el)
        settle(el as HTMLElement)
    })
    observer.observe(document.documentElement, { childList: true, subtree: true })

    if (maxWaitMs > 0)
      timer = setTimeout(settle, maxWaitMs, null)
  })
}
