import browser from 'webextension-polyfill'

interface Message {
  contentScriptQuery: string
  [key: string]: any
}

export enum TABS_MESSAGE {
  OPEN_LINK_IN_BACKGROUND = 'openLinkInBackground',
}

function handleMessage(message: unknown) {
  const msg = message as Message
  if (msg.contentScriptQuery === TABS_MESSAGE.OPEN_LINK_IN_BACKGROUND) {
    return browser.tabs.create({ url: msg.url, active: false })
  }
}

export function setupTabMsgLstnrs() {
  browser.runtime.onMessage.removeListener(handleMessage)
  browser.runtime.onMessage.addListener(handleMessage)
}
