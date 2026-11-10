<script setup lang="ts">
import type { ShortcutDefinition } from '../shortcuts'

import { nextTick, ref, watch } from 'vue'

import { toggleShortcutsHelp } from '../actions'
import { useMessages } from '../i18n'
import { getShortcutDefinitions } from '../shortcuts'
import { ui } from '../state'

const t = useMessages()
const closeButton = ref<HTMLButtonElement | null>(null)

/** 设置开关 + 页面能力（番剧切集）共同决定帮助里列哪些快捷键 */
const shortcuts = computed(() => getShortcutDefinitions())

function isSeparator(key: string): boolean {
  return key === '–'
}

/** 组合键之间插入「+」，范围键（0 – 9）之间不插 */
function needsPlus(item: ShortcutDefinition, index: number): boolean {
  if (index === 0)
    return false
  const current = item.keys[index]
  const previous = item.keys[index - 1]
  if (!current || !previous)
    return false
  return !isSeparator(current) && !isSeparator(previous)
}

watch(() => ui.helpOpen, async (open) => {
  if (!open)
    return
  await nextTick()
  closeButton.value?.focus()
})
</script>

<template>
  <Transition name="bvp-fade">
    <div
      v-if="ui.helpOpen"
      class="bvp-help"
      role="dialog"
      aria-modal="true"
      :aria-label="t.shortcutsTitle"
    >
      <div class="bvp-help__backdrop" aria-hidden="true" @click="toggleShortcutsHelp(false)" />
      <div class="bvp-help__dialog">
        <div class="bvp-help__header">
          <h2 class="bvp-help__title">
            {{ t.shortcutsTitle }}
          </h2>
          <button
            ref="closeButton"
            class="bvp-icon-btn"
            type="button"
            data-bvp-action="close-help"
            :aria-label="t.close"
            :title="t.close"
            @click="toggleShortcutsHelp(false)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
        <p class="bvp-help__hint">
          {{ t.shortcutsHint }}
        </p>
        <ul class="bvp-help__list">
          <li v-for="item in shortcuts" :key="item.labelKey" class="bvp-help__row">
            <span class="bvp-help__label">{{ t.shortcut[item.labelKey] }}</span>
            <span class="bvp-help__keys">
              <template v-for="(key, index) in item.keys" :key="`${item.labelKey}-${index}`">
                <span v-if="isSeparator(key)" class="bvp-help__separator">{{ key }}</span>
                <template v-else>
                  <span v-if="needsPlus(item, index)" class="bvp-help__separator">+</span>
                  <kbd class="bvp-kbd">{{ key }}</kbd>
                </template>
              </template>
            </span>
          </li>
        </ul>
      </div>
    </div>
  </Transition>
</template>
