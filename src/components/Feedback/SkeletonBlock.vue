<script setup lang="ts">
/**
 * 统一骨架块。
 *
 * 只是一个「带圆角与占位色的灰块」，可配置行数 / 高度 / 宽度 / 圆角 / 间距 / 圆形，
 * 供各页原有骨架（列表卡片、动态卡片、任意占位）拼装使用；不承担布局。
 *
 * - 纯展示元素：根节点固定 aria-hidden="true"，不进入读屏树；
 * - 颜色用 --bew-skeleton（暗色自动跟随），动画为透明度脉冲；
 * - prefers-reduced-motion: reduce 下关闭动画并保留静态占位色。
 */
const props = withDefaults(defineProps<{
  /** 行数（每行一个等高占位块） */
  rows?: number
  /** 单行高度：数字按 px，字符串原样使用 */
  height?: number | string
  /** 宽度：数字按 px，字符串原样使用 */
  width?: number | string
  /** 圆角：数字按 px，字符串原样使用 */
  radius?: number | string
  /** 多行之间的间距：数字按 px，字符串原样使用 */
  gap?: number | string
  /** 圆形占位（头像 / 圆点）：圆角固定 50% */
  circle?: boolean
  /** 是否播放脉冲动画（默认开；静态占位可关） */
  animated?: boolean
}>(), {
  rows: 1,
  height: 12,
  width: '100%',
  radius: 8,
  gap: 8,
  circle: false,
  animated: true,
})

function toCssSize(value: number | string): string {
  return typeof value === 'number'
    ? `${value}px`
    : value
}

const rowStyle = computed<Record<string, string>>(() => ({
  height: toCssSize(props.height),
  width: toCssSize(props.width),
  borderRadius: props.circle
    ? '50%'
    : toCssSize(props.radius),
}))

const wrapperStyle = computed<Record<string, string>>(() => ({
  gap: toCssSize(props.gap),
}))
</script>

<template>
  <div
    class="feedback-skeleton"
    :class="{ 'is-animated': animated }"
    :style="wrapperStyle"
    aria-hidden="true"
  >
    <span
      v-for="row in Math.max(1, rows)"
      :key="row"
      class="feedback-skeleton__row"
      :style="rowStyle"
    />
  </div>
</template>

<style scoped lang="scss">
.feedback-skeleton {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.feedback-skeleton__row {
  display: block;
  flex: none;
  background: var(--bew-skeleton);
}

.feedback-skeleton.is-animated .feedback-skeleton__row {
  animation: feedback-skeleton-pulse 1.6s ease-in-out infinite;
}

@keyframes feedback-skeleton-pulse {
  0%,
  100% {
    opacity: 0.55;
  }

  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .feedback-skeleton.is-animated .feedback-skeleton__row {
    animation: none;
    opacity: 0.7;
  }
}

/* #region 窄屏适配（第 17 轮） */
@media (max-width: 640px) {
  .feedback-skeleton__row {
    border-radius: 6px;
  }
}
/* #endregion */

/* #region 暗色 / 高对比度（第 17 轮） */
.dark .feedback-skeleton__row {
  /* 暗色下 --bew-skeleton（fill-2 30%）与页面底色只有约 1.52:1，占位块几乎看不见；
     混入次要文字色后约 1.87:1（prefers-contrast 下约 2.6:1）。骨架是装饰元素，
     不满足 3:1 也合规，但至少要能辨认出「正在加载」 */
  background: color-mix(in oklab, var(--bew-skeleton), var(--bew-text-3) 22%);
}

@media (prefers-contrast: more) {
  .feedback-skeleton__row {
    background: color-mix(in oklab, var(--bew-skeleton), var(--bew-text-2) 35%);
  }
}
/* #endregion */
</style>
