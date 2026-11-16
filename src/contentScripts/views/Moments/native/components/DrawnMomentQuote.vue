<script setup lang="ts">
import type { DrawnQuote } from '../types'

import Picture from '~/components/Picture.vue'
import DrawnMomentContent from './DrawnMomentContent.vue'

/** 转发引用块：原动态作者 + 原动态内容（视频卡 / 图文 / 预约卡） */
defineProps<{
  quote: DrawnQuote
}>()
</script>

<template>
  <div class="bewly-moment-quote">
    <div v-if="quote.authorName" class="bewly-moment-quote__author">
      <span v-if="quote.authorAvatar" class="bewly-moment-quote__avatar">
        <Picture :src="quote.authorAvatar" fallback-kind="avatar" />
      </span>
      <span class="bewly-moment-quote__name">{{ quote.authorName }}</span>
    </div>
    <DrawnMomentContent v-if="quote.content" :content="quote.content" />
  </div>
</template>
