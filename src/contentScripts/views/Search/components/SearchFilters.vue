<script setup lang="ts">
/**
 * 筛选栏：排序（5 档）/ 时长（5 档）/ 一级分区（19 + 全部）。
 *
 * 取值与真机验证过的接口 / 原生 URL 参数一一对应（见 constants.ts）：
 *   order=totalrank|click|pubdate|dm|stow
 *   duration=''|1|2|3|4
 *   tids_1=<一级分区 id>
 *
 * 组件本身不拉数据，选中即 emit，父组件负责重置到第 1 页并重拉。
 * 排序 / 时长用 chip 行（与空间页 tab 同一套视觉），分区 19 个选项用原生 select
 * （chip 会占掉两整行，且 select 天然带键盘与读屏支持，浮层里也不会被 overflow 裁掉）。
 */
import type { SearchDurationId, SearchOrderId } from '../constants'
import { SEARCH_TIDS } from '../constants'
import { useSearchDrawnI18n } from '../searchDrawnI18n'

defineProps<{
  order: SearchOrderId
  duration: SearchDurationId
  tid: string
}>()

const emit = defineEmits<{
  (e: 'changeOrder', order: SearchOrderId): void
  (e: 'changeDuration', duration: SearchDurationId): void
  (e: 'changeTid', tid: string): void
}>()

const { t } = useSearchDrawnI18n()

const orderOptions = computed<{ id: SearchOrderId, label: string }[]>(() => [
  { id: 'totalrank', label: t.value.orderTotalrank },
  { id: 'click', label: t.value.orderClick },
  { id: 'pubdate', label: t.value.orderPubdate },
  { id: 'dm', label: t.value.orderDm },
  { id: 'stow', label: t.value.orderStow },
])

const durationOptions = computed<{ id: SearchDurationId, label: string }[]>(() => [
  { id: '', label: t.value.durationAll },
  { id: '1', label: t.value.durationShort },
  { id: '2', label: t.value.durationMedium },
  { id: '3', label: t.value.durationLong },
  { id: '4', label: t.value.durationXlong },
])

function handleTidChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('changeTid', value)
}
</script>

<template>
  <section class="search-filters" :aria-label="t.filtersAria">
    <div class="search-filters__row">
      <span class="search-filters__label">{{ t.orderLabel }}</span>
      <div class="search-filters__chips" role="group" :aria-label="t.orderLabel">
        <button
          v-for="option in orderOptions"
          :key="option.id"
          class="search-filters__chip"
          :class="{ 'is-active': option.id === order }"
          type="button"
          :aria-pressed="option.id === order"
          @click="emit('changeOrder', option.id)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div class="search-filters__row">
      <span class="search-filters__label">{{ t.durationLabel }}</span>
      <div class="search-filters__chips" role="group" :aria-label="t.durationLabel">
        <button
          v-for="option in durationOptions"
          :key="option.id || 'all'"
          class="search-filters__chip"
          :class="{ 'is-active': option.id === duration }"
          type="button"
          :aria-pressed="option.id === duration"
          @click="emit('changeDuration', option.id)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div class="search-filters__row search-filters__row--select">
      <label class="search-filters__label" for="bewly-search-tid">{{ t.tidLabel }}</label>
      <div class="search-filters__select">
        <select
          id="bewly-search-tid"
          :value="tid"
          @change="handleTidChange"
        >
          <option value="">
            {{ t.tidAll }}
          </option>
          <option v-for="option in SEARCH_TIDS" :key="option.id" :value="String(option.id)">
            {{ option.name }}
          </option>
        </select>
        <span class="search-filters__select-arrow i-mingcute:down-line" aria-hidden="true" />
      </div>
    </div>
  </section>
</template>
