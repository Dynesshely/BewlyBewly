<script setup lang="ts">
import type { RankPgcRankItem } from '../types'
import ALink from '~/components/ALink.vue'
import { removeHttpFromUrl } from '~/utils/main'
import { usePopularI18n } from '../i18n'
import { formatCount } from '../utils'

const props = defineProps<{
  item: RankPgcRankItem
  rank: number
}>()

const { t } = usePopularI18n()

const coverUrl = computed(() => removeHttpFromUrl(props.item.cover ?? ''))
const isTop = computed(() => props.rank <= 3)
const rating = computed(() => props.item.rating?.replace('分', '') ?? '')
</script>

<template>
  <li class="popular-rank-row">
    <span
      class="popular-rank-row__badge"
      :data-tier="isTop ? 'top' : undefined"
      :aria-label="t.rankNo.replace('{rank}', String(rank))"
    >{{ rank }}</span>

    <ALink class="popular-rank-row__cover popular-rank-row__cover--portrait" :href="item.url" type="videoCard">
      <img :src="coverUrl" alt="" loading="lazy">
    </ALink>

    <div class="popular-rank-row__body">
      <ALink class="popular-rank-row__title" :href="item.url" type="videoCard" :title="item.title">
        {{ item.title }}
      </ALink>

      <p class="popular-rank-row__desc">
        {{ item.desc }}
      </p>

      <div class="popular-rank-row__meta">
        <span v-if="rating" class="popular-rank-row__rating">{{ rating }}</span>
        <span class="popular-rank-row__stat" :title="t.playCount">
          <span class="i-tabler:play" aria-hidden="true" />
          {{ formatCount(item.stat.view) }}
        </span>
        <span class="popular-rank-row__stat">
          <span class="i-tabler:heart" aria-hidden="true" />
          {{ formatCount(item.stat.follow) }}
        </span>
      </div>
    </div>
  </li>
</template>
