<script setup lang="ts">
withDefaults(defineProps<{
  /** 转发卡片里的骨架更紧凑 */
  compact?: boolean
}>(), {
  compact: false,
})
</script>

<template>
  <div class="moment-skeleton" :class="{ 'is-compact': compact }" aria-hidden="true">
    <div class="moment-skeleton__avatar" />
    <div class="moment-skeleton__body">
      <div class="moment-skeleton__head">
        <span class="moment-skeleton__line is-name" />
        <span class="moment-skeleton__line is-time" />
      </div>
      <span class="moment-skeleton__line" />
      <span class="moment-skeleton__line" />
      <span class="moment-skeleton__line is-short" />
      <div class="moment-skeleton__media" />
      <div class="moment-skeleton__stats">
        <span class="moment-skeleton__pill" />
        <span class="moment-skeleton__pill" />
        <span class="moment-skeleton__pill" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.moment-skeleton {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border: 1px solid var(--bew-border-color);
  border-radius: var(--bew-radius);
  background: var(--bew-elevated);
}

.moment-skeleton.is-compact {
  padding: 0;
  border: 0;
  background: transparent;
}

.moment-skeleton__avatar {
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--bew-skeleton);
  animation: moment-skeleton-pulse 1.6s ease-in-out infinite;
}

.moment-skeleton.is-compact .moment-skeleton__avatar {
  width: 28px;
  height: 28px;
}

.moment-skeleton__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.moment-skeleton__head {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.moment-skeleton__line {
  display: block;
  width: 100%;
  height: 10px;
  border-radius: 5px;
  background: var(--bew-skeleton);
  animation: moment-skeleton-pulse 1.6s ease-in-out infinite;

  &.is-name {
    width: 120px;
  }

  &.is-time {
    width: 64px;
    height: 8px;
  }

  &.is-short {
    width: 62%;
  }
}

.moment-skeleton__media {
  height: 120px;
  border-radius: 10px;
  background: var(--bew-skeleton);
  animation: moment-skeleton-pulse 1.6s ease-in-out infinite;
}

.moment-skeleton__stats {
  display: flex;
  gap: 12px;
}

.moment-skeleton__pill {
  width: 54px;
  height: 16px;
  border-radius: 8px;
  background: var(--bew-skeleton);
  animation: moment-skeleton-pulse 1.6s ease-in-out infinite;
}

@keyframes moment-skeleton-pulse {
  0%,
  100% {
    opacity: 0.55;
  }

  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .moment-skeleton__avatar,
  .moment-skeleton__line,
  .moment-skeleton__media,
  .moment-skeleton__pill {
    animation: none;
    opacity: 0.7;
  }
}
</style>
