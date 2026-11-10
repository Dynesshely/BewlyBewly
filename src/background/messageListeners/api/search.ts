import type { APIMAP } from '../../utils'
import { AHS } from '../../utils'

const API_SEARCH = {
  getSearchSuggestion: {
    url: 'https://s.search.bilibili.com/main/suggest',
    _fetch: {
      method: 'get',
    },
    params: {
      term: '',
      highlight: '',
    },
    afterHandle: AHS.J_D,
  },
  // 搜索热门词 / 热搜（B 站搜索页右侧「搜索发现」）
  // https://socialsisteryi.github.io/bilibili-API-collect/docs/search/hot.html
  getHotSearchWords: {
    url: 'https://s.search.bilibili.com/main/hotword',
    _fetch: {
      method: 'get',
    },
    afterHandle: AHS.J_D,
  },
} satisfies APIMAP

export default API_SEARCH
