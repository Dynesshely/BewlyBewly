<script setup lang="ts">
import { ui } from '../state'
import CommentFoldButtons from './CommentFoldButtons.vue'
import CommentToolbar from './CommentToolbar.vue'
import CompactBar from './CompactBar.vue'
import FloatingControls from './FloatingControls.vue'
import ShortcutHelp from './ShortcutHelp.vue'
</script>

<template>
  <div class="bvp-root" :data-ready="ui.ready" :data-mini="ui.mini" :data-cinema="ui.cinema">
    <CompactBar />
    <CommentToolbar />
    <CommentFoldButtons />
    <FloatingControls v-if="ui.ready" />
    <Transition name="bvp-fade">
      <div v-if="ui.toast" class="bvp-toast" role="status" aria-live="polite">
        {{ ui.toast }}
      </div>
    </Transition>
    <ShortcutHelp />
  </div>
</template>
