<script setup lang="ts">
import { computed } from 'vue'

import { openSettings, selectCategory } from '../actions'
import { formatUnread, useMessages } from '../i18n'
import { state } from '../state'

const t = useMessages()
const categories = computed(() => state.categories)

function badgeText(unread: number | null): string {
  if (unread === null)
    return ''
  return unread > 99
    ? '99+'
    : String(unread)
}

function tabLabel(name: string, unread: number | null): string {
  return unread
    ? `${name}，${formatUnread(t.value.unreadBadge, unread)}`
    : name
}
</script>

<template>
  <nav class="bewly-msg-tabs" :aria-label="t.categories">
    <div class="bewly-msg-tabs__list" role="tablist">
      <button
        v-for="category in categories"
        :key="category.index"
        class="bewly-msg-tabs__pill"
        :class="{ 'is-active': category.active }"
        type="button"
        role="tab"
        :aria-selected="category.active"
        :aria-label="tabLabel(category.name, category.unread)"
        @click="selectCategory(category.index)"
      >
        <span class="bewly-msg-tabs__label">{{ category.name }}</span>
        <span v-if="category.unread" class="bewly-msg-tabs__badge" aria-hidden="true">{{ badgeText(category.unread) }}</span>
        <span v-else-if="category.dot" class="bewly-msg-tabs__dot" aria-hidden="true" />
      </button>
    </div>
    <button class="bewly-msg-tabs__settings" type="button" @click="openSettings()">
      {{ t.settings }}
    </button>
  </nav>
</template>
