import type { APIMAP } from '../../utils'
import { AHS } from '../../utils'

const API_MOMENT = {
  getTopBarNewMomentsCount: {
    url: 'https://api.bilibili.com/x/web-interface/dynamic/entrance',
    _fetch: {
      method: 'get',
    },
    params: {},
    afterHandle: AHS.J_D,
  },
  getTopBarMoments: {
    url: 'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/nav',
    _fetch: {
      method: 'get',
    },
    params: {
      type: 'video',
      update_baseline: '',
      offset: '',
    },
    afterHandle: AHS.J_D,
  },
  getTopBarLiveMoments: {
    url: 'https://api.live.bilibili.com/xlive/web-ucenter/v1/xfetter/FeedList',
    _fetch: {
      method: 'get',
    },
    params: {
      page: 1,
      pagesize: 10,
    },
    afterHandle: AHS.J_D,
  },
  // 动态点赞 / 取消点赞
  // https://socialsisteryi.github.io/bilibili-API-collect/docs/dynamic/like.html
  likeMoment: {
    url: 'https://api.bilibili.com/x/dynamic/feed/dyn/thumb',
    _fetch: {
      method: 'post',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: {
        dyn_id_str: '',
        up: 1,
        csrf: '',
      },
    },
    afterHandle: AHS.J_D,
  },
  getMoments: {
    url: 'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all',
    _fetch: {
      method: 'get',
    },
    params: {
      type: 'all',
      offset: 0,
      update_baseline: '',
    },
    afterHandle: AHS.J_D,
  },
} satisfies APIMAP

export default API_MOMENT
