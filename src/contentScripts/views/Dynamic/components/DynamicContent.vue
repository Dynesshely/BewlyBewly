<script setup lang="ts">
/**
 * 一条动态的「内容块」：视频卡 / 图文（正文 + 九宫格）/ 通用卡。
 *
 * 同一个组件既用于原创动态的内容，也用于转发引用块里的原动态内容，
 * 只是 `nested` 时图片网格与视频卡都收窄一档（见 dynamic-drawn.scss 的 .dynamic-quote 规则）。
 */
import type { DynamicContent } from '../types'
import DynamicPics from './DynamicPics.vue'
import DynamicText from './DynamicText.vue'
import DynamicVideoCard from './DynamicVideoCard.vue'

defineProps<{
  content: DynamicContent
  /** 在转发引用块里（收窄一档） */
  nested?: boolean
}>()
</script>

<template>
  <div class="dynamic-content">
    <h3 v-if="content.title" class="dynamic-content__title">
      <a
        v-if="content.href"
        :href="content.href"
        target="_blank"
        rel="noopener noreferrer"
      >{{ content.title }}</a>
      <template v-else>
        {{ content.title }}
      </template>
    </h3>

    <DynamicVideoCard v-if="content.kind === 'video' && content.video" :video="content.video" />

    <template v-else>
      <DynamicText
        v-for="(paragraph, index) in content.paragraphs"
        :key="`content-text-${index}`"
        :paragraph="paragraph"
        :collapsible="!nested"
      />
      <DynamicPics v-if="content.pictures.length" :pictures="content.pictures" />
    </template>
  </div>
</template>
