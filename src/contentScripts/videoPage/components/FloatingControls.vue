<script setup lang="ts">
import { restorePlayer } from '../actions'
import { useMessages } from '../i18n'
import { ui } from '../state'

/**
 * 右下角浮动控件（第 33 轮收敛）。
 *
 * 用户要求把「选集」「快捷键」两个入口挪到工具栏（原生按钮，由 toolbarActions.ts 注入），
 * 所以这里**只保留迷你播放器态下的「还原播放器」**：
 * - 它就是「播放器已经收成浮窗、需要一键还原」这唯一场景的兜底按钮；
 * - 选集面板仍可用 `[` / `]` 打开，帮助仍可用 `?` 打开 —— 两者都走 actions，不依赖这里的按钮。
 */
const t = useMessages()
</script>

<template>
  <div
    v-if="ui.mini"
    class="bvp-fab-group"
    role="toolbar"
    :aria-label="t.controls"
  >
    <button
      class="bvp-fab"
      type="button"
      data-bvp-action="restore"
      :title="`${t.restorePlayer}（P）`"
      @click="restorePlayer()"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M3 9.5V13h3.5M13 6.5V3H9.5M13 3 9 7M3 13l4-4"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span class="bvp-fab__label">{{ t.restorePlayer }}</span>
    </button>
  </div>
</template>
