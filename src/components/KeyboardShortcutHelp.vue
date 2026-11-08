<script setup lang="ts">
defineEmits<{ (e: 'close'): void }>()

const items = [
  { keys: '↑ ↓ ← →', desc: 'keyboard_help.move' },
  { keys: 'Home / End', desc: 'keyboard_help.jump' },
  { keys: 'Enter', desc: 'keyboard_help.open_new' },
  { keys: 'Space', desc: 'keyboard_help.open_current' },
  { keys: '1 - 6', desc: 'keyboard_help.tabs' },
  { keys: '/', desc: 'keyboard_help.search' },
  { keys: 'Ctrl/Cmd + K', desc: 'keyboard_help.command_palette' },
  { keys: 's / f', desc: 'keyboard_help.sort_filter' },
  { keys: 'i', desc: 'keyboard_help.info_detail' },
  { keys: 'q', desc: 'keyboard_help.queue' },
  { keys: '?', desc: 'keyboard_help.help' },
]
</script>

<template>
  <div class="keyboard-help-mask" @click.self="$emit('close')">
    <div class="keyboard-help-panel">
      <div class="keyboard-help-header">
        <span class="keyboard-help-title">{{ $t('keyboard_help.title') }}</span>
        <span class="keyboard-help-hint">{{ $t('keyboard_help.hint') }}</span>
      </div>
      <div v-for="item in items" :key="item.keys" class="keyboard-help-row">
        <kbd class="keyboard-help-key">{{ item.keys }}</kbd>
        <span class="keyboard-help-desc">{{ $t(item.desc) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.keyboard-help-mask {
  position: fixed;
  inset: 0;
  z-index: 10010;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 35%);
  backdrop-filter: blur(4px);
}

.keyboard-help-panel {
  width: min(420px, 86vw);
  padding: 20px 24px;
  border-radius: var(--bew-radius);
  background: var(--bew-elevated);
  box-shadow: var(--bew-shadow-2);
  border: 1px solid var(--bew-border-color);
}

.keyboard-help-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 14px;
}

.keyboard-help-title {
  font-weight: 600;
  color: var(--bew-text-1);
}

.keyboard-help-hint {
  font-size: 12px;
  color: var(--bew-text-3);
}

.keyboard-help-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
  color: var(--bew-text-2);
}

.keyboard-help-key {
  min-width: 96px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--bew-border-color);
  background: var(--bew-fill-1);
  font-size: 12px;
  font-family: ui-monospace, monospace;
  color: var(--bew-text-1);
  text-align: center;
}

.keyboard-help-desc {
  font-size: 13px;
}
</style>
