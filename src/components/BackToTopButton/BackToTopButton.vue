<script setup lang="ts">
/**
 * 自绘页统一的「回到顶部 / 回到底部」浮动按钮。
 *
 * # 为什么抽成一个组件
 *
 * 首页有一份自己的回顶按钮（`views/Home/Home.vue` 里 40 行样式 + 30 行滚动逻辑），
 * 而第 93~103 轮改成的自绘页（空间 / 搜索 / 热门 / 分区 / 动态 / 消息）**一个都没有**：
 * 长列表滚到第 5 屏以后想回顶，只能一路把滚轮拖回去 —— 而 Home 键又被键盘卡片导航占用，
 * 用户得先想起来「这页没有回顶」。同一件事在 6 个页面上各写一遍必然出现 6 套阈值与样式，
 * 所以这里做一次：
 *
 * - 状态来自 `useBackToTopButton`（只读滚动容器自身的 scrollTop / clientHeight，两屏阈值）；
 * - 视觉只用 `--bew-*` 令牌，深浅主题自动跟随；`prefers-reduced-motion` 下不做位移；
 * - `Teleport` 到 `body`：自绘页的覆盖层宿主是 `pointer-events: none` 的 fixed 容器，
 *   留在里面会和宿主的层级 / 裁剪纠缠；挂到 body 上则与首页那份行为完全一致；
 * - 焦点环、aria-label、title 都带文案；用到 aria-live 的是「滚过两屏才出现」这件事本身
 *   不需要播报，所以只做视觉出现，不抢读屏。
 */
import { useBackToTopMessages } from './i18n'

withDefaults(defineProps<{
  /** 显示「回到顶部」 */
  showTop?: boolean
  /** 显示「回到底部」（不需要时不传） */
  showBottom?: boolean
  /** 右下角偏移，默认 24（与首页一致） */
  offset?: number
}>(), {
  showTop: false,
  showBottom: false,
  offset: 24,
})

const emit = defineEmits<{
  (e: 'top'): void
  (e: 'bottom'): void
}>()

const { t } = useBackToTopMessages()
</script>

<template>
  <Teleport to="body">
    <Transition name="bewly-btt-fade">
      <div
        v-if="showTop || showBottom"
        class="bewly-back-to-top"
        :style="{ right: `${offset}px`, bottom: `${offset}px` }"
      >
        <button
          v-if="showTop"
          type="button"
          class="bewly-back-to-top__btn"
          :aria-label="t.backToTop"
          :title="`${t.backToTop} · ${t.backToTopHint}`"
          @click="emit('top')"
        >
          <span class="i-tabler:arrow-up" aria-hidden="true" />
        </button>
        <button
          v-if="showBottom"
          type="button"
          class="bewly-back-to-top__btn is-ghost"
          :aria-label="t.backToBottom"
          :title="`${t.backToBottom} · ${t.backToBottomHint}`"
          @click="emit('bottom')"
        >
          <span class="i-tabler:arrow-down" aria-hidden="true" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.bewly-back-to-top {
  position: fixed;
  z-index: 96;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.bewly-back-to-top__btn {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--bew-theme-color);
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: var(--bew-shadow-2);
  transition:
    transform 180ms cubic-bezier(0.22, 0.61, 0.36, 1),
    box-shadow 180ms cubic-bezier(0.22, 0.61, 0.36, 1);

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--bew-shadow-3);
  }

  &:active {
    transform: scale(0.94);
  }

  &:focus-visible {
    outline: 2px solid var(--bew-theme-color);
    outline-offset: 3px;
  }

  /* 次要入口（回到底部）：不抢主按钮的视觉重量 */
  &.is-ghost {
    width: 36px;
    height: 36px;
    font-size: 17px;
    background: var(--bew-elevated);
    color: var(--bew-text-2);
    box-shadow: var(--bew-shadow-1);

    &:hover {
      color: var(--bew-theme-color);
      box-shadow: var(--bew-shadow-2);
    }
  }
}

/* 深浅主题：主按钮是主题色实心，暗色下描一圈更清楚 */
:global(.dark) .bewly-back-to-top__btn {
  box-shadow:
    var(--bew-shadow-2),
    0 0 0 1px color-mix(in oklab, #fff, transparent 88%);
}

@media (prefers-reduced-motion: reduce) {
  .bewly-back-to-top__btn {
    transition: none;

    &:hover,
    &:active {
      transform: none;
    }
  }
}

/* 高对比度：去掉阴影，改用描边 */
@media (prefers-contrast: more) {
  .bewly-back-to-top__btn {
    box-shadow: none;
    border: 2px solid currentcolor;
  }
}

.bewly-btt-fade-enter-active,
.bewly-btt-fade-leave-active {
  transition: opacity 160ms ease-out;
}

.bewly-btt-fade-enter-from,
.bewly-btt-fade-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .bewly-back-to-top__btn {
    width: 36px;
    height: 36px;
    font-size: 18px;
  }
}
</style>
