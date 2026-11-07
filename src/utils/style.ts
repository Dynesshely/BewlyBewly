import browser from 'webextension-polyfill'

/**
 * Inject one of the per-page compiled stylesheets at runtime.
 *
 * Page styles are no longer bundled into the main content-script style.css;
 * they are compiled separately by scripts/build-pages-styles.mjs and injected
 * only on the page that needs them.
 *
 * @param name file name without extension, e.g. 'homePage'
 */
export function injectPageStyle(name: string): Promise<void> {
  return new Promise((resolve) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = browser.runtime.getURL(`dist/styles/pages/${name}.css`)
    link.onload = () => resolve()
    link.onerror = () => resolve()
    document.documentElement.appendChild(link)
  })
}
