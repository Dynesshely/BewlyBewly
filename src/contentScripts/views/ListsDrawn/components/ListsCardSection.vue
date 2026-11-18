<script setup lang="ts">
/**
 * 列表分组 + 卡片网格（三个页面共用）。
 *
 * 复用的东西一件都不重写：
 * - 网格 / 分组头 / 卡片外观的样式来自 `views/listShared/styles/listPage.scss`（页面里 import）；
 * - 单张卡片直接是 `listShared/components/ListVideoCard.vue`
 *   （内含 `~/components/VideoCard`、悬停快捷操作、观看进度条、时间轴列）；
 * - 本组件只做三件 listShared 没覆盖的事：
 *   1. 给每张卡套一个 `[data-bewly-list-card]` 容器：`useListVirtual` / `useListScrollMemory`
 *      靠这个属性做离屏优化与滚动位置记忆；
 *   2. 批量选择模式（稍后再看页）：左上角方框 + **整个卡片可点选中**，
 *      选择模式下点卡片不再跳转（capture 阶段拦截并 preventDefault）；
 *   3. 把卡片上的快捷操作事件原样往上抛。
 */
import type { ListCardItem, ListQuickActionId, ListViewMode } from '../../listShared/types'

import ListVideoCard from '../../listShared/components/ListVideoCard.vue'

const props = withDefaults(defineProps<{
  items: ListCardItem[]
  viewMode: ListViewMode
  label?: string
  count?: number
  /** 批量选择模式：显示每张卡左上角的方框，且点卡片=切换选中 */
  selectable?: boolean
  /** 已选 key（只在 selectable 时有意义） */
  selectedKeys?: string[]
  /** 是否禁用选择（写操作在途） */
  selectDisabled?: boolean
  /** 选择方框的无障碍名称（父级传 i18n 文案） */
  selectLabel?: string
}>(), {
  label: '',
  count: 0,
  selectable: false,
  selectedKeys: () => [],
  selectDisabled: false,
  selectLabel: 'Select',
})

const emit = defineEmits<{
  (e: 'action', payload: { id: ListQuickActionId, item: ListCardItem }): void
  (e: 'toggleSelect', key: string): void
}>()

const gridClass = computed(() => `bewly-list-grid bewly-list-grid--${props.viewMode}`)

function isSelected(key: string | number): boolean {
  return props.selectedKeys.includes(String(key))
}

/**
 * 选择模式下点卡片任意位置 = 切换选中，并且**不能**跳转。
 *
 * 用 capture 阶段拦截：卡片内部是 `<a>`（ALink），冒泡阶段再去 preventDefault 时
 * 浏览器的默认跳转已经排队了；capture 才能稳定吃掉。
 */
function handleCardClickCapture(event: MouseEvent, item: ListCardItem) {
  if (!props.selectable || props.selectDisabled)
    return
  event.preventDefault()
  event.stopPropagation()
  emit('toggleSelect', String(item.key))
}
</script>

<template>
  <section class="bewly-list-group">
    <h2 v-if="label" class="bewly-list-group__header">
      <span>{{ label }}</span>
      <span v-if="count > 0" class="bewly-list-group__count">{{ count }}</span>
    </h2>

    <div :class="gridClass">
      <div
        v-for="item in items"
        :key="item.key"
        class="lists-drawn-card"
        :class="{
          'is-select-mode': selectable,
          'is-selected': selectable && isSelected(item.key),
        }"
        :data-bewly-list-card="String(item.key)"
        @click.capture="handleCardClickCapture($event, item)"
      >
        <ListVideoCard :item="item" :view-mode="viewMode" @action="emit('action', $event)" />

        <button
          v-if="selectable"
          type="button"
          class="lists-drawn-select"
          :class="{ 'is-checked': isSelected(item.key) }"
          :disabled="selectDisabled"
          :aria-pressed="isSelected(item.key)"
          :aria-label="selectLabel"
          @click.stop.prevent="emit('toggleSelect', String(item.key))"
        >
          <span
            :class="isSelected(item.key) ? 'i-tabler:check' : 'i-tabler:square'"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  </section>
</template>
