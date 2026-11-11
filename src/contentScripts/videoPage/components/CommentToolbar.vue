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

    <style scoped lang="scss">
      /* #region 窄屏适配（第 25 轮）
      工具条是 fixed + 内联 left/top 定位（由 comments.ts 计算并已 clamp 到视口内），
      这里只加媒体查询：≤1024px 允许换行、≤768px 缩小按钮，保证按钮不被裁切、
      也不会因为固定宽度盖住视频信息栏的可点区域。不改桌面端（≥1280px）观感。 */
      @media (max-width: 1024px) {
      .bvp-comment-toolbar {
      box-sizing: border-box;
      flex-wrap: wrap;
      row-gap: 4px;
      max-width: min(320px, calc(100vw - 24px));
      border-radius: 14px;
      }
      }

      @media (max-width: 768px) {
      .bvp-comment-toolbar {
      max-width: calc(100vw - 16px);
      padding: 3px;
      border-radius: 12px;
      }

      .bvp-comment-btn {
      height: 24px;
      padding: 0 8px;
      font-size: 11px;
      }
      }
      /* #endregion */
    </style>

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
