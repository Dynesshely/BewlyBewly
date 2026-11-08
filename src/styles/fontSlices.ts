/** 由 scripts/font-slices.py 生成，请勿手改 */
import browser from 'webextension-polyfill'

export const FONT_SLICE_CSS = `
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-000.woff2')}) format('woff2');
    unicode-range: U+0020-007E;
  }
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-001.woff2')}) format('woff2');
    unicode-range: U+3000-303F;
  }
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-002.woff2')}) format('woff2');
    unicode-range: U+FF00-FFEF;
  }
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-003.woff2')}) format('woff2');
    unicode-range: U+4E00-51E7;
  }
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-004.woff2')}) format('woff2');
    unicode-range: U+51E8-55CF;
  }
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-005.woff2')}) format('woff2');
    unicode-range: U+55D0-59B7;
  }
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-006.woff2')}) format('woff2');
    unicode-range: U+59B8-5D9F;
  }
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-007.woff2')}) format('woff2');
    unicode-range: U+5DA0-6187;
  }
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-008.woff2')}) format('woff2');
    unicode-range: U+6188-656F;
  }
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-009.woff2')}) format('woff2');
    unicode-range: U+6570-6957;
  }
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-010.woff2')}) format('woff2');
    unicode-range: U+6958-6D3F;
  }
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-011.woff2')}) format('woff2');
    unicode-range: U+6D40-7127;
  }
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-012.woff2')}) format('woff2');
    unicode-range: U+7128-750F;
  }
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-013.woff2')}) format('woff2');
    unicode-range: U+7510-78F7;
  }
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-014.woff2')}) format('woff2');
    unicode-range: U+78F8-7CDF;
  }
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-015.woff2')}) format('woff2');
    unicode-range: U+7CE0-80C7;
  }
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-016.woff2')}) format('woff2');
    unicode-range: U+80C8-84AF;
  }
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-017.woff2')}) format('woff2');
    unicode-range: U+84B0-8897;
  }
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-018.woff2')}) format('woff2');
    unicode-range: U+8898-8C7F;
  }
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-019.woff2')}) format('woff2');
    unicode-range: U+8C80-9067;
  }
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-020.woff2')}) format('woff2');
    unicode-range: U+9068-944F;
  }
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-021.woff2')}) format('woff2');
    unicode-range: U+9450-9837;
  }
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-022.woff2')}) format('woff2');
    unicode-range: U+9838-9C1F;
  }
  @font-face {
    font-family: "ShangguSansSCVF";
    src: url(${browser.runtime.getURL('/assets/fonts/sc/sans-023.woff2')}) format('woff2');
    unicode-range: U+9C20-9FA5;
  }
`
