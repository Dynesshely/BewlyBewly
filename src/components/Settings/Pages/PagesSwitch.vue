<script setup lang="ts">
/**
 * 带 aria-describedby 的开关（视觉与全局 Radio 一致）。
 *
 * 全局 Radio 把原生 checkbox 放在 label 里并用了 hidden 属性，无法把
 * aria-describedby 传给真正被读屏识别的 input；这里复用同样的外观，
 * 但用「视觉隐藏但仍可获得焦点」的方式隐藏 input，并把描述关联写在 input 上。
 *
 * 仅用于设置页需要说明文案关联的开关（第 24 轮新增的两个开关）。
 */
const props = defineProps<{
  /** 关联说明文案的元素 id（aria-describedby） */
  describedby?: string
  /** input 的 id（可选，便于外部 label / 测试定位） */
  inputId?: string
}>()

const model = defineModel<boolean>({ required: true })
</script>

<template>
  <label class="pages-switch">
    <input
      :id="props.inputId"
      v-model="model"
      class="pages-switch__input"
      type="checkbox"
      :aria-describedby="props.describedby"
    >
    <span class="pages-switch__track" />
  </label>
</template>

<style scoped lang="scss">
.pages-switch {
  --switch-width: 50px;
  --switch-height: 25px;
  --switch-border: 2px;

  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

/* 视觉隐藏但仍可获得焦点：读屏 / 键盘都能操作到真正的 checkbox */
.pages-switch__input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.pages-switch__track {
  position: relative;
  display: inline-block;
  box-sizing: border-box;
  width: var(--switch-width);
  height: var(--switch-height);
  border: var(--switch-border) solid var(--bew-border-color);
  border-radius: calc(var(--switch-height) / 2);
  background: var(--bew-fill-1);
}

.pages-switch__track::after {
  position: absolute;
  top: calc(0px - var(--switch-border) / 2);
  box-sizing: border-box;
  width: calc(var(--switch-height) - var(--switch-border));
  height: calc(var(--switch-height) - var(--switch-border));
  border: var(--switch-border) solid var(--bew-border-color);
  border-radius: calc(var(--switch-height) / 2);
  background: white;
  content: "";
}

.pages-switch__input:hover + .pages-switch__track {
  background: var(--bew-fill-2);
}

.pages-switch__input:active + .pages-switch__track::after {
  transform: scale(0.9);
}

.pages-switch__input:checked + .pages-switch__track {
  border-color: var(--bew-theme-color);
  background: var(--bew-theme-color-60);
}

.pages-switch__input:checked + .pages-switch__track::after {
  border-color: var(--bew-theme-color);
  transform: translateX(calc(var(--switch-width) - var(--switch-height)));
}

.pages-switch__input:focus-visible + .pages-switch__track {
  outline: 2px solid var(--bew-theme-color);
  outline-offset: 2px;
}

.pages-switch__track,
.pages-switch__track::after {
  transition:
    background-color var(--bew-motion-fast, 120ms) var(--bew-ease-out, ease),
    border-color var(--bew-motion-fast, 120ms) var(--bew-ease-out, ease),
    transform var(--bew-motion-fast, 120ms) var(--bew-ease-out, ease);
}

@media (prefers-reduced-motion: reduce) {
  .pages-switch__track,
  .pages-switch__track::after {
    transition: none;
  }
}

@media (forced-colors: active) {
  .pages-switch__track {
    border-color: ButtonText;
    background: ButtonFace;
  }

  .pages-switch__track::after {
    border-color: ButtonText;
    background: ButtonFace;
  }

  .pages-switch__input:checked + .pages-switch__track {
    border-color: Highlight;
    background: Highlight;
  }

  .pages-switch__input:checked + .pages-switch__track::after {
    border-color: Highlight;
  }

  .pages-switch__input:focus-visible + .pages-switch__track {
    outline-color: Highlight;
  }
}
</style>
