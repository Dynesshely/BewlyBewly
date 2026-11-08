import { settings } from '~/logic'

/**
 * 原生页面（搜索页、播放页推荐、热门排行等）的屏蔽词过滤器。
 *
 * 只给命中的卡片加 `data-bewly-filtered="native"`，隐藏交给 CSS，
 * 绝不删除 B 站节点，保证可逆且不影响站点逻辑。
 * 原生卡片能可靠拿到标题与 UP 主；播放量/时长解析不到时按未知放行。
 */

interface NativeRule {
  root: string
  item: string
  title: string
  author?: string
}

const RULES: Record<string, NativeRule[]> = {
  search: [
    {
      root: '.search-content, .video-list, #search-content',
      item: '.bili-video-card, .video-list-item, .search-page-video',
      title: '.bili-video-card__info--tit, .title, h3',
      author: '.bili-video-card__info--author, .up-name, .upname',
    },
  ],
  watch: [
    {
      root: '.right-container, .recommend-list-v1',
      item: '.video-page-card-small, .video-card, .rec-video-card, .bili-video-card',
      title: '.title, .video-name, .bili-video-card__info--tit',
      author: '.upname, .up-name, .bili-video-card__info--author, .name',
    },
  ],
  page: [
    {
      root: '.popular-video-container, .rank-list, .bangumi-list, .video-list',
      item: '.video-card, .rank-item, .bili-video-card, .video-list-item',
      title: '.video-name, .title, .info .title, .bili-video-card__info--tit',
      author: '.up-name, .upname, .bili-video-card__info--author, .name',
    },
  ],
}

const FILTERED_ATTR = 'data-bewly-filtered'

function textOf(el: Element, selector?: string): string {
  if (!selector)
    return ''
  return (el.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** 编译标题关键词规则（字符串或 /regex/ 形式） */
function compileKeywords(): { strings: string[], regExps: RegExp[] } {
  const strings: string[] = []
  const regExps: RegExp[] = []
  for (const item of settings.value.filterByTitle) {
    const keyword = item.keyword?.trim()
    if (!keyword)
      continue
    if (keyword.startsWith('/') && keyword.endsWith('/')) {
      try {
        regExps.push(new RegExp(keyword.slice(1, -1), 'i'))
      }
      catch {
        // 非法正则忽略
      }
    }
    else {
      strings.push(keyword.toUpperCase())
    }
  }
  return { strings, regExps }
}

function shouldHide(title: string): boolean {
  if (!settings.value.enableFilterByTitle)
    return false
  const { strings, regExps } = compileKeywords()
  if (!strings.length && !regExps.length)
    return false
  const upper = title.toUpperCase()
  return strings.some(keyword => upper.includes(keyword)) || regExps.some(re => re.test(title))
}

/** 标记当前页面所有命中的原生卡片；返回清理函数 */
export function markNativeFilteredCards(): () => void {
  if (!settings.value.enableFilterByTitle)
    return () => {}

  const kind = /search\.bilibili\.com/.test(location.hostname)
    ? 'search'
    : 'page'
  const marked: Element[] = []

  const scan = (root: ParentNode) => {
    for (const rule of RULES[kind]) {
      root.querySelectorAll(rule.item).forEach((card) => {
        const title = textOf(card, rule.title)
        if (!title)
          return
        if (shouldHide(title)) {
          card.setAttribute(FILTERED_ATTR, 'native')
          marked.push(card)
        }
        else if (card.getAttribute(FILTERED_ATTR) === 'native' && !marked.includes(card)) {
          card.removeAttribute(FILTERED_ATTR)
        }
      })
    }
  }

  scan(document)
  // 动态加载的卡片（瀑布流/分页）陆续标记
  const observer = new MutationObserver(() => scan(document))
  observer.observe(document.body, { childList: true, subtree: true })

  return () => {
    observer.disconnect()
    marked.forEach(card => card.removeAttribute(FILTERED_ATTR))
  }
}
