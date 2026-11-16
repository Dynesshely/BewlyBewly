<script setup lang="ts">
import type { RankRegionId } from '../constants'
import { RANK_REGIONS } from '../constants'
import { usePopularI18n } from '../i18n'
import { pathForRegion } from '../utils'

defineProps<{ active: RankRegionId }>()
const emit = defineEmits<{ (e: 'select', id: RankRegionId): void }>()

const { t } = usePopularI18n()

/** 普通左键切分区；带修饰键 / 中键时保留原生链接（可在新标签页打开原生排行榜） */
function handleClick(event: MouseEvent, id: RankRegionId) {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
    return
  event.preventDefault()
  emit('select', id)
}
</script>

<template>
  <div class="popular-region-tabs" role="tablist" :aria-label="t.rankRegionAria">
    <a
      v-for="region in RANK_REGIONS"
      :key="region.id"
      class="popular-region-tab"
      :class="{ 'is-active': active === region.id }"
      :href="pathForRegion(region)"
      role="tab"
      :aria-selected="active === region.id"
      @click="handleClick($event, region.id)"
    >
      {{ t.region[region.id] }}
    </a>
  </div>
</template>
