<script setup lang="ts">
import { useMessages } from '../i18n'
import { ui } from '../state'

/**
 * 顶部 2px 阅读进度条。
 *
 * 页面不够长（可滚动高度过小）时整条隐藏（ui.showProgress），
 * 避免在短文章上出现一条永远 100% 的进度条。
 */
const t = useMessages()
</script>

<template>
  <div
    v-if="ui.showProgress"
    class="bap-progress"
    role="progressbar"
    :aria-label="t.progress"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="ui.progress"
  >
    <div class="bap-progress__fill" :style="{ width: `${ui.progress}%` }" />
  </div>
</template>
