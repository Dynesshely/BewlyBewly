<script setup lang="ts">
/**
 * 转发引用块：原动态作者 + 原动态内容。
 *
 * 视觉上是缩进一层的浅底块（与原生 `.bili-dyn-content__orig.reference` 同构），
 * 里面的正文不折叠 —— 嵌套两层「展开」会把引用块撑得很乱，
 * 而且引用块本身已经是次要信息，长文跳详情看更合适。
 */
import type { DynamicItem } from '../types'
import { computed } from 'vue'
import Picture from '~/components/Picture.vue'
import { useDynamicI18n } from '../i18n'
import DynamicContent from './DynamicContent.vue'
import DynamicText from './DynamicText.vue'

const props = defineProps<{
  quote: NonNullable<DynamicItem['quote']>
}>()

const { t } = useDynamicI18n()

/** 引用块的读屏名称：「转发自 <原动态作者>」（视觉上不重复显示作者关系） */
const ariaLabel = computed(() =>
  props.quote.authorName
    ? t.value.quoteFrom.replace('{name}', props.quote.authorName)
    : t.value.forward,
)
</script>

<template>
  <div class="dynamic-quote" :aria-label="ariaLabel">
    <a
      v-if="quote.authorName"
      class="dynamic-quote__author"
      :href="quote.authorHref || undefined"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span v-if="quote.authorFace" class="dynamic-quote__avatar">
        <Picture :src="quote.authorFace" fallback-kind="avatar" :alt="quote.authorName" />
      </span>
      <span class="dynamic-quote__name">{{ quote.authorName }}</span>
    </a>
    <DynamicText
      v-for="(paragraph, index) in quote.paragraphs"
      :key="`quote-text-${index}`"
      :paragraph="paragraph"
      :collapsible="false"
    />
    <DynamicContent v-if="quote.content" :content="quote.content" nested />
  </div>
</template>
