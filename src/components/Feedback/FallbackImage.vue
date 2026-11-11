<script setup lang="ts">
/**
 * 统一的图片加载失败占位（第 19 轮）。
 *
 * 由 `Picture.vue` 在 `<img>` error 后渲染，也可以单独用于自定义图片（如灯箱）。
 * 设计约束：
 * - 占位填充父容器（宽高 100%），父容器尺寸由调用方决定 —— 不改变原图占位，避免布局跳动；
 * - 虚线边框 + 图标，图标按媒体类型区分（图片 / 视频 / 头像）；
 * - 纯 CSS，无动画 / 无网络请求（reduced-motion 天然兼容）；
 * - 颜色只用 --bew-*：暗色下自动适配，prefers-contrast / forced-colors 下加深边界；
 * - 可读性：`role="img"` + `aria-label`，读屏能读到「图片加载失败」而不是空白。
 */
withDefaults(defineProps<{
  /** 媒体类型：决定图标与默认无障碍文案 */
  kind?: 'image' | 'video' | 'avatar'
  /** 可选文字（小尺寸场景建议不传，只显示图标） */
  text?: string
  /** 自定义无障碍名称 */
  ariaLabel?: string
}>(), {
  kind: 'image',
  text: '',
  ariaLabel: '',
})

const KIND_ICON: Record<'image' | 'video' | 'avatar', string> = {
  image: 'i-mingcute:image-line',
  video: 'i-mingcute:video-line',
  avatar: 'i-mingcute:user-3-line',
}

const KIND_LABEL: Record<'image' | 'video' | 'avatar', string> = {
  image: '图片加载失败',
  video: '视频封面加载失败',
  avatar: '头像加载失败',
}
</script>

<template>
  <span
    class="bewly-image-fallback"
    :class="[`is-${kind}`, { 'has-text': Boolean(text) }]"
    role="img"
    :aria-label="ariaLabel || KIND_LABEL[kind]"
  >
    <span class="bewly-image-fallback__icon" :class="KIND_ICON[kind]" aria-hidden="true" />
    <span v-if="text" class="bewly-image-fallback__text">{{ text }}</span>
  </span>
</template>

<style scoped lang="scss">
.bewly-image-fallback {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 100%;
  overflow: hidden;
  color: var(--bew-text-3);
  text-align: center;
  /* 虚线边框 + 半透明底：与「图片」明显区分，又不喧宾夺主 */
  background: var(--bew-fill-2);
  border: 1px dashed var(--bew-border-color);
  border-radius: inherit;
}

.bewly-image-fallback__icon {
  font-size: 24px;
  line-height: 1;
}

.bewly-image-fallback.is-avatar .bewly-image-fallback__icon {
  font-size: 16px;
}

.bewly-image-fallback.has-text .bewly-image-fallback__icon {
  font-size: 20px;
}

.bewly-image-fallback__text {
  max-width: 90%;
  overflow: hidden;
  font-size: 11px;
  line-height: 1.4;
  color: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* #region 暗色：虚线边框与图标抬一档（--bew-text-3 在暗色下只有约 4.5:1，图标按 3:1 也偏临界） */
.dark .bewly-image-fallback {
  color: var(--bew-text-2);
  border-color: var(--bew-text-4);
}

/* #region 高对比度 / 强制颜色 */
@media (prefers-contrast: more) {
  .bewly-image-fallback {
    color: var(--bew-text-2);
    border-color: var(--bew-text-3);
  }
}

@media (forced-colors: active) {
  .bewly-image-fallback {
    color: CanvasText;
    background: Canvas;
    border: 1px dashed CanvasText;
  }
}
/* #endregion */
</style>
