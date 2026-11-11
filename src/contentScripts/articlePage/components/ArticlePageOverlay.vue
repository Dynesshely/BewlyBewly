<script setup lang="ts">
import { ui } from '../state'
import ArticleImageLightbox from './ArticleImageLightbox.vue'
import ArticleTocPanel from './ArticleTocPanel.vue'
import ReadingDock from './ReadingDock.vue'
import ReadingProgress from './ReadingProgress.vue'
</script>

<template>
  <div class="bap-root" :data-ready="ui.ready" :data-reading="ui.reading">
    <ReadingProgress />
    <Transition name="bap-fade">
      <ReadingDock v-if="ui.ready" />
    </Transition>
    <ArticleTocPanel />
    <ArticleImageLightbox />
    <Transition name="bap-fade">
      <div v-if="ui.toast" class="bap-toast" role="status" aria-live="polite">
        {{ ui.toast }}
      </div>
    </Transition>
  </div>
</template>
