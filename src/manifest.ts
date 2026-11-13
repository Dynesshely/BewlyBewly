import type { Manifest } from 'webextension-polyfill'
import type PkgType from '../package.json'

import fs from 'fs-extra'
import { isDev, isFirefox, isSafari, port, r } from '../scripts/utils'

/**
 * 固定扩展 ID 用的公钥（base64 编码的 DER SPKI）。
 *
 * 这是**公钥**，可以安全地进仓库；配套私钥放在工作区 `.meta/dynesshely/bewlybewly/signing/`，
 * 只用于本地打包签名的 CRX，绝不入库。
 *
 * 加入 key 之后扩展 ID 固定为 `ejmgedipcepmbhbiiegjaecfhlcmajfe`，
 * 不会再随安装路径变化 —— 换目录、换机器都不会丢设置。
 */
const EXTENSION_PUBLIC_KEY = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4U9rJOZpgmwoHNodzmTpJQpXrVbs5WQ+pM1RwUgXWnK2weZimOP/d5E1DoNDuI+lqVlXSkeDXFUotjdy61XhJk6fcC9j2RhZn+9j9yWMZAcZemqdLz1EN1GnOr+CGidSyplVOslhfm7+tehZPDLGI7hJ7gu96ExHYMNEuJGowRcp5Py5T8586KbaSMuA9d9U4PPde0zc4DSPCiNZbRLwo7p6a05o9LJM5KdZicl0XjLkkOfirYPPxjnCAfGRP6SkfVf8d3IaXyX6JIyLsM02TdmhepnxVWV4A3+xUfJhLWKS5jwdeaf2KNikvl1CnMG7MPVpkgqEMHO9dYiqDr1mCwIDAQAB'

export async function getManifest() {
  const pkg = await fs.readJSON(r('package.json')) as typeof PkgType

  // update this file to update this manifest.json
  // can also be conditional based on your need
  // webextension-polyfill 的类型里没有 `key`，而 MV3 支持它（用于固定扩展 ID），
  // 所以这里交叉一个可选字段，避免 @typescript-eslint 报错又不丢类型检查。
  const manifest: Manifest.WebExtensionManifest & { key?: string } = {
    manifest_version: 3,
    name: `${pkg.displayName || pkg.name}${isDev ? ' Dev' : ''}`,
    version: pkg.version,
    key: EXTENSION_PUBLIC_KEY,
    description: pkg.description,
    homepage_url: pkg.homepage,
    // action: {
    //   default_icon: './assets/icon-512.png',
    //   default_popup: './dist/popup/index.html',
    // },
    // options_ui: {
    //   page: './dist/options/index.html',
    //   open_in_tab: true,
    // },

    // Setting `persistent` to true in Manifest V3 results in an error in Firefox
    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background
    background: (isFirefox || isSafari)
      ? {
          scripts: ['./dist/background/index.js'],
          persistent: isFirefox ? undefined : false,
        }
      : { service_worker: './dist/background/index.js' },

    icons: {
      16: './assets/icon-512.png',
      48: './assets/icon-512.png',
      128: './assets/icon-512.png',
    },
    permissions: [
      'storage',
      'declarativeNetRequest',
      'tabs',
      ...isFirefox
        ? ['webRequest', 'webRequestBlocking', 'cookies']
        : [],
    ],
    host_permissions: [
      '*://*.bilibili.com/*',
      '*://*.hdslb.com/*',
    ],
    content_scripts: [
      {
        matches: [
          '*://www.bilibili.com/*',
          '*://search.bilibili.com/*',
          '*://t.bilibili.com/*',
          '*://space.bilibili.com/*',
          '*://message.bilibili.com/*',
          '*://member.bilibili.com/*',
          '*://account.bilibili.com/*',
          '*://www.hdslb.com/*',
          '*://passport.bilibili.com/*',
          '*://music.bilibili.com/*',
          '*://live.bilibili.com/*',
        ],
        js: ['./dist/contentScripts/loader.js'],
        css: ['./dist/contentScripts/esm/style.css'],
        run_at: 'document_start',
        match_about_blank: true,
        all_frames: true,
      },
      {
        matches: [
          '*://www.bilibili.com/*',
          '*://search.bilibili.com/*',
          '*://t.bilibili.com/*',
          '*://space.bilibili.com/*',
          '*://message.bilibili.com/*',
          '*://member.bilibili.com/*',
          '*://account.bilibili.com/*',
          '*://www.hdslb.com/*',
          '*://passport.bilibili.com/*',
          '*://music.bilibili.com/*',
          '*://live.bilibili.com/*',
        ],
        js: ['./dist/inject/index.js'],
        run_at: 'document_start',
        all_frames: true,
        world: 'MAIN',
      },
    ],
    web_accessible_resources: [
      {
        resources: [
          'dist/contentScripts/esm/*',
          'dist/styles/pages/*',
          'assets/*',
        ],
        matches: ['<all_urls>'],
        // matches: ['./assets/*'],
      },
    ],
    content_security_policy: isFirefox
      ? {
          extension_pages: 'script-src \'self\'; object-src \'self\'',
        }
      : {
          extension_pages: isDev
          // this is required on dev for Vite script to load
            ? `script-src 'self' http://localhost:${port}; object-src 'self' http://localhost:${port}`
            : 'script-src \'self\'; object-src \'self\'',
        },
    ...isFirefox
      ? {}
      : {
          declarative_net_request: {
            rule_resources: [
              {
                id: 'ruleset_1',
                enabled: true,
                path: 'assets/rules.json',
              },
            ],
          },
        },
  }

  if (isDev)
    manifest.permissions?.push('webNavigation')

  if (isFirefox) {
    manifest.browser_specific_settings = {
      gecko: {
        id: 'addon@bewlybewly.com',
      },
    }
  }

  return manifest
}
