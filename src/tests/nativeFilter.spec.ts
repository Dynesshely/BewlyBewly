import { beforeEach, describe, expect, it, vi } from 'vitest'

import { markNativeFilteredCards } from '~/utils/nativeFilter'

const settingsValue = {
  enableFilterByTitle: true,
  filterByTitle: [] as { keyword: string }[],
}

vi.mock('~/logic', () => ({
  settings: {
    get value() {
      return settingsValue
    },
  },
}))

function buildCard(title: string): HTMLElement {
  const card = document.createElement('div')
  card.className = 'bili-video-card'
  const titleEl = document.createElement('h3')
  titleEl.className = 'bili-video-card__info--tit'
  titleEl.textContent = title
  card.appendChild(titleEl)
  return card
}

describe('nativeFilter', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    settingsValue.enableFilterByTitle = true
    settingsValue.filterByTitle = [
      { keyword: '广告' },
    ]
  })

  it('命中关键词的卡片被打标记而不是删除', () => {
    const list = document.createElement('div')
    list.className = 'video-list'
    const hit = buildCard('这是广告内容')
    const normal = buildCard('普通视频标题')
    list.append(hit, normal)
    document.body.appendChild(list)

    const stop = markNativeFilteredCards()
    expect(hit.getAttribute('data-bewly-filtered')).toBe('native')
    expect(normal.hasAttribute('data-bewly-filtered')).toBe(false)
    expect(document.body.contains(hit)).toBe(true)
    stop()
  })

  it('过滤关闭时不标记', () => {
    settingsValue.enableFilterByTitle = false
    const list = document.createElement('div')
    list.className = 'video-list'
    const hit = buildCard('广告视频')
    list.appendChild(hit)
    document.body.appendChild(list)

    const stop = markNativeFilteredCards()
    expect(hit.hasAttribute('data-bewly-filtered')).toBe(false)
    stop()
  })

  it('停止后移除标记', () => {
    const list = document.createElement('div')
    list.className = 'video-list'
    const hit = buildCard('广告视频')
    list.appendChild(hit)
    document.body.appendChild(list)

    const stop = markNativeFilteredCards()
    expect(hit.getAttribute('data-bewly-filtered')).toBe('native')
    stop()
    expect(hit.hasAttribute('data-bewly-filtered')).toBe(false)
  })
})
