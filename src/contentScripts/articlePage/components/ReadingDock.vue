<script setup lang="ts">
import { computed } from 'vue'

import {
  decreaseFont,
  increaseFont,
  scrollToTop,
  toggleReading,
  toggleToc,
} from '../actions'
import { fontStepLabel, formatTemplate, useMessages } from '../i18n'
import { ui } from '../state'

/**
 * 右下角浮动控件：阅读进度百分比 + 沉浸阅读开关 + 字号三档 + 目录开关 + 回到顶部。
 *
 * 每个按钮都是原生 <button type="button">，带 aria-label 与 title，Tab 可达。
 */
const t = useMessages()

const fontLabel = computed(() => fontStepLabel(t.value, ui.fontStep))
const canDecrease = computed(() => ui.fontStep !== 's')
const canIncrease = computed(() => ui.fontStep !== 'l')
</script>

<template>
  <div class="bap-dock" role="toolbar" :aria-label="t.dock">
    <span v-if="ui.showProgress" class="bap-percent" aria-hidden="true">{{ ui.progress }}%</span>

    <div class="bap-group">
      <button
        type="button"
        class="bap-fab"
        :aria-pressed="ui.reading"
        :aria-label="ui.reading ? t.exitReading : t.reading"
        :title="ui.reading ? `${t.exitReading}（R / Esc）` : `${t.reading}（R）`"
        @click="toggleReading()"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M2.5 3.5h5v9h-5zM8.5 3.5h5v9h-5z"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linejoin="round"
          />
        </svg>
        <span class="bap-fab__label">{{ ui.reading ? t.exitReading : t.reading }}</span>
      </button>

      <button
        type="button"
        class="bap-fab bap-fab--icon"
        :disabled="!canDecrease"
        :aria-label="t.fontSmaller"
        :title="`${t.fontSmaller}（[）`"
        @click="decreaseFont()"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 11V5h5M4 8h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
          <path d="M10 11h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
        </svg>
      </button>

      <span class="bap-font-step" :title="`${t.fontLabel}：${fontLabel}`">
        {{ fontLabel }}
      </span>

      <button
        type="button"
        class="bap-fab bap-fab--icon"
        :disabled="!canIncrease"
        :aria-label="t.fontLarger"
        :title="`${t.fontLarger}（]）`"
        @click="increaseFont()"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 11V5h5M4 8h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
          <path d="M10 11h3M11.5 9.5v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <div class="bap-group">
      <button
        type="button"
        class="bap-fab"
        :data-active="ui.tocOpen"
        :aria-expanded="ui.tocOpen"
        :aria-label="t.toc"
        :title="`${t.toc} · ${formatTemplate(t.tocCount, { count: ui.tocItems.length })}`"
        :disabled="ui.tocItems.length === 0"
        @click="toggleToc()"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M2.5 4h11M2.5 8h7M2.5 12h7"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
          />
        </svg>
        <span class="bap-fab__label">{{ t.toc }}</span>
      </button>

      <button
        type="button"
        class="bap-fab bap-fab--icon"
        :aria-label="t.backToTop"
        :title="`${t.backToTop}（T）`"
        @click="scrollToTop()"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 13V4M4.5 7.5 8 4l3.5 3.5"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>
  </div>
</template>
