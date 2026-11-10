<script lang="ts" setup>
import { ref } from 'vue'
import { settings } from '~/logic'

import SearchQuickPanel from './components/SearchQuickPanel.vue'
import { useDirectPasteSetting } from './composables/useDirectPasteSetting'
import { useSearchI18n } from './i18n'
import { labelKeyForKind, parseDirectLink } from './utils/directLink'
import { openDirectLink } from './utils/navigation'

/**
 * 搜索起始页。
 *
 * 居中搜索栏 + 快捷入口（最近搜索 / 热门推荐词）+ BV 号与链接直达。
 * 页面内任意位置粘贴 BV 号或 B 站链接时，直接打开目标而不是塞进搜索框；
 * 该行为可用面板里的开关关掉（localStorage：bewly-search-direct-paste）。
 */
const { t } = useSearchI18n()
const directPasteEnabled = useDirectPasteSetting()

const pasteStatus = ref<string>('')
let pasteStatusTimer: ReturnType<typeof setTimeout> | null = null

function showPasteStatus(message: string) {
  pasteStatus.value = message
  if (pasteStatusTimer)
    clearTimeout(pasteStatusTimer)
  pasteStatusTimer = setTimeout(() => {
    pasteStatus.value = ''
  }, 2600)
}

/** 收起「已识别…」提示（Escape 立即清理，不等 2.6s 自动消失） */
function clearPasteStatus() {
  if (pasteStatusTimer) {
    clearTimeout(pasteStatusTimer)
    pasteStatusTimer = null
  }
  pasteStatus.value = ''
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !pasteStatus.value)
    return
  clearPasteStatus()
}

function handlePaste(event: ClipboardEvent) {
  if (!directPasteEnabled.value)
    return

  const target = parseDirectLink(event.clipboardData?.getData('text') ?? '')
  if (!target)
    return

  // 命中直达目标：阻止内容落进搜索框
  event.preventDefault()
  event.stopPropagation()
  openDirectLink(target)
  showPasteStatus(t('direct_navigate', {
    label: t(labelKeyForKind(target.kind)),
  }))
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  clearPasteStatus()
})
</script>

<template>
  <div class="search-start" @paste="handlePaste">
    <div class="search-start-main">
      <Logo
        v-if="settings.searchPageShowLogo"
        :size="180"
        :color="settings.searchPageLogoColor === 'white' ? 'white' : 'var(--bew-theme-color)'"
        :glow="settings.searchPageLogoGlow"
        class="search-start-logo"
      />
      <SearchBar
        :darken-on-focus="settings.searchPageDarkenOnSearchFocus"
        :blurred-on-focus="settings.searchPageBlurredOnSearchFocus"
        :focused-character="settings.searchPageSearchBarFocusCharacter"
      />
      <p class="search-start-hint">
        {{ t('keyboard_hint') }}
      </p>
      <p class="search-start-status" role="status" aria-live="polite">
        {{ pasteStatus }}
      </p>
    </div>

    <SearchQuickPanel class="search-start-panel" />
  </div>
</template>

<style scoped lang="scss">
.search-start {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  margin-top: 14vh;
  padding-bottom: 48px;
}

.search-start-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.search-start-logo {
  margin-bottom: 48px;
  z-index: 1;
}

.search-start-hint {
  margin: 16px 0 0;
  max-width: 550px;
  color: var(--bew-text-3);
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
}

.search-start-status {
  min-height: 18px;
  margin: 4px 0 0;
  color: var(--bew-theme-color);
  font-size: 12px;
  line-height: 1.5;
}

.search-start-panel {
  margin-top: 28px;
}

@media (max-width: 640px) {
  .search-start {
    margin-top: 8vh;
    padding-inline: 12px;
  }

  .search-start-logo {
    margin-bottom: 28px;
  }

  .search-start-hint {
    padding-inline: 8px;
  }

  .search-start-panel {
    margin-top: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .search-start * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
