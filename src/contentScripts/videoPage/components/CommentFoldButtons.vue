<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { expandComment } from '../comments'
import { useMessages } from '../i18n'
import { ui } from '../state'

const t = useMessages()

/**
 * 第 25 轮窄屏修复：≤768px 时展开按钮改为「贴评论区右内侧」。
 *
 * 原来按钮的 left 由 comments.ts 按 thread 右边缘算（rect.right - 宽度），
 * 窄屏下正文几乎占满整行，按钮会压在文字上。这里只改**呈现位置**：
 * 窄屏改用 `right: 8px`，不再消费传入的 left；逻辑与点击行为不变。
 */
const NARROW_QUERY = '(max-width: 768px)'
const narrow = ref(false)
let media: MediaQueryList | null = null

function syncNarrow(): void {
  narrow.value = media?.matches ?? false
}

onMounted(() => {
  media = window.matchMedia(NARROW_QUERY)
  syncNarrow()
  media.addEventListener('change', syncNarrow)
})

onBeforeUnmount(() => {
  media?.removeEventListener('change', syncNarrow)
  media = null
})

function buttonStyle(button: { top: number, left: number }): Record<string, string> {
  if (narrow.value)
    return { top: `${button.top}px`, right: '8px' }
  return { top: `${button.top}px`, left: `${button.left}px` }
}
</script>

<template>
  <button
    v-for="button in ui.commentFoldButtons"
    :key="button.id"
    class="bvp-comment-expand"
    type="button"
    data-bvp-action="expand-comment"
    :style="buttonStyle(button)"
    @click="expandComment(button.id)"
  >
    {{ t.commentsExpand }}
  </button>
</template>
