<script setup lang="ts">
import type { GridVideoElement } from '../types'
import type { GridLayoutType } from '~/logic'
import type { TrendingResult, List as VideoItem } from '~/models/video/trending'
import { useBewlyApp } from '~/composables/useAppProvider'
import { useGridLayoutClass } from '~/composables/useGridLayout'
import { useListPageActions } from '~/composables/useListPageActions'

import api from '~/utils/api'

type VideoElement = GridVideoElement<VideoItem>

const props = defineProps<{
  gridLayout: GridLayoutType
}>()

const emit = defineEmits<{
  (e: 'beforeLoading'): void
  (e: 'afterLoading'): void
}>()

const gridClass = useGridLayoutClass(toRef(props, 'gridLayout'))
const videoList = ref<VideoElement[]>([])
const isLoading = ref<boolean>(false)
const pn = ref<number>(1)
const noMoreContent = ref<boolean>(false)
const { haveScrollbar } = useBewlyApp()
const { rebindPageActions } = useListPageActions({
  isLoading,
  noMoreContent,
  reachBottom: () => getData(),
  refresh: () => initData(),
})

onMounted(() => {
  initData()
})

onActivated(() => {
  rebindPageActions()
})

async function initData() {
  noMoreContent.value = false
  videoList.value.length = 0
  pn.value = 1
  await getData()
}

async function getData() {
  emit('beforeLoading')
  isLoading.value = true
  try {
    await getTrendingVideos()
  }
  finally {
    isLoading.value = false
    emit('afterLoading')
  }
}

async function getTrendingVideos() {
  if (noMoreContent.value)
    return

  try {
    let i = 0
    // https://github.com/starknt/BewlyBewly/blob/fad999c2e482095dc3840bb291af53d15ff44130/src/contentScripts/views/Home/components/ForYou.vue#L208
    const pendingVideos: VideoElement[] = Array.from({ length: 30 }, () => ({
      uniqueId: `unique-id-${(videoList.value.length || 0) + i++})}`,
    } satisfies VideoElement))
    let lastVideoListLength = videoList.value.length
    videoList.value.push(...pendingVideos)

    const response: TrendingResult = await api.video.getPopularVideos({
      pn: pn.value++,
      ps: 30,
    })

    if (response.code === 0) {
      noMoreContent.value = response.data.no_more

      const resData = [] as VideoItem[]

      response.data.list.forEach((item: VideoItem) => {
        resData.push(item)
      })

      // when videoList has length property, it means it is the first time to load
      if (!videoList.value.length) {
        videoList.value = resData.map(item => ({ uniqueId: `${item.aid}`, item }))
      }
      else {
        resData.forEach((item) => {
          videoList.value[lastVideoListLength++] = {
            uniqueId: `${item.aid}`,
            item,
          }
        })
      }

      if (!await haveScrollbar() && !noMoreContent.value) {
        getTrendingVideos()
      }
    }
  }
  finally {
    videoList.value = videoList.value.filter(video => video.item)
  }
}

defineExpose({ initData })
</script>

<template>
  <div>
    <div
      m="b-0 t-0" relative w-full h-full
      :class="gridClass"
    >
      <VideoCard
        v-for="video in videoList"
        :key="video.uniqueId"
        :skeleton="!video.item"
        :video="video.item ? {
          id: Number(video.item.aid),
          duration: video.item.duration,
          title: video.item.title,
          desc: video.item.desc,
          cover: video.item.pic,
          author: {
            name: video.item.owner.name,
            authorFace: video.item.owner.face,
            mid: video.item.owner.mid,
          },
          view: video.item.stat.view,
          danmaku: video.item.stat.danmaku,
          publishedTimestamp: video.item.pubdate,
          bvid: video.item.bvid,
          tag: video.item.rcmd_reason.content,
          cid: video.item.cid,
        } : undefined"
        show-preview
        :horizontal="gridLayout !== 'adaptive'"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.grid-adaptive {
  --uno: "grid 2xl:cols-5 xl:cols-4 lg:cols-3 md:cols-2 sm:cols-1 cols-1 gap-5";
}

.grid-two-columns {
  --uno: "grid cols-1 xl:cols-2 gap-4";
}

.grid-one-column {
  --uno: "grid cols-1 gap-4";
}
</style>
