<script setup lang="ts">
import type { MomentsDensity } from '../composables/useMomentsDensity'
import SkeletonBlock from '~/components/Feedback/SkeletonBlock.vue'

/**
 * 动态卡片骨架：用统一 Feedback/SkeletonBlock 拼装。
 *
 * 卡片外壳（边框 / 圆角 / 背景 / 密度间距）仍由本组件负责，
 * 灰块的尺寸 / 圆角 / 脉冲动画全部来自 SkeletonBlock（含 reduced-motion 降级）。
 */
const props = withDefaults(defineProps<{
  /** 转发卡片里的骨架更紧凑 */
  compact?: boolean
  /** 卡片密度：紧凑档骨架同步收窄 */
  density?: MomentsDensity
}>(), {
  compact: false,
  density: 'comfortable',
})

const isDense = computed(() => props.density === 'compact' && !props.compact)

const avatarSize = computed(() => {
  if (props.compact)
    return 28
  return isDense.value
    ? 36
    : 44
})

const mediaHeight = computed(() => (isDense.value
  ? 96
  : 120))
</script>

<template>
  <div
    class="moment-skeleton"
    :class="{ 'is-compact': compact, 'is-density-compact': isDense }"
    aria-hidden="true"
  >
    <SkeletonBlock
      class="moment-skeleton__avatar"
      :width="avatarSize"
      :height="avatarSize"
      :gap="0"
      circle
    />

    <div class="moment-skeleton__body">
      <div class="moment-skeleton__head">
        <SkeletonBlock :height="10" :radius="5" :width="120" />
        <SkeletonBlock :height="8" :radius="4" :width="64" />
      </div>

      <SkeletonBlock :height="10" :radius="5" />
      <SkeletonBlock :height="10" :radius="5" />
      <SkeletonBlock :height="10" :radius="5" width="62%" />

      <SkeletonBlock :height="mediaHeight" :radius="10" />

      <div class="moment-skeleton__stats">
        <SkeletonBlock :height="16" :radius="8" :width="54" />
        <SkeletonBlock :height="16" :radius="8" :width="54" />
        <SkeletonBlock :height="16" :radius="8" :width="54" />
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

.moment-skeleton.is-density-compact {
  gap: 10px;
  padding: 12px 16px;
}

.moment-skeleton__avatar {
  flex: none;
}

.moment-skeleton__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.moment-skeleton.is-density-compact .moment-skeleton__body {
  gap: 8px;
}

.moment-skeleton__head {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.moment-skeleton__stats {
  display: flex;
  gap: 12px;
}
</style>
