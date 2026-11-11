<script setup lang="ts">
import { computed } from 'vue'

import { clickCommentSort, toggleCommentsOnlyUp } from '../comments'
import { useMessages } from '../i18n'
import { ui } from '../state'

const t = useMessages()

/** 影院模式会压暗评论区：增强 UI 跟随隐藏 */
const visible = computed(() => ui.commentFound
  && ui.commentToolbarVisible
  && !ui.cinema
  && (ui.commentSortAvailable || ui.commentUpAvailable))

const upTitle = computed(() => ui.commentUpAvailable
  ? t.value.commentsOnlyUp
  : t.value.commentsUpUnavailable)

const toolbarStyle = computed(() => ({
  top: `${ui.commentToolbarTop}px`,
  left: `${ui.commentToolbarLeft}px`,
}))
</script>

<template>
  <div
    v-if="visible"
    class="bvp-comment-toolbar"
    role="toolbar"
    :aria-label="t.commentsToolbar"
    :style="toolbarStyle"
  >
    <template v-if="ui.commentSortAvailable">
      <button
        class="bvp-comment-btn"
        type="button"
        data-bvp-action="comment-sort-hot"
        :aria-pressed="ui.commentActiveSort === 'hot'"
        :title="t.commentsSortHot"
        @click="clickCommentSort('hot')"
      >
        {{ t.commentsSortHot }}
      </button>
      <button
        class="bvp-comment-btn"
        type="button"
        data-bvp-action="comment-sort-latest"
        :aria-pressed="ui.commentActiveSort === 'latest'"
        :title="t.commentsSortLatest"
        @click="clickCommentSort('latest')"
      >
        {{ t.commentsSortLatest }}
      </button>
    </template>

    <span
      v-if="ui.commentSortAvailable && ui.commentUpAvailable"
      class="bvp-comment-toolbar__divider"
      aria-hidden="true"
    />

    <button
      class="bvp-comment-btn"
      type="button"
      data-bvp-action="comment-only-up"
      :aria-pressed="ui.commentsOnlyUp"
      :disabled="!ui.commentUpAvailable"
      :title="upTitle"
      :aria-label="t.commentsOnlyUp"
      @click="toggleCommentsOnlyUp()"
    >
      {{ t.commentsOnlyUp }}
    </button>
  </div>
</template>
