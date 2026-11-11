<script setup lang="ts">
import emitter from '~/utils/mitt'

import { dismissRecommendRail, railState } from '../recommendRail'
import RecommendRail from '../recommendRail/RecommendRail.vue'
import { ui } from '../state'
import CommentFoldButtons from './CommentFoldButtons.vue'
import CommentToolbar from './CommentToolbar.vue'
import CompactBar from './CompactBar.vue'
import FloatingControls from './FloatingControls.vue'
import ShortcutHelp from './ShortcutHelp.vue'

/**
 * 点击轨道卡片 = **当前标签页内嵌预览**。
 *
 * 走 `emitter.emit('open-video-preview', url)`：首页聚焦浏览的
 * `openFocusActiveCard('preview')` 用的就是这条通道（App.vue 里转发到 openIframeDrawer），
 * 所以视频页与首页的「当前页预览」行为完全一致，不会整页跳转。
 */
/** 卡片链接来自 B 站原生 DOM，多为协议相对（//www.bilibili.com/...），
 *  App.vue 的 openIframeDrawer 会 `new URL(url)` 解析失败而退化成新标签页打开，
 *  所以这里统一补成绝对地址。 */
function toAbsolute(url: string): string {
  if (!url)
    return ''
  try {
    return new URL(url, location.href).href
  }
  catch {
    return url
  }
}

function openRailPreview(url: string): void {
  const absolute = toAbsolute(url)
  if (absolute)
    emitter.emit('open-video-preview', absolute)
}

/** Ctrl/⌘ + 点击 / 中键：新标签页打开（保持 B 站原生行为语义） */
function openRailNewTab(url: string): void {
  const absolute = toAbsolute(url)
  if (!absolute)
    return
  window.open(absolute, '_blank', 'noopener')
}
</script>

<template>
  <div class="bvp-root" :data-ready="ui.ready" :data-mini="ui.mini" :data-fixed="ui.fixedLayout">
    <CompactBar />
    <CommentToolbar />
    <CommentFoldButtons />
    <!-- 第 27 轮：推荐视频横向聚焦轨道（页面下部，卡片来自原生 .rcmd-tab） -->
    <RecommendRail
      v-if="railState.placement && railState.cards.length"
      :cards="railState.cards"
      :placement="railState.placement"
      @preview="openRailPreview"
      @open-new-tab="openRailNewTab"
      @close="dismissRecommendRail"
    />
    <FloatingControls v-if="ui.ready" />
    <Transition name="bvp-fade">
      <div v-if="ui.toast" class="bvp-toast" role="status" aria-live="polite">
        {{ ui.toast }}
      </div>
    </Transition>
    <ShortcutHelp />
  </div>
</template>
