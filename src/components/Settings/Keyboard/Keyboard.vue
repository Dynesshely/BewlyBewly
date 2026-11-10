<script lang="ts" setup>
import type { ShortcutActionId } from '~/constants/shortcuts'
import type { KeyboardOpenAction } from '~/logic/storage'
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'
import { DEFAULT_SHORTCUTS, eventToCombo, formatCombo, resolveShortcut, SHORTCUT_ACTIONS } from '~/constants/shortcuts'
import { settings } from '~/logic'

import SettingsItem from '../components/SettingsItem.vue'
import SettingsItemGroup from '../components/SettingsItemGroup.vue'

const { t } = useI18n()
const toast = useToast()

const openActionOptions = computed(() => [
  {
    label: t('settings.keyboard_open_opt.new_tab'),
    value: 'newTab',
  },
  {
    label: t('settings.keyboard_open_opt.current_tab'),
    value: 'currentTab',
  },
  {
    label: t('settings.keyboard_open_opt.preview'),
    value: 'preview',
  },
])

const capturing = ref<ShortcutActionId | null>(null)

function shortcutOf(id: ShortcutActionId): string {
  return resolveShortcut(id, settings.value.keyboardShortcuts)
}

function startCapture(id: ShortcutActionId) {
  capturing.value = id
  window.addEventListener('keydown', onCaptureKeydown, true)
}

function stopCapture() {
  capturing.value = null
  window.removeEventListener('keydown', onCaptureKeydown, true)
}

function setShortcut(id: ShortcutActionId, combo: string) {
  const next = { ...settings.value.keyboardShortcuts }
  if (!combo || combo === DEFAULT_SHORTCUTS[id])
    delete next[id]
  else
    next[id] = combo
  settings.value.keyboardShortcuts = next
}

function onCaptureKeydown(event: KeyboardEvent) {
  const id = capturing.value
  if (!id)
    return
  event.preventDefault()
  event.stopPropagation()

  // 只按修饰键时继续等待真正的按键
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key))
    return

  if (event.key === 'Escape') {
    stopCapture()
    return
  }
  if (event.key === 'Backspace' || event.key === 'Delete') {
    setShortcut(id, '')
    stopCapture()
    return
  }

  const combo = eventToCombo(event)
  // 冲突检测：同一个组合键不能绑两个动作
  const conflict = SHORTCUT_ACTIONS.find(action => action.id !== id && shortcutOf(action.id) === combo)
  if (conflict) {
    toast.warning(t('settings.keyboard_conflict', {
      action: t(conflict.labelKey),
    }))
    return
  }

  setShortcut(id, combo)
  stopCapture()
}

function resetShortcut(id: ShortcutActionId) {
  setShortcut(id, '')
}

function restoreAll() {
  settings.value.keyboardShortcuts = {}
}

function setOpenAction(field: 'keyboardEnterAction' | 'keyboardSpaceAction', value: KeyboardOpenAction) {
  settings.value[field] = value
}

onBeforeUnmount(stopCapture)
</script>

<template>
  <div>
    <SettingsItemGroup :title="t('settings.group_keyboard_open_mode')">
      <SettingsItem :title="t('settings.keyboard_enter_action')" :desc="t('settings.keyboard_open_mode_desc')">
        <Select
          :model-value="settings.keyboardEnterAction"
          :options="openActionOptions"
          w="full"
          @update:model-value="setOpenAction('keyboardEnterAction', $event as KeyboardOpenAction)"
        />
      </SettingsItem>
      <SettingsItem :title="t('settings.keyboard_space_action')" :desc="t('settings.keyboard_open_mode_desc')">
        <Select
          :model-value="settings.keyboardSpaceAction"
          :options="openActionOptions"
          w="full"
          @update:model-value="setOpenAction('keyboardSpaceAction', $event as KeyboardOpenAction)"
        />
      </SettingsItem>
    </SettingsItemGroup>

    <SettingsItemGroup :title="t('settings.group_keyboard_shortcuts')">
      <div
        v-for="action in SHORTCUT_ACTIONS"
        :key="action.id"
        class="keyboard-shortcut-row"
      >
        <span class="keyboard-shortcut-label">{{ t(action.labelKey) }}</span>
        <div class="keyboard-shortcut-actions">
          <button
            class="keyboard-key-btn"
            :class="{ capturing: capturing === action.id }"
            @click="capturing === action.id ? stopCapture() : startCapture(action.id)"
          >
            {{ capturing === action.id
              ? t('settings.keyboard_press_key')
              : (shortcutOf(action.id) ? formatCombo(shortcutOf(action.id)) : t('settings.keyboard_disabled')) }}
          </button>
          <button
            v-if="settings.keyboardShortcuts[action.id]"
            class="keyboard-reset-btn"
            :title="t('settings.keyboard_reset')"
            @click="resetShortcut(action.id)"
          >
            ↺
          </button>
        </div>
      </div>
      <div class="keyboard-restore">
        <button class="keyboard-restore-btn" @click="restoreAll">
          {{ t('settings.keyboard_restore_defaults') }}
        </button>
      </div>
    </SettingsItemGroup>
  </div>
</template>

<style lang="scss" scoped>
.keyboard-shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 9px 4px;
  border-bottom: 1px solid var(--bew-border-color);

  &:last-of-type {
    border-bottom: none;
  }
}

.keyboard-shortcut-label {
  color: var(--bew-text-1);
  font-size: 14px;
}

.keyboard-shortcut-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.keyboard-key-btn {
  min-width: 96px;
  padding: 4px 10px;
  border: 1px solid var(--bew-border-color);
  border-radius: 8px;
  background: var(--bew-fill-1);
  color: var(--bew-text-1);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--bew-theme-color);
  }

  &.capturing {
    border-color: var(--bew-theme-color);
    color: var(--bew-theme-color);
    background: var(--bew-theme-color-20);
  }
}

.keyboard-reset-btn {
  padding: 2px 6px;
  border: none;
  background: transparent;
  color: var(--bew-text-3);
  font-size: 14px;
  cursor: pointer;

  &:hover {
    color: var(--bew-theme-color);
  }
}

.keyboard-restore {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
}

.keyboard-restore-btn {
  padding: 6px 14px;
  border: 1px solid var(--bew-border-color);
  border-radius: 8px;
  background: var(--bew-fill-1);
  color: var(--bew-text-2);
  font-size: 12px;
  cursor: pointer;

  &:hover {
    border-color: var(--bew-theme-color);
    color: var(--bew-theme-color);
  }
}
</style>
