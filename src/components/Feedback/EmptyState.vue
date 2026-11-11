<script setup lang="ts">
/**
 * 统一空态组件。
 *
 * 视觉沿用列表页原来的「圆环 + 图标」画法（纯 CSS，不引入插画资源），
 * 结构为「图形 / 标题 / 说明 / 操作」四段，任何一段缺失就自动收起。
 *
 * - 默认挂 role="status" + aria-live="polite"，读屏会在空态出现时播报；
 * - compact 用于面板内的小空态（如搜索起始页的最近搜索），不渲染圆环、横向排布；
 * - 主按钮等操作通过默认插槽传入，组件只负责可达性与键盘焦点样式。
 */
withDefaults(defineProps<{
  title?: string
  description?: string
  /** 图标类名（UnoCSS / Iconify），默认收件箱 */
  icon?: string
  /** 面板内小空态：无圆环、横向、文本靠左 */
  compact?: boolean
  /** 是否使用 role=status + aria-live（默认开；父级已有 live region 时可关） */
  live?: boolean
}>(), {
  title: '',
  description: '',
  icon: 'i-mingcute:inbox-line',
  compact: false,
  live: true,
})
</script>

<template>
  <div
    v-if="!compact"
    class="feedback-state"
    :role="live ? 'status' : undefined"
    :aria-live="live ? 'polite' : undefined"
  >
    <div class="feedback-state__art" aria-hidden="true">
      <span class="feedback-state__ring" />
      <span class="feedback-state__ring feedback-state__ring--inner" />
      <span class="feedback-state__icon" :class="icon" />
    </div>

    <p v-if="title" class="feedback-state__title">
      {{ title }}
    </p>
    <p v-if="description" class="feedback-state__desc">
      {{ description }}
    </p>

    <div v-if="$slots.default" class="feedback-state__actions">
      <slot />
    </div>
  </div>

  <div
    v-else
    class="feedback-state is-compact"
    :role="live ? 'status' : undefined"
    :aria-live="live ? 'polite' : undefined"
  >
    <span class="feedback-state__compact-icon" :class="icon" aria-hidden="true" />
    <div class="feedback-state__compact-text">
      <p v-if="title" class="feedback-state__title">
        {{ title }}
      </p>
      <p v-if="description" class="feedback-state__desc">
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.default" class="feedback-state__actions">
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
.feedback-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 16px;
  text-align: center;
}

.feedback-state.is-compact {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  text-align: left;
}

.feedback-state__art {
  position: relative;
  display: grid;
  width: 96px;
  height: 96px;
  margin-bottom: 4px;
  place-items: center;
}

.feedback-state__ring {
  position: absolute;
  inset: 0;
  border: 1px dashed var(--bew-fill-3);
  border-radius: 50%;
  animation: feedback-state-ring-spin 28s linear infinite;
}

.feedback-state__ring--inner {
  inset: 14px;
  border-style: solid;
  border-color: var(--bew-fill-2);
  animation-direction: reverse;
  animation-duration: 20s;
}

.feedback-state__icon {
  position: relative;
  z-index: 1;
  font-size: 34px;
  color: var(--bew-theme-color);
}

.feedback-state__compact-icon {
  flex: none;
  font-size: 16px;
  color: var(--bew-text-3);
}

.feedback-state__compact-text {
  min-width: 0;
}

.feedback-state__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--bew-text-1);
  text-wrap: balance;
}

.feedback-state.is-compact .feedback-state__title {
  font-size: 12px;
  font-weight: 600;
}

.feedback-state__desc {
  max-width: 46ch;
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--bew-text-3);
}

.feedback-state.is-compact .feedback-state__desc {
  max-width: none;
}

.feedback-state__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 4px;
}

.feedback-state.is-compact .feedback-state__actions {
  flex: none;
  margin-top: 0;
}

/* 插槽里的按钮：统一焦点样式（不覆盖各页自己的按钮外观） */
.feedback-state__actions :deep(button),
.feedback-state__actions :deep(a) {
  cursor: pointer;
}

.feedback-state__actions :deep(button:focus-visible),
.feedback-state__actions :deep(a:focus-visible) {
  outline: 2px solid var(--bew-theme-color);
  outline-offset: 2px;
}

@keyframes feedback-state-ring-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .feedback-state__ring {
    animation: none;
  }
}
</style>
