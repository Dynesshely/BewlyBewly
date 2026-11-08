import browser from 'webextension-polyfill'

import { injectCSS } from '~/utils/main'
import { FONT_SLICE_CSS } from './fontSlices'

injectCSS(`
  @font-face {
    font-family: "Numbers";
    unicode-range: U+0030-0039;
    src: url(${browser.runtime.getURL('/assets/fonts/Geist[wght].woff2')}) format("woff2-variations");
  }

  @font-face {
    font-family: "Onest";
    src: url(${browser.runtime.getURL('/assets/fonts/Onest[wght].woff2')}) format("woff2-variations");
  }

  /* 中文变量字体按 unicode-range 切片：浏览器只会下载页面实际用到的切片 */
  ${FONT_SLICE_CSS}

  @font-face {
    font-family: "CJKEmDash";
    unicode-range: U+2014, U+2E3A-2E3B;
    src: url(${browser.runtime.getURL('/assets/fonts/ZhudouSansVF-subset.woff2')}) format("woff2-variations");
  }
`)
