<script setup lang="ts">
/**
 * 直播间侧栏「推荐直播」列表（自绘）。
 *
 * 挂在原生「主播公告」所在右侧列（`#sections-vm .right-container`，300px）的下方，
 * 与弹幕 / 礼物栏互不相干。数据走 `recList`（真机抓包确认：带 `landing_room_id` 时返回 7 条）。
 */
import type { LiveRoomCard as LiveRoomCardModel } from '../types'
import { fetchRoomRecommend } from '../api'
import { ROOM_RECOMMEND_LIMIT } from '../constants'
import LiveRoomCard from '../home/components/LiveRoomCard.vue'
import { useLiveI18n } from '../i18n'

const props = defineProps<{ roomId: number }>()

const { t } = useLiveI18n()

const cards = ref<LiveRoomCardModel[]>([])
const loading = ref(false)
const error = ref(false)
let disposed = false

async function load() {
  if (loading.value)
    return
  loading.value = true
  error.value = false
  try {
    const list = await fetchRoomRecommend(props.roomId)
    if (disposed)
      return
    cards.value = list.slice(0, ROOM_RECOMMEND_LIMIT)
  }
  catch (err) {
    if (disposed)
      return
    error.value = true
    console.warn('[BewlyBewly] 直播推荐列表加载失败', err)
  }
  finally {
    if (!disposed)
      loading.value = false
  }
}

onMounted(() => {
  void load()
})

onUnmounted(() => {
  disposed = true
})
</script>

<template>
  <section class="bew-live-rec">
    <header class="bew-live-rec__head">
      <h2 class="bew-live-rec__title">
        {{ t.recommendTitle }}
      </h2>
      <a class="bew-live-rec__more" href="https://live.bilibili.com/" target="_blank" rel="noopener">
        {{ t.recommendMore }}
      </a>
    </header>

    <div v-if="cards.length" class="bew-live-rec__list">
      <LiveRoomCard v-for="card in cards" :key="card.roomId" :card="card" compact />
    </div>

    <div v-else-if="error" class="bew-live-rec__state">
      <button class="bew-live-btn is-small" type="button" @click="load">
        {{ t.retry }}
      </button>
    </div>

    <div v-else-if="loading" class="bew-live-rec__list" aria-hidden="true">
      <div v-for="index in 3" :key="index" class="bew-live-skeleton is-compact">
        <div class="bew-live-skeleton__cover" />
        <div class="bew-live-skeleton__line" />
      </div>
    </div>
  </section>
</template>
