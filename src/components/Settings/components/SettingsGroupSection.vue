<script setup lang="ts">
/**
 * 设置分组卡片（通用）。
 *
 * 与 SettingsItemGroup 的视觉完全一致，额外提供：
 *   - 分组标题行右侧的「重置本组」按钮（可选）；
 *   - 分组根节点上的 \`data-settings-group\` 标记，供设置页的分组导航做滚动定位与高亮；
 *   - 重置反馈文案（父组件控制何时显示「已重置」）。
 *
 * 只负责展示与事件，不关心具体字段：重置逻辑由使用方决定。
 */
const props = withDefaults(defineProps<{
  /** 分组标识：写到根节点 data-settings-group，导航按它定位 */
  groupKey: string
  title?: string
  desc?: string
  /** 是否显示「重置本组」按钮 */
  showReset?: boolean
  resetLabel?: string
  resetDoneLabel?: string
  /** 刚重置过：按钮短暂切换成「已重置」 */
  resetDone?: boolean
}>(), {
  title: '',
  desc: '',
  showReset: true,
  resetLabel: 'Reset group',
  resetDoneLabel: 'Reset done',
  resetDone: false,
})

const emit = defineEmits<{ (e: 'reset'): void }>()

function onReset() {
  if (props.resetDone)
    return
  emit('reset')
}
</script>

<template>
  <section
    :data-settings-group="groupKey"
    class="b-settings-group"
  >
    <div class="b-settings-group__head">
      <div class="b-settings-group__titles">
        <p text="base $bew-text-1" fw-bold>
          {{ title }}
        </p>
        <p v-if="desc" text="sm $bew-text-2">
          {{ desc }}
        </p>
      </div>

      <button
        v-if="showReset"
        type="button"
        class="b-settings-group__reset"
        :class="{ 'is-done': resetDone }"
        :aria-label="resetDone ? resetDoneLabel : resetLabel"
        @click="onReset"
      >
        {{ resetDone ? resetDoneLabel : resetLabel }}
      </button>
    </div>

    <main
      style="box-shadow: var(--bew-shadow-edge-glow-1), var(--bew-shadow-1);"
      mt-2 px-4 mx--4 rounded="$bew-radius"
      bg="$bew-fill-alt"
      shadow="$bew-shadow-edge-glow-1"
    >
      <slot />
    </main>
  </section>
</template>

<style lang="scss" scoped>
.b-settings-group {
  // 顶部有设置面板标题条（80px）+ 吸顶的导航 / 搜索工具栏（约 92px），滚动定位时留出这段空间
  scroll-margin-top: 172px;
}

.b-settings-group + .b-settings-group {
  margin-top: 1.5rem;
}

.b-settings-group__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.b-settings-group__titles {
  min-width: 0;
}

.b-settings-group__reset {
  flex: none;
  padding: 0.125rem 0.625rem;
  border: 1px solid var(--bew-border-color);
  border-radius: 999px;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--bew-text-2);
  background: var(--bew-fill-1);
  cursor: pointer;
  transition:
    color var(--bew-motion-fast, 120ms) var(--bew-ease-out, ease),
    background-color var(--bew-motion-fast, 120ms) var(--bew-ease-out, ease);
}

.b-settings-group__reset:hover {
  color: var(--bew-theme-color);
  background: var(--bew-fill-2);
}

.b-settings-group__reset:focus-visible {
  outline: 2px solid var(--bew-theme-color);
  outline-offset: 2px;
}

.b-settings-group__reset.is-done {
  color: var(--bew-theme-color);
  border-color: var(--bew-theme-color-40, var(--bew-theme-color));
}

@media (prefers-reduced-motion: reduce) {
  .b-settings-group__reset {
    transition: none;
  }
}
</style>
