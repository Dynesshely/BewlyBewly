<script setup lang="ts">
/**
 * 统一错误态组件。
 *
 * 结构：错误图标 + 标题 + 可选接口 message + 重试按钮（也可用默认插槽完全自定义操作）。
 * - 默认 role="alert" + aria-live="assertive"：错误出现时读屏立即播报；
 * - 重试按钮是原生 button，带 aria-label（重试文案）与 focus-visible 描边；
 * - 视觉只用 --bew-* 变量，暗色自动跟随；reduced-motion 下不做任何位移 / 脉冲动画。
 */
withDefaults(defineProps<{
  title?: string
  /** 接口返回的错误信息（可选，长文本会自动换行） */
  message?: string
  /** 错误图标类名，默认断网图标 */
  icon?: string
  /** 是否显示重试按钮（无重试能力时设 false） */
  retryable?: boolean
  retryLabel?: string
  /** 是否使用 role=alert + aria-live（默认开） */
  live?: boolean
  /**
   * 二级出路的说明文字（第 106 轮）。
   *
   * 只有「重试」时，用户遇到反复失败的接口会陷在「重试 → 还是失败」里，
   * 不知道该换个走法。页面向本组件传入一段说明（例如「重试还是不行？
   * 可以在原版页面打开，或换个数据源」），渲染在按钮上方作为引导；
   * 具体按钮仍由默认插槽提供，组件只负责排版与可达性。
   */
  fallbackHint?: string
}>(), {
  title: '',
  message: '',
  icon: 'i-tabler:cloud-off',
  retryable: true,
  retryLabel: 'Retry',
  live: true,
  fallbackHint: '',
})

defineEmits<{ (e: 'retry'): void }>()
</script>

<template>
  <div
    class="feedback-error"
    :role="live ? 'alert' : undefined"
    :aria-live="live ? 'assertive' : undefined"
  >
    <div class="feedback-error__art" aria-hidden="true">
      <span class="feedback-error__ring" />
      <span class="feedback-error__icon" :class="icon" />
    </div>

    <p v-if="title" class="feedback-error__title">
      {{ title }}
    </p>
    <p v-if="message" class="feedback-error__message">
      {{ message }}
    </p>

    <p v-if="fallbackHint" class="feedback-error__hint">
      {{ fallbackHint }}
    </p>

    <div v-if="retryable || $slots.default" class="feedback-error__actions">
      <button
        v-if="retryable"
        type="button"
        class="feedback-error__retry"
        :aria-label="retryLabel"
        @click="$emit('retry')"
      >
        <span class="i-tabler:refresh" aria-hidden="true" />
        <span>{{ retryLabel }}</span>
      </button>
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
.feedback-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 16px;
  text-align: center;
}

.feedback-error__art {
  position: relative;
  display: grid;
  width: 88px;
  height: 88px;
  margin-bottom: 2px;
  border-radius: 50%;
  background: var(--bew-fill-1);
  border: 1px dashed var(--bew-border-color);
  place-items: center;
}

.feedback-error__ring {
  position: absolute;
  inset: 12px;
  border: 1px solid var(--bew-fill-2);
  border-radius: 50%;
}

.feedback-error__icon {
  position: relative;
  z-index: 1;
  font-size: 32px;
  color: var(--bew-error-color);
}

.feedback-error__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--bew-text-1);
  text-wrap: balance;
}

.feedback-error__message {
  max-width: 52ch;
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--bew-text-3);
  overflow-wrap: anywhere;
}

.feedback-error__hint {
  max-width: 52ch;
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--bew-text-2);
  text-wrap: pretty;
}

.feedback-error__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 4px;
}

.feedback-error__retry {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--bew-border-color);
  border-radius: 999px;
  background: var(--bew-fill-1);
  color: var(--bew-text-1);
  font-size: 12px;
  line-height: 1.5;
  cursor: pointer;
  transition:
    color var(--bew-motion-fast, 120ms) var(--bew-ease-out, ease),
    background-color var(--bew-motion-fast, 120ms) var(--bew-ease-out, ease),
    border-color var(--bew-motion-fast, 120ms) var(--bew-ease-out, ease);
}

.feedback-error__retry:hover {
  color: var(--bew-theme-color);
  background: var(--bew-fill-2);
  border-color: var(--bew-theme-color-40);
}

.feedback-error__retry:focus-visible {
  outline: 2px solid var(--bew-theme-color);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .feedback-error__retry {
    transition: none;
  }
}

/* #region 窄屏适配（第 17 轮） */
@media (max-width: 640px) {
  .feedback-error {
    padding: 32px 12px;
  }

  .feedback-error__hint {
    font-size: 12px;
  }

  .feedback-error__art {
    width: 76px;
    height: 76px;
  }

  .feedback-error__title {
    font-size: 15px;
  }

  .feedback-error__message {
    word-break: break-word;
  }

  .feedback-error__actions {
    width: 100%;
    justify-content: center;
  }
}
/* #endregion */

/* #region 暗色 / 高对比度（第 17 轮） */
.dark .feedback-error__message {
  color: var(--bew-text-2);
}

@media (prefers-contrast: more) {
  .feedback-error__art,
  .feedback-error__ring,
  .feedback-error__retry {
    border-color: var(--bew-text-3);
  }

  .feedback-error__message {
    color: var(--bew-text-2);
  }
}
/* #endregion */
</style>
