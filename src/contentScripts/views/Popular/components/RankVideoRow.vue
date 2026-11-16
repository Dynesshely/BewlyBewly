<script setup lang="ts">
import type { RankVideoRankItem } from '../types'
import ALink from '~/components/ALink.vue'
import { removeHttpFromUrl } from '~/utils/main'
import { usePopularI18n } from '../i18n'
import { formatCount, formatDuration } from '../utils'

const props = defineProps<{
  item: RankVideoRankItem
  rank: number
}>()

const { t } = usePopularI18n()

const videoUrl = computed(() => `https://www.bilibili.com/video/${props.item.bvid}`)
const authorUrl = computed(() => `https://space.bilibili.com/${props.item.owner.mid}`)
const coverUrl = computed(() => removeHttpFromUrl(props.item.pic ?? ''))
const isTop = computed(() => props.rank <= 3)
</script>

<template>
  <li class="popular-rank-row">
    <span
      class="popular-rank-row__badge"
      :data-tier="isTop ? 'top' : undefined"
      :aria-label="t.rankNo.replace('{rank}', String(rank))"
    >{{ rank }}</span>

    <ALink class="popular-rank-row__cover" :href="videoUrl" type="videoCard">
      <img :src="coverUrl" alt="" loading="lazy">
      <span class="popular-rank-row__duration">{{ formatDuration(item.duration) }}</span>
    </ALink>

    <div class="popular-rank-row__body">
      <ALink class="popular-rank-row__title" :href="videoUrl" type="videoCard" :title="item.title">
        {{ item.title }}
      </ALink>

      <div class="popular-rank-row__meta">
        <ALink class="popular-rank-row__up" :href="authorUrl" type="topBar">
          {{ item.owner.name }}
        </ALink>
        <span class="popular-rank-row__stat" :title="t.playCount">
          <span class="i-tabler:play" aria-hidden="true" />
          <span class="popular-visually-hidden">{{ t.playCount }}</span>
          {{ formatCount(item.stat.view) }}
        </span>
        <span class="popular-rank-row__stat" :title="t.danmakuCount">
          <span class="i-tabler:message-dots" aria-hidden="true" />
          <span class="popular-visually-hidden">{{ t.danmakuCount }}</span>
          {{ formatCount(item.stat.danmaku) }}
        </span>
      </div>
    </div>
  </li>
</template>
