<script setup lang="ts">
/**
 * 三页统一的错误态：`components/Feedback/ErrorState` + 一个「在原版页面打开」的兜底入口。
 *
 * 「失败回退」在这套 dock 页面体系里的含义：三个页面本身就是 Bewly 自己渲染的
 * shadow DOM 页面，**从不读写原生 B 站 DOM**，所以接口失败时原生页面本来就没被动过；
 * 这里额外给一个原生页面链接，让用户能立刻拿到数据（数据在服务端，不会丢）。
 */
import ErrorState from '~/components/Feedback/ErrorState.vue'

withDefaults(defineProps<{
  title: string
  message?: string
  retryLabel?: string
  /** 原生页面地址（点击在新标签打开） */
  nativeUrl?: string
  /** 兜底链接文案 */
  nativeLabel?: string
}>(), {
  message: '',
  retryLabel: '',
  nativeUrl: '',
  nativeLabel: '',
})

defineEmits<{ (e: 'retry'): void }>()
</script>

<template>
  <div class="lists-drawn-error">
    <ErrorState
      :title="title"
      :message="message"
      :retry-label="retryLabel"
      @retry="$emit('retry')"
    >
      <a
        v-if="nativeUrl"
        class="lists-drawn-error__native"
        :href="nativeUrl"
        target="_blank"
        rel="noreferrer noopener"
      >{{ nativeLabel }}</a>
    </ErrorState>
  </div>
</template>
