<script setup lang="ts">
import { expandComment } from '../comments'
import { useMessages } from '../i18n'
import { ui } from '../state'

const t = useMessages()
</script>

<template>
  <template v-if="!ui.cinema">
    <button
      v-for="button in ui.commentFoldButtons"
      :key="button.id"
      class="bvp-comment-expand"
      type="button"
      data-bvp-action="expand-comment"
      :style="{ top: `${button.top}px`, left: `${button.left}px` }"
      @click="expandComment(button.id)"
    >
      {{ t.commentsExpand }}
    </button>
  </template>
</template>
